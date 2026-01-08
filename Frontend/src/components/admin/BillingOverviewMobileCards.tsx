import { useState } from "react";
import type { BillingEnvelope, TimecardRow } from "../../models/Invoice";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
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
  handleInvoiceTarget: () => void;
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

const totalArticles = (t: BillingEnvelope["total"]) =>
  (t?.registeredArticleCount ?? 0) + (t?.customArticleCount ?? 0);

export function BillingOverviewMobileCards({
  data,
  loading,
  handleInvoiceTarget,
  selectMode = false,
  isSelected,
  onToggleSelect,
}: Props) {
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <div className="h-full min-h-0 overflow-y-auto grid gap-3">
      <StatusLegend />
      {data.map((c) => {
  const hasCustomer = !!c.billingInfo?.customer_id;
  const isOpen = openId === c.company.id;
  const selected = isSelected?.(c.company.id) ?? false;

  const hasUnbilledBefore = c.meta.flags.hasUnbilledBeforeStart; 
  const hasUnbilledAfter  = c.meta.flags.hasUnbilledAfterEnd;    
  const isBilledLocked =
    c.meta?.billing?.state === "billed" ||
    (c.meta.flags.isFullyBilledInRange && !c.meta.flags.hasUnbilledInRange); 
  const isPartiallyBilled = c.meta.billing.state === "mixed";   

  const statusClass = [
    hasUnbilledBefore && "!bg-amber-300/40 dark:!bg-amber-700/30",
    hasUnbilledAfter  && "!bg-sky-300/40 dark:!bg-sky-700/30",
    isBilledLocked    && "!bg-slate-200/60 dark:!bg-slate-300/40",
    isPartiallyBilled &&
      "bg-[linear-gradient(135deg,transparent_49%,rgb(226_232_240/0.75)_51%)] dark:bg-[linear-gradient(135deg,transparent_49%,rgb(156_163_175/0.55)_51%)] bg-no-repeat bg-[length:100%_100%]",
  ].filter(Boolean).join(" ");

  const toggleThis = () => onToggleSelect?.(c);
  const onCardKeyDown = (e: React.KeyboardEvent) => {
    if (!selectMode || !hasCustomer) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleThis();
    }
  };

        return (
          <Card
            key={c.company.id}
            role={selectMode && hasCustomer ? "button" : undefined}
            tabIndex={selectMode && hasCustomer ? 0 : -1}
            onKeyDown={onCardKeyDown}
            onClick={() => {
              if (!selectMode || !hasCustomer) return;
              toggleThis();
            }}
            className={[
              "relative transition-all",
              selectMode && hasCustomer
                ? "cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/80"
                : "",
              !hasCustomer ? "!bg-red-800/30 cursor-not-allowed" : "",
              isOpen ? "ring-1 ring-muted-foreground/20 shadow-sm" : "",
              selected
                ? "bg-emerald-100 dark:bg-emerald-900/80 ring-2 ring-emerald-500 ring-inset shadow-md"
                : "",
            ].join(" ")}
          >
            {selected && (
              <>
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-0 top-0 h-0 w-0
                             border-t-[28px] border-l-[28px]
                             border-t-emerald-500 border-l-transparent"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-[2px] top-[2px]
                             inline-flex items-center justify-center
                             h-4 w-4 rounded-full bg-emerald-600 text-white"
                >
                  <Check className="h-3 w-3" />
                </span>
              </>
            )}
             <div className="relative">
        <div
          aria-hidden
          className={[
            "absolute inset-0 rounded-t-lg pointer-events-none",
            statusClass,
          ].join(" ")}
        />
            <CardHeader className="p-4">
              <div className="flex items-start justify-between gap-3 min-w-0">
                <div className="min-w-0">
                  <CardTitle className="max-w-full break-words whitespace-normal">
                    {c.company.name ?? "—"}
                  </CardTitle>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Company ID:{" "}
                    <span className="font-mono">{c.company.id}</span>
                  </div>
                  <div className="mt-0.5 text-xs">
                    Invoice target:{" "}
                    {c.billingInfo?.customer_id ? (
                      <span className="font-mono">
                        {c.billingInfo.customer_id}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        — not connected
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm">
                    <span className="text-muted-foreground">Total hours: </span>
                    <span className="font-medium">
                      {fmtHours(c.total?.hoursSum)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Articles: {totalArticles(c.total)}{" "}
                    <span className="opacity-70">
                      (reg. {c.total.registeredArticleCount} / custom{" "}
                      {c.total.customArticleCount})
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  {!hasCustomer ? (
                    <Button
                      size="sm"
                      className="!opacity-100"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation(); // inte toggla select
                        handleInvoiceTarget();
                      }}
                    >
                      Connect
                    </Button>
                  ) : null}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation(); // inte toggla select
                      setOpenId((p) =>
                        p === c.company.id ? null : c.company.id
                      );
                    }}
                  >
                    {isOpen ? (
                      <>
                        Hide <ChevronUp className="ml-1 h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Details <ChevronDown className="ml-1 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
</div>
            {isOpen && (
              <CardContent className="p-0 border-t">
                <CompanyTimeReports
                  rows={c.timecards?.rows ?? []}
                  hasCustomer={hasCustomer} 
                />
              </CardContent>
            )}
          </Card>
        );
      })}

      {loading &&
        Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4">
            <div className="h-4 w-1/3 bg-muted rounded mb-3" />
            <div className="h-3 w-1/4 bg-muted rounded mb-1.5" />
            <div className="h-3 w-1/3 bg-muted rounded mb-3" />
            <div className="h-8 w-24 bg-muted rounded" />
          </div>
        ))}
    </div>
  );
}

function CompanyTimeReports({
  rows,

  hasCustomer,
}: {
  rows: TimecardRow[];
  hasCustomer?: boolean;
}) {
  if (!rows?.length) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No time reports in this period.
      </div>
    );
  }

  return (
    <div
      className={[
        "p-3",
        !hasCustomer
          ? "border rounded-lg !border-red-800 dark:!border-red-900/70"
          : "",
      ].join(" ")}
    >
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead className="min-w-[220px]">Desc</TableHead>
            <TableHead className="text-right">Hours</TableHead>
            <TableHead className="text-center">Articles</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((r) => {
   const billedTimecard = r.billing?.billed === true;

          return (
            <TableRow
        key={r.id}
        className={billedTimecard ? "!bg-slate-200/60 dark:!bg-slate-300/40" : ""}
      >
              <TableCell className="align-top">
  <span className="block tabular-nums">{r.date?.slice(0, 7)}</span>
  <span className="block tabular-nums">{r.date?.slice(8, 10)}</span>
</TableCell>
              <TableCell className="align-top">
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

              <TableCell className="text-right align-top">
                {fmtHours(r.hours)}
              </TableCell>

          
              <TableCell className="text-center align-top">
                {r.items?.length ? (
                  <div className="flex flex-col gap-1 w-full min-w-0 divide-y">
                    {r.items.map((i) => (
                      <div
                        key={i.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-2 w-full pb-2 min-w-0 "
                      >
                        <span className="min-w-0 whitespace-normal break-words [overflow-wrap:anywhere] leading-tight text-left">
                          {i.description}
                        </span>
                        <span className="self-end text-muted-foreground tabular-nums">
                          {i.amount} pcs
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  "—"
                )}
              </TableCell>
            </TableRow>
          
          )})}
        </TableBody>
      </Table>
    </div>
  );
}
