import { memo } from "react";

export type CustomTopItem = {
  id: number;
  label: string;
  count: number;
};

type Props = {
  query: string;
  onQueryChange: (v: string) => void;
  top: CustomTopItem[];
  onPick: (desc: string) => void;
};

/**
 * ArticleCustomFilter
 *
 * Controlled input for filtering custom article descriptions.
 * Also shows a list of common descriptions that can be clicked to quickly apply a filter.
 *
 * Wrapped in React.memo because:
 * - it receives controlled props
 * - it may be rendered inside heavier admin filter UIs
 * - memo prevents unnecessary re-renders when parent state changes unrelated data
 */
export const ArticleCustomFilter = memo(function ArticleCustomFilter({
  query,
  onQueryChange,
  top,
  onPick,
}: Props) {
  const inputId = "article-custom-filter-input";

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <label htmlFor={inputId} className="text-sm font-medium">
          Custom description
        </label>
        <input
          id={inputId}
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder='e.g. “Cabling 30m Cat6”'
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>

      {!!top.length && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">
            Common descriptions
          </div>
          <div className="flex flex-wrap gap-2">
            {top.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onPick(t.label)}
                className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
                title={`${t.count} occurrences`}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
