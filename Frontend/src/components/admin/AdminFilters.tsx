import { useEffect, useMemo, useRef, useState } from "react";
import type { AdminFilter } from "../../models/admin";
import { BillableTriSwitch } from "../BillableTriSwitch";
import { Button } from "../ui/button";
import { MonthRangeSwitcher } from "./MonthRangeSwitcher";
import { SearchableSelect } from "../SearchableSelect";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  ArticleRegisteredMulti,
  type RegisteredArticleOpt,
} from "./ArticleRegisteredMulti";
import { ArticleCustomFilter, type CustomTopItem } from "./ArticleCustomFilter";
import { ArticleModeSwitch } from "./ArticleModeSwitch";

type Props = {
  filter?: AdminFilter;
  onSubmit: (f: AdminFilter) => void;
  customers: { id: number; name: string }[];
  projects: { id: number; name: string }[];
  users: { id: number; name: string }[];
  categories: { id: number; name: string }[];
  articleRegistered?: RegisteredArticleOpt[];
  articleCustomTop?: CustomTopItem[];
};

/**
 * Normalize makes sure the filter object has a consistent shape.
 * This prevents "false diffs" when comparing objects (e.g. undefined vs empty string/array),
 * and keeps the UI state predictable.
 */
const normalize = (f?: AdminFilter): AdminFilter => ({
  from: f?.from ?? "",
  to: f?.to ?? "",
  customerId: f?.customerId,
  projectId: f?.projectId,
  userId: f?.userId,
  category: f?.category,
  search: f?.search ?? "",
  billable: f?.billable,
  billed: f?.billed,
  articleMode: f?.articleMode ?? "all",
  articleIds: f?.articleIds ?? [],
  customArticleQuery: f?.customArticleQuery ?? "",
});

export const AdminFilters = ({
  filter,
  onSubmit,
  customers,
  projects,
  users,
  categories,
  articleRegistered = [],
  articleCustomTop = [],
}: Props) => {
  const [draft, setDraft] = useState<AdminFilter>(() => normalize(filter));

  /**
   * We stringify the normalized incoming filter so we can:
   * 1) use it as a stable dependency key
   * 2) resync draft when parent filter changes (e.g. external reset)
   *
   * This is a pragmatic approach; it keeps the sync-effect simple and reliable.
   */
  const filterKey = useMemo(() => JSON.stringify(normalize(filter)), [filter]);

  // Keep local draft in sync if parent filter changes from outside this component.
  useEffect(() => {
    setDraft(normalize(filter));
  }, [filterKey]);

  const patch = (p: Partial<AdminFilter>) =>
    setDraft((prev) => ({ ...prev, ...p }));

  const resetAll = () =>
    setDraft((prev) => ({
      ...prev,
      customerId: undefined,
      projectId: undefined,
      userId: undefined,
      category: undefined,
      billable: undefined,
      billed: undefined,
      articleMode: "all",
      articleIds: [],
      customArticleQuery: "",
      search: "",
    }));

  /**
   * Debounce prevents firing a backend request for every single keystroke/change.
   * The parent hook will re-fetch stats whenever onSubmit is called.
   */
  const debouncedDraft = useDebouncedValue(draft, 350);

  /**
   * React 18 + StrictMode (dev) mounts components twice.
   * Without this guard, the filter would "submit" on the first mount and cause canceled requests.
   * We intentionally skip the first submit to avoid duplicate initial fetches.
   */
  const didMountRef = useRef(false);

  /**
   * Keep track of the last submitted payload to avoid redundant submits when values didn't change.
   */
  const lastSubmitKeyRef = useRef<string>("");

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;

      // Baseline: treat incoming filter as "already submitted" on mount.
      lastSubmitKeyRef.current = JSON.stringify(normalize(filter));
      return;
    }

    const nextKey = JSON.stringify(debouncedDraft);

    // Do nothing if this payload is identical to the last submitted payload.
    if (lastSubmitKeyRef.current === nextKey) return;

    // Do nothing if draft equals the incoming filter (e.g. when parent resyncs).
    const incomingKey = JSON.stringify(normalize(filter));
    if (nextKey === incomingKey) return;

    lastSubmitKeyRef.current = nextKey;
    onSubmit(debouncedDraft);
  }, [debouncedDraft, filter, onSubmit]);

  return (
    <div className="w-full space-y-3" aria-label="Admin filters">
      <div className="flex justify-center">
        <MonthRangeSwitcher
          defaultSpan="thisMonth"
          onChange={(r) => patch({ from: r.start, to: r.end })}
        />
      </div>

      <div className="flex flex-wrap gap-3 bg-muted/30 p-3 rounded-xl items-start">
        <div className="w-full flex-none sm:flex-1 sm:basis-0 sm:min-w-[220px] space-y-1">
          <SearchableSelect
            label="Customer"
            value={draft.customerId}
            onChange={(id) => patch({ customerId: id })}
            options={customers}
            placeholder="Search customers…"
            clearLabel="All"
          />
        </div>

        <div className="w-full flex-none sm:flex-1 sm:basis-0 sm:min-w-[220px] space-y-1">
          <SearchableSelect
            label="Project"
            value={draft.projectId}
            onChange={(id) => patch({ projectId: id })}
            options={projects}
            placeholder="Search projects…"
          />
        </div>

        <div className="w-full flex-none sm:flex-1 sm:basis-0 sm:min-w-[220px] space-y-1">
          <SearchableSelect
            label="User"
            value={draft.userId}
            onChange={(id) => patch({ userId: id })}
            options={users}
            placeholder="Search users…"
          />
        </div>

        <div className="w-full flex-none sm:flex-1 sm:basis-0 sm:min-w-[220px] space-y-1">
          <SearchableSelect
            label="Category"
            value={draft.category}
            onChange={(id) => patch({ category: id })}
            options={categories}
            placeholder="Search categories…"
          />
        </div>

        <div className="flex flex-col gap-3 bg-muted/30 p-3 rounded-xl">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Articles</span>
            <ArticleModeSwitch
              value={draft.articleMode ?? "all"}
              onChange={(m) =>
                patch({
                  articleMode: m,
                  // When switching mode, clear irrelevant filter values to avoid confusing queries.
                  articleIds: m === "registered" ? draft.articleIds : [],
                  customArticleQuery: m === "custom" ? draft.customArticleQuery : "",
                })
              }
            />
          </div>

          {draft.articleMode === "registered" && (
            <ArticleRegisteredMulti
              value={draft.articleIds ?? []}
              onChange={(ids) => patch({ articleIds: ids })}
              options={articleRegistered}
              disabled={false}
            />
          )}

          {draft.articleMode === "custom" && (
            <ArticleCustomFilter
              query={draft.customArticleQuery ?? ""}
              onQueryChange={(v) => patch({ customArticleQuery: v })}
              top={articleCustomTop}
              onPick={(desc) => patch({ customArticleQuery: desc })}
            />
          )}
        </div>

        <div className="w-full flex-none sm:flex-1 sm:basis-0 sm:min-w-[220px]">
          <BillableTriSwitch
            label="Billable"
            value={draft.billable == null ? "all" : draft.billable ? "true" : "false"}
            onChange={(tri) =>
              patch({ billable: tri === "all" ? undefined : tri === "true" })
            }
          />
        </div>

        <div className="w-full flex-none sm:flex-1 sm:basis-0 sm:min-w-[220px]">
          <BillableTriSwitch
            label="Billed"
            value={draft.billed == null ? "all" : draft.billed ? "true" : "false"}
            onChange={(tri) =>
              patch({ billed: tri === "all" ? undefined : tri === "true" })
            }
          />
        </div>
      </div>

      <div className="flex w-full gap-2 justify-end">
        <Button type="button" className="text-red-500" variant="outline" onClick={resetAll}>
          Reset
        </Button>
      </div>
    </div>
  );
};
