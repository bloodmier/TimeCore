import {
  Fragment,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { ChevronUp, ChevronsUpDown, Check, ChevronDown } from "lucide-react";
import type { TimeReportPatch, TimeReportRow } from "../../models/timeReports";
import { TimeReportSummary } from "./TimeReportSummary";
import { TimeReportEditDialogV2 } from "./TimeReportEditDialogV2";
import type {
  ArticleSearch,
  CustomerData,
  LookupData,
} from "../../hooks/useTimeOverveiw";
import { RemoveButton } from "./RemoveButton";

type Props = {
  rows: TimeReportRow[];
  onUpdate?: (
    id: string | number,
    patch: TimeReportPatch
  ) => Promise<void> | void;
  customerData: CustomerData;
  lookupData: LookupData;
  articleSearch: ArticleSearch;
  ondelete: (id: number) => void;
};

const toHours = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v)
    ? v.toFixed(v % 1 === 0 ? 0 : 2)
    : "—";

const prettyDate = (ymd: string) => ymd;

type SortKey =
  | "date"
  | "customerName"
  | "projectName"
  | "category"
  | "hours"
  | "billable";
type SortDir = "asc" | "desc";

const CellToggle = ({
  children,
  onToggle,
  controlsId,
  expanded,
  focusable = false,
  className = "",
  ariaLabel,
}: {
  children: React.ReactNode;
  onToggle: () => void;
  controlsId?: string;
  expanded?: boolean;
  focusable?: boolean;
  className?: string;
  ariaLabel?: string;
}) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onToggle();
    }}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }
    }}
    className={`w-full bg-transparent hover:bg-muted/40 rounded-md px-2 py-1 ${className}`}
    aria-controls={focusable ? controlsId : undefined}
    aria-expanded={focusable ? expanded : undefined}
    aria-label={ariaLabel}
    tabIndex={focusable ? 0 : -1}
  >
    {children}
  </button>
);

const Collapse = ({
  open,
  children,
  id,
  className = "",
}: {
  open: boolean;
  children: React.ReactNode;
  id?: string;
  className?: string;
}) => (
  <div
    id={id}
    data-expanded={open ? "true" : "false"}
    aria-hidden={!open}
    className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out
      max-h-0 opacity-0 data-[expanded=true]:max-h-[1500px] data-[expanded=true]:opacity-100 ${className}`}
  >
    {children}
  </div>
);

export function TimeReportsTable({
  rows,
  onUpdate,
  ondelete,
  customerData,
  lookupData,
  articleSearch,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  const headerHostRef = useRef<HTMLDivElement | null>(null);
  const bodyHostRef = useRef<HTMLDivElement | null>(null);
  const headerInnerRef = useRef<HTMLDivElement | null>(null);

  const requestSort = useCallback((key: SortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prevKey;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) =>
    !active ? (
      <ChevronsUpDown className="h-4 w-4 opacity-50" />
    ) : dir === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      let av: any, bv: any;

      switch (sortKey) {
        case "date":
          av = a.date ?? "";
          bv = b.date ?? "";
          break;
        case "customerName":
          av = (a.customerName ?? "").toLowerCase();
          bv = (b.customerName ?? "").toLowerCase();
          break;
        case "projectName":
          av = (a.projectName ?? "").toLowerCase();
          bv = (b.projectName ?? "").toLowerCase();
          break;
        case "category":
          av = (a.category ?? "").toLowerCase();
          bv = (b.category ?? "").toLowerCase();
          break;
        case "hours":
          av = typeof a.hours === "number" ? a.hours : Number(a.hours) || 0;
          bv = typeof b.hours === "number" ? b.hours : Number(b.hours) || 0;
          break;
        case "billable":
          av = a.billable ? 1 : 0;
          bv = b.billable ? 1 : 0;
          break;
        default:
          av = 0;
          bv = 0;
      }

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const totals = useMemo(() => {
    return sorted.reduce(
      (acc, r) => {
        const h = typeof r.hours === "number" ? r.hours : Number(r.hours) || 0;
        acc.hours += h;
        acc.billableHours += r.billable ? h : 0;
        return acc;
      },
      { hours: 0, billableHours: 0 }
    );
  }, [sorted]);

  useLayoutEffect(() => {
    const headerHost = headerHostRef.current;
    const bodyHost = bodyHostRef.current;
    const headerInner = headerInnerRef.current;
    if (!headerHost || !bodyHost || !headerInner) return;

    const headerTable = headerHost.querySelector("table");
    const bodyTable = bodyHost.querySelector("table");
    if (!headerTable || !bodyTable) return;

    const findFirstVisibleRow = () => {
      const rs = bodyTable.querySelectorAll("tbody > tr");
      for (const r of Array.from(rs)) {
        const el = r as HTMLElement;
        if (el.matches(".hidden")) continue;
        if (el.querySelector("td[data-col]")) return el;
      }
      return null;
    };

    const syncWidths = () => {
      const row = findFirstVisibleRow();
      if (!row) return;

      const bodyCells = Array.from(
        row.querySelectorAll<HTMLTableCellElement>("td[data-col]")
      ).filter((td) => td.offsetParent !== null);

      const widths = new Map<string, number>();
      for (const td of bodyCells) {
        const id = td.dataset.col!;
        widths.set(id, Math.ceil(td.getBoundingClientRect().width));
      }

      const headCells =
        headerTable.querySelectorAll<HTMLTableCellElement>("th[data-col]");
      headCells.forEach((th) => {
        const id = th.dataset.col!;
        const w = widths.get(id);
        if (w != null) {
          th.style.width = `${w}px`;
          th.style.minWidth = `${w}px`;
          th.style.maxWidth = `${w}px`;
        } else {
          th.style.removeProperty("width");
          th.style.removeProperty("min-width");
          th.style.removeProperty("max-width");
        }
      });
    };

    const onScrollX = () => {
      headerInner.style.transform = `translateX(${-bodyHost.scrollLeft}px)`;
    };

    // Throttle sync with RAF to avoid RO spam
    const rafId = { current: 0 as number | null };
    const safeSync = () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(syncWidths);
    };

    const ro = new ResizeObserver(safeSync);
    ro.observe(bodyHost);
    ro.observe(headerHost);

    window.addEventListener("resize", safeSync, { passive: true });
    bodyHost.addEventListener("scroll", onScrollX, { passive: true });

    safeSync();
    onScrollX();

    const initial = requestAnimationFrame(safeSync);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", safeSync);
      bodyHost.removeEventListener("scroll", onScrollX);
      if (rafId.current) cancelAnimationFrame(rafId.current);
      cancelAnimationFrame(initial);
    };
  }, [sorted, expandedId]);

  return (
    <section className="w-full mx-auto grid gap-3">
      {/* MOBILE (<935px) */}
      <div className="min-[935px]:hidden grid gap-2">
        {sorted.map((r) => {
          const isOpen = expandedId === r.id;
          const toggle = () =>
            setExpandedId((prev) => (prev === r.id ? null : r.id));
          const mobileExpId = `exp-mobile-${r.id}`;

          const isLocked = !!r.billed;

          return (
            <div
              key={`card-${r.id}`}
              className={`rounded-xl border p-3 grid gap-2 ${
                isLocked ? "opacity-60 bg-muted/20" : ""
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 -ml-1 rounded-md px-1.5 py-1 hover:bg-muted/40"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle();
                  }}
                  aria-controls={mobileExpId}
                  aria-expanded={isOpen}
                  aria-label={`Toggle details for time report ${String(r.id)}`}
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                  <span className="text-sm font-medium truncate">
                    {r.customerName ?? "—"}
                  </span>
                </button>

                <div className="text-xs text-muted-foreground">
                  {prettyDate(r.date)}
                </div>
              </div>

              {(r.workDescription || r.note) && (
                <div className="text-sm text-muted-foreground">
                  {r.workDescription ?? r.note}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {r.category ? (
                  <Badge variant="secondary">{r.category}</Badge>
                ) : null}
                {r.projectName ? (
                  <span className="text-xs">Project: {r.projectName}</span>
                ) : null}
                {r.billable ? (
                  <span className="text-xs">Billable</span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Non-billable
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between border-t pt-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Hours: </span>
                  <span className="font-medium">{toHours(r.hours)}</span>
                </div>
              </div>

              <Collapse
                open={isOpen}
                id={mobileExpId}
                className="rounded-md border bg-muted/30 mt-2"
              >
                <div className="p-3 space-y-3 overflow-visible">
                  <TimeReportSummary row={r} columns={1} />
                  <div className="flex justify-end gap-2">
                    {isLocked ? (
                      <span className="text-xs text-muted-foreground italic">
                        Billed — locked
                      </span>
                    ) : (
                      <>
                        <RemoveButton
                          deleteid={r.id}
                          onDelete={ondelete}
                          label="Delete"
                        />
                        <TimeReportEditDialogV2
                          row={r}
                          onSave={onUpdate}
                          customerData={customerData}
                          lookupData={lookupData}
                          articleSearch={articleSearch}
                        />
                      </>
                    )}
                  </div>
                </div>
              </Collapse>
            </div>
          );
        })}

        <div className="rounded-xl border p-3 bg-muted/30" aria-label="Totals">
          <div className="flex items-center justify-between">
            <div className="font-medium">Total</div>
            <div className="text-sm">{toHours(totals.hours)} h</div>
          </div>
          <div className="text-xs text-muted-foreground">
            Billable hours: {toHours(totals.billableHours)}
          </div>
        </div>
      </div>

      {/* TABLE (>=935px) */}
      <div
        ref={headerHostRef}
        className="hidden min-[935px]:block w-full sticky top-0 z-20 bg-background table-fixed"
      >
        <div ref={headerInnerRef} className="will-change-transform">
          <Table className="w-full table-fixed">
            <TableHeader className="w-full bg-background">
              <TableRow className="w-full bg-background">
                <TableHead data-col="date" className="w-[160px]">
                  <button
                    onClick={() => requestSort("date")}
                    className="inline-flex items-center gap-1 font-medium"
                    aria-label="Sort by date"
                  >
                    Date <SortIcon active={sortKey === "date"} dir={sortDir} />
                  </button>
                </TableHead>

                <TableHead
                  data-col="customer"
                  className="inline-flex w-full items-center justify-center gap-1 font-medium truncate whitespace-nowrap overflow-hidden"
                >
                  <button
                    onClick={() => requestSort("customerName")}
                    className="inline-flex items-center gap-1 font-medium"
                    aria-label="Sort by customer"
                  >
                    Customer{" "}
                    <SortIcon
                      active={sortKey === "customerName"}
                      dir={sortDir}
                    />
                  </button>
                </TableHead>

                <TableHead
                  data-col="project"
                  className="hidden min-[1056px]:table-cell text-center"
                >
                  <button
                    onClick={() => requestSort("projectName")}
                    className="inline-flex items-center gap-1 font-medium"
                    aria-label="Sort by project"
                  >
                    Project{" "}
                    <SortIcon
                      active={sortKey === "projectName"}
                      dir={sortDir}
                    />
                  </button>
                </TableHead>

                <TableHead data-col="category">
                  <button
                    onClick={() => requestSort("category")}
                    className="inline-flex items-center gap-1 font-medium"
                    aria-label="Sort by category"
                  >
                    Category{" "}
                    <SortIcon active={sortKey === "category"} dir={sortDir} />
                  </button>
                </TableHead>

                <TableHead data-col="hours" className="text-center">
                  <button
                    onClick={() => requestSort("hours")}
                    className="inline-flex w-full items-center justify-center gap-1 font-medium truncate whitespace-nowrap overflow-hidden"
                    aria-label="Sort by hours"
                  >
                    Hours{" "}
                    <SortIcon active={sortKey === "hours"} dir={sortDir} />
                  </button>
                </TableHead>

                <TableHead data-col="billable" className="text-center">
                  <button
                    onClick={() => requestSort("billable")}
                    className="inline-flex items-center gap-1 font-medium"
                    aria-label="Sort by billable"
                  >
                    Billable{" "}
                    <SortIcon active={sortKey === "billable"} dir={sortDir} />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
          </Table>
        </div>
      </div>

      <div
        ref={bodyHostRef}
        className="hidden min-[935px]:block rounded-xl overflow-x-auto overflow-y-hidden border w-full"
      >
        <Table className="w-full table-fixed">
          <TableBody>
            {sorted.map((r) => {
              const isOpen = expandedId === r.id;
              const toggle = () =>
                setExpandedId((prev) => (prev === r.id ? null : r.id));

              const expMdId = `exp-md-${r.id}`;
              const expLgId = `exp-lg-${r.id}`;

              return (
                <Fragment key={`row-${r.id}`}>
                  <TableRow
                    className={`${
                      isOpen ? "bg-muted/30" : "hover:bg-muted/50"
                    } ${r.billed ? "opacity-60 bg-muted/20" : ""}`}
                    aria-expanded={isOpen}
                  >
                    <TableCell data-col="date" className="w-[160px]">
                      <CellToggle
                        focusable
                        controlsId={expLgId}
                        expanded={isOpen}
                        onToggle={toggle}
                        ariaLabel={`Toggle details for time report ${String(
                          r.id
                        )}`}
                      >
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              isOpen ? "rotate-180" : ""
                            }`}
                            aria-hidden
                          />
                          <span>{prettyDate(r.date)}</span>
                        </div>
                      </CellToggle>
                    </TableCell>

                    <TableCell data-col="customer" className="max-w-[320px]">
                      <CellToggle
                        onToggle={toggle}
                        ariaLabel={`Toggle details for customer row ${String(
                          r.id
                        )}`}
                      >
                        <div className="truncate font-medium">
                          {r.customerName ?? "—"}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.workDescription ?? r.note ?? ""}
                        </div>
                      </CellToggle>
                    </TableCell>

                    <TableCell
                      data-col="project"
                      className="hidden min-[1056px]:table-cell text-center"
                    >
                      <CellToggle
                        onToggle={toggle}
                        className="flex justify-center text-center"
                      >
                        {r.projectName ?? "—"}
                      </CellToggle>
                    </TableCell>

                    <TableCell data-col="category">
                      {(() => {
                        const cat =
                          (r as any).category ?? (r as any).categoryName;
                        return cat ? (
                          <Badge variant="secondary">{cat}</Badge>
                        ) : (
                          "—"
                        );
                      })()}
                    </TableCell>

                    <TableCell data-col="hours" className="text-right">
                      <CellToggle onToggle={toggle}>
                        {toHours(r.hours)}
                      </CellToggle>
                    </TableCell>

                    <TableCell data-col="billable" className="text-center">
                      <CellToggle
                        onToggle={toggle}
                        className="flex justify-center text-center"
                      >
                        {r.billable ? (
                          <Check className="h-4 w-4" aria-hidden />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </CellToggle>
                    </TableCell>
                  </TableRow>

                  <TableRow
                    id={expMdId}
                    className={`hidden ${
                      isOpen ? "min-[935px]:table-row" : "min-[935px]:hidden"
                    } min-[1056px]:hidden`}
                    aria-hidden={!isOpen}
                  >
                    <TableCell colSpan={5} className="bg-muted/30 p-0">
                      <Collapse open={isOpen}>
                        <div className="p-4">
                          <TimeReportSummary row={r} columns={2} dense />
                          <div className="flex justify-end mt-3 gap-2">
                            {r.billed ? (
                              <span className="text-xs text-muted-foreground italic">
                                Billed — locked
                              </span>
                            ) : (
                              <>
                                <RemoveButton
                                  deleteid={r.id}
                                  onDelete={ondelete}
                                  label="Delete"
                                />
                                <TimeReportEditDialogV2
                                  row={r}
                                  onSave={onUpdate}
                                  customerData={customerData}
                                  lookupData={lookupData}
                                  articleSearch={articleSearch}
                                />
                              </>
                            )}
                          </div>
                        </div>
                      </Collapse>
                    </TableCell>
                  </TableRow>

                  <TableRow
                    id={expLgId}
                    className={`hidden ${
                      isOpen ? "min-[1056px]:table-row" : "min-[1056px]:hidden"
                    }`}
                    aria-hidden={!isOpen}
                  >
                    <TableCell colSpan={6} className="bg-muted/30 p-0">
                      <Collapse open={isOpen}>
                        <div className="p-4">
                          <TimeReportSummary row={r} columns={3} dense />
                          <div className="flex justify-end mt-3 gap-2">
                            {r.billed ? (
                              <span className="text-xs text-muted-foreground italic">
                                Billed — locked
                              </span>
                            ) : (
                              <>
                                <RemoveButton
                                  deleteid={r.id}
                                  onDelete={ondelete}
                                  label="Delete"
                                />
                                <TimeReportEditDialogV2
                                  row={r}
                                  onSave={onUpdate}
                                  customerData={customerData}
                                  lookupData={lookupData}
                                  articleSearch={articleSearch}
                                />
                              </>
                            )}
                          </div>
                        </div>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}

            <TableRow className="bg-muted/30 hidden min-[935px]:table-row min-[1056px]:hidden">
              <TableCell colSpan={3} className="text-right font-medium">
                Total
              </TableCell>
              <TableCell className="text-right font-semibold">
                {toHours(totals.hours)}
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">
                {toHours(totals.billableHours)} billable
              </TableCell>
            </TableRow>

            <TableRow className="bg-muted/30 hidden min-[1056px]:table-row">
              <TableCell colSpan={4} className="text-right font-medium">
                Total
              </TableCell>
              <TableCell className="text-right font-semibold">
                {toHours(totals.hours)}
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">
                {toHours(totals.billableHours)} billable
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
