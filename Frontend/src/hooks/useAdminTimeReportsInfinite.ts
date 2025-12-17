/**
 * useAdminTimeReportsInfinite
 *
 * Admin-facing hook for browsing, filtering and managing time reports
 * using infinite scrolling.
 *
 * Responsibilities:
 * - Fetches paginated admin time reports with cursor-based pagination
 * - Supports filtering by date range, user, billing status and search query
 * - Handles optimistic updates and deletes with safe rollback
 * - Fetches and exposes tenant users for filtering
 * - Fetches server-side summary statistics
 * - Provides a client-side fallback summary when server summary is unavailable
 *
 * Technical details:
 * - Uses cookie-based authentication via AdminTimeOverviewService
 * - Protects against stale responses using request id guards
 * - Uses refs to avoid closure-related rollback bugs
 * - Designed for admin-only routes
 *
 * @param initial Optional initial filter parameters (date range, scope, limit, etc.)
 * @returns State and handlers for admin time report overview pages
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  GetTimeReportsParams,
  Summary,
  TimeReportPatch,
  TimeReportRow,
  Scope,
  IUser,
} from "../models/timeReports";
import { AdminTimeOverviewService } from "../services/AdminTimeoverveiwservice";
import { getMonthRange } from "../helpers/TimeHelpersfunctions";

const CHUNK_SIZE = 25;

type ExtraParams = {
  q?: string;
  scope?: Scope;
  userId?: number;
  userIds?: number[];
  limit?: number;
  cursor?: string;
};

type Params = {
  start: string;
  end: string;
  status?: "billed" | "unbilled";
} & ExtraParams;

/**
 * parseIdQuery
 *
 * Parses a search string and attempts to extract a numeric ID.
 * Supported formats:
 * - "id:123"
 * - "#123"
 * - "123"
 *
 * Used to detect direct ID searches in the admin search field.
 *
 * @param q Raw search string
 * @returns Parsed numeric ID or null if no valid ID was found
 */
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
/**
 * billedFromStatus
 *
 * Converts a UI-friendly status value into the boolean format
 * expected by the backend API.
 *
 * @param status "billed" | "unbilled" | undefined
 * @returns true | false | undefined
 */
const billedFromStatus = (status?: string): boolean | undefined =>
  status === "billed" ? true : status === "unbilled" ? false : undefined;
/**
 * normalizeForList
 *
 * Normalizes backend time report rows into a consistent shape
 * expected by the UI.
 *
 * Handles:
 * - category vs categoryName inconsistencies
 * - Ensures items is always an array
 *
 * @param row Raw backend row
 * @returns Normalized TimeReportRow
 */
const normalizeForList = (row: any): TimeReportRow => ({
  ...row,
  category: row?.category ?? row?.categoryName ?? null,
  items: Array.isArray(row?.items) ? row.items : [],
});

export function useAdminTimeReportsInfinite(initial?: Partial<Params>) {
  const { start: defStart, end: defEnd } = getMonthRange(0);

  const [params, setParams] = useState<Params>({
    start: initial?.start ?? defStart,
    end: initial?.end ?? defEnd,
    status: initial?.status,
    q: initial?.q ?? "",
    scope: initial?.scope ?? "all",
    userId: initial?.userId,
    userIds: initial?.userIds,
    limit: initial?.limit ?? CHUNK_SIZE,
    cursor: undefined,
  });

  const [rows, setRows] = useState<TimeReportRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);

// Keeps a reference to the latest rows array.
// Used to safely rollback optimistic updates without stale closures.
  const rowsRef = useRef<TimeReportRow[]>([]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const [loadingFirst, setLoadingFirst] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const [users, setUsers] = useState<IUser[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const hasMore = !!nextCursor;
// Guards used to prevent outdated requests from mutating state
// when filters change quickly.
  const listReqIdRef = useRef(0);
  const summaryReqIdRef = useRef(0);


  const listQuery: GetTimeReportsParams = useMemo(
    () => ({
      start: params.start,
      end: params.end,
      billed: billedFromStatus(params.status),
      q: params.q,
      userId: params.userId,
      userIds: params.userIds,
      limit: params.limit,
      scope: params.scope,
      cursor: undefined,
    }),
    [
      params.start,
      params.end,
      params.status,
      params.q,
      params.userId,
      params.userIds,
      params.limit,
      params.scope,
    ]
  );

  const summaryQuery: GetTimeReportsParams = useMemo(
    () => ({
      start: params.start,
      end: params.end,
      billed: billedFromStatus(params.status),
      q: params.q,
      userId: params.userId,
      userIds: params.userIds,
    }),
    [params.start, params.end, params.status, params.q, params.userId, params.userIds]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await AdminTimeOverviewService.getUsers();
        if (!mounted) return;
        setUsers(Array.isArray(list) ? list : []);
      } catch (e) {
        console.warn("AdminTimeOverviewService.getUsers failed", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
/**
 * refetch
 *
 * Fetches the first page of time reports for the current filters.
 * Resets pagination state and replaces existing rows.
 */
  const refetch = useCallback(async () => {
    const reqId = ++listReqIdRef.current;
    setLoadingFirst(true);
    setError(null);

    try {
      const res = await AdminTimeOverviewService.getEntries(listQuery);
      if (reqId !== listReqIdRef.current) return;

      const first = (res?.items ?? []).map(normalizeForList);
      setRows(first);
      setNextCursor(res?.nextCursor);
    } catch (e: any) {
      if (reqId !== listReqIdRef.current) return; 

      setRows([]);
      setNextCursor(undefined);
      setError(e?.message ?? "Failed to fetch admin reports");
    } finally {
      if (reqId === listReqIdRef.current) setLoadingFirst(false);
    }
  }, [listQuery]);


  const refetchSummary = useCallback(async () => {
    const reqId = ++summaryReqIdRef.current;
    setLoadingSummary(true);

    try {
      const s = await AdminTimeOverviewService.getSummary(summaryQuery);
      if (reqId !== summaryReqIdRef.current) return;
      setSummary(s);
    } catch {
    } finally {
      if (reqId === summaryReqIdRef.current) setLoadingSummary(false);
    }
  }, [summaryQuery]);


  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    void refetchSummary();
  }, [refetchSummary]);
/**
 * loadMore
 *
 * Fetches the next page of results using the current cursor
 * and appends them to the existing list.
 */
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;

    setLoadingMore(true);
    setError(null);

    const cursorQuery: GetTimeReportsParams = {
      ...listQuery,
      cursor: nextCursor,
    };

    try {
      const res = await AdminTimeOverviewService.getEntries(cursorQuery);
      const more = (res?.items ?? []).map(normalizeForList);
      setRows((prev) => prev.concat(more));
      setNextCursor(res?.nextCursor);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, listQuery]);
/**
 * handleUpdate
 *
 * Optimistically updates a time report row.
 * Rolls back to the previous state if the API request fails.
 */
  const handleUpdate = useCallback(
    async (id: string | number, patch: TimeReportPatch) => {
      const before = rowsRef.current;

    
      setRows((prev) =>
        prev.map((r) => (r.id === id ? ({ ...r, ...patch } as TimeReportRow) : r))
      );

      try {
        const serverRow = await AdminTimeOverviewService.updateEntry(+id, patch);
        if (serverRow && typeof serverRow === "object") {
          const normalized = normalizeForList(serverRow);
          setRows((prev) =>
            prev.map((r) => (r.id === id ? (normalized as TimeReportRow) : r))
          );
        }
        void refetchSummary();
      } catch (e: any) {
        setRows(before); 
        setError(e?.message ?? "Failed to update report");
      }
    },
    [refetchSummary]
  );
/**
 * handleDelete
 *
 * Optimistically removes a time report row.
 * Restores the previous list if deletion fails.
 */
  const handleDelete = useCallback(
    async (id: number) => {
      const before = rowsRef.current;

      setRows((prev) => prev.filter((r) => r.id !== id));

      try {
        await AdminTimeOverviewService.deleteEntry(id);
        void refetchSummary();
      } catch (e: any) {
        setRows(before); 
        setError(e?.message ?? "Failed to delete report");
      }
    },
    [refetchSummary]
  );
/**
 * resetAnd
 *
 * Utility helper used by all filter setters.
 * - Resets pagination
 * - Clears current rows
 * - Applies new filter params
 * - Forces refetch if filters did not actually change
 */
  const resetAnd = useCallback(
    (updater: (p: Params) => Params) => {
      const next = updater({ ...params, cursor: undefined });

      const same =
        next.start === params.start &&
        next.end === params.end &&
        (next.status ?? undefined) === (params.status ?? undefined) &&
        (next.q ?? "") === (params.q ?? "") &&
        (next.userId ?? undefined) === (params.userId ?? undefined) &&
        JSON.stringify(next.userIds ?? []) === JSON.stringify(params.userIds ?? []) &&
        (next.limit ?? CHUNK_SIZE) === (params.limit ?? CHUNK_SIZE) &&
        (next.scope ?? "all") === (params.scope ?? "all");

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

  const setScope = useCallback(
    (scope?: Scope, userId?: number, userIds?: number[]) =>
      resetAnd((p) => ({ ...p, scope, userId, userIds })),
    [resetAnd]
  );

  const setPageSize = useCallback(
    (limit: number) =>
      resetAnd((p) => ({ ...p, limit: Math.max(1, limit || CHUNK_SIZE) })),
    [resetAnd]
  );

  const SelectedUser = useCallback(
    (user: IUser | null) => {
      resetAnd((p) => ({
        ...p,
        userId: user ? user.id : undefined,
        userIds: undefined,
      }));
    },
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
      const name = String(r.workDescription || r.category || "").toLowerCase();
      if (name === "vacation") return s + (Number(r.hours) || 0);
      return s;
    }, 0);

    const sickHours = rows.reduce((s, r) => {
      const name = String(r.workDescription || r.category || "").toLowerCase();
      if (name === "sick") return s + (Number(r.hours) || 0);
      return s;
    }, 0);

    return {
      totalHours: Number(totalHours.toFixed(2)),
      billableHours: Number(billableHours.toFixed(2)),
      nonBillableHours: Number(nonBillableHours.toFixed(2)),
      amount: 0,
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
    setScope,
    setPageSize,
    users,
    SelectedUser,

    summary: summaryPreferServer,
    pageSummary,
    totalSummary: summary,
    loadingSummary,
  };
}
