/**
 * useAdminInvoice
 *
 * Central orchestration hook for the Admin Invoicing workflow.
 *
 * This hook owns:
 * - The active invoice filter state (date range, billing status, billable-only toggle)
 * - Fetching invoice-ready time and material data for the admin view
 * - Coordination of the full billing flow per company:
 *   - Creating invoices in Fortnox
 *   - Generating and queuing worklog PDFs
 *   - Locking and marking time reports and material items as billed
 * - Fetching and managing generated PDFs (preview, download, resend)
 * - Fetching customer email preferences and sending PDFs to customers
 *
 * Key behaviors:
 * - Initializes with the current calendar month by default
 * - Fetches Fortnox connection status in parallel with invoice data
 * - Prevents duplicate fetches for identical filter states
 * - Executes the billing process in ordered phases with detailed progress and logging
 * - Ensures locking of hours/items only occurs after successful invoice + PDF creation
 * - Aggregates per-company results into a unified progress and result model
 *
 * The hook is intentionally backend-driven:
 * all invoice creation, validation, locking, and PDF generation logic
 * is handled server-side. The frontend acts as a thin orchestration layer
 * responsible only for state management, user interaction, and progress feedback.
 *
 * Authentication is cookie-based:
 * no access tokens are handled in the frontend. Session refresh and retry
 * logic is handled centrally by the Axios interceptor.
 *
 * Intended usage:
 *   const {
 *     env,
 *     customers,
 *     status,
 *     setStatus,
 *     range,
 *     setRange,
 *     onProceedSelected,
 *     generatePdfselected,
 *     handlePDFPreview,
 *     handlePDFDownload
 *   } = useAdminInvoice();
 */


import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminInvoiceService } from "../services/AdminInvoiceservice";
import type {
  CollectAllEnvelope,
  CollectAllCustomer,
  BillingEnvelope,
  ProceedOptions,
  PdfGlobalOptions,
  PdfRowOptionWithOverrides,
  WorklogGenerateRequest,
  WorklogGenerateResponse,
  CustomersSendPrefs,
  SendPdfConfirmPayload,
} from "../models/Invoice";
import {
  getLastDayOfCurrentMonth,
  getThisMonthRange,
} from "../helpers/dateHelpers";
import { buildForSelection } from "../helpers/fortnoxBuilders";
import { FortnoxService } from "../services/FortnoxService";
import { buildWorklogGeneratePayload } from "../helpers/pdfBuilder";
import {
  pushLog,
  normalizeFortnoxError,
  type ProceedResult,
  type ProceedLog,
} from "../helpers/proceedLogging";
import { useAutoRefreshChanges } from "../hooks/useAutoRefreshChanges";


const thisMonth = getThisMonthRange();
type Range = { start?: string; end?: string };
type Status = "unbilled" | "billed" | "all";

const {
  collectAllInvoiceData,
  createWorklogPdf,
  getAllPdfInRange,
  getCustomerSendPrefs,
  getDownloadPdf,
  getPreviewPdf,
  lockAndMarkBilled,
  lockAndMarkItems,
  sendInvoiceToFortKnox,
  sendPdfToCustomer,
  sendToWorklogPdfQueue,
} = AdminInvoiceService;

export const useAdminInvoice = () => {
  const initialRange: Range = { start: thisMonth.from, end: thisMonth.to };

  const [status, setStatus] = useState<Status>("unbilled");
  const [onlyBillable, setOnlyBillable] = useState<boolean>(true);
  const [env, setEnv] = useState<CollectAllEnvelope | null>(null);
  const [customers, setCustomers] = useState<CollectAllCustomer[]>([]);
  const [range, setRange] = useState<Range>(initialRange);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);

  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [results, setResults] = useState<WorklogGenerateResponse[]>([]);

  const [customersSendPrefs, setCustomersSendPrefs] =
    useState<CustomersSendPrefs>({ emails: [], language: "" });

  const ToPdfResult = useMemo(
    () => ({ resultModalOpen, setResultModalOpen, results }),
    [resultModalOpen, results]
  );

  const lastFetchedKeyRef = useRef<string | null>(null);

  const fetchData = useCallback(
    async (r: Range = range) => {
      const key = `${r.start ?? ""}|${r.end ?? ""}|${status}|${
        onlyBillable ? 1 : 0
      }`;
      if (lastFetchedKeyRef.current === key) return;
      lastFetchedKeyRef.current = key;

      setLoading(true);
      setError(null);

      try {
        const [s, next] = await Promise.all([
          FortnoxService.getStatus(),
          collectAllInvoiceData({
            start: r.start ?? "",
            end: r.end ?? "",
            status,
            onlyBillable,
          }),
        ]);

        setNeedsReauth(!!s?.needsReauth);
        setEnv(next);
        setCustomers(Array.isArray(next?.customers) ? next.customers : []);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setLoading(false);
      }
    },
    [range, status, onlyBillable]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = () => {
    lastFetchedKeyRef.current = null;
    fetchData({ start: range.start, end: range.end });
  };

  const getLatestMs = useCallback(async () => {
    const r = { start: range.start ?? "", end: range.end ?? "" };

    // Du kan välja om status/onlyBillable ska påverka "changes"-nyckeln
    // (rekommenderas: ja, så att den bara refreshar när just denna vy har ändringar)
    const res = await AdminInvoiceService.getChanges({
      start: r.start,
      end: r.end,
      status,
      onlyBillable,
    });

    return res?.latestMs ?? null;
  }, [range.start, range.end, status, onlyBillable]);

 const onAutoRefresh = useCallback(async () => {
  refetch();
}, [refetch]);


  const auto = useAutoRefreshChanges({
    getLatestMs,
    onRefresh: onAutoRefresh,
    options: { intervalMs: 15_000 },
  });

  // När filter ändras: reset baseline så första poll bara "synkar" och inte trigger refresh direkt
  useEffect(() => {
    auto.resetBaseline();
  }, [range.start, range.end, status, onlyBillable]);

  const handleInvoiceTarget = async () => {
    // Placeholder for future invoice target selection logic (e.g. select a customer/company as target).
    return;
  };

  const onProceedSelected = async (
    rows: BillingEnvelope[],
    opts?: ProceedOptions,
    onProgress?: (v: number, label?: string) => void
  ): Promise<ProceedResult> => {
    const logs: ProceedLog[] = [];

    const report = (done: number, total: number, label?: string) => {
      if (!onProgress) return;
      const pct = total <= 0 ? 0 : Math.round((done / total) * 100);
      onProgress(pct, label);
    };

    const extractFortnoxError = (src: any) => {
      const body =
        src?.response?.data ?? src?.response ?? src?.error ?? src ?? null;
      const code =
        body?.ErrorInformation?.code ??
        body?.error ??
        body?.id ??
        src?.code ??
        undefined;
      const message =
        body?.ErrorInformation?.message ??
        body?.message ??
        src?.message ??
        "Unknown Fortnox error";
      return { message: String(message), code, body };
    };

    const perRowUnits = rows.map((r) => {
      const a = r.locks?.timeReportIds?.length ? 1 : 0;
      const b = r.locks?.timeReportItemIds?.length ? 1 : 0;
      return 1 + a + b;
    });
    const totalUnits = 1 + perRowUnits.reduce((s, n) => s + n, 0);
    let doneUnits = 0;

    pushLog(logs, {
      level: "info",
      step: "prepare",
      message: "Preparing payloads…",
    });
    report(doneUnits, totalUnits, "Preparing payloads…");

    const payloads = buildForSelection(rows, {
      laborArticleNo: import.meta.env.VITE_LABOR_ARTICLE_NO,
      materialArticleNo: import.meta.env.VITE_MATERIAL_ARTICLE_NO,
      includeCustomItems: false,
      invoiceDate: opts?.invoiceDate || getLastDayOfCurrentMonth(),
      dueInDays: 30,
    });
    console.log(payloads);
    

    if (!payloads.length) {
      pushLog(logs, { level: "info", step: "final", message: "Nothing to do." });
      report(totalUnits, totalUnits, "Nothing to do");
      return {
        logs,
        summary: {
          createdCount: 0,
          lockedHoursCount: 0,
          lockedItemsCount: 0,
          pdfQueuedCount: 0,
          errorCount: 0,
        },
      };
    }

    pushLog(logs, {
      level: "info",
      step: "create-invoices",
      message: `Creating invoices in Fortnox… (${payloads.length})`,
    });
    report(doneUnits, totalUnits, "Creating invoices in Fortnox…");

    let createdCount = 0;
    let errorCount = 0;
    let res: any;

    try {
      res = await sendInvoiceToFortKnox(payloads);

      createdCount = Array.isArray(res?.ok) ? res.ok.length : 0;

      const failed = Array.isArray(res?.failed) ? res.failed : [];
      if (failed.length) {
        for (const f of failed) {
          const companyId = f?.envelopeCompanyId as number | undefined;
          const company =
            companyId != null
              ? rows.find((r) => r.company.id === companyId)?.company.name
              : undefined;

          const fe = extractFortnoxError(f);
          errorCount += 1;

          pushLog(logs, {
            level: "error",
            step: "create-invoices",
            companyId,
            company,
            message: `Invoice creation failed${
              company ? ` for ${company}` : ""
            }: ${fe.message}`,
            meta: { code: fe.code, body: fe.body },
          });
        }
      }

      pushLog(logs, {
        level: "success",
        step: "create-invoices",
        message: `Invoices created: ${createdCount}`,
        meta: { ok: res?.ok?.length ?? 0, failed: res?.failed?.length ?? 0 },
      });
    } catch (e) {
      const err = normalizeFortnoxError(e);
      errorCount += 1;
      pushLog(logs, {
        level: "error",
        step: "create-invoices",
        message: `Failed to create invoices: ${err.message}`,
        meta: err,
      });
      report(totalUnits, totalUnits, "Aborted (create invoices failed)");
      return {
        logs,
        summary: {
          createdCount: 0,
          lockedHoursCount: 0,
          lockedItemsCount: 0,
          pdfQueuedCount: 0,
          errorCount,
        },
      };
    }

    doneUnits += 1;
    report(doneUnits, totalUnits, "Invoices created");

    const invoiceMap: Record<number, { labor?: string; materials?: string }> =
      {};
    for (const entry of res?.ok ?? []) {
      const companyId = entry.envelopeCompanyId as number;
      const docNo = entry?.response?.Invoice?.DocumentNumber as
        | string
        | undefined;
      if (!docNo) continue;
      if (!invoiceMap[companyId]) invoiceMap[companyId] = {};
      invoiceMap[companyId][entry.kind as "labor" | "materials"] = docNo;
    }

    const phase1Ok: Record<number, boolean> = {};
    let pdfQueuedCount = 0;

    for (const r of rows) {
      const companyId = r.company.id;
      const company = r.company.name;
      const inv = invoiceMap[companyId];

      if (!inv || !inv.labor) {
        pushLog(logs, {
          level: "info",
          step: "generate-pdf",
          companyId,
          company,
          message: "No labor invoice found; skipping PDF and locking.",
        });
        phase1Ok[companyId] = false;
        continue;
      }

      pushLog(logs, {
        level: "info",
        step: "generate-pdf",
        companyId,
        company,
        message: `Queueing worklog PDF → invoice ${inv.labor}`,
      });
      report(doneUnits, totalUnits, `Generating PDF (${company})…`);

      const payload = buildWorklogGeneratePayload(r as any, inv.labor, {
        invoiceDate: opts?.invoiceDate ?? undefined,
        mode: "calendar-month",
      });

      if (!payload) {
        pushLog(logs, {
          level: "info",
          step: "generate-pdf",
          companyId,
          company,
          message: "No PDF payload; skipping PDF and locking.",
        });
        phase1Ok[companyId] = false;
        doneUnits += 1;
        report(doneUnits, totalUnits, `PDF step skipped (${company})`);
        continue;
      }

      try {
        await sendToWorklogPdfQueue(payload);
        pdfQueuedCount += 1;
        phase1Ok[companyId] = true;
        pushLog(logs, {
          level: "success",
          step: "generate-pdf",
          companyId,
          company,
          message: `PDF queued/linked (${inv.labor}).`,
        });
      } catch (e) {
        const fe = extractFortnoxError(e);
        errorCount += 1;
        phase1Ok[companyId] = false;
        pushLog(logs, {
          level: "error",
          step: "generate-pdf",
          companyId,
          company,
          message: `Failed to create/queue PDF: ${fe.message} (skipping locking)`,
          meta: { code: fe.code, body: fe.body },
        });
      }

      doneUnits += 1;
      report(doneUnits, totalUnits, `PDF step done (${company})`);
    }

    let lockedHoursCount = 0;
    let lockedItemsCount = 0;

    for (const r of rows) {
      const companyId = r.company.id;
      const company = r.company.name;

      if (!phase1Ok[companyId]) {
        pushLog(logs, {
          level: "info",
          step: "prepare",
          companyId,
          company,
          message: "Phase 1 not OK — skipping locking.",
        });
        if (r.locks?.timeReportIds?.length) {
          doneUnits += 1;
          report(doneUnits, totalUnits, `Locking hours skipped (${company})`);
        }
        if (r.locks?.timeReportItemIds?.length) {
          doneUnits += 1;
          report(doneUnits, totalUnits, `Locking items skipped (${company})`);
        }
        continue;
      }

      const inv = invoiceMap[companyId];

      if (inv?.labor && r.locks?.timeReportIds?.length) {
        pushLog(logs, {
          level: "info",
          step: "lock-hours",
          companyId,
          company,
          message: `Locking hours → invoice ${inv.labor}`,
        });
        report(doneUnits, totalUnits, `Locking hours (${company})…`);

        try {
          await lockAndMarkBilled({
            invoiceNumber: inv.labor,
            locks: { timeReportIds: r.locks.timeReportIds },
          });
          lockedHoursCount += 1;
          pushLog(logs, {
            level: "success",
            step: "lock-hours",
            companyId,
            company,
            message: `Hours locked (${inv.labor}).`,
          });
        } catch (e) {
          const fe = extractFortnoxError(e);
          errorCount += 1;
          pushLog(logs, {
            level: "error",
            step: "lock-hours",
            companyId,
            company,
            message: `Failed to lock hours: ${fe.message}`,
            meta: { code: fe.code, body: fe.body },
          });
        }

        doneUnits += 1;
        report(doneUnits, totalUnits, `Hours locked (${company})`);
      }

      if (inv?.materials && r.locks?.timeReportItemIds?.length) {
        pushLog(logs, {
          level: "info",
          step: "lock-items",
          companyId,
          company,
          message: `Locking item rows → invoice ${inv.materials}`,
        });
        report(doneUnits, totalUnits, `Locking items (${company})…`);

        try {
          await lockAndMarkItems({
            invoiceNumber: inv.materials,
            locks: { timeReportItemIds: r.locks.timeReportItemIds },
          });
          lockedItemsCount += 1;
          pushLog(logs, {
            level: "success",
            step: "lock-items",
            companyId,
            company,
            message: `Items locked (${inv.materials}).`,
          });
        } catch (e) {
          const fe = extractFortnoxError(e);
          errorCount += 1;
          pushLog(logs, {
            level: "error",
            step: "lock-items",
            companyId,
            company,
            message: `Failed to lock items: ${fe.message}`,
            meta: { code: fe.code, body: fe.body },
          });
        }

        doneUnits += 1;
        report(doneUnits, totalUnits, `Items locked (${company})`);
      }
    }

    report(totalUnits, totalUnits, "Done");
    pushLog(logs, { level: "success", step: "final", message: "Done." });

    return {
      logs,
      summary: {
        createdCount,
        lockedHoursCount,
        lockedItemsCount,
        pdfQueuedCount,
        errorCount,
      },
    };
  };

  const generatePdfselected = async (
    perRow: PdfRowOptionWithOverrides[],
    global: PdfGlobalOptions
  ) => {
    const chosen = (perRow || []).filter((r) => r.include);
    if (!chosen.length) return;
    
    setResults([]);

    const isValidInvoice = (s?: string | null) => !!(s && /^[A-Za-z0-9-_]+$/.test(s));

    for (const r of chosen) {
      const from = r.periodStartOverride ?? global.periodStart ?? undefined;
      const to = r.periodEndOverride ?? global.periodEnd ?? undefined;

      const invoice =
        r.attachMode === "manual" && isValidInvoice(r.invoiceNumber?.trim())
          ? r.invoiceNumber!.trim()
          : null;

      const payload: WorklogGenerateRequest = {
        companyId: r.companyId,
        period: from || to ? { from, to } : null,
        language: global.language,
        attachMode: r.attachMode,
        invoiceNumber: invoice,
        selectedTimeReportIds: Array.isArray(r.selectedTimeReportIds)
          ? r.selectedTimeReportIds
          : [],
      };

      try {
        const res = await createWorklogPdf(payload);
        setResults((prev) => [...prev, res]);
        setResultModalOpen(true);
      } catch (e: any) {
        const errMsg = e?.response?.data?.error ?? e?.message ?? "Request failed";

        setResults((prev) => [
          ...prev,
          {
            success: false,
            companyId: r.companyId,
            error: errMsg,
          } as WorklogGenerateResponse,
        ]);
        setResultModalOpen(true);
        console.error("[PDF] failed for company", r.companyId, e);
      }
    }
  };

  const handlePDFDownload = async (pdfId: string | number | undefined) => {
    if (pdfId == null) return;

    const id = Number(pdfId);
    if (!Number.isFinite(id)) throw new Error("Ogiltigt PDF-id");

    const { blob, fileName } = await getDownloadPdf(id);
    const objectUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(objectUrl);
  };

  const handlePDFPreview = async (pdfId: string | number | undefined) => {
    if (pdfId == null) return;

    const id = Number(pdfId);
    if (!Number.isFinite(id)) return;

    const { blob } = await getPreviewPdf(id);
    const objectUrl = URL.createObjectURL(blob);

    window.open(objectUrl, "_blank", "noopener,noreferrer");

    // Give the new tab time to read the Blob URL before revoking it.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  };

  const getCustomerPrefs = async (customerId: number) => {
    const prefs = await getCustomerSendPrefs(customerId);
    setCustomersSendPrefs(prefs);
  };

  const onConfirmSendEmail = async (payload: SendPdfConfirmPayload) => {
    return sendPdfToCustomer(payload);
  };

  const showAllPdfs = async (query: string = "") => {
    const res = await getAllPdfInRange({
      start: range.start,
      end: range.end,
      query,
    });
    setResults(res);
    setResultModalOpen(true);
  };

  return {
    env,
    customers,
    handleInvoiceTarget,
    loading,
    error,
    range,
    setRange,
    status,
    setStatus,
    onlyBillable,
    setOnlyBillable,
    onProceedSelected,
    refetch,
    needsReauth,
    generatePdfselected,
    ToPdfResult,
    handlePDFDownload,
    handlePDFPreview,
    customersSendPrefs,
    getCustomerPrefs,
    onConfirmSendEmail,
    showAllPdfs,
  };
};
