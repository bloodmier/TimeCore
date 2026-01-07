import { useEffect, useRef } from "react";

type GetLatestMsFn = () => Promise<number | null | undefined>;

type Options = {
  intervalMs?: number;

  /**
   * If provided, refresh only when this returns true.
   * Useful for infinite scroll pages: only auto refresh when user is at top.
   */
  shouldRefreshNow?: () => boolean;

  /**
   * Optional: if shouldRefreshNow() is false and changes are detected,
   * we can set this flag so you can show a banner (if you ever want).
   * If you don't want banner, ignore it.
   */
  onDeferredChange?: () => void;
};

/**
 * useAutoRefreshChanges
 *
 * Generic "poll for latestMs and auto-refresh when it changes".
 *
 * Requirements:
 * - You have a backend endpoint that returns latestMs (like your /changes).
 * - You provide a refresh callback (refetch/refreshVisible).
 *
 * Behavior:
 * - Establishes baseline on first successful poll.
 * - If latestMs > baseline -> triggers onRefresh().
 * - After successful refresh, baseline moves to the latestMs we observed.
 * - Optional shouldRefreshNow to avoid scroll jumps.
 */
export function useAutoRefreshChanges(args: {
  getLatestMs: GetLatestMsFn;
  onRefresh: () => Promise<void> | void;
  options?: Options;
}) {
  const { getLatestMs, onRefresh, options } = args;

  const intervalMs = options?.intervalMs ?? 15_000;

  // baseline = "UI is synced up to this server version"
  const baselineMsRef = useRef<number | null>(null);

  // remember a newer server version when we can't refresh right now (optional)
  const pendingMsRef = useRef<number | null>(null);

  // prevent overlapping refresh calls
  const refreshingRef = useRef(false);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const latestMs = await getLatestMs();
        if (!alive) return;
        if (latestMs == null) return;

        // First successful poll establishes baseline (no refresh)
        if (baselineMsRef.current == null) {
          baselineMsRef.current = latestMs;
          pendingMsRef.current = null;
          return;
        }

        // Nothing new
        if (latestMs <= baselineMsRef.current) return;

        // There is something new
        const ok = options?.shouldRefreshNow ? options.shouldRefreshNow() : true;

        if (!ok) {
          // Defer refresh until user is in a safe position (e.g. top)
          pendingMsRef.current = latestMs;
          options?.onDeferredChange?.();
          return;
        }

        // Avoid overlapping refreshes
        if (refreshingRef.current) return;
        refreshingRef.current = true;

        try {
          await onRefresh();
          // After refresh, advance baseline to the newest known server version
          baselineMsRef.current = latestMs;
          pendingMsRef.current = null;
        } finally {
          refreshingRef.current = false;
        }
      } catch (e) {
        // Never crash UI due to polling
        console.warn("useAutoRefreshChanges tick failed:", e);
      }
    };

    void tick();
    const id = window.setInterval(tick, intervalMs);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
    // NOTE: we intentionally depend on the passed fns; ensure they are stable (useCallback/useMemo)
  }, [getLatestMs, onRefresh, intervalMs, options?.shouldRefreshNow, options?.onDeferredChange]);

  /**
   * Optional helper: call this when UI becomes "safe" again (e.g., user scrolls to top)
   * to immediately apply a deferred refresh.
   */
  const flushIfPending = async () => {
    const pending = pendingMsRef.current;
    if (pending == null) return;

    const ok = options?.shouldRefreshNow ? options.shouldRefreshNow() : true;
    if (!ok) return;

    if (refreshingRef.current) return;
    refreshingRef.current = true;

    try {
      await onRefresh();
      baselineMsRef.current = pending;
      pendingMsRef.current = null;
    } finally {
      refreshingRef.current = false;
    }
  };

  return {
    baselineMs: baselineMsRef.current,
    pendingMs: pendingMsRef.current,
    flushIfPending,
    resetBaseline: () => {
      baselineMsRef.current = null;
      pendingMsRef.current = null;
    },
  };
}
