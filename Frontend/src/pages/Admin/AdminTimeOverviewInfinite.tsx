/**
 * AdminTimeOverviewInfinite
 *
 * Admin page for viewing and managing all time reports within a tenant.
 *
 * Features:
 * - Infinite scrolling with cursor-based pagination
 * - Date range selection and user filtering
 * - Free-text and ID-based search
 * - Inline editing and deletion of time reports
 * - Real-time summary statistics
 *
 * UX & performance considerations:
 * - Uses scroll-based lazy loading with throttling
 * - Preserves layout during initial load to reduce CLS
 * - Displays clear loading, empty and error states
 *
 * Access:
 * - Intended for admin users only
 * - Data is tenant-scoped and protected by backend middleware
 */

import React, { useCallback, useEffect, useRef } from "react";
import { AppLoader } from "../../components/appLoader";
import { TimeReportsTable } from "../../components/timeReports/TimeReportsTable";
import { useTimeOverviewData } from "../../hooks/useTimeOverveiw";

import {
  useAdminTimeReportsInfinite,
  parseIdQuery,
} from "../../hooks/useAdminTimeReportsInfinite";
import { AdminOverviewControls } from "../../components/admin/AdminOverviewControls";

export const AdminTimeOverviewInfinite: React.FC = () => {
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
    users,
    SelectedUser,
    summary,
  } = useAdminTimeReportsInfinite({ limit: 25, scope: "all" });

  const { customerData, lookupData, articleSearch } = useTimeOverviewData();

  const listRef = useRef<HTMLDivElement | null>(null);
  const lastLoadAtRef = useRef<number>(0);
  const nudgedRef = useRef(false);

  // Scroll-based infinite loading with cooldown to avoid request spam.
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

  // Tiny “nudge” to ensure scroll events keep firing after new content is appended.
  useEffect(() => {
    if (!loadingMore && nudgedRef.current) {
      nudgedRef.current = false;
      const el = listRef.current;
      if (!el) return;

      requestAnimationFrame(() => {
        el.scrollTop = el.scrollTop + 1;
      });
    }
  }, [loadingMore]);

  const handleSearchSubmit = useCallback(
    (q: string) => {
      // Keep your existing behavior: backend receives q (supports #id / id:xxx)
      setSearch(q);

      // Optional: you can use this if you want to do something special client-side
      // (like auto-expand the row in UI) when query is an ID.
      void parseIdQuery(q);
    },
    [setSearch]
  );

  return (
    <div className="flex flex-col w-full h-[100dvh] lg:h-[74dvh] md:max-h-[100dvh] ">
      {/* Header */}
      <div className="flex-shrink-0 w-full border-b bg-background">
        <div className="relative w-full min-w-0 mx-auto px-3 py-3">
          <AdminOverviewControls
            start={params.start}
            end={params.end}
            onChangeRange={({ start, end }) => setRange(start, end)}
            users={users}
            selectedUserId={params.userId ?? null}
            onSelectUser={SelectedUser}
            search={params.q ?? ""}
            onSearch={handleSearchSubmit}
            summary={summary}
            showingCount={rows.length}
          />
        </div>
      </div>

      {/* Content region */}
      <div
        ref={listRef}
        role="region"
        aria-label="Admin time reports list"
        className="flex-1 min-h-0 w-full min-w-0 relative overflow-y-scroll overflow-x-hidden bg-background scrollbar-dark [scrollbar-gutter:stable_both-edges]"
      >
        <div className="relative w-full min-w-0 mx-auto px-3 py-4 flex flex-col gap-4">
          {/* Error */}
          {error && !loadingFirst && (
            <div
              role="alert"
              className="text-sm text-red-600 flex items-center justify-between gap-3"
            >
              <span className="min-w-0 break-words">{error}</span>
              <button className="underline shrink-0" onClick={() => refetch()}>
                Try again
              </button>
            </div>
          )}

          {/* First load overlay */}
          {loadingFirst && !error && (
            <>
              {/* Invisible table to preserve layout and reduce CLS */}
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

          {/* Loaded state */}
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
