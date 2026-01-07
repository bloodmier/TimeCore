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

const billedFromStatus = (status?: string): boolean | undefined =>
  status === "billed" ? true : status === "unbilled" ? false : undefined;

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

  const listReqIdRef = useRef(0);
  const summaryReqIdRef = useRef(0);

  const [hasNewUpdates, setHasNewUpdates] = useState(false);

  // ✅ FIX: keep two refs
  // baselineMsRef = "list is synced up to this server version"
  // latestServerMsRef = "latest server version we've observed during polling"
  const baselineMsRef = useRef<number | null>(null);
  const latestServerMsRef = useRef<number | null>(null);

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

  const changesQuery = useMemo(
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

  // Load users once
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

  // ✅ FIX: Polling should NOT advance baseline.
  // It only detects if server latest > baseline -> refresh.
  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const res = await AdminTimeOverviewService.getChanges({
          ...changesQuery,
          since: baselineMsRef.current ?? undefined,
        });

        if (!alive) return;

        if (res?.latestMs == null) return;

        // always keep newest server version we've seen
        latestServerMsRef.current = res.latestMs;

        // first successful tick: establish baseline without showing banner
        if (baselineMsRef.current == null) {
          baselineMsRef.current = res.latestMs;
          return;
        }

        // server newer than baseline -> banner
        if (res.latestMs > baselineMsRef.current) {
          setHasNewUpdates(true);
        }
      } catch (e) {
        console.warn("getChanges polling failed:", e);
      }
    };

    void tick();
    const id = window.setInterval(tick, 15_000);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [changesQuery]);

  /**
   * refetch: fetch first page and then set baseline to server latestMs (NOT Date.now)
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

      // hide banner
      setHasNewUpdates(false);

      // ✅ sync baseline to server latest version
      try {
        const ch = await AdminTimeOverviewService.getChanges({
          ...changesQuery,
          since: undefined,
        });
        if (ch?.latestMs != null) {
          baselineMsRef.current = ch.latestMs;
          latestServerMsRef.current = ch.latestMs;
        } else {
          baselineMsRef.current = null;
          latestServerMsRef.current = null;
        }
      } catch {
        // keep previous baseline
      }
    } catch (e: any) {
      if (reqId !== listReqIdRef.current) return;
      setRows([]);
      setNextCursor(undefined);
      setError(e?.message ?? "Failed to fetch admin reports");
    } finally {
      if (reqId === listReqIdRef.current) setLoadingFirst(false);
    }
  }, [listQuery, changesQuery]);

  const refetchSummary = useCallback(async () => {
    const reqId = ++summaryReqIdRef.current;
    setLoadingSummary(true);

    try {
      const s = await AdminTimeOverviewService.getSummary(summaryQuery);
      if (reqId !== summaryReqIdRef.current) return;
      setSummary(s);
    } catch {
      // ignore
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

        // ✅ treat our own update as synced: move baseline to latest server seen (if any)
        if (latestServerMsRef.current != null) {
          baselineMsRef.current = latestServerMsRef.current;
        }
        setHasNewUpdates(false);
      } catch (e: any) {
        setRows(before);
        setError(e?.message ?? "Failed to update report");
      }
    },
    [refetchSummary]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      const before = rowsRef.current;

      setRows((prev) => prev.filter((r) => r.id !== id));

      try {
        await AdminTimeOverviewService.deleteEntry(id);
        void refetchSummary();

        // ✅ treat our own delete as synced
        if (latestServerMsRef.current != null) {
          baselineMsRef.current = latestServerMsRef.current;
        }
        setHasNewUpdates(false);
      } catch (e: any) {
        setRows(before);
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
        (next.userId ?? undefined) === (params.userId ?? undefined) &&
        JSON.stringify(next.userIds ?? []) === JSON.stringify(params.userIds ?? []) &&
        (next.limit ?? CHUNK_SIZE) === (params.limit ?? CHUNK_SIZE) &&
        (next.scope ?? "all") === (params.scope ?? "all");

      setRows([]);
      setNextCursor(undefined);

      // ✅ reset banner + baseline when filters change
      setHasNewUpdates(false);
      baselineMsRef.current = null;
      latestServerMsRef.current = null;

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

  /**
   * refreshVisible: refresh first page WITHOUT clearing UI first
   * After refresh, baseline moves -> banner clears
   */
  const refreshVisible = useCallback(
    async (opts?: { preserveScrollEl?: HTMLElement | null }) => {
      const reqId = ++listReqIdRef.current;

      const el = opts?.preserveScrollEl ?? null;
      const prevScrollTop = el ? el.scrollTop : null;

      setError(null);

      try {
        const res = await AdminTimeOverviewService.getEntries(listQuery);
        if (reqId !== listReqIdRef.current) return;

        const first = (res?.items ?? []).map(normalizeForList);

        setRows(first);
        setNextCursor(res?.nextCursor);

        if (el && typeof prevScrollTop === "number") {
          requestAnimationFrame(() => {
            try {
              el.scrollTop = prevScrollTop;
            } catch {}
          });
        }

        // ✅ synced now -> clear banner, then set baseline to server latest
        setHasNewUpdates(false);

        try {
          const ch = await AdminTimeOverviewService.getChanges({
            ...changesQuery,
            since: undefined,
          });
          if (ch?.latestMs != null) {
            baselineMsRef.current = ch.latestMs;
            latestServerMsRef.current = ch.latestMs;
          }
        } catch {}

        void refetchSummary();
      } catch (e: any) {
        if (reqId !== listReqIdRef.current) return;
        setError(e?.message ?? "Failed to refresh");
      }
    },
    [listQuery, refetchSummary, changesQuery]
  );

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

    hasNewUpdates,
    refreshVisible,

    clearNewUpdates: () => {
      // “Dismiss” banner -> move baseline to the latest server version we know
      setHasNewUpdates(false);
      if (latestServerMsRef.current != null) {
        baselineMsRef.current = latestServerMsRef.current;
      }
    },
  };
}
