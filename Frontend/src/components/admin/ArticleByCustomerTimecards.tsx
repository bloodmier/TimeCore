import { useState } from "react";
import { ChevronDown } from "lucide-react";

type Item = {
  kind: "registered" | "custom";
  articleId?: number;
  label: string;
  qty: number;
};

type Timecard = {
  timeReportId: number;
  date: string;
  totalQty: number;
  items: Item[];
};

type Row = {
  customerId: number | null;
  customerName: string;
  timecards: Timecard[];
};

/**
 * ArticleByCustomerTimecards
 *
 * Renders a drill-down view of article/items grouped by customer and then by timecard.
 * Uses <details>/<summary> to keep the UI lightweight and accessible without extra JS.
 *
 * Notes:
 * - The outer <details> is controlled so the chevron rotation stays in sync with "open".
 * - Inner <details> are intentionally uncontrolled (browser-managed) for simplicity and performance.
 */
export function ArticleByCustomerTimecards({
  data,
  title = "Articles by customer → timecards",
}: {
  data?: Row[];
  title?: string;
}) {
  const list = data ?? [];
  const [open, setOpen] = useState(false);

  return (
    <details
      className="rounded-xl border bg-background"
      open={open}
      onToggle={(e) => {
        // Only react to toggles on THIS <details>, not nested ones.
        if (e.target !== e.currentTarget) return;
        setOpen((e.currentTarget as HTMLDetailsElement).open);
      }}
    >
      <summary className="cursor-pointer list-none p-4 flex items-center justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">
            Click to view timecards and products per customer
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </summary>

      <div className="p-4 pt-0 space-y-3">
        {!list.length ? (
          <div className="text-sm text-muted-foreground">No data.</div>
        ) : (
          list.map((cust, idx) => (
            // Use a stable key. customerId can be null, so include index as a safe fallback.
            <details
              key={`${cust.customerId ?? "null"}:${idx}`}
              className="group rounded-lg border p-3"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <div className="font-medium truncate">{cust.customerName || "—"}</div>
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>

              {cust.timecards.length === 0 ? (
                <div className="mt-2 text-sm text-muted-foreground">—</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {cust.timecards.map((tc) => (
                    <details
                      key={tc.timeReportId}
                      className="group rounded-md bg-muted/40 p-2"
                    >
                      <summary className="flex items-center justify-between cursor-pointer list-none">
                        <div className="text-sm font-medium">
                          {tc.date} · #{tc.timeReportId}
                        </div>

                        {/* This summary can get long if there are many items.
                            If it becomes noisy later, consider truncating or showing "N items". */}
                        <div className="text-xs text-muted-foreground text-right">
                          {tc.items.map((it, i2) => (
                            <span key={`${it.kind}:${it.articleId ?? "x"}:${i2}`}>
                              {it.label} ×{it.qty}
                              {i2 < tc.items.length - 1 ? ", " : ""}
                            </span>
                          ))}
                        </div>
                      </summary>

                      <div className="mt-2 overflow-auto">
                        <table className="w-full text-xs">
                          <thead className="text-muted-foreground">
                            <tr>
                              <th scope="col" className="text-left py-1 pr-2">
                                Product
                              </th>
                              <th scope="col" className="text-right py-1 pl-2">
                                Qty
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {tc.items.map((it, i) => (
                              <tr
                                key={`${it.kind}:${it.articleId ?? "x"}:${i}`}
                                className="border-t"
                              >
                                <td className="py-1 pr-2 truncate max-w-[60ch]">
                                  {it.label}
                                </td>
                                <td className="py-1 pl-2 text-right">{it.qty}</td>
                              </tr>
                            ))}
                            <tr className="border-t font-medium">
                              <td className="py-1 pr-2 text-right">Total</td>
                              <td className="py-1 pl-2 text-right">{tc.totalQty}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </details>
          ))
        )}
      </div>
    </details>
  );
}
