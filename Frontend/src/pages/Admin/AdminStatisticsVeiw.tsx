/**
 * AdminStatisticsView
 *
 * This page is the main admin analytics dashboard for TimeCore.
 * It lets an admin filter time reporting data (date range, customer, project, user, category,
 * billable/billed flags, search text, hour range, and article filters).
 *
 * Based on the current filter selection, the page loads:
 * - Summary totals (total hours, billable/non-billable, days reported, sick/vacation hours)
 * - Article-related statistics (registered articles + custom queries)
 * - Charts for hours by customer, week, user, and category
 * - A table of missing reporting days (optionally including dates/excluding weekends)
 *
 * The filter UI updates the state in a backend-driven way, and the dashboard re-fetches and
 * re-renders the stats accordingly.
 */


import { useMemo } from "react";
import { AdminFilters } from "../../components/admin/AdminFilters";
import { ArticleStatsSummary } from "../../components/admin/ArticleStatsSummary";
import { HoursByCategoryChart } from "../../components/admin/HoursByCategoryChart";
import { HoursByCustomerChart } from "../../components/admin/HoursByCustomerChart";
import { HoursByUserChart } from "../../components/admin/HoursByUserChart";
import { HoursPerWeekChart } from "../../components/admin/HoursPerWeekChart";
import { MissingReportDaysTableStats } from "../../components/admin/MissingReportDaysTableStats";
import { AppLoader } from "../../components/appLoader";
import { TimeSummaryCard } from "../../components/timeReports/TimeSummaryCard";
import { useAdminFilterReports } from "../../hooks/useAdminFilterReports";

export const AdminStatisticsVeiw = () => {
  const { filter, setFilter, stats, statsLoading, statsError, facets } =
    useAdminFilterReports();

  // Memoize derived props to reduce unnecessary re-renders in heavier child components.
  const filterProps = useMemo(
    () => ({
      filter,
      onSubmit: (f: Partial<typeof filter>) => setFilter(f),
      customers: facets.customers,
      projects: facets.projects,
      users: facets.users,
      categories: facets.categories,
      articleRegistered: facets?.articles?.registered ?? [],
      articleCustomTop: facets?.articles?.customTop ?? [],
    }),
    [filter, setFilter, facets]
  );

  const showContent = !statsLoading && !statsError && !!stats;

  return (
    <main className="space-y-4" aria-busy={statsLoading ? "true" : "false"}>
      {/* Heading helps screen readers + improves page structure (Lighthouse Accessibility) */}
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Admin statistics</h1>
        <p className="text-sm text-muted-foreground">
          Filter and analyze time reporting data for the selected period.
        </p>
      </header>

      <section aria-label="Filters">
        <AdminFilters {...filterProps} />
      </section>

      {/* Loading state (A11y: role + aria-live) */}
      {statsLoading && (
        <section role="status" aria-live="polite" aria-label="Loading statistics">
          <AppLoader />
        </section>
      )}

      {/* Error state (A11y: role + aria-live) */}
      {!statsLoading && statsError && (
        <section
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          Error: {statsError}
        </section>
      )}

      {/* Content */}
      {showContent && stats && (
        <section aria-label="Statistics dashboard">
          <div className="grid gap-3">
            <TimeSummaryCard
              totalHours={stats.summary.totalHours}
              billableHours={stats.summary.billableHours}
              nonBillableHours={stats.summary.nonBillableHours}
              daysReported={stats.summary.activeDays}
              sick={stats.summary.sickHours}
              vacation={stats.summary.vacationHours}
              Titel="Summary for current selection"
            />

            <ArticleStatsSummary
              registered={stats.articles?.registered ?? []}
              custom={stats.articles?.custom ?? []}
              articleMode={filter.articleMode}
              activeRegisteredIds={filter.articleIds}
              activeCustomQuery={filter.customArticleQuery}
              data={stats.articlesByCustomerTimecards}
            />

            <HoursByCustomerChart data={stats.byCustomer} />
            <HoursPerWeekChart data={stats.weekHours} />

            <div className="flex gap-3 flex-col lg:flex-row">
              <HoursByUserChart data={stats.byUser} />
              <HoursByCategoryChart data={stats.byCategory} />
            </div>

            <MissingReportDaysTableStats data={stats.missingDays ?? []} />
          </div>
        </section>
      )}
    </main>
  );
};
