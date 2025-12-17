import { useEffect, useState, useId } from "react";
import { Input } from "../../components/ui/input";
import { X, Search as SearchIcon, HelpCircle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Label } from "@radix-ui/react-label";
import { Popover, PopoverTrigger, PopoverContent } from "../../components/ui/popover";

type Props = {
  value: string;
  onChange?: (next: string) => void;
  onSubmit?: (query: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  submitOnClear?: boolean;
  showHelp?: boolean;
};

export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Search…",
  debounceMs = 300,
  className = "",
  submitOnClear = true,
  showHelp = true,
}: Props) {
  const [local, setLocal] = useState(value);
  const inputId = useId();

  useEffect(() => setLocal(value), [value]);

  useEffect(() => {
    if (!onChange) return;
    const t = window.setTimeout(() => {
      if (local !== value) onChange(local.trim());
    }, debounceMs);
    return () => window.clearTimeout(t);
  }, [local, value, onChange, debounceMs]);

  const runSubmit = (q: string) => {
    const cb = onSubmit ?? onChange;
    cb?.(q.trim());
  };

  const handleClear = () => {
    setLocal("");
    if (submitOnClear) runSubmit("");
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    runSubmit(local);
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="flex items-center justify-between">
        <Label htmlFor={inputId}>Search</Label>

        {showHelp && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0"
                aria-label="Open search tips"
              >
                <HelpCircle className="mr-1 h-4 w-4" />
                Search tips
              </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[340px] text-sm" side="bottom" align="end">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                What you can search
              </div>

              <ul className="list-disc pl-5 space-y-1">
                <li><span className="font-medium">ID</span>: <code>#123</code> or <code>id:123</code></li>
                <li><span className="font-medium">Exact date</span>: <code>2025-10-15</code></li>
                <li><span className="font-medium">Month</span>: <code>2025-10</code> · <span className="font-medium">Year</span>: <code>2025</code></li>
                <li><span className="font-medium">Range</span>: <code>2025-10-01..2025-10-15</code>, <code>to</code>, or <code>-</code></li>
                <li><span className="font-medium">Slash date</span>: <code>20/10/2025</code> or <code>2025/10/20</code></li>
                <li><span className="font-medium">Keywords</span>: <code>today</code>, <code>yesterday</code>, <code>last 24h</code></li>
                <li><span className="font-medium">Day of month</span>: e.g. <code>20</code></li>
                <li><span className="font-medium">Free text</span>: customer, project, category, notes, etc.</li>
              </ul>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="relative mt-1">
        <Input
          id={inputId}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10"
          aria-label="Search time reports"
        />

        <Button
          type="submit"
          variant="ghost"
          size="icon"
          aria-label="Submit search"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
        >
          <SearchIcon className="h-4 w-4" />
        </Button>

        {local && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
}
