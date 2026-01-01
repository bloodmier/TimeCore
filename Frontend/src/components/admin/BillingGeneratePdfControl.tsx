import { useEffect, useMemo, useState } from "react";
import type { BillingEnvelope } from "../../models/Invoice";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../ui/select";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "../ui/popover";
import { Calendar } from "../ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";

// helpers

const parseYMD = (s?: string | null) => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const ymd = (d?: Date | null) => (d ? fmt(d) : "");

const pretty = (s?: string | null) => s ?? "—";
const firstDayOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), 1);
const lastDayOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0);

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

type AttachMode = "none" | "manual";

export type PdfRowOption = {
  companyId: number;
  include: boolean;
  attachMode: AttachMode;
  invoiceNumber?: string;
};

export type PdfGlobalOptions = {
  periodStart?: string;
  periodEnd?: string;
  language: "en" | "sv";
  includePrices: boolean;
  onlyBillable: boolean;
  note?: string | null;
};

type RowState = PdfRowOption & {
  periodStartOverride?: string | null;
  periodEndOverride?: string | null;
  selectedTimeReportIds: number[];
  expand: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  showTriggerButton?: boolean;

  selectedRows: BillingEnvelope[];
  range: { start?: string; end?: string };
  onlyBillable: boolean;
  enabled?: boolean;
  busy?: boolean;
  onGenerate: (
    perRow: Array<
      PdfRowOption & {
        periodStartOverride?: string | null;
        periodEndOverride?: string | null;
        selectedTimeReportIds?: number[];
      }
    >,
    global: PdfGlobalOptions
  ) => Promise<void> | void;
  className?: string;
};

export function BillingGeneratePdfControl({
  open,
  onOpenChange,
  showTriggerButton = true,
  selectedRows,
  range,
  onlyBillable,
  enabled = true,
  busy = false,
  onGenerate,
  className = "",
}: Props) {
  const [rowsState, setRowsState] = useState<RowState[]>([]);
  const [language, setLanguage] = useState<"en" | "sv">("sv");
  const [includePrices, setIncludePrices] = useState<boolean>(true);
  const [onlyBillableLocal, setOnlyBillableLocal] =
    useState<boolean>(onlyBillable);
  const [note, setNote] = useState<string>("");

  /* ---------------- Helpers: standarddatum ---------------- */

  const deriveSpanFromTimecards = (row: BillingEnvelope) => {
    const dates = (row.timecards?.rows ?? [])
      .map((t) => t?.date)
      .filter(Boolean)
      .sort();
    if (dates.length) {
      return { from: dates[0]!, to: dates[dates.length - 1]! };
    }
    return null;
  };

  const defaultMonthSpan = () => ({
    from: fmt(firstDayOfMonth()),
    to: fmt(lastDayOfMonth()),
  });

  const derivePerCompanySpan = (row: BillingEnvelope) => {
    // Prio 1: global range
    if (range.start && range.end) return { from: range.start, to: range.end };
    // Prio 2: meta first/last
    if (row.meta?.firstDate && row.meta?.lastDate)
      return { from: row.meta.firstDate, to: row.meta.lastDate };
    // Prio 3: från timecards
    const tc = deriveSpanFromTimecards(row);
    if (tc) return tc;
    // Prio 4: innevarande månad
    return defaultMonthSpan();
  };

  /* ---------------- initiera när modal öppnas ---------------- */
  useEffect(() => {
    if (!open) return;

    const initial: RowState[] = (selectedRows ?? []).map((r) => {
      const allIds = (r.timecards?.rows ?? [])
        .map((t) => Number(t.id))
        .filter(Boolean);

      const span = derivePerCompanySpan(r);

      return {
        companyId: r.company.id,
        include: true,
        attachMode: "none",
        invoiceNumber: "",
        periodStartOverride: span.from ?? null,
        periodEndOverride: span.to ?? null,
        selectedTimeReportIds: allIds,
        expand: false,
      };
    });

    setRowsState(initial);
    setLanguage((localStorage.getItem("pdf_lang") as "en" | "sv") || "en");
    setIncludePrices(localStorage.getItem("pdf_prices") !== "0");
    setOnlyBillableLocal(
      localStorage.getItem("pdf_only_billable") === null
        ? onlyBillable
        : localStorage.getItem("pdf_only_billable") === "1"
    );
    setNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedRows]);

  /* ---------------- persist ---------------- */
  useEffect(() => {
    localStorage.setItem("pdf_lang", language);
  }, [language]);
  useEffect(() => {
    localStorage.setItem("pdf_prices", includePrices ? "1" : "0");
  }, [includePrices]);
  useEffect(() => {
    localStorage.setItem("pdf_only_billable", onlyBillableLocal ? "1" : "0");
  }, [onlyBillableLocal]);

  const includedCount = useMemo(
    () => rowsState.filter((r) => r.include).length,
    [rowsState]
  );

  const manualAttachInvalid = useMemo(() => {
    for (const r of rowsState) {
      if (!r.include) continue;
      if (r.attachMode === "manual") {
        if (!r.invoiceNumber?.trim()) return true;
        if (!/^[A-Za-z0-9-_]+$/.test(r.invoiceNumber.trim())) return true;
      }
    }
    return false;
  }, [rowsState]);

  const canSubmit =
    enabled && includedCount > 0 && !manualAttachInvalid && !busy;

  const patchRow = (companyId: number, patch: Partial<RowState>) => {
    setRowsState((prev) =>
      prev.map((r) => (r.companyId === companyId ? { ...r, ...patch } : r))
    );
  };

  const toggleCard = (companyId: number) => {
    setRowsState((prev) =>
      prev.map((r) =>
        r.companyId === companyId ? { ...r, expand: !r.expand } : r
      )
    );
  };

  const toggleAllCards = (companyId: number, on: boolean, allIds: number[]) => {
    patchRow(companyId, { selectedTimeReportIds: on ? allIds : [] });
  };

  const toggleOneCard = (companyId: number, id: number, on: boolean) => {
    setRowsState((prev) =>
      prev.map((r) => {
        if (r.companyId !== companyId) return r;
        const set = new Set(r.selectedTimeReportIds);
        if (on) set.add(id);
        else set.delete(id);
        return { ...r, selectedTimeReportIds: Array.from(set) };
      })
    );
  };

  const resolveDatesForSubmit = (rs: RowState, row: BillingEnvelope) => {
    const start =
      rs.periodStartOverride ||
      range.start ||
      derivePerCompanySpan(row).from ||
      defaultMonthSpan().from;

    const end =
      rs.periodEndOverride ||
      range.end ||
      derivePerCompanySpan(row).to ||
      defaultMonthSpan().to;

    return { start, end };
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const perRow = rowsState.map((r) => {
      const row = selectedRows.find((x) => x.company.id === r.companyId)!;
      const dates = resolveDatesForSubmit(r, row);

      return {
        companyId: r.companyId,
        include: r.include,
        attachMode: r.attachMode,
        invoiceNumber:
          r.attachMode === "manual" && r.invoiceNumber?.trim()
            ? r.invoiceNumber.trim()
            : undefined,
        periodStartOverride: dates.start,
        periodEndOverride: dates.end,
        selectedTimeReportIds: r.selectedTimeReportIds ?? [],
      };
    });

    const global: PdfGlobalOptions = {
      periodStart: range.start,
      periodEnd: range.end,
      language,
      includePrices,
      onlyBillable: onlyBillableLocal,
      note: note?.trim() ? note.trim() : null,
    };

    await Promise.resolve(onGenerate(perRow, global));
    onOpenChange(false);
  };

  return (
    <div className={className}>
      {showTriggerButton && (
        <Button
          variant="default"
          disabled={!enabled || (selectedRows?.length ?? 0) === 0}
          onClick={() => onOpenChange(true)}
        >
          Generate PDFs ({selectedRows?.length ?? 0})
        </Button>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:max-w-[95vw] md:max-w-[1200px] max-w-[95vw] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Generate PDFs</DialogTitle>
            <DialogDescription>
              Choose which rows to include, set per-customer date range and
              optionally attach a manual invoice number. You can also deselect
              specific timecards per customer.
            </DialogDescription>
          </DialogHeader>

          <div className="text-xs text-muted-foreground -mt-2">
            Global period:&nbsp;
            <Badge variant="secondary">
              {range.start || "—"} – {range.end || "—"}
            </Badge>
          </div>

          <Separator className="my-3" />

          {/* Sticky header + nicer cards */}
          <div className="rounded border">
            <div className="grid grid-cols-12 text-xs text-muted-foreground bg-muted/40 px-3 py-2 sticky top-0 z-10">
              <div className="col-span-1">Use</div>
              <div className="col-span-3">Company</div>
              <div className="col-span-3">Attach</div>
              <div className="col-span-5">Per-customer settings</div>
            </div>

            <div className="max-h-[520px] overflow-auto">
              {(selectedRows ?? []).map((row) => {
                const companyId = row.company.id;
                const rs =
                  rowsState.find((x) => x.companyId === companyId) ??
                  ({
                    companyId,
                    include: true,
                    attachMode: "none",
                    invoiceNumber: "",
                    periodStartOverride:
                      range.start ??
                      row.meta?.firstDate ??
                      derivePerCompanySpan(row).from ??
                      null,
                    periodEndOverride:
                      range.end ??
                      row.meta?.lastDate ??
                      derivePerCompanySpan(row).to ??
                      null,
                    selectedTimeReportIds: (row.timecards?.rows ?? [])
                      .map((t) => Number(t.id))
                      .filter(Boolean),
                    expand: false,
                  } as RowState);

                const manualDisabled = !rs.include;
                
                const allCards = (row.timecards?.rows ?? []).map((t) => ({
                  id: Number(t.id),
                  date: t.date,
                  hours: t.hours,
                  desc: t.work_labor || t.note || "",
                  user: t.user_name || "",
                  billable: !!t.billable,
                }));
                const allIds = allCards.map((c) => c.id);
                const selectedSet = new Set(rs.selectedTimeReportIds);

                return (
                  <div
                    key={companyId}
                    className="grid grid-cols-12 items-start gap-3 px-3 py-3 border-t first:border-t-0 bg-background"
                  >
                    {/* Use */}
                    <div className="col-span-1 flex justify-center pt-2">
                      <Checkbox
                        checked={rs.include}
                        onCheckedChange={(v) =>
                          patchRow(companyId, { include: !!v })
                        }
                      />
                    </div>

                    {/* Company */}
                    <div className="col-span-3">
                      <div className="font-medium">{row.company.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.total?.timeReportCount ?? 0} timecard
                        {(row.total?.timeReportCount ?? 0) === 1 ? "" : "s"}
                        {" • "}
                        Hours: {row.total?.hoursSum ?? 0}
                      </div>
                    </div>

                    {/* Attach */}
                    <div className="col-span-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={rs.attachMode === "none"}
                            onCheckedChange={() =>
                              patchRow(companyId, { attachMode: "none" })
                            }
                            disabled={!rs.include}
                          />
                          <Label className="text-xs">No attachment</Label>
                        </div>

                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={rs.attachMode === "manual"}
                            onCheckedChange={() =>
                              patchRow(companyId, { attachMode: "manual" })
                            }
                            disabled={!rs.include}
                          />
                          <Label className="text-xs">Manual invoice #</Label>
                          <Input
                            className="h-8 w-[160px]"
                            placeholder="e.g. 12345"
                            value={rs.invoiceNumber ?? ""}
                            onChange={(e) =>
                              patchRow(companyId, {
                                invoiceNumber: e.target.value,
                              })
                            }
                            disabled={
                              manualDisabled || rs.attachMode !== "manual"
                            }
                          />
                          
                        </div>
                      </div>
                    </div>

                    {/* Per-customer settings */}
                    <div className="col-span-5">
                      <div className="grid gap-2">
                        {/* Dates (compact) */}
                        <div className="space-y-2">
                          {/* Tydlig liten header med valt intervall */}
                          <div className="text-xs text-muted-foreground">
                            <Badge variant="outline" className="font-normal">
                              {pretty(rs.periodStartOverride)} –{" "}
                              {pretty(rs.periodEndOverride)}
                            </Badge>
                          </div>

                          {/* Två små knappar med kalenderikon */}
                          <div className="flex flex-wrap items-center gap-2">
                            <DateIconButton
                              label="From"
                              value={rs.periodStartOverride}
                              disabled={!rs.include}
                              onSelect={(v) =>
                                patchRow(companyId, { periodStartOverride: v })
                              }
                            />
                            <span className="text-muted-foreground text-xs">
                              →
                            </span>
                            <DateIconButton
                              label="To"
                              value={rs.periodEndOverride}
                              disabled={!rs.include}
                              onSelect={(v) =>
                                patchRow(companyId, { periodEndOverride: v })
                              }
                            />

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="ml-2 h-8"
                              onClick={() => {
                                const span = derivePerCompanySpan(row);
                                patchRow(companyId, {
                                  periodStartOverride: span.from,
                                  periodEndOverride: span.to,
                                });
                              }}
                              disabled={!rs.include}
                            >
                              Reset
                            </Button>
                          </div>
                        </div>

                        {/* Timecards selector (expandable) */}
                        <div className="rounded border bg-muted/10">
                          <button
                            type="button"
                            className="w-full flex items-center justify-between px-3 py-2 text-sm"
                            onClick={() => toggleCard(companyId)}
                            disabled={!rs.include}
                          >
                            <span>
                              Timecards ({rs.selectedTimeReportIds.length}/
                              {allCards.length})
                            </span>
                            {rs.expand ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>

                          {rs.expand && (
                            <div className="px-3 pb-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    toggleAllCards(companyId, true, allIds)
                                  }
                                  disabled={
                                    !rs.include ||
                                    allIds.length ===
                                      rs.selectedTimeReportIds.length
                                  }
                                >
                                  Select all
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    toggleAllCards(companyId, false, allIds)
                                  }
                                  disabled={
                                    !rs.include ||
                                    rs.selectedTimeReportIds.length === 0
                                  }
                                >
                                  Unselect all
                                </Button>
                              </div>

                              <div className="max-h-[220px] overflow-auto pr-1 space-y-1">
                                {allCards.length === 0 && (
                                  <div className="text-xs text-muted-foreground italic">
                                    No timecards.
                                  </div>
                                )}
                                {allCards.map((c) => {
                                  const on = selectedSet.has(c.id);
                                  return (
                                    <label
                                      key={c.id}
                                      className="flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-muted/50"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Checkbox
                                          checked={on}
                                          onCheckedChange={(v) =>
                                            toggleOneCard(companyId, c.id, !!v)
                                          }
                                          disabled={!rs.include}
                                        />
                                        <span className="inline-flex gap-2">
                                          <Badge variant="outline">
                                            {c.date}
                                          </Badge>
                                          <span>{c.user}</span>
                                          <span className="text-muted-foreground">
                                            • {c.hours}h
                                          </span>
                                          {c.desc ? (
                                            <span className="text-muted-foreground">
                                              • {c.desc}
                                            </span>
                                          ) : null}
                                        </span>
                                      </div>
                                      {!c.billable ? (
                                        <Badge variant="destructive">
                                          non-billable
                                        </Badge>
                                      ) : null}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator className="my-4" />

          {/* Global options */}
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Language</Label>
                <Select
                  value={language}
                  onValueChange={(v) => setLanguage(v as "en" | "sv")}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="sv">Svenska</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1">
                <Label>&nbsp;</Label>
                <div className="flex items-center gap-4">
                  
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {busy ? "Generating…" : `Generate PDFs (${includedCount})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DateIconButton({
  label,
  value,
  disabled,
  onSelect,
}: {
  label: "From" | "To";
  value?: string | null;
  disabled?: boolean;
  onSelect: (v: string | null) => void;
}) {
  const selected = parseYMD(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted/50 disabled:opacity-50"
          disabled={disabled}
        >
          <CalendarIcon className="h-4 w-4" />
          <span className="tabular-nums">{pretty(value)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0">
        <Calendar
          mode="single"
          selected={selected ?? undefined}
          onSelect={(d) => onSelect(d ? ymd(d) : null)}
          initialFocus
        />
        <div className="flex items-center justify-between p-2 border-t">
          <span className="text-xs text-muted-foreground">{label}</span>
          <button
            className="text-xs underline underline-offset-2"
            onClick={() => onSelect(null)}
            type="button"
          >
            Clear
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
