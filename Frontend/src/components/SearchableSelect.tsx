import { useState, useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "../components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "../components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandEmpty,
  CommandItem,
  CommandSeparator,
} from "../components/ui/command";
import { cn } from "../lib/utils"; 

type Option = { id: number; name: string };
type SearchableSelectProps = {
  label?: string;
  value?: number | undefined;
  onChange: (v: number | undefined) => void;
  options: Option[];
  placeholder?: string;
  clearLabel?: string;      
  disabled?: boolean;
  buttonClassName?: string;
};

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = "Search…",
  clearLabel = "All",
  disabled,
  buttonClassName,
}) => {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => options.find((o) => o.id === value),
    [options, value]
  );

  return (
    <div className="space-y-1">
      {label && <label className="text-sm text-foreground">{label}</label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            aria-expanded={open}
            className={cn("w-full justify-between", buttonClassName)}
          >
            {selected ? selected.name : clearLabel}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={placeholder} />
            <CommandList className="scrollbar-dark">
              <CommandEmpty>No results.</CommandEmpty>

              <CommandGroup>
                <CommandItem
                  key="__all__"
                  value="__all__"
                  onSelect={() => {
                    onChange(undefined);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100 " : "opacity-0") } />
                  {clearLabel}
                </CommandItem>
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup>
                {options.map((o) => (
                  <CommandItem
                    key={o.id}
                    value={`${o.name} ${o.id}`}
                    onSelect={() => {
                      onChange(o.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === o.id ? "opacity-100" : "opacity-0")} />
                    {o.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
