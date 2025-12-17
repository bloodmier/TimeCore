// src/components/time/CustomerSearchPopover.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../../components/ui/command";
import type { icustomer } from "../../models/customer";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

export interface CustomerSearchPopoverProps {
  value: number | null;
  onPick: (id: number) => void;
  onSearch: (query: string) => Promise<icustomer[] | undefined>;
  customers: icustomer[];
  recentCustomers: icustomer[];
  ownerCompanies: icustomer[];
  quickAdd: (company: string, ownerId: number) => Promise<icustomer>;
  buttonLabel?: string;
  disabled?: boolean;
  onQuickAdd?: (newCustomer: icustomer) => void;
  resetKey?: any;
}

export const CustomerSearchPopover = ({
  value,
  onPick,
  onSearch,
  customers,
  recentCustomers,
  ownerCompanies,
  quickAdd,
  buttonLabel = "Select…",
  onQuickAdd,
  disabled,
  resetKey,
}: CustomerSearchPopoverProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<icustomer[]>([]);
  const debounceRef = useRef<number | null>(null);

  const [newCompany, setNewCompany] = useState("");
  const [adding, setAdding] = useState(false);
  const [ownerId, setOwnerId] = useState<number | null>(null);

  useEffect(() => {
    setSearch("");
    setResults([]);
  }, [resetKey]);

  const handleQuickAdd = useCallback(async () => {
    if (!quickAdd || !newCompany.trim() || !ownerId) return;
    try {
      setAdding(true);

      const added = await quickAdd(newCompany.trim(), ownerId);

      setNewCompany("");
      setOwnerId(null);
      setResults((prev) => [...prev, added]);

      onPick(added.id);

      if (onQuickAdd) onQuickAdd(added);

      setOpen(false);
    } finally {
      setAdding(false);
    }
  }, [newCompany, ownerId, quickAdd, onPick, onQuickAdd]);

  const selected = useMemo(() => {
    return (
      customers.find((c) => c.id === value) ||
      results.find((c) => c.id === value) ||
      recentCustomers.find((c) => c.id === value) ||
      null
    );
  }, [value, customers, results, recentCustomers]);

  const handleSearch = (q: string) => {
    setSearch(q);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!q.trim()) {
      setResults([]);
      return;
    }

    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await onSearch(q);
        setResults(res ?? []);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Choose customer"
          className="w-full justify-between"
          disabled={disabled}
        >
          {selected ? selected.company : buttonLabel}
          <ChevronsUpDown
            className="ml-2 h-4 w-4 shrink-0 opacity-50"
            aria-hidden="true"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[320px] p-0 max-h-none overflow-visible data-[state=open]:animate-none"
        align="start"
      >
        <Command className="max-h-none overflow-visible" shouldFilter={false}>
          <CommandInput
            placeholder="Search customer…"
            aria-label="Search customer"
            value={search}
            onValueChange={handleSearch}
          />
          <CommandList className="max-h-none overflow-visible">
            {loading && (
              <div className="flex justify-center p-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              </div>
            )}

            {!loading && search && !results.length && (
              <CommandEmpty>No results found.</CommandEmpty>
            )}

            {!search && recentCustomers.length > 0 && (
              <>
                <CommandGroup heading="Recent">
                  {recentCustomers.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={c.company}
                      onSelect={() => {
                        onPick(c.id);
                        setOpen(false);
                      }}
                    >
                      {c.company}
                      {value === c.id && (
                        <Check className="ml-auto h-4 w-4" aria-hidden="true" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {search && results.length > 0 && (
              <CommandGroup heading="Results">
                {results.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.company}
                    onSelect={() => {
                      onPick(c.id);
                      setOpen(false);
                    }}
                  >
                    {c.company}
                    {value === c.id && (
                      <Check className="ml-auto h-4 w-4" aria-hidden="true" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandSeparator />
            <CommandGroup heading="Add customer" />
            <div className="p-3 space-y-2">
              <Input
                placeholder="New company name"
                aria-label="New company name"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
              />
              <Select
                value={ownerId ? String(ownerId) : ""}
                onValueChange={(val) => setOwnerId(Number(val))}
              >
                <SelectTrigger aria-label="Choose owner company">
                  <SelectValue placeholder="Choose owner company…" />
                </SelectTrigger>
                <SelectContent>
                  {ownerCompanies.map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>
                      {o.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                disabled={!newCompany || !ownerId || adding}
                onClick={handleQuickAdd}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                {adding ? "Adding…" : "Quick add"}
              </Button>
            </div>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
