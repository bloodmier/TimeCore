import type { ReactNode } from "react";
import { Badge } from "../../components/ui/badge";
import type { TimeReportRow } from "../../models/timeReports";
import { Button } from "../ui/button";
import { Copy } from "lucide-react";

type Props = {
  row: TimeReportRow;
  columns?: 1 | 2 | 3;
  dense?: boolean;
  maxLen?: number;
};

const dash = "—";
const clip = (s: string | null | undefined, n: number) => {
  const v = (s ?? "").trim();
  if (!v) return dash;
  return v.length > n ? v.slice(0, n - 1) + "…" : v;
};

const fmtHours = (h: number | null | undefined) => {
  if (h == null) return dash;
  return h % 1 === 0 ? String(h) : h.toFixed(2);
};

const Field = ({
  label,
  children,
  hideIfEmpty = false,
}: {
  label: string;
  children: ReactNode;
  hideIfEmpty?: boolean;
}) => {
  const isEmpty =
    children === null ||
    children === undefined ||
    (typeof children === "string" && children.trim() === "") ||
    children === dash;

  if (hideIfEmpty && isEmpty) return null;

  return (
    <div className="rounded-md border p-2 bg-muted/10 min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium min-w-0 overflow-hidden break-words">{isEmpty ? dash : children}</div>
    </div>
  );
};

export function TimeReportSummary({ row, columns = 2, dense = false, maxLen = 60 }: Props) {
  const projectId = "projectId" in row ? ((row as any).projectId as number | string | null) : null;

  const gridCols =
    columns === 1
      ? "grid-cols-1"
      : columns === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  const valueTextCls = dense ? "text-sm" : "text-base";

  return (
    <div className="space-y-3 max-h-10000">
      <div className={`grid gap-2 ${gridCols} ${valueTextCls}`}>
        <Field label="Date" hideIfEmpty>{row.date ?? dash}</Field>
        <Field label="Customer" hideIfEmpty>{row.customerName ?? dash}</Field>

        <Field label="Project" hideIfEmpty>
          {row.projectName ? clip(row.projectName, 40) : projectId != null ? `#${projectId}` : dash}
        </Field>

        <Field label="Category" hideIfEmpty>{row.category ?? dash}</Field>
        <Field label="Hours" hideIfEmpty>{fmtHours(row.hours)} h</Field>

        <Field label="Billable">
          {row.billable ? (
            <Badge variant="secondary" className="px-2 py-0.5">Billable</Badge>
          ) : (
            <Badge variant="outline" className="px-2 py-0.5 text-muted-foreground border-muted-foreground/30">
              Non-billable
            </Badge>
          )}
        </Field>

        <Field label="Billed">
          {row.billed ? (
            <Badge className="px-2 py-0.5">Billed</Badge>
          ) : (
            <Badge variant="outline" className="px-2 py-0.5 text-muted-foreground border-muted-foreground/30">
              Not billed
            </Badge>
          )}
        </Field>

        <Field label="Invoice #">
          {typeof row.invoiceNumber === "number" ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">#{row.invoiceNumber}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(String(row.invoiceNumber));
                  } catch {
                    // ignore
                  }
                }}
                aria-label="Copy invoice number"
                title="Copy"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            dash
          )}
        </Field>

        <Field label="Work" hideIfEmpty>
          <span title={row.workDescription ?? ""}>{clip(row.workDescription, maxLen)}</span>
        </Field>

        <Field label="Note" hideIfEmpty>
          <span title={row.note ?? ""}>{clip(row.note, Math.max(30, Math.floor(maxLen / 1.5)))}</span>
        </Field>
      </div>

      {Array.isArray(row.items) && row.items.length > 0 && (
        <div className="rounded-md border p-2">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Items</div>

          <div className="grid gap-1">
            {row.items.map((it: any) => {
              const name = it.articleName || it.description || dash;
              const amount = it.amount == null ? dash : String(it.amount);
              const unit = it.articleUnit ? ` ${it.articleUnit}` : "";
              const price =
                typeof it.articlePrice === "number"
                  ? it.articlePrice % 1 === 0
                    ? String(it.articlePrice)
                    : it.articlePrice.toFixed(2)
                  : null;
              const total =
                typeof it.articlePrice === "number" && typeof it.amount === "number"
                  ? (it.articlePrice * it.amount).toFixed(2)
                  : null;

              return (
                <div key={it.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate" title={name}>{name}</div>
                    <div className="text-muted-foreground">
                      Qty: {amount}
                      {unit}
                      {price != null ? `  ·  @ ${price}` : ""}
                    </div>
                  </div>

                  <div className="shrink-0 font-medium">{total != null ? total : ""}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
