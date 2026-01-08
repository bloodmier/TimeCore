import { Fragment, useEffect, useMemo, useState } from "react";
import type { BillingEnvelope, TimecardRow } from "../../models/Invoice";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ChevronDown, ChevronUp, Check } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { StatusLegend } from "./StatusLegend";

type Props = {
  data: BillingEnvelope[];
  loading: boolean;
  selectMode?: boolean;
  isSelected?: (id: number) => boolean;
  onToggleSelect?: (row: BillingEnvelope) => void;
};

const fmtHours = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n)
    ? n % 1 === 0
      ? n.toFixed(0)
      : n.toFixed(2)
    : "—";

export function BillingOverviewDesktopTable({
  data,
  loading,
  selectMode = false,
  isSelected,
  onToggleSelect,
}: Props) {
  const [openId, setOpenId] = useState<number | null>(null);
  const rows = useMemo(() => data ?? [], [data]);
  const toggleOpen = (id: number) => setOpenId((p) => (p === id ? null : id));
  const [colSpan, setColSpan] = useState(6);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 640) setColSpan(4);
      else if (w < 1024) setColSpan(5);
      else setColSpan(6);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div className="flex flex-col h-[65dvh]  border bg-background">
      <StatusLegend />
      <div className="min-h-0 overflow-x-auto overflow-y-auto relative [scrollbar-gutter:stable] scrollbar-dark">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 border-b bg-background">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead className="hidden lg:table-cell">
                  Company ID
                </TableHead>
                <TableHead>
                  <span className="hidden lg:inline">Invoice (fortnox)</span>
                  <span className="inline lg:hidden">Invoice id</span>
                </TableHead>
                <TableHead className="text-center">
                  <span className="hidden lg:inline">Total hours</span>
                  <span className="inline lg:hidden">Hours</span>
                </TableHead>
                <TableHead className="text-center">Articles</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
          </Table>
        </div>

        {/* Body */}
        <Table className="table-fixed w-full">
          <TableBody>
            {rows.map((c) => {
              const hasCustomer = !!c.billingInfo?.customer_id;
              const open = openId === c.company.id;
              const selected = isSelected?.(c.company.id) ?? false;
              const hasUnbilledBefore = c.meta.flags.hasUnbilledBeforeStart;
              const hasUnbilledAfter = c.meta.flags.hasUnbilledAfterEnd;
              const isBilledLocked =
                c.meta?.billing?.state === "billed" ||
                (c.meta.flags.isFullyBilledInRange &&
                  !c.meta.flags.hasUnbilledInRange);
              const isPartiallyBilled = c.meta.billing.state === "mixed";

              const toggleThis = () => onToggleSelect?.(c);
              const onRowKeyDown = (e: React.KeyboardEvent) => {
                if (!selectMode || !hasCustomer) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleThis();
                }
              };

              return (
                <Fragment key={c.company.id}>
                  <TableRow
                    className={[
                      "!relative overflow-hidden rounded-md transition-all",
                      selectMode && hasCustomer
                        ? "cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/80"
                        : "",
                      !hasCustomer ? "!bg-red-800/30 cursor-not-allowed" : "",
                      hasUnbilledBefore
                        ? "!bg-amber-300/40 dark:bg-amber-700/30"
                        : "",
                      hasUnbilledAfter
                        ? "!bg-sky-300/40 dark:bg-sky-700/30"
                        : "",
                      isBilledLocked
                        ? "!bg-slate-200/60 dark:!bg-slate-300/40"
                        : "",
                      isPartiallyBilled
                        ? "bg-[linear-gradient(135deg,transparent_49%,rgb(226_232_240/0.75)_51%)] dark:bg-[linear-gradient(135deg,transparent_49%,rgb(156_163_175/0.55)_51%)] bg-no-repeat bg-[length:100%_100%]"
                        : "",
                      open ? "bg-muted/30" : "",
                      selected
                        ? "bg-emerald-100 ring-2 dark:bg-emerald-900/80 ring-emerald-500 shadow-md ring-inset "
                        : "",
                    ].join(" ")}
                    onClick={() => {
                      if (!selectMode || !hasCustomer) return;
                      onToggleSelect?.(c);
                    }}
                    tabIndex={selectMode && hasCustomer ? 0 : -1}
                    role={selectMode && hasCustomer ? "button" : undefined}
                    onKeyDown={onRowKeyDown}
                    aria-pressed={selectMode ? selected : undefined}
                  >
                    <TableCell className="align-top">
                      <div className="truncate font-medium">
                        {c.company.name ?? "—"}
                      </div>
                    </TableCell>

                    <TableCell className="hidden lg:table-cell align-top">
                      <span className="font-mono">{c.company.id}</span>
                    </TableCell>

                    <TableCell className="align-top">
                      {c.billingInfo?.customer_id ? (
                        <span className="font-mono">
                          {c.billingInfo.customer_id}
                        </span>
                      ) : (
    <span className="text-xs text-muted-foreground italic">
      Not connected
    </span>
  )}
                    </TableCell>

                    <TableCell className="align-top text-center">
                      {fmtHours(c.total?.hoursSum)}
                    </TableCell>

                    <TableCell className="align-top text-center">
                      {c.total.itemCount}
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation(); // don’t toggle selection
                            toggleOpen(c.company.id);
                          }}
                          aria-expanded={open}
                          aria-label={open ? "Hide details" : "Show details"}
                          className="flex items-center gap-1"
                        >
                          {open ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                        {selected && (
                          <>
                            <span
                              aria-hidden
                              className="pointer-events-none absolute right-0 top-0 h-0 w-0
                                     border-t-[36px] border-l-[36px]
                                     border-t-emerald-500 border-l-transparent"
                            />
                            <span
                              aria-hidden
                              className="pointer-events-none absolute right-[2px] top-[2px]
                                     inline-flex items-center justify-center
                                     h-3 w-3 text-white"
                            >
                              <Check className="h-4 w-4" />
                            </span>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>

                  {open && (
                    <TableRow className="bg-muted/20">
                      <TableCell colSpan={colSpan} className="p-0">
                        <div className="w-full p-3">
                          <CompanyTimeReports
                            rows={c.timecards?.rows ?? []}
                            hasCustomer={hasCustomer}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}

            {/* Loading skeleton rows */}
            {loading &&
  Array.from({ length: 3 }).map((_, i) => (
    <TableRow key={`sk-${i}`} className="opacity-60">
      {/* 1) Company */}
      <TableCell className="py-6">
        <div className="h-4 w-2/3 bg-muted rounded" />
      </TableCell>

      {/* 2) Company ID (lg only) */}
      <TableCell className="hidden lg:table-cell">
        <div className="h-4 w-1/3 bg-muted rounded" />
      </TableCell>

      {/* 3) Invoice */}
      <TableCell>
        <div className="h-4 w-1/2 bg-muted rounded" />
      </TableCell>

      {/* 4) Hours */}
      <TableCell className="text-center">
        <div className="mx-auto h-4 w-12 bg-muted rounded" />
      </TableCell>

      {/* 5) Articles */}
      <TableCell className="text-center">
        <div className="mx-auto h-4 w-10 bg-muted rounded" />
      </TableCell>

      {/* 6) Actions */}
      <TableCell className="text-right">
        <div className="ml-auto h-8 w-28 bg-muted rounded" />
      </TableCell>
    </TableRow>
  ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CompanyTimeReports({
  rows,
  hasCustomer,
}: {
  rows: TimecardRow[];
  hasCustomer: boolean;
}) {
  const prettyYMD = (s: string) => s;
  if (!rows?.length) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No time reports in this period.
      </div>
    );
  }
  return (
    <div
      className={`p-3
        border rounded-lg border-green-700
        ${!hasCustomer ? "border rounded-lg !border-red-800 dark:!border-red-900/70" : ""}`}
    >
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead className="w-[220px]">Description</TableHead>
            <TableHead className="hidden lg:table-cell ">Timecard id</TableHead>
            <TableHead className="text-center hidden lg:table-cell">
              User
            </TableHead>
            <TableHead className="text-right">Hours</TableHead>
            <TableHead className="hidden sm:table-cell text-right">
              Articles
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const billedTimecard = r.billing.billed;
            const InvoiceNumber = r.billing.invoiceNumber;

            return (
              <TableRow className={`${billedTimecard ? "!bg-slate-200/60 dark:!bg-slate-300/40" : ""}`} key={r.id}>
                <TableCell
                  
                >
                  {prettyYMD(r.date)}
                </TableCell>

                <TableCell className="">
                  <div className="font-medium whitespace-normal break-words">
                    {r.work_labor ?? r.note ?? "—"}
                  </div>
                  {r.note && r.work_labor && (
                    <div className="text-xs text-muted-foreground font-medium whitespace-normal break-words">
                      {r.note}
                    </div>
                  )}
                  {r.category != null && (
                    <div className="mt-1">
                      <Badge variant="secondary">{r.category}</Badge>
                    </div>
                  )}
                </TableCell>
                <TableCell className=" hidden lg:table-cell">{r.id}<br/> {InvoiceNumber !== null && `(invoice Nr: ${InvoiceNumber})`}</TableCell>
                <TableCell className="text-center hidden lg:table-cell">
                  {r.user_name}
                </TableCell>
                <TableCell className="text-right">
                  {fmtHours(r.hours)}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-right align-center">
                  {r.items?.length ? (
                    <div className="flex flex-col items-end gap-1 w-full divide-y divide-gray-500 ">
                      {r.items.map((i) => (
                        <div
                          key={i.id}
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-2 w-full pb-2"
                        >
                          <span className="whitespace-normal break-words leading-tight text-left">
                            {i.description}
                          </span>
                          <span className="whitespace-nowrap self-end text-muted-foreground tabular-nums">
                            {i.amount} st
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
