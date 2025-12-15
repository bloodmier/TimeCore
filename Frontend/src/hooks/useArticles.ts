/**
 * useArticles
 *
 * Handles article search and time report line items.
 * - Debounced, cached search against the articles API
 * - Infinite “load more” pagination
 * - Manages a local list of line items for a report/draft
 * - Can load/save items for a specific time report via API
 */

import { useState, useRef, useCallback, useEffect } from "react";
import type { Article, ReportItemInput } from "../models/Article";
import { TimeReportService } from "../services/timeReportService";

export const useArticles = (
  options: { limit?: number; debounceMs?: number } = {}
) => {
  const LIMIT = options.limit ?? 10;
  const DEBOUNCE_MS = options.debounceMs ?? 300;

  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [items, setItems] = useState<ReportItemInput[]>([]);

  const reqIdRef = useRef(0);
  const cacheRef = useRef<Map<string, Article[]>>(new Map());

  const addItemFromArticle = useCallback(
    (article: Article, amount = 1, purchasePrice: number | null = null) => {
      setItems((prev) => [
        ...prev,
        {
          articleId: article.id,
          description: article.name,
          amount,
          purchasePrice,
        },
      ]);
    },
    []
  );

  const addOtherItem = useCallback(
    (description: string, amount = 1, purchasePrice: number | null = null) => {
      setItems((prev) => [
        ...prev,
        { articleId: null, description, amount, purchasePrice },
      ]);
    },
    []
  );

  const updateItem = useCallback(
    (index: number, patch: Partial<ReportItemInput>) => {
      setItems((prev) =>
        prev.map((it, i) => (i === index ? { ...it, ...patch } : it))
      );
    },
    []
  );

  const setItemAmount = useCallback((index: number, amount: number) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === index
          ? {
              ...it,
              amount: Math.max(1, Math.floor(Number(amount) || 1)),
            }
          : it
      )
    );
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearItems = useCallback(() => setItems([]), []);

  const loadItems = useCallback(async (reportId: number) => {
    const rows = await TimeReportService.fetchReportItems(reportId);
    const mapped: ReportItemInput[] = rows.map((r) => ({
      articleId: r.article_id,
      description: r.description,
      amount: r.amount ?? 1,
    }));
    setItems(mapped);
    return rows;
  }, []);

  const saveItems = useCallback(
    async (reportId: number) => {
      return TimeReportService.replaceReportItems(reportId, items);
    },
    [items]
  );

  const runSearch = useCallback(
    async (q: string, limit = LIMIT, customOffset = 0) => {
      return TimeReportService.searchArticles(q, limit, customOffset);
    },
    [LIMIT]
  );

  const resetSearch = useCallback(() => {
    setQuery("");
    setArticles([]);
    setOffset(0);
    setHasMore(false);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const q = query.trim();
    const id = ++reqIdRef.current;
    let cancelled = false;

    if (!q) {
      resetSearch();
      return;
    }

    const cached = cacheRef.current.get(`${q}|${LIMIT}|0`);
    if (cached) {
      setArticles(cached);
      setOffset(cached.length);
      setHasMore(cached.length >= LIMIT);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const t = window.setTimeout(async () => {
      try {
        const rows = await TimeReportService.searchArticles(
          q,
          LIMIT,
          0
        );
        if (cancelled || id !== reqIdRef.current) return;
        cacheRef.current.set(`${q}|${LIMIT}|0`, rows);
        setArticles(rows);
        setOffset(rows.length);
        setHasMore(rows.length >= LIMIT);
      } catch (e: any) {
        if (cancelled || id !== reqIdRef.current) return;
        setError(e?.message ?? "Search failed");
      } finally {
        if (!cancelled && id === reqIdRef.current) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, resetSearch, LIMIT, DEBOUNCE_MS]);

  const loadMore = useCallback(async () => {
    const q = query.trim();
    if (!q || loading || !hasMore) return [];

    const key = `${q}|${LIMIT}|${offset}`;
    const cached = cacheRef.current.get(key);
    if (cached) {
      setArticles((prev) => [...prev, ...cached]);
      setOffset((o) => o + cached.length);
      setHasMore(cached.length >= LIMIT);
      return cached;
    }

    setLoading(true);
    try {
      const rows = await TimeReportService.searchArticles(
        q,
        LIMIT,
        offset
      );
      cacheRef.current.set(key, rows);
      setArticles((prev) => [...prev, ...rows]);
      setOffset((o) => o + rows.length);
      setHasMore(rows.length >= LIMIT);
      return rows;
    } catch (e: any) {
      setError(e?.message ?? "Load more failed");
      return [];
    } finally {
      setLoading(false);
    }
  }, [query, offset, hasMore, loading, LIMIT]);

  return {
    query,
    setQuery,
    articles,
    loading,
    error,
    hasMore,
    loadMore,
    resetSearch,
    runSearch,

    items,
    setItems,
    addItemFromArticle,
    addOtherItem,
    updateItem,
    setItemAmount,
    removeItem,
    clearItems,

    loadItems,
    saveItems,
  };
};
