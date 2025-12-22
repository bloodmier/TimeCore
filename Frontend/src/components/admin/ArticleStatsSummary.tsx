import { useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { ArticleByCustomerTimecards } from "./ArticleByCustomerTimecards";

type Registered = { articleId: number; label: string; count: number };
type Custom = { label: string; count: number };

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

type Props = {
  registered: Registered[];
  custom: Custom[];
  articleMode?: "all" | "registered" | "custom";
  activeRegisteredIds?: number[]; // from <ArticleRegisteredMulti>
  activeCustomQuery?: string; // from <ArticleCustomFilter>
  title?: string;
  data?: Row[];
};

/**
 * ArticleStatsSummary
 *
 * Shows a summary of article usage in the current stats selection.
 * - Supports filtering by article mode (all/registered/custom)
 * - Supports local (client-side) search in the summary lists
 * - Optionally renders a drill-down view (customer -> timecards -> items)
 *
 * Important: all filtering here is client-side; backend filtering is controlled via the parent filter state.
 */
export function ArticleStatsSummary({
  registered,
  custom,
  articleMode = "all",
  activeRegisteredIds = [],
  activeCustomQuery = "",
  title = "Article summary (from stats)",
  data,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const reg = registered ?? [];
  const cus = custom ?? [];

  // Totals (raw, before local search)
  const totalRegRaw = reg.reduce((s, x) => s + (x.count || 0), 0);
  const totalCusRaw = cus.reduce((s, x) => s + (x.count || 0), 0);

  // Normalize search inputs (client-side only)
  const qLower = q.trim().toLowerCase();
  const customQueryLower = (activeCustomQuery ?? "").trim().toLowerCase();

  // Precompute selected registered ids as a Set for fast lookups (O(1)).
  const activeRegSet = useMemo(
    () => new Set(activeRegisteredIds),
    [activeRegisteredIds]
  );

  // Step 1: apply mode filter (registered/custom/all) + registered id filter if present.
  const regModeFiltered = useMemo(() => {
    if (articleMode !== "registered") return reg;
    if (activeRegisteredIds.length) {
      return reg.filter((r) => activeRegSet.has(r.articleId));
    }
    return reg;
  }, [articleMode, reg, activeRegisteredIds.length, activeRegSet]);

  const cusModeFiltered = useMemo(() => {
    if (articleMode !== "custom") return cus;
    if (customQueryLower) {
      return cus.filter((c) =>
        (c.label ?? "").toLowerCase().includes(customQueryLower)
      );
    }
    return cus;
  }, [articleMode, cus, customQueryLower]);

  // Step 2: apply local search (client-side search inside the summary tables).
  const regFiltered = useMemo(() => {
    if (!qLower) return regModeFiltered;
    return regModeFiltered.filter((r) =>
      (r.label ?? "").toLowerCase().includes(qLower)
    );
  }, [regModeFiltered, qLower]);

  const cusFiltered = useMemo(() => {
    if (!qLower) return cusModeFiltered;
    return cusModeFiltered.filter((c) =>
      (c.label ?? "").toLowerCase().includes(qLower)
    );
  }, [cusModeFiltered, qLower]);

  // Totals after filters
  const totalReg = regFiltered.reduce((s, x) => s + (x.count || 0), 0);
  const totalCus = cusFiltered.reduce((s, x) => s + (x.count || 0), 0);

  const hint =
    articleMode === "registered"
      ? activeRegisteredIds.length
        ? `Filter: ${activeRegisteredIds.length} registered`
        : "Filter: registered (all)"
      : articleMode === "custom"
      ? activeCustomQuery
        ? `Filter: custom matching “${activeCustomQuery}”`
        : "Filter: custom (all)"
      : "Filter: all articles";

  // Render helper for a summary section table.
  const Section = ({
    header,
    rows,
    emptyText,
    total,
  }: {
    header: string;
    rows: Array<{ key: string; label: string; count: number }>;
    emptyText: string;
    total: number;
  }) => (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <div className="text-sm font-medium">{header}</div>
        <div className="text-xs text-muted-foreground">
          {rows.length} items · total {total}
        </div>
      </div>

      {!rows.length ? (
        <div className="text-sm text-muted-foreground">{emptyText}</div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="text-left py-2 pr-2">
                  Article
                </th>
                <th scope="col" className="text-right py-2 px-2">
                  Count
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b last:border-0">
                  <td className="py-2 pr-2">
                    <div className="truncate">
                      {r.label || "(no description)"}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const regRows = useMemo(
    () =>
      regFiltered
        .slice()
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .map((x) => ({
          key: `reg:${x.articleId}`,
          label: x.label,
          count: x.count,
        })),
    [regFiltered]
  );

  const cusRows = useMemo(
    () =>
      cusFiltered
        .slice()
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        // Safer key: include label + count + index (labels may repeat)
        .map((x, i) => ({
          key: `cus:${x.label}:${x.count}:${i}`,
          label: x.label,
          count: x.count,
        })),
    [cusFiltered]
  );

  const uniqueCount =
    (articleMode === "custom" ? 0 : regFiltered.length) +
    (articleMode === "registered" ? 0 : cusFiltered.length);

  // Filter the drill-down data using the same mode/search logic as the summary.
  const dataFiltered = useMemo(() => {
    if (!data) return undefined;

    const itemMatches = (it: Item) => {
      const label = (it.label ?? "").toLowerCase();

      // Mode filter
      if (articleMode === "registered") {
        if (it.kind !== "registered") return false;
        if (activeRegisteredIds.length && !activeRegSet.has(it.articleId ?? -1))
          return false;
      } else if (articleMode === "custom") {
        if (it.kind !== "custom") return false;
        if (customQueryLower && !label.includes(customQueryLower)) return false;
      }

      // Local search
      if (qLower && !label.includes(qLower)) return false;

      return true;
    };

    return data
      .map((cust) => {
        const timecards = cust.timecards
          .map((tc) => {
            const items = tc.items.filter(itemMatches);
            if (items.length === 0) return null;

            const totalQty = items.reduce((s, x) => s + (x.qty ?? 0), 0);
            return { ...tc, items, totalQty };
          })
          .filter((x): x is NonNullable<typeof x> => Boolean(x));

        if (timecards.length === 0) return null;
        return { ...cust, timecards };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [
    data,
    articleMode,
    activeRegisteredIds.length,
    activeRegSet,
    customQueryLower,
    qLower,
  ]);

  return (
    <details
      className="rounded-xl border bg-background"
      open={open}
      onToggle={(e) => {
        if (e.target !== e.currentTarget) return;
        setOpen((e.currentTarget as HTMLDetailsElement).open);
      }}
    >
      <summary className="cursor-pointer list-none p-4 flex items-center justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {hint} · {uniqueCount} unique articles
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </summary>

      <div className="p-4 pt-0 space-y-4">
        {/* Client-side search within the already loaded stats (no extra API calls). */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-80">
            <input
              className="w-full rounded-md border px-8 py-2 text-sm"
              placeholder="Search articles…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />

            {q && (
              <button
                type="button"
                className="absolute right-2 top-2.5"
                title="Clear"
                aria-label="Clear search"
                onClick={() => setQ("")}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <div className="ml-auto text-sm text-muted-foreground">
            Total (raw): {totalRegRaw + totalCusRaw}
          </div>
        </div>

        {/* Sections */}
        {(articleMode === "all" || articleMode === "registered") && (
          <Section
            header="Registered"
            rows={regRows}
            emptyText="No registered articles in the current selection."
            total={totalReg}
          />
        )}

        {(articleMode === "all" || articleMode === "custom") && (
          <Section
            header="Custom"
            rows={cusRows}
            emptyText="No custom descriptions in the current selection."
            total={totalCus}
          />
        )}
      </div>

      <ArticleByCustomerTimecards data={dataFiltered} />
    </details>
  );
}
