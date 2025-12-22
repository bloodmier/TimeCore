import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { fromYMD, toYMD } from "../../helpers/dateHelpers";
import { getMonthRange } from "../../helpers/TimeHelpersfunctions";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "../../components/ui/popover";
import { Calendar } from "../../components/ui/calendar";
import { CalendarIcon } from "lucide-react";

type Range = { start: string; end: string };
type DefaultSpan = "thisMonth" | "lastMonth";

type Props = {
  defaultSpan?: DefaultSpan;           
  onChange: (r: Range) => void;       
};

export const MonthRangeSwitcher: React.FC<Props> = ({
  defaultSpan = "thisMonth",
  onChange,
}) => {
  // --- helpers ---
  const today = () => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  };
  const addDays = (d: Date, n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  const startOfYear  = (d: Date) => new Date(d.getFullYear(), 0, 1);
  const endOfYear    = (d: Date) => new Date(d.getFullYear(), 11, 31);
  const startOfQuarter = (d: Date) => {
    const qStartMonth = Math.floor(d.getMonth() / 3) * 3;
    return new Date(d.getFullYear(), qStartMonth, 1);
  };
  const toRange = (s: Date, e: Date): Range => ({ start: toYMD(s), end: toYMD(e) });
  const monthDiff = (a: Date, b: Date) => (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());


 const deriveOffsetFromRangeStart = (r: Range) => {
  if (!r?.start) return 0; 
  const start = fromYMD(r.start);
  const now = today();
  const safeStart = start ?? now;
  const monthStart = new Date(safeStart.getFullYear(), safeStart.getMonth(), 1);
  const nowMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return monthDiff(monthStart, nowMonthStart);
};

  const initialOffset = defaultSpan === "lastMonth" ? -1 : 0; 
  const initialRange = useMemo(() => getMonthRange(initialOffset), [initialOffset]);

  const [range, setRange] = useState<Range>(initialRange);
  const [monthOffset, setMonthOffset] = useState<number | null>(initialOffset);

  useEffect(() => { onChange(range); }, [range]);

 
  const setByOffset = (off: number) => {
    setMonthOffset(off);
    setRange(getMonthRange(off));
  };

  const prevMonth = () => {
    const base = monthOffset ?? deriveOffsetFromRangeStart(range);
    setByOffset(base - 1);
  };
  const nextMonth = () => {
    const base = monthOffset ?? deriveOffsetFromRangeStart(range);
    setByOffset(base + 1);
  };
  const thisMonth = () => setByOffset(0);

  const lastNDays = (n: number) => {
    const e = today();
    const s = addDays(e, -(n - 1));
    setMonthOffset(null);
    setRange(toRange(s, e));
  };
  const lastNMonthsRolling = (n: number) => {
    const e = today();
    const s = new Date(e.getFullYear(), e.getMonth() - (n - 1), 1);
    setMonthOffset(null);
    setRange(toRange(s, e));
  };

  const yearToDate  = () => { const e = today(); setMonthOffset(null); setRange(toRange(startOfYear(e), e)); };
  const quarterToDate = () => { const e = today(); setMonthOffset(null); setRange(toRange(startOfQuarter(e), e)); };
  const thisYearFull = () => { const e = today(); setMonthOffset(null); setRange(toRange(startOfYear(e), endOfYear(e))); };
  const lastYearFull = () => {
    const e = today(); const yr = e.getFullYear() - 1;
    setMonthOffset(null);
    setRange(toRange(new Date(yr,0,1), new Date(yr,11,31)));
  };

  const [openFrom, setOpenFrom] = useState(false);
  const [openTo, setOpenTo] = useState(false);

  const onSelectFrom = (d?: Date) => {
    if (!d) return;
    const newStart = toYMD(d);
    setMonthOffset(null);
    if (new Date(newStart) > new Date(range.end)) {
      setRange({ start: newStart, end: newStart });
    } else {
      setRange({ ...range, start: newStart });
    }
    setOpenFrom(false);
  };

  const onSelectTo = (d?: Date) => {
    if (!d) return;
    const newEnd = toYMD(d);
    setMonthOffset(null);
    if (new Date(newEnd) < new Date(range.start)) {
      setRange({ start: newEnd, end: newEnd });
    } else {
      setRange({ ...range, end: newEnd });
    }
    setOpenTo(false);
  };

  return (
    <div className="w-full max-w-screen-md mx-auto flex flex-col gap-3 items-center text-center">
      <div className="w-full flex flex-wrap items-center gap-2 justify-center">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth}>Prev</Button>
          <Button variant="secondary" size="sm" onClick={thisMonth}>This month</Button>
          <Button variant="outline" size="sm" onClick={nextMonth}>Next</Button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">Quick picks ▾</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Month</DropdownMenuLabel>
            <DropdownMenuItem onClick={thisMonth}>This month</DropdownMenuItem>
            <DropdownMenuItem onClick={prevMonth}>Previous month</DropdownMenuItem>
            <DropdownMenuSeparator />

            <DropdownMenuLabel>Rolling days</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => lastNDays(7)}>Last 7 days</DropdownMenuItem>
            <DropdownMenuItem onClick={() => lastNDays(30)}>Last 30 days</DropdownMenuItem>
            <DropdownMenuItem onClick={() => lastNDays(90)}>Last 90 days</DropdownMenuItem>
            <DropdownMenuSeparator />

            <DropdownMenuLabel>Rolling months</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => lastNMonthsRolling(3)}>Last 3 months</DropdownMenuItem>
            <DropdownMenuSeparator />

            <DropdownMenuLabel>Year / Quarter</DropdownMenuLabel>
            <DropdownMenuItem onClick={quarterToDate}>QTD (quarter→today)</DropdownMenuItem>
            <DropdownMenuItem onClick={yearToDate}>YTD (year→today)</DropdownMenuItem>
            <DropdownMenuItem onClick={thisYearFull}>This year (full)</DropdownMenuItem>
            <DropdownMenuItem onClick={lastYearFull}>Last year (full)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Row 2: From/To with Popover + Calendar */}
      <div className="w-full flex flex-wrap items-center gap-3 justify-center">
        {/* From */}
        <div className="w-full sm:w-auto">
          <Label htmlFor="from">From</Label>
          <Popover open={openFrom} onOpenChange={setOpenFrom}>
            <PopoverTrigger asChild>
              <Button
                id="from"
                variant="outline"
                className="w-full sm:w-48 justify-between text-left font-normal"
              >
                {range.start || "Pick a date"}
                <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0" align="start">
              <Calendar
                mode="single"
                selected={fromYMD(range.start)}
                onSelect={onSelectFrom}
                autoFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* To */}
        <div className="w-full sm:w-auto">
          <Label htmlFor="to">To</Label>
          <Popover open={openTo} onOpenChange={setOpenTo}>
            <PopoverTrigger asChild>
              <Button
                id="to"
                variant="outline"
                className="w-full sm:w-48 justify-between text-left font-normal"
              >
                {range.end || "Pick a date"}
                <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0" align="start">
              <Calendar
                mode="single"
                selected={fromYMD(range.end)}
                onSelect={onSelectTo}
                autoFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Range text */}
        <span className="w-full text-sm text-muted-foreground">
          {range.start} → {range.end}
        </span>
      </div>
    </div>
  );
};
