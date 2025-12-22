import { memo, useMemo } from "react";
import { ChevronsUpDown, Check, X } from "lucide-react";
import { Button } from "../ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import {
  Command,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "../ui/command";

export type RegisteredArticleOpt = { id: number; name: string; count: number };

type Props = {
  label?: string;
  options: RegisteredArticleOpt[];
  value: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
};

/**
 * ArticleRegisteredMulti
 *
 * Multi-select for registered articles using a Popover + Command palette pattern.
 * - Fully controlled via `value` + `onChange`
 * - Uses memo to avoid re-rendering when parent changes unrelated state
 * - Uses a Map lookup to render selected "chips" efficiently
 */
export const ArticleRegisteredMulti = memo(function ArticleRegisteredMulti({
  label = "Articles (standard)",
  options,
  value,
  onChange,
  disabled,
}: Props) {
  const labelId = "registered-articles-label";

  // Map id -> label for rendering selected chips quickly.
  const byId = useMemo(
    () => new Map(options.map((o) => [o.id, `${o.name} (${o.count})`])),
    [options]
  );

  // Toggle selected state for an article id.
  const toggle = (id: number) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const clearAll = () => onChange([]);

  return (
    <div className="space-y-1">
      <label id={labelId} className="text-sm font-medium">
        {label}
      </label>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
            disabled={disabled}
            aria-labelledby={labelId}
          >
            {value.length ? `${value.length} Selected` : "All"}
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Search articles…" />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>

              <CommandGroup className="max-h-64 overflow-auto">
                {options.map((o) => {
                  const active = value.includes(o.id);

                  return (
                    <CommandItem
                      key={o.id}
                      value={`${o.name} ${o.id}`}
                      // CommandItem passes a string value to onSelect; we ignore it and use our id.
                      onSelect={() => toggle(o.id)}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          active ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      {o.name} ({o.count})
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {!!value.length && (
        <div className="flex flex-wrap gap-1 pt-1">
          {value.map((id) => {
            const chipLabel = byId.get(id) ?? String(id);

            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs"
              >
                {chipLabel}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((v) => v !== id))}
                  aria-label={`Remove ${chipLabel}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}

          <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
            Clear
          </Button>
        </div>
      )}
    </div>
  );
});
