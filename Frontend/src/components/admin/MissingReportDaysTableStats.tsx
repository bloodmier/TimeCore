import { useMemo, useState } from "react";

type MissingRow = {
  userId: number;
  name: string;
  missingCount: number;
  missingDates?: string[];
};

/**
 * MissingReportDaysTableStats
 *
 * Displays employees with missing time reporting days in a table.
 * - Rows are sorted by missingCount (descending) for quick triage
 * - Each employee row can be expanded to show all missing dates
 * - When collapsed, only a short preview of dates is shown
 */
export function MissingReportDaysTableStats({
  data,
  title = "Days without reporting",
  maxPreviewDates = 6,
}: {
  data: MissingRow[];
  title?: string;
  maxPreviewDates?: number;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  // Toggle which user row is expanded (only one open at a time).
  const toggle = (uid: number) =>
    setExpanded((cur) => (cur === uid ? null : uid));

  // Sort rows (highest missingCount first, then name).
  const rows = useMemo(
    () =>
      (data ?? [])
        .slice()
        .sort(
          (a, b) =>
            b.missingCount - a.missingCount || a.name.localeCompare(b.name)
        ),
    [data]
  );

  return (
    <div className="w-full rounded-xl border bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th scope="col" className="py-2 pr-2 text-left font-medium">
                Employee
              </th>
              <th scope="col" className="py-2 px-2 text-left font-medium">
                Missing days
              </th>
              <th scope="col" className="py-2 pl-2 text-left font-medium">
                Dates
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="py-6 text-center text-muted-foreground"
                >
                  No missing days 🎉
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const isOpen = expanded === r.userId;
                const list = r.missingDates ?? [];
                const preview = list.slice(0, maxPreviewDates);
                const rest = Math.max(0, list.length - preview.length);

                return (
                  <tr key={r.userId} className="border-b align-top">
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggle(r.userId)}
                          className="rounded-md px-2 py-1 text-xs hover:bg-muted/60"
                          disabled={list.length === 0}
                          aria-expanded={isOpen}
                          aria-label={
                            list.length === 0
                              ? `No missing dates available for ${r.name}`
                              : `${isOpen ? "Hide" : "Show"} missing dates for ${r.name}`
                          }
                          title={
                            list.length === 0
                              ? "No dates available"
                              : isOpen
                              ? "Hide dates"
                              : "Show dates"
                          }
                        >
                          {isOpen ? "−" : "+"}
                        </button>

                        <span className="font-medium">{r.name}</span>
                      </div>
                    </td>

                    <td className="py-2 px-2">
                      <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded-md border px-2 py-1 font-mono">
                        {r.missingCount}
                      </span>
                    </td>

                    <td className="py-2 pl-2">
                      {list.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : !isOpen ? (
                        <>
                          <span className="font-mono">{preview.join(", ")}</span>
                          {rest > 0 && (
                            <span className="text-muted-foreground">
                              {" "}
                              … (+{rest})
                            </span>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {list.map((d) => (
                            <span
                              key={d}
                              className="rounded-md border px-2 py-1 font-mono"
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
