import { Button } from "../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

type Props = {
  pageIndex: number;
  pageSize: number;
  count: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void | Promise<void>;
  onNext: () => void | Promise<void>;
  onPageSizeChange: (n: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  disabled?: boolean;
};

export function CursorPagination({
  pageIndex,
  pageSize,
  count,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  className = "",
  disabled = false,
}: Props) {
  const page = pageIndex + 1;
  const from = pageIndex * pageSize + (count ? 1 : 0);
  const to = from + Math.max(0, count - 1);

  const opts = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b);

  return (
    <div
      className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${className}`}
      aria-disabled={disabled}
    >
      <div className="text-sm text-muted-foreground">
        {count ? `Showing ${from}–${to}` : "No results"}
        <span className="ml-2">• Page {page}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground hidden sm:inline">
          Rows
        </span>

        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(Number(v))}
          disabled={disabled}
        >
          <SelectTrigger className="w-[88px]" aria-label="Rows per page">
            <SelectValue placeholder="Rows" />
          </SelectTrigger>
          <SelectContent>
            {opts.map((opt) => (
              <SelectItem key={opt} value={String(opt)}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={onPrev}
          disabled={!canPrev || disabled}
          aria-label="Previous page"
        >
          Previous
        </Button>

        <Button
          onClick={onNext}
          disabled={!canNext || disabled}
          aria-label="Next page"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
