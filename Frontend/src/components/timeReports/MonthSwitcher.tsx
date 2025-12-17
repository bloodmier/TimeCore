import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "../../components/ui/popover";
import { Calendar } from "../../components/ui/calendar";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { getMonthRange } from "../../helpers/TimeHelpersfunctions";
import { sv } from "date-fns/locale";

type Props = {
  start?: string;
  end?: string;
  onChange: (v: { start: string | undefined; end: string | undefined }) => void;
  AllUnbilled?: boolean;
};

export const MonthSwitcher: React.FC<Props> = ({ start, end, onChange, AllUnbilled }) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const fromYMD = (s?: string): Date | undefined => {
    if (!s) return undefined;
    const [y, m, d] = s.split("-").map(Number);
    if (!y || !m || !d) return undefined;
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  };

  const firstOfMonthFromYMD = (ymd?: string): Date => {
    const base = fromYMD(ymd) ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  };

  const monthAdd = (base: Date, delta: number) =>
    new Date(base.getFullYear(), base.getMonth() + delta, 1);

  const [from, setFrom] = useState<Date | undefined>(fromYMD(start));
  const [to, setTo] = useState<Date | undefined>(fromYMD(end));

  useEffect(() => setFrom(fromYMD(start)), [start]);
  useEffect(() => setTo(fromYMD(end)), [end]);

  useEffect(() => {
    if (from && to && to >= from) {
      onChange({ start: toYMD(from), end: toYMD(to) });
    }
  }, [from, to]);

  const [leftMonth, setLeftMonth] = useState<Date>(firstOfMonthFromYMD(start));
  const [rightMonth, setRightMonth] = useState<Date>(monthAdd(firstOfMonthFromYMD(start), 1));

  const changeBy = (delta: number) => {
    const base = firstOfMonthFromYMD(start);
    const next = monthAdd(base, delta);
    const first = new Date(next.getFullYear(), next.getMonth(), 1);
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0);
    setFrom(first);
    setTo(last);
    onChange({ start: toYMD(first), end: toYMD(last) });
  };

  const setThisMonth = () => {
    const { start: s, end: e } = getMonthRange(0);
    const f = fromYMD(s), t = fromYMD(e);
    setFrom(f); setTo(t);
    onChange({ start: s, end: e });
  };

  const MonthPicker = ({ month, setMonth }: { month: Date; setMonth: (d: Date) => void }) => {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const y = month.getFullYear();
    const m = month.getMonth();

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous year"
            onClick={() => setMonth(new Date(y - 1, m, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="text-sm font-medium">{y}</div>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Next year"
            onClick={() => setMonth(new Date(y + 1, m, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {months.map((label, idx) => (
            <Button
              key={label}
              variant={idx === m ? "secondary" : "outline"}
              size="sm"
              onClick={() => setMonth(new Date(y, idx, 1))}
              aria-label={`Set month ${label} ${y}`}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
    );
  };

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const base = firstOfMonthFromYMD(start);
    setLeftMonth(base);
    setRightMonth((prev) => {
      const adj = monthAdd(base, 1);
      const same =
        prev.getFullYear() === adj.getFullYear() &&
        prev.getMonth() === adj.getMonth();
      return same ? prev : adj;
    });
  }, [open, start]);

  const setToday = () => {
    const d = new Date(); setFrom(d); setTo(d);
    onChange({ start: toYMD(d), end: toYMD(d) });
  };

  const setYesterday = () => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    setFrom(d); setTo(d);
    onChange({ start: toYMD(d), end: toYMD(d) });
  };

  const setLastMonth = () => {
    const { start: s, end: e } = getMonthRange(-1);
    const f = fromYMD(s), t = fromYMD(e);
    setFrom(f); setTo(t);
    onChange({ start: s, end: e });
  };

  const setThisYear = () => {
    const now = new Date();
    const f = new Date(now.getFullYear(), 0, 1);
    const t = new Date(now.getFullYear(), 11, 31);
    setFrom(f); setTo(t);
    onChange({ start: toYMD(f), end: toYMD(t) });
  };

  const setNoDate = () => {
    setFrom(undefined);
    setTo(undefined);
    onChange({ start: undefined, end: undefined });
  };

  const startLabel = start ?? "—";
  const endLabel = end ?? "—";

  return (
    <div className="flex w-full items-center gap-2 flex-wrap lg:flex-nowrap lg:justify-end">
      <div className="flex gap-2">
        {AllUnbilled && (
          <Button variant="outline" className="mr-5" onClick={setNoDate}>
            All Unbilled
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => changeBy(-1)} aria-label="Previous month range">
          Prev
        </Button>
        <Button variant="secondary" size="sm" onClick={setThisMonth} aria-label="Set this month range">
          This month
        </Button>
        <Button variant="outline" size="sm" onClick={() => changeBy(+1)} aria-label="Next month range">
          Next
        </Button>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto lg:ml-2 flex items-center gap-2"
            title="Pick dates (left=start, right=end)"
            aria-label="Open date range picker"
          >
            <CalendarIcon className="h-4 w-4" />
            <span className="tabular-nums">{startLabel}</span>
            <span>→</span>
            <span className="tabular-nums">{endLabel}</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-3" align="end">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-md border p-2">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Previous month (start calendar)"
                    onClick={() => setLeftMonth(monthAdd(leftMonth, -1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-sm font-medium">
                    {leftMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Next month (start calendar)"
                    onClick={() => setLeftMonth(monthAdd(leftMonth, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" title="Pick month/year (left)" aria-label="Pick month and year (start calendar)">
                      <CalendarIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px]" align="end">
                    <MonthPicker month={leftMonth} setMonth={setLeftMonth} />
                  </PopoverContent>
                </Popover>
              </div>

              <Calendar
                mode="single"
                month={leftMonth}
                numberOfMonths={1}
                onMonthChange={setLeftMonth}
                selected={from}
                onSelect={(d) => {
                  if (!d) return;
                  if (to && d > to) setFrom(d);
                  else setFrom(d);
                }}
                locale={sv}
                disabled={to ? { after: to } : undefined}
              />
            </div>

            <div className="rounded-md border p-2">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Previous month (end calendar)"
                    onClick={() => setRightMonth(monthAdd(rightMonth, -1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-sm font-medium">
                    {rightMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Next month (end calendar)"
                    onClick={() => setRightMonth(monthAdd(rightMonth, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" title="Pick month/year (right)" aria-label="Pick month and year (end calendar)">
                      <CalendarIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px]" align="end">
                    <MonthPicker month={rightMonth} setMonth={setRightMonth} />
                  </PopoverContent>
                </Popover>
              </div>

              <Calendar
                mode="single"
                month={rightMonth}
                numberOfMonths={1}
                onMonthChange={setRightMonth}
                selected={to}
                onSelect={(d) => {
                  if (!d) return;
                  setTo(d);
                }}
                locale={sv}
                disabled={from ? { before: from } : undefined}
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={setToday} aria-label="Set date range to today">Today</Button>
            <Button variant="outline" size="sm" onClick={setYesterday} aria-label="Set date range to yesterday">Yesterday</Button>
            <Button variant="outline" size="sm" onClick={setThisMonth} aria-label="Set date range to this month">This month</Button>
            <Button variant="outline" size="sm" onClick={setLastMonth} aria-label="Set date range to last month">Last month</Button>
            <Button variant="outline" size="sm" className="col-span-2" onClick={setThisYear} aria-label="Set date range to this year">
              This year
            </Button>
          </div>

          <div className="flex justify-between mt-3">
            <Button variant="outline" size="sm" onClick={setNoDate} aria-label="Clear date filter">
              No date filter
            </Button>
            <Button size="sm" onClick={() => setOpen(false)} aria-label="Close date picker">
              Close
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
