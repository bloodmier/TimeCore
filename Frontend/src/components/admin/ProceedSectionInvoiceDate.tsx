// src/components/billing/ProceedSectionInvoiceDate.tsx
import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { format, endOfMonth, parseISO, isValid } from "date-fns";

type Props = {
  value: string | null;                 // "YYYY-MM-DD" or null
  onChange: (val: string | null) => void;
};

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

export function ProceedSectionInvoiceDate({ value, onChange }: Props) {
  const [enabled, setEnabled] = useState<boolean>(!!value);

  const monthEnd = useMemo(() => endOfMonth(new Date()), []);
  const monthEndIso = useMemo(() => toIso(monthEnd), [monthEnd]);

  const parsed = useMemo(() => {
    // parse value if present, fallback to month end
    if (value) {
      const d = parseISO(value);
      if (isValid(d)) return d;
    }
    return monthEnd;
  }, [value, monthEnd]);

  const pretty = useMemo(() => format(parsed, "yyyy-MM-dd"), [parsed]);

  const handleToggle = (v: boolean) => {
    setEnabled(v);
    if (!v) {
      // Auto: no explicit date, but show what auto means (last of month) in UI text below
      onChange(null);
    } else {
      // Default when enabling: last day of current month
      onChange(toIso(parsed ?? monthEnd));
    }
  };

  const setToday = () => {
    const d = new Date();
    onChange(toIso(d));
  };

  const setMonthEnd = () => {
    onChange(monthEndIso);
  };

  const clearAuto = () => {
    // Back to auto (Fortnox decides), but we display last-of-month hint
    onChange(null);
    setEnabled(false);
  };

  return (
    <section className="rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Invoice date</div>
          {!enabled ? (
            <p className="text-sm text-muted-foreground">
              Auto (last day of this month: <span className="font-medium">{monthEndIso}</span>)
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pick a specific date or use quick actions below.
            </p>
          )}
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggle} />
      </div>

      {enabled && (
        <div className="mt-4 grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="proceed-invoice-date">Date</Label>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="proceed-invoice-date"
                  variant="outline"
                  className="w-full justify-start font-normal"
                  type="button"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {pretty}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parsed}
                  onSelect={(d) => d && onChange(toIso(d))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={setMonthEnd}>
              Set to month end ({monthEndIso})
            </Button>
            <Button type="button" variant="outline" onClick={setToday}>
              Set to today
            </Button>
            <Button type="button" variant="ghost" onClick={clearAuto}>
              Clear (auto)
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
