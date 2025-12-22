/**
 * useAdminFilterReports
 *
 * Central data hook for the Admin Statistics view.
 *
 * This hook owns:
 * - The current admin filter state (date range, customer, project, user, category, article filters, etc.)
 * - Fetching aggregated statistics based on the active filters
 * - Fetching facet data (customers, projects, users, categories, articles) for filter dropdowns
 *
 * Key behaviors:
 * - Initializes with the current month by default
 * - Debounces the free-text search field to avoid request spam while typing
 * - Cancels in-flight requests when filters change (AbortController)
 * - Ignores aborted/canceled requests so they do not surface as UI errors
 * - Separates "stats" and "facets" loading/error states
 *
 * The hook is intentionally backend-driven:
 * all calculations, filtering, and aggregation are performed server-side.
 * The frontend acts as a thin client that only manages state, UX, and rendering.
 *
 * Intended usage:
 *   const {
 *     filter,
 *     setFilter,
 *     stats,
 *     statsLoading,
 *     facets
 *   } = useAdminFilterReports();
 */


import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AdminFilter, StatsResponse } from "../models/admin";
import type { AdminFacets } from "../services/AdminFilterReportsservice";
import { AdminFilterReportsService } from "../services/AdminFilterReportsservice";
import { getThisMonthRange } from "../helpers/dateHelpers";

type Return = {
  filter: AdminFilter;
  setFilter: (patch: Partial<AdminFilter>) => void;

  stats?: StatsResponse;
  statsLoading: boolean;
  statsError: string | null;
  refetchStats: () => void;

  facets: AdminFacets;
  facetsLoading: boolean;
  facetsError: string | null;
  refetchFacets: () => void;
};

const EMPTY_FACETS: AdminFacets = {
  customers: [],
  projects: [],
  users: [],
  categories: [],
  articles: { registered: [], customTop: [] },
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

export const useAdminFilterReports = (initial?: Partial<AdminFilter>): Return => {
  const [filter, setFilterState] = useState<AdminFilter>({
    ...getThisMonthRange(),
    ...initial,
  });

  const [stats, setStats] = useState<StatsResponse | undefined>(undefined);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [facets, setFacets] = useState<AdminFacets>(EMPTY_FACETS);
  const [facetsLoading, setFacetsLoading] = useState(false);
  const [facetsError, setFacetsError] = useState<string | null>(null);
  // Debounce only the search string to reduce request spam while typing.
  const debouncedSearch = useDebouncedValue(filter.search ?? "", 250);

  const isCanceled = useCallback((e: any) => {
    // Axios cancellation usually looks like { code: "ERR_CANCELED", name: "CanceledError", message: "canceled" }
    // Fetch abort usually looks like { name: "AbortError" }
    return (
      e?.name === "AbortError" ||
      e?.name === "CanceledError" ||
      e?.code === "ERR_CANCELED" ||
      String(e?.message || "").toLowerCase() === "canceled"
    );
  }, []);

  // Make array dependency stable to avoid unnecessary refetches.
  const articleIdsKey = useMemo(
    () => (filter.articleIds?.length ? filter.articleIds.join(",") : ""),
    [filter.articleIds]
  );

  // Build a stable base query object.
  const baseQuery = useMemo(() => {
    return {
      from: filter.from,
      to: filter.to,
      customerId: filter.customerId,
      projectId: filter.projectId,
      userId: filter.userId,
      category: filter.category,
      billable: filter.billable,
      billed: filter.billed,
      search: debouncedSearch,
      minH: filter.minH,
      maxH: filter.maxH,
      articleMode: filter.articleMode,
      articleIds: filter.articleIds,
      customArticleQuery: filter.customArticleQuery,

      /**
       * usersScope:
       * - "tenantAll": loads all users
       * - "recent": limits to users active within the last ~60 days (backend-defined)
       * - "active": backend-defined "active"
       */
      usersScope: "recent" as const,
    };
  }, [
    filter.from,
    filter.to,
    filter.customerId,
    filter.projectId,
    filter.userId,
    filter.category,
    filter.billable,
    filter.billed,
    debouncedSearch,
    filter.minH,
    filter.maxH,
    filter.articleMode,
    articleIdsKey, // 👈 stable dependency
    filter.customArticleQuery,
  ]);

  // Abort controllers to cancel in-flight requests on filter changes.
  const statsAbortRef = useRef<AbortController | null>(null);
  const facetsAbortRef = useRef<AbortController | null>(null);

  const fetchStats = useCallback(async () => {
    statsAbortRef.current?.abort();
    const ac = new AbortController();
    statsAbortRef.current = ac;

    setStatsLoading(true);
    setStatsError(null);

    try {
      const res = await AdminFilterReportsService.stats(
        {
          ...baseQuery,
          includeMissing: 1,
          missingExcludeWeekends: 1,
          missingIncludeDates: 1,
          includeArticleTimecards: 1,
        },
        { signal: ac.signal }
      );

      if (ac.signal.aborted) return;
      setStats(res);
    } catch (e: any) {
      if (isCanceled(e)) return; // ✅ do not show cancels as errors
      setStats(undefined);
      setStatsError(e?.message ?? "Failed to load stats");
    } finally {
      if (!ac.signal.aborted) setStatsLoading(false);
    }
  }, [baseQuery, isCanceled]);

  const fetchFacets = useCallback(async () => {
    facetsAbortRef.current?.abort();
    const ac = new AbortController();
    facetsAbortRef.current = ac;

    setFacetsLoading(true);
    setFacetsError(null);

    try {
      const res = await AdminFilterReportsService.facets(baseQuery, { signal: ac.signal });

      if (ac.signal.aborted) return;

      const f = res?.facets ?? EMPTY_FACETS;

      setFacets({
        customers: f.customers ?? [],
        projects: f.projects ?? [],
        users: f.users ?? [],
        categories: f.categories ?? [],
        articles: {
          registered: f.articles?.registered ?? [],
          customTop: f.articles?.customTop ?? [],
        },
      });
    } catch (e: any) {
      if (isCanceled(e)) return; // ✅ ignore cancels here too
      setFacets(EMPTY_FACETS);
      setFacetsError(e?.message ?? "Failed to load facets");
    } finally {
      if (!ac.signal.aborted) setFacetsLoading(false);
    }
  }, [baseQuery, isCanceled]);

  useEffect(() => {
    fetchStats();
    return () => statsAbortRef.current?.abort();
  }, [fetchStats]);

  useEffect(() => {
    fetchFacets();
    return () => facetsAbortRef.current?.abort();
  }, [fetchFacets]);

  return {
    filter,
    setFilter: (patch) => setFilterState((prev) => ({ ...prev, ...patch })),

    stats,
    statsLoading,
    statsError,
    refetchStats: fetchStats,

    facets,
    facetsLoading,
    facetsError,
    refetchFacets: fetchFacets,
  };
};
