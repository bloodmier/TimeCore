/**
 * useUserTimeReportsInfinite
 *
 * Main data hook for the "Time Overview" list.
 *
 * Responsibilities:
 * - Manages query params (date range, search, status, limit, cursor)
 * - Loads paged results from GET /time-reports (cursor pagination)
 * - Loads aggregated summary from GET /time-reports/summary
 * - Provides optimistic update/delete handlers:
 *   - handleUpdate(id, patch) -> PUT /time-reports/:id
 *   - handleDelete(id)        -> DELETE /time-reports/:id
 * - Exposes "loadMore" for infinite scrolling
 *
 * Notes:
 * - Pagination is cursor-based and stable for infinite scroll
 * - Summary prefers server values but falls back to computed page summary
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  GetTimeReportsParams,
  Summary,
  TimeReportPatch,
  TimeReportRow,
} from "../models/timeReports";
import { getMonthRange } from "../helpers/TimeHelpersfunctions";
import { TimeReportsService } from "../services/timeReportsService";

const CHUNK_SIZE = 25;

type Params = {
  start: string;
  end: string;
  q?: string;
  limit?: number;
  cursor?: string;
  status?: "billed" | "unbilled";
};

export function parseIdQuery(q: string): number | null {
  const s = (q ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith("id:")) {
    const n = Number(s.slice(3).trim());
    return Number.isFinite(n) ? n : null;
  }
  if (s.startsWith("#")) {
    const n = Number(s.slice(1).trim());
    return Number.isFinite(n) ? n : null;
  }
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function useUserTimeReportsInfinite(initial?: Partial<Params>) {
  const { start: defStart, end: defEnd } = getMonthRange(0);

  const [params, setParams] = useState<Params>({
    start: initial?.start ?? defStart,
    end: initial?.end ?? defEnd,
    status: initial?.status,
    q: initial?.q ?? "",
    limit: initial?.limit ?? CHUNK_SIZE,
    cursor: undefined,
  });

  const [rows, setRows] = useState<TimeReportRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);

  const [loadingFirst, setLoadingFirst] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const hasMore = !!nextCursor;

  const refetch = useCallback(async () => {
    setLoadingFirst(true);
    setError(null);
    try {
      const res = await TimeReportsService.list<TimeReportRow>({
        start: params.start,
        end: params.end,
        status: params.status,
        q: params.q,
        limit: params.limit,
      } as GetTimeReportsParams);

      const first = (res?.items ?? []).map(TimeReportsService.normalizeRow);
      setRows(first);
      setNextCursor(res?.nextCursor);
    } catch (e: any) {
      setRows([]);
      setNextCursor(undefined);
      setError(e?.message ?? "Failed to fetch time reports");
    } finally {
      setLoadingFirst(false);
    }
  }, [params.start, params.end, params.status, params.q, params.limit]);

  const refetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const s = await TimeReportsService.summary({
        start: params.start,
        end: params.end,
        status: params.status,
        q: params.q,
      } as GetTimeReportsParams);
      setSummary(s);
    } catch {
    } finally {
      setLoadingSummary(false);
    }
  }, [params.start, params.end, params.status, params.q]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    void refetchSummary();
  }, [refetchSummary]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);

    try {
      const res = await TimeReportsService.list<TimeReportRow>({
        start: params.start,
        end: params.end,
        status: params.status,
        q: params.q,
        limit: params.limit,
        cursor: nextCursor,
      } as GetTimeReportsParams);

      const more = (res?.items ?? []).map(TimeReportsService.normalizeRow);
      setRows((prev) => prev.concat(more));
      setNextCursor(res?.nextCursor);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, params.start, params.end, params.status, params.q, params.limit]);

  const handleUpdate = useCallback(
    async (id: string | number, patch: TimeReportPatch) => {
      let rollback: TimeReportRow[] | null = null;

      setRows((prev) => {
        rollback = prev;
        return prev.map((r) => (r.id === id ? ({ ...r, ...patch } as any) : r));
      });

      try {
        const serverRow = await TimeReportsService.update(Number(id), patch);
        const normalized = TimeReportsService.normalizeRow(serverRow);
        setRows((prev) => prev.map((r) => (r.id === id ? normalized : r)));
        void refetchSummary();
      } catch (e: any) {
        if (rollback) setRows(rollback);
        setError(e?.message ?? "Failed to update report");
      }
    },
    [refetchSummary]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      let rollback: TimeReportRow[] | null = null;

      setRows((prev) => {
        rollback = prev;
        return prev.filter((r) => r.id !== id);
      });

      try {
        await TimeReportsService.remove(id);
        void refetchSummary();
      } catch (e: any) {
        if (rollback) setRows(rollback);
        setError(e?.message ?? "Failed to delete report");
      }
    },
    [refetchSummary]
  );

  const resetAnd = useCallback(
    (updater: (p: Params) => Params) => {
      const next = updater({ ...params, cursor: undefined });

      const same =
        next.start === params.start &&
        next.end === params.end &&
        (next.status ?? undefined) === (params.status ?? undefined) &&
        (next.q ?? "") === (params.q ?? "") &&
        (next.limit ?? CHUNK_SIZE) === (params.limit ?? CHUNK_SIZE);

      setRows([]);
      setNextCursor(undefined);
      setParams(next);

      if (same) queueMicrotask(() => void refetch());
    },
    [params, refetch]
  );

  const setSearch = useCallback(
    (raw: string) => resetAnd((p) => ({ ...p, q: raw ?? "" })),
    [resetAnd]
  );

  const setRange = useCallback(
    (start: string, end: string) => resetAnd((p) => ({ ...p, start, end })),
    [resetAnd]
  );

  const setPageSize = useCallback(
    (limit: number) => resetAnd((p) => ({ ...p, limit: Math.max(1, limit || CHUNK_SIZE) })),
    [resetAnd]
  );

  const pageSummary: Summary = useMemo(() => {
    const totalHours = rows.reduce((s, r) => s + (Number(r.hours) || 0), 0);
    const billableHours = rows.reduce(
      (s, r) => s + ((r.billable ? Number(r.hours) : 0) || 0),
      0
    );
    const nonBillableHours = totalHours - billableHours;
    const daysReported = new Set(rows.map((r) => r.date)).size;

    const vacationHours = rows.reduce((s, r) => {
      const name = String(r.workDescription || r.category || r.categoryName || "").toLowerCase();
      return name === "vacation" ? s + (Number(r.hours) || 0) : s;
    }, 0);

    const sickHours = rows.reduce((s, r) => {
      const name = String(r.workDescription || r.category || r.categoryName || "").toLowerCase();
      return name === "sick" ? s + (Number(r.hours) || 0) : s;
    }, 0);

    return {
      totalHours: Number(totalHours.toFixed(2)),
      billableHours: Number(billableHours.toFixed(2)),
      nonBillableHours: Number(nonBillableHours.toFixed(2)),
      daysReported,
      vacationHours: Number(vacationHours.toFixed(2)),
      sickHours: Number(sickHours.toFixed(2)),
    };
  }, [rows]);

  const summaryPreferServer: Summary = summary ?? pageSummary;

  return {
    rows,
    hasMore,
    loadingFirst,
    loadingMore,
    error,

    refetch,
    loadMore,
    handleUpdate,
    handleDelete,

    params,
    setRange,
    setSearch,
    setPageSize,

    summary: summaryPreferServer,
    pageSummary,
    totalSummary: summary,
    loadingSummary,
  };
}
