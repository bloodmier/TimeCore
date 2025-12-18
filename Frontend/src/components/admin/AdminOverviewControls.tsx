import React from "react";
import { MonthSwitcher } from "../../components/timeReports/MonthSwitcher";
import { UserSelect } from "../../components/admin/UserSelect";
import { SearchInput } from "../../components/timeReports/SearchInput";
import { TimeSummaryCard } from "../../components/timeReports/TimeSummaryCard";
import type { IUser, Summary } from "../../models/timeReports";

type Props = {
  title?: string;
  start: string;
  end: string;
  onChangeRange: (r: { start: string; end: string }) => void;
  users: IUser[];
  selectedUserId: number | null;
  onSelectUser: (u: IUser | null) => void;
  search: string;
  onSearch: (q: string) => void;
  summary: Summary;
  showingCount?: number;
  totalCount?: number;
};

export const AdminOverviewControls: React.FC<Props> = ({
  title = "Time overview Admin",
  start,
  end,
  onChangeRange,
  users,
  selectedUserId,
  onSelectUser,
  search,
  onSearch,
  summary,
  showingCount,
  totalCount,
}) => {
  return (
    <div className="flex flex-col gap-3">
      {/* Top row */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-2xl font-semibold text-center lg:text-left">
          {title}
        </h1>

        <MonthSwitcher start={start} end={end} onChange={onChangeRange as any} />
      </div>

      {/* Summary */}
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

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4 w-full">
          <div className="w-full lg:w-1/2">
            <UserSelect
              users={users}
              onSelect={onSelectUser}
              selectedUserId={selectedUserId}
              includeAll
            />
          </div>

          <div className="w-full lg:w-1/2">
            <SearchInput
              value={search ?? ""}
              onSubmit={onSearch}
              onChange={onSearch}
              placeholder="Search time reports…"
              submitOnClear
              showHelp
            />
          </div>
        </div>

        {/* Count */}
        {typeof showingCount === "number" ? (
          <div className="text-xs text-muted-foreground text-right">
            {totalCount != null ? (
              <>
                Showing <b>{showingCount}</b> of <b>{totalCount}</b> rows
              </>
            ) : (
              <>
                Showing <b>{showingCount}</b> rows
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
