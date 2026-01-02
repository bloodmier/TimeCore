import * as React from "react";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import type { OrderKey, SortKey } from "../../models/Draft";

type Action =
  | { type: "SET_SORT"; sort: SortKey }
  | { type: "SET_ORDER"; order: OrderKey };

type DraftsSortBarProps = {
  filters: { order?: OrderKey };
  dispatch: React.Dispatch<Action>;
  className?: string;
};

export function DraftsSortBar({
  filters,
  dispatch,
  className,
}: DraftsSortBarProps) {
  return (
    <div className={`flex flex-row gap-4 md:gap-6 mb-4 ${className ?? ""}`}>
      <div className="flex flex-col gap-1">
        <Label id="sort-label" className="text-sm">
          Sort
        </Label>
        <Select
          defaultValue="company_name"
          onValueChange={(v) =>
            dispatch({ type: "SET_SORT", sort: v as SortKey })
          }
        >
          <SelectTrigger
            className="w-[180px]"
            aria-labelledby="sort-label"
            aria-label="Sort drafts"
          >
            <SelectValue placeholder="Sort by modified" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="company_name">Company</SelectItem>
            <SelectItem value="modified">Last updated</SelectItem>
            <SelectItem value="date">Report date</SelectItem>
            <SelectItem value="created_date">Created</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label id="order-label" className="text-sm">
          Order
        </Label>
        <Select
          value={filters.order ?? "desc"}
          onValueChange={(v) =>
            dispatch({ type: "SET_ORDER", order: v as OrderKey })
          }
        >
          <SelectTrigger
            className="w-[180px]"
            aria-labelledby="order-label"
            aria-label="Order direction"
          >
            <SelectValue placeholder="Choose order" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="asc">A–Ö</SelectItem>
            <SelectItem value="desc">Ö–A</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
