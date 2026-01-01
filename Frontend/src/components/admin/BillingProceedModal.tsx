// src/components/billing/BillingProceedModal.tsx
import { useMemo, useState, useEffect, useRef } from "react";

import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "../ui/dialog";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import type { BillingEnvelope, ProceedOptions } from "../../models/Invoice";
import { ProceedSectionInvoiceDate } from "./ProceedSectionInvoiceDate";
import { getLastDayOfCurrentMonth } from "../../helpers/dateHelpers";
import { ProgressButton } from "../ui/ProgressButton";
import type { ProceedLog, ProceedResult } from "../../helpers/proceedLogging";

type Props = {
  open: boolean;
  rows: BillingEnvelope[];
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (
    opts: ProceedOptions,
    onProgress: (v: number, label?: string) => void
  ) => Promise<ProceedResult | void>;
  initialOptions?: ProceedOptions;
  onDone?: () => void; // refetch i föräldern
};

export function BillingProceedModal({
  open,
  rows,
  busy = false,
  onCancel,
  onConfirm,
  initialOptions,
  onDone,
}: Props) {
  const [opts, setOpts] = useState<ProceedOptions>(initialOptions ?? {});
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState<string | undefined>();
  const [logs, setLogs] = useState<ProceedLog[]>([]);
  const [result, setResult] = useState<ProceedResult | null>(null);

  const logRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);

  // Håll logg-rutan autoscrollad
  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs, result]);

  // Reset state när modalen stängs
  useEffect(() => {
    if (!open) {
      setProgress(0);
      setProgressLabel(undefined);
      setLogs([]);
      setResult(null);
      setOpts(initialOptions ?? {});
    }
  }, [open, initialOptions]);

  const companyCount = rows.length;
  const canConfirm = !busy && companyCount > 0;

  const totalHours = useMemo(() => {
    try {
      return rows.reduce((sum, r) => sum + (r.total?.hoursSum ?? 0), 0);
    } catch {
      return 0;
    }
  }, [rows]);

  const handleConfirm = async () => {
    setProgress(1);
    setProgressLabel("Starting…");
    setResult(null);
    setLogs((prev) => [
      ...prev,
      { ts: Date.now(), level: "info", step: "prepare", message: "Start…" },
    ]);

    const out = await onConfirm(opts, (v, label) => {
      setProgress(v);
      if (label != null) setProgressLabel(label);
      setLogs((prev) => [
        ...prev,
        { ts: Date.now(), level: "info", step: "prepare", message: label ?? "" },
      ]);
    });

    if (out && "logs" in out) {
      setResult(out);
      setLogs(out.logs ?? []);
      setProgress((p) => (p < 100 ? 100 : p));
      setProgressLabel("Done");
    }
  };

  // Gemensam stäng-funktion som även kör refetch (onDone)
  const handleClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    onDone?.();  // refetch i föräldern
    onCancel();  // stäng i föräldern
    // släpp låset efter render-tick
    setTimeout(() => {
      closingRef.current = false;
    }, 0);
  };

  const errorCount = result?.summary.errorCount ?? 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create invoices</DialogTitle>
          <DialogDescription>
            You selected <strong>{companyCount}</strong>{" "}
            {companyCount === 1 ? "company" : "companies"} ({totalHours} h total).
            Configure options below before creating the invoices.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1fr,1.4fr]">
          {/* vänsterkolumn */}
          <div className="space-y-3">
            <div className="text-sm font-medium">Selection</div>
            <div className="rounded-xl border p-3 max-h-64 overflow-auto">
              {rows.map((r) => (
                <div key={r.company.id} className="flex items-start justify-between py-1">
                  <div className="mr-3 min-w-0">
                    <div className="truncate font-medium">{r.company.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.billingInfo?.customer_id
                        ? `Customer #${r.billingInfo.customer_id}`
                        : "No customer mapping"}
                    </div>
                  </div>
                  <div className="text-right text-xs tabular-nums text-muted-foreground">
                    {r.total?.hoursSum ?? 0} h
                  </div>
                </div>
              ))}
              {rows.length === 0 && (
                <div className="text-sm text-muted-foreground">No rows selected.</div>
              )}
            </div>

            <Separator />

            <div className="rounded-xl border p-3 text-sm">
              <div className="font-medium mb-1">Current options</div>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>
                  Invoice date:{" "}
                  {opts.invoiceDate ? (
                    <span>{opts.invoiceDate}</span>
                  ) : (
                    <em>Auto ({getLastDayOfCurrentMonth()})</em>
                  )}
                </li>
              </ul>
            </div>
          </div>

          {/* högerkolumn */}
          <div className="space-y-5">
            <ProceedSectionInvoiceDate
              value={opts.invoiceDate ?? null}
              onChange={(v) => setOpts((o) => ({ ...o, invoiceDate: v }))}
            />

            {/* status + logg */}
            <div className="rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {progressLabel ?? "Idle"}
                </div>
                {result && (
                  <Badge variant={errorCount ? "destructive" : "default"}>
                    {errorCount ? `${errorCount} errors` : "No errors"}
                  </Badge>
                )}
              </div>

              <div
                className="mt-2 h-56 overflow-auto rounded-md border p-2 text-sm scrollbar-dark"
                ref={logRef}
              >
                {logs.length === 0 ? (
                  <div className="text-muted-foreground">No log entries yet…</div>
                ) : (
                  <ul className="space-y-1">
                    {logs.map((l, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {new Date(l.ts).toLocaleTimeString()}
                        </span>
                        <span
                          className={
                            l.level === "error"
                              ? "text-red-600 dark:text-red-400"
                              : l.level === "success"
                              ? "text-emerald-700 dark:text-emerald-400"
                              : ""
                          }
                        >
                          {l.company ? `[${l.company}] ` : ""}
                          {l.message}
                          {l.meta?.message ? ` — ${l.meta.message}` : ""}
                          {l.meta?.code ? ` (code: ${l.meta.code})` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {result && (
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-lg border p-2">
                    <div className="font-medium">Summary</div>
                    <ul className="mt-1 space-y-0.5 text-muted-foreground">
                      <li>Invoices created: {result.summary.createdCount}</li>
                      <li>Hours locked: {result.summary.lockedHoursCount}</li>
                      <li>Items locked: {result.summary.lockedItemsCount}</li>
                      <li>PDF queued: {result.summary.pdfQueuedCount}</li>
                      <li>Errors: {result.summary.errorCount}</li>
                    </ul>
                  </div>
                  <div className="flex items-end justify-end gap-2">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        navigator.clipboard.writeText(
                          JSON.stringify(
                            { logs: result.logs, summary: result.summary },
                            null,
                            2
                          )
                        )
                      }
                    >
                      Copy log JSON
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {/* Cancel: låt DialogClose stänga, onOpenChange tar hand om handleClose */}
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={busy || progress > 0}>
              Cancel
            </Button>
          </DialogClose>

          {/* OK ska också trigga refetch + stäng */}
          {result ? (
            <Button type="button" onClick={handleClose}>
              OK
            </Button>
          ) : (
            <ProgressButton
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              progress={progress}
              progressLabel={progressLabel}
            >
              Create invoices
            </ProgressButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
