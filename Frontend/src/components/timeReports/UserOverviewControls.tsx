import React from "react";
import { MonthSwitcher } from "./MonthSwitcher";
import { SearchInput } from "./SearchInput";
import { TimeSummaryCard } from "./TimeSummaryCard";
import type { Summary } from "../../models/timeReports";

type Props = {
  title?: string;
  start: string;
  end: string;
  onChangeRange: (r: { start: string; end: string }) => void;
  search: string;
  onSearch: (q: string) => void;
  summary: Summary;
  showingCount?: number;
  totalCount?: number;
};

export const UserOverviewControls: React.FC<Props> = ({
  title = "Time overview",
  start,
  end,
  onChangeRange,
  search,
  onSearch,
  summary,
  showingCount,
  totalCount,
}) => {
  return (
    <div className="w-full min-w-full flex flex-col gap-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-2xl font-semibold text-center lg:text-left">{title}</h1>
        <MonthSwitcher start={start} end={end} onChange={onChangeRange as any} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex-1">
          <TimeSummaryCard
            totalHours={summary.totalHours}
            billableHours={summary.billableHours}
            nonBillableHours={summary.nonBillableHours}
            amount={summary.amount}
            daysReported={summary.daysReported}
            sick={summary.sickHours}
            vacation={summary.vacationHours}
          />
        </div>

        <div className="flex flex-row gap-4 flex-1 max-w-full">
          <div className="w-full">
            <SearchInput
              value={search ?? ""}
              onSubmit={onSearch}
              onChange={onSearch}
              placeholder="Search time reports…"
              submitOnClear
            />
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          {typeof showingCount === "number" ? (
            totalCount != null ? (
              <>
                Showing <b>{showingCount}</b> of <b>{totalCount}</b> rows
              </>
            ) : (
              <div className="flex gap-0.5 justify-end mr-1">
                <p>Showing:</p>
                <b className="ml-1">{showingCount}</b> rows
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
};
