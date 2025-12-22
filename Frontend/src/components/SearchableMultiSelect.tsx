import { useMemo } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "../components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Check, ChevronsUpDown, X } from "lucide-react";

type Opt = { id: number; name: string };

export function SearchableMultiSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Search…",
  disabled,
}: {
  label: string;
  value: number[];
  onChange: (ids: number[]) => void;
  options: Opt[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const byId = useMemo(() => new Map(options.map(o => [o.id, o.name])), [options]);
  const selected = value.map(id => ({ id, name: byId.get(id) ?? String(id) }));

  const toggle = (id: number) => {
    if (value.includes(id)) onChange(value.filter(v => v !== id));
    else onChange([...value, id]);
  };
  const clearOne = (id: number) => onChange(value.filter(v => v !== id));
  const clearAll = () => onChange([]);

  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">{label}</div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" disabled={disabled} className="w-full justify-between">
            {selected.length ? `${selected.length} selected` : "All"}
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-80" align="start">
          <Command>
            <CommandInput placeholder={placeholder} />
            <CommandEmpty>Inga träffar</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {options.map(o => {
                const active = value.includes(o.id);
                return (
                  <CommandItem key={o.id} onSelect={() => toggle(o.id)}>
                    <Check className={`mr-2 h-4 w-4 ${active ? "opacity-100" : "opacity-0"}`} />
                    {o.name}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {selected.map(s => (
            <Badge key={s.id} variant="secondary" className="gap-1">
              {s.name}
              <button type="button" onClick={() => clearOne(s.id)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={clearAll}>Clear</Button>
        </div>
      )}
    </div>
  );
}
