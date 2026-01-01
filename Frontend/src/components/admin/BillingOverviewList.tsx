import { useCallback, useMemo, useState } from "react";
import type {
  BillingEnvelope,
  CustomersSendPrefs,
  ProceedOptions,
  SendPdfConfirmPayload,
  ToPdfResultType,
} from "../../models/Invoice";
import { BillingOverviewDesktopTable } from "./BillingOverviewDesktopTable";
import { BillingOverviewMobileCards } from "./BillingOverviewMobileCards";
import { BillingSelectionBar } from "./BillingSelectionBar";
import { FortnoxReconnectBanner } from "../fortnox/FortnoxReconnectBanner";
import { BillingProceedModal } from "./BillingProceedModal";
import type { ProceedResult } from "../../helpers/proceedLogging";
import { BillingGeneratePdfControl } from "./BillingGeneratePdfControl";
import { WorklogResultModal } from "./WorklogResultModal";

type Props = {
  data: BillingEnvelope[];
  loading?: boolean;
  className?: string;
  handleInvoiceTarget: () => void;

  onProceedSelected?: (
    rows: BillingEnvelope[],
    opts: ProceedOptions,
    onProgress: (v: number, label?: string) => void
  ) => Promise<ProceedResult | void>;

  needsReauth: boolean;
  refetch: () => void;
  range?: { start?: string; end?: string };
  onlyBillable?: boolean;

  onGeneratePdfsSelected?: (
    perRow: {
      companyId: number;
      include: boolean;
      attachMode: "none" | "manual";
      invoiceNumber?: string;
    }[],
    global: {
      periodStart?: string;
      periodEnd?: string;
      language: "en" | "sv";
      includePrices: boolean;
      onlyBillable: boolean;
      note?: string | null;
    }
  ) => Promise<void> | void;

  ToPdfResult: ToPdfResultType;

  handleDownload: (Pdfid: string | number | undefined) => void;
  handlePDFPreview: (Pdfid: string | number | undefined) => void;

  customersSendPrefs: CustomersSendPrefs;
  getCustomerPrefs: (id: number) => void;

  onConfirmEmail?: (payload: SendPdfConfirmPayload) => Promise<string> | string;

  // NOTE: The prop type says no args, but the parent currently passes a function that accepts
  // an optional query string. If you want to support search input, update this type to:
  // onShowAllPdfs?: (query?: string) => void | Promise<void>;
  onShowAllPdfs?: () => void | Promise<void>;
};

export function BillingOverviewList({
  data,
  loading,
  className = "",
  handleInvoiceTarget,
  onProceedSelected,
  needsReauth,
  refetch,
  range,
  onlyBillable = true,
  onGeneratePdfsSelected,
  ToPdfResult,
  handleDownload,
  handlePDFPreview,
  customersSendPrefs,
  getCustomerPrefs,
  onConfirmEmail,
  onShowAllPdfs,
}: Props) {
  const ordered = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  // Companies without billingInfo.customer_id cannot be invoiced in Fortnox,
  // so we exclude them from "select all" and proceed actions.
  const selectable = useMemo(
    () => ordered.filter((c) => !!c.billingInfo?.customer_id),
    [ordered]
  );

  const [selectMode, setSelectMode] = useState(false);

  // Selection is keyed by company.id to enforce "one selection per company".
  // This prevents duplicates and keeps selection stable across UI layouts (table/cards).
  const [selectedById, setSelectedById] = useState<Record<number, BillingEnvelope>>(
    {}
  );

  const [proceedOpen, setProceedOpen] = useState(false);
  const [proceedRows, setProceedRows] = useState<BillingEnvelope[]>([]);
  const [busy, setBusy] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);

  const totalCount = ordered.length;
  const selectedCount = Object.keys(selectedById).length;

  const selectedRows = useMemo(() => Object.values(selectedById), [selectedById]);

  const isSelected = useCallback((id: number) => !!selectedById[id], [selectedById]);

  const openPdfModal = () => {
    if (selectedRows.length === 0) return;
    setPdfOpen(true);
  };

  const toggleSelectMode = () => {
    setSelectMode((v) => {
      // When leaving selection mode, clear selection to avoid accidental actions later.
      if (v) setSelectedById({});
      return !v;
    });
  };

  const toggleOne = (row: BillingEnvelope) => {
    if (!row.billingInfo?.customer_id) return;
    const id = row.company.id;

    setSelectedById((prev) => {
      // Toggle behavior: if already selected -> remove, else add.
      if (prev[id]) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: row };
    });
  };

  const toggleAll = () => {
    const allSelectableChosen = Object.keys(selectedById).length === selectable.length;

    if (allSelectableChosen) {
      setSelectedById({});
    } else {
      const next: Record<number, BillingEnvelope> = {};
      for (const c of selectable) next[c.company.id] = c;
      setSelectedById(next);
    }
  };

  const openProceed = () => {
    const chosen = Object.values(selectedById);
    if (chosen.length === 0) return;
    setProceedRows(chosen);
    setProceedOpen(true);
  };

  const handleConfirmWithProgress = async (
    opts: ProceedOptions,
    onProgress: (v: number, label?: string) => void
  ) => {
    if (!onProceedSelected) return;

    setBusy(true);
    try {
      const out = await onProceedSelected(proceedRows, opts, onProgress);
      return out;
    } finally {
      setBusy(false);
    }
  };

  if (!loading && ordered.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No companies found for the selected period.
      </div>
    );
  }

  return (
    <div className={`min-h-0 w-full ${className}`}>
      <div className="hidden h-full md:block">
        <div className="w-full min-w-0 overflow-x-auto">
        <BillingOverviewDesktopTable
          data={ordered}
          loading={!!loading}
          handleInvoiceTarget={handleInvoiceTarget}
          selectMode={selectMode}
          isSelected={isSelected}
          onToggleSelect={toggleOne}
        />
        </div>
      </div>

      <div className="block h-full md:hidden">
        <BillingOverviewMobileCards
          data={ordered}
          loading={!!loading}
          handleInvoiceTarget={handleInvoiceTarget}
          selectMode={selectMode}
          isSelected={isSelected}
          onToggleSelect={toggleOne}
        />
      </div>

      {/* Shows a Fortnox re-authentication banner when the backend indicates OAuth is required. */}
      {needsReauth && <FortnoxReconnectBanner needsReauth={needsReauth} />}

      <BillingSelectionBar
        selectMode={selectMode}
        selectedCount={selectedCount}
        totalCount={totalCount}
        selectableCount={selectable.length}
        onToggleSelectMode={toggleSelectMode}
        onToggleAll={toggleAll}
        onProceed={openProceed}
        onOpenGeneratePdfs={openPdfModal}
        canGeneratePdfs={!busy}
        onShowAllPdfs={onShowAllPdfs}
      />

      <BillingProceedModal
        open={proceedOpen}
        rows={proceedRows}
        onCancel={() => setProceedOpen(false)}
        busy={busy}
        onConfirm={(opts, onProgress) => handleConfirmWithProgress(opts, onProgress)}
        // Triggers a refetch after successful proceed flow so the UI reflects new billed/locked state.
        onDone={() => refetch()}
      />

      <BillingGeneratePdfControl
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        showTriggerButton={false}
        selectedRows={selectedRows}
        range={range ?? {}}
        onlyBillable={onlyBillable ?? true}
        enabled={selectedRows.length > 0}
        busy={busy}
        onGenerate={(perRow, global) => {
          if (!onGeneratePdfsSelected) return;

          // Mark busy while generating PDFs so other destructive actions are disabled.
          setBusy(true);
          const p = onGeneratePdfsSelected(perRow, global);
          Promise.resolve(p).finally(() => setBusy(false));
        }}
      />

      <WorklogResultModal
        open={ToPdfResult.resultModalOpen}
        onOpenChange={ToPdfResult.setResultModalOpen}
        results={ToPdfResult.results}
        handleDownload={handleDownload}
        handlePDFPreview={handlePDFPreview}
        customersSendPrefs={customersSendPrefs}
        getCustomerPrefs={getCustomerPrefs}
        onConfirmEmail={onConfirmEmail}
        onSearchPdfs={onShowAllPdfs}
      />
    </div>
  );
}
