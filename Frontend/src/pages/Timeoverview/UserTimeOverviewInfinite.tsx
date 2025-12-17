/**
 * UserTimeOverviewInfinite
 *
 * Main page component for the user's time report overview.
 *
 * Responsibilities:
 * - Orchestrates data loading via `useUserTimeReportsInfinite`
 * - Handles infinite scroll behavior
 * - Wires together filters, summary, and table components
 * - Coordinates editing and deletion of time reports
 *
 * This component does NOT contain business logic.
 * All data-fetching and mutations are delegated to hooks and services.
 */


import { AppLoader } from "../../components/appLoader";
import { TimeReportsTable } from "../../components/timeReports/TimeReportsTable";
import { useUserTimeReportsInfinite } from "../../hooks/useUserTimeReportsInfinite";
import { UserOverviewControls } from "../../components/timeReports/UserOverviewControls";
import { useTimeOverviewData } from "../../hooks/useTimeOverveiw";
import { useCallback, useEffect, useRef } from "react";

export const UserTimeOverviewInfinite = () => {
  const {
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
    summary,
  } = useUserTimeReportsInfinite({ limit: 25 });

  const { customerData, lookupData, articleSearch } = useTimeOverviewData();

  const listRef = useRef<HTMLDivElement | null>(null);
  const lastLoadAtRef = useRef<number>(0);
  const nudgedRef = useRef(false);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const COOLDOWN_MS = 600;
    const THRESHOLD_PX = 300;

    const onScroll = () => {
      if (!hasMore || loadingMore) return;

      const { scrollTop, clientHeight, scrollHeight } = el;
      const distanceToBottom = scrollHeight - (scrollTop + clientHeight);

      if (distanceToBottom <= THRESHOLD_PX) {
        const now = performance.now();
        if (now - lastLoadAtRef.current < COOLDOWN_MS) return;

        lastLoadAtRef.current = now;
        nudgedRef.current = true;
        void loadMore();
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [hasMore, loadingMore, loadMore]);

  useEffect(() => {
    if (!loadingMore && nudgedRef.current) {
      nudgedRef.current = false;
      const el = listRef.current;
      if (!el) return;
      requestAnimationFrame(() => {
        el.scrollTop += 1;
      });
    }
  }, [loadingMore]);

  const handleSearchSubmit = useCallback(
    (q: string) => {
      setSearch(q);
    },
    [setSearch]
  );

  return (
    <div className="flex w-full flex-col min-h-[80svh] md:h-[50dvh] md:max-h-[100dvh] md:overflow-hidden">
      <div className="flex-shrink-0 w-full border-b bg-background">
        <div className="relative w-full min-w-0 mx-auto px-3 py-3">
          <UserOverviewControls
            start={params.start}
            end={params.end}
            onChangeRange={({ start, end }) => setRange(start, end)}
            search={params.q ?? ""}
            onSearch={handleSearchSubmit}
            summary={summary}
            showingCount={rows.length}
          />
        </div>
      </div>

      <div
        ref={listRef}
        className="flex-1 min-h-0 w-full min-w-0 relative overflow-y-scroll overflow-x-hidden bg-background scrollbar-dark [scrollbar-gutter:stable_both-edges]"
        aria-busy={loadingFirst || loadingMore}
      >
        <div className="relative w-full min-w-0 mx-auto px-3 py-4 flex flex-col gap-4">
          {error && !loadingFirst && (
            <div className="text-sm text-red-600" role="alert">
              {error}{" "}
              <button className="underline" onClick={() => refetch()}>
                Try again
              </button>
            </div>
          )}

          {loadingFirst && !error && (
            <>
              <div className="invisible w-full">
                <TimeReportsTable
                  rows={rows as any}
                  onUpdate={() => {}}
                  ondelete={() => {}}
                  customerData={customerData}
                  lookupData={lookupData}
                  articleSearch={articleSearch}
                />
              </div>
              <div className="absolute inset-0 grid place-items-center">
                <AppLoader />
              </div>
            </>
          )}

          {!loadingFirst && !error && (
            <>
              <TimeReportsTable
                rows={rows as any}
                onUpdate={handleUpdate}
                ondelete={handleDelete}
                customerData={customerData}
                lookupData={lookupData}
                articleSearch={articleSearch}
              />

              <div className="w-full py-4 text-center">
                {loadingMore ? (
                  <div className="w-full text-xs text-muted-foreground">
                    <AppLoader />
                  </div>
                ) : hasMore ? (
                  <div className="w-full text-[11px] text-muted-foreground opacity-80">
                    Scroll to load more
                  </div>
                ) : (
                  <div className="w-full text-[11px] text-muted-foreground opacity-80">
                    {rows.length ? "No more results" : "No results"}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
