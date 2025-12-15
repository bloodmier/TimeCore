/**
 * TimeRegisterVacationpage
 *
 * Page for registering vacation for the current user across a date range.
 * - Generates one time report entry per selected day
 * - Can skip weekends and Swedish public holidays
 * - Uses a default number of hours per day that can be overridden per date
 */


import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "../../components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "../../components/ui/calendar";
import { Checkbox } from "../../components/ui/checkbox";

import { sv } from "date-fns/locale";

import { useCategory } from "../../hooks/useCategory";
import { TimeReportService } from "../../services/timeReportService";
import type { TimeReportCreateDTO } from "../../models/Draft";
import { today } from "../../helpers/TimeHelpersfunctions";
import { fromYMD, toYMD } from "../../helpers/dateHelpers";
import { TenantService } from "../../services/tenantService";


type VacationDayEntry = {
  date: string; 
  isWeekend: boolean;
  isHoliday: boolean;
  hours: string; 
};

/* ==== helpers ==== */

// Easter algorithm (simplified Meeus/Jones/Butcher variant)
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toYMDLocal(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getSwedishPublicHolidays(year: number): Set<string> {
  const res = new Set<string>();

  // Fixed-date holidays
  res.add(`${year}-01-01`); // New Year's Day
  res.add(`${year}-01-06`); // Epiphany
  res.add(`${year}-05-01`); // May Day
  res.add(`${year}-06-06`); // National Day of Sweden
  res.add(`${year}-12-25`); // Christmas Day
  res.add(`${year}-12-26`); // Boxing Day

  // Easter-based holidays
  const easterSunday = getEasterSunday(year);
  const goodFriday = addDays(easterSunday, -2);
  const easterMonday = addDays(easterSunday, 1);
  const ascensionDay = addDays(easterSunday, 39);

  res.add(toYMDLocal(goodFriday)); // Good Friday
  res.add(toYMDLocal(easterMonday)); // Easter Monday
  res.add(toYMDLocal(ascensionDay)); // Ascension Day

  // Midsummer Day (Saturday between 20–26 June)
  const midsummerStart = new Date(year, 5, 20); // 20 June
  let midsummerDay = midsummerStart;
  while (midsummerDay.getDay() !== 6) {
    midsummerDay = addDays(midsummerDay, 1);
  }
  res.add(toYMDLocal(midsummerDay));

  // All Saints' Day (Saturday between 31 Oct – 6 Nov)
  const allSaintsStart = new Date(year, 9, 31); // 31 Oct
  let allSaints = allSaintsStart;
  while (allSaints.getDay() !== 6) {
    allSaints = addDays(allSaints, 1);
  }
  res.add(toYMDLocal(allSaints));

  return res;
}

const sanitizeHoursInput = (raw: string): string => {
  if (raw == null) return "";
  let clean = raw.replace(",", ".");
  clean = clean.replace(/-/g, "");

  clean = clean.replace(/[^0-9.]/g, "");

  if (clean.trim() === "") return "";

  const num = Number(clean);
  if (Number.isNaN(num)) return "";

  if (num < 0) return "0";
  if (num > 24) return "24";

  return clean;
};

export const TimeRegisterVacationpage = () => {
  const { category } = useCategory();

  const [fromDate, setFromDate] = useState<string>(today);
  const [toDate, setToDate] = useState<string>(today);
  const [openFrom, setOpenFrom] = useState(false);
  const [openTo, setOpenTo] = useState(false);

  const [skipWeekends, setSkipWeekends] = useState(true);
  const [skipHolidays, setSkipHolidays] = useState(true);

  const [defaultHours, setDefaultHours] = useState<string>("8");
  const [note, setNote] = useState<string>("");

  const [dayEntries, setDayEntries] = useState<VacationDayEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customerId, setCustomerID] = useState<number>(0);

  useEffect(() => {
    const getCompanyId = async () => {
      const res = await TenantService.getCompany();
      setCustomerID(res.customerId);
    };
    getCompanyId();
  }, []);

  useEffect(() => {
    if (!fromDate || !toDate) {
      setDayEntries([]);
      return;
    }

    const start = fromYMD(fromDate);
    const end = fromYMD(toDate);
    if (!start || !end || start > end) {
      setDayEntries([]);
      return;
    }

    const yearSet = new Set<number>();
    const tmpDates: Date[] = [];
    let cur = new Date(start);
    while (cur <= end) {
      tmpDates.push(new Date(cur));
      yearSet.add(cur.getFullYear());
      cur.setDate(cur.getDate() + 1);
    }

    // Collect holidays for all years in the selected range
    const holidaySet = new Set<string>();
    for (const y of yearSet) {
      for (const d of getSwedishPublicHolidays(y)) {
        holidaySet.add(d);
      }
    }

    const newEntries: VacationDayEntry[] = tmpDates
      .map((d) => {
        const ymd = toYMD(d);
        const js = new Date(d);
        const weekday = js.getDay(); // 0=Sun, 6=Sat
        const isWeekend = weekday === 0 || weekday === 6;
        const isHoliday = holidaySet.has(ymd);

        return {
          date: ymd,
          isWeekend,
          isHoliday,
          hours: defaultHours,
        };
      })
      .filter((entry) => {
        if (skipWeekends && entry.isWeekend) return false;
        if (skipHolidays && entry.isHoliday) return false;
        return true;
      });

    setDayEntries(newEntries);
  }, [fromDate, toDate, skipWeekends, skipHolidays, defaultHours]);

  const totalDays = dayEntries.length;
  const totalHours = useMemo(() => {
    return dayEntries.reduce((sum, d) => {
      const h = Number(String(d.hours).replace(",", "."));
      if (!d.hours || Number.isNaN(h) || h <= 0) return sum;
      return sum + h;
    }, 0);
  }, [dayEntries]);

  const fullDay = () => setDefaultHours("8");
  const halfDay = () => setDefaultHours("4");

  const handleChangeDayHours = (idx: number, value: string) => {
    setDayEntries((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, hours: value } : d))
    );
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!fromDate || !toDate) {
      setError("Please choose both From and To.");
      return;
    }

    if (!dayEntries.length) {
      setError("No days to register. Check your range and filters.");
      return;
    }

    // Find the "vacation" category
    const vacationCategory = category.find(
      (c) => c.name.toLowerCase() === "vacation"
    );
    if (!vacationCategory) {
      setError(
        'Category "vacation" not found. Ask an administrator to create it.'
      );
      return;
    }

    const payloads: TimeReportCreateDTO[] = [];

    for (const entry of dayEntries) {
      const h = Number(String(entry.hours).replace(",", "."));
      if (!entry.hours || Number.isNaN(h) || h <= 0) {
        continue;
      }

      payloads.push({
        customer_id: customerId,
        note: note.trim(),
        work_labor: "Vacation",
        category: vacationCategory.id,
        date: entry.date,
        hours: h,
        billable: false,
        project_id: null,
        items: [],
      });
    }

    if (!payloads.length) {
      setError("All days have zero or invalid hours. Nothing to register.");
      return;
    }

    try {
      setSubmitting(true);
      await TimeReportService.registerTime(payloads);
      setSuccess(
        `Vacation registered for ${payloads.length} day(s), total ${totalHours.toFixed(
          2
        )} hours ✔`
      );
      // Keep range & filters, reset defaultHours and note
      setDefaultHours("8");
      setNote("");
    } catch (e) {
      console.error(e);
      setError("Could not register vacation. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Register vacation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Time will be registered on DB (internal) and marked as non-billable.
          </p>
        </div>

        <div className="space-y-4 rounded-lg border p-4 bg-card w-full">
          {/* Range */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>From</Label>
              <Popover open={openFrom} onOpenChange={setOpenFrom}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between"
                  >
                    {fromDate || "Pick start date"}
                    <CalendarIcon className="w-4 h-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-0">
                  <Calendar
                    mode="single"
                    selected={fromYMD(fromDate)}
                    onSelect={(d) => {
                      if (!d) return;
                      const ymd = toYMD(d);
                      setFromDate(ymd);
                      if (toDate && toDate < ymd) setToDate(ymd);
                      setOpenFrom(false);
                    }}
                    locale={sv}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <Label>To</Label>
              <Popover open={openTo} onOpenChange={setOpenTo}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between"
                  >
                    {toDate || "Pick end date"}
                    <CalendarIcon className="w-4 h-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-0">
                  <Calendar
                    mode="single"
                    selected={fromYMD(toDate)}
                    onSelect={(d) => {
                      if (!d) return;
                      const ymd = toYMD(d);
                      setToDate(ymd);
                      setOpenTo(false);
                    }}
                    locale={sv}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={skipWeekends}
                onCheckedChange={(v) => setSkipWeekends(Boolean(v))}
              />
              Skip weekends
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={skipHolidays}
                onCheckedChange={(v) => setSkipHolidays(Boolean(v))}
              />
              Skip public holidays
            </label>
          </div>

          <div className="space-y-1 pt-2">
            <Label>Hours per day (default)</Label>
            <div className="flex gap-3 items-start">
              <Input
                type="number"
                step="0.25"
                min="0"
                max="24"
                value={defaultHours}
                onChange={(e) =>
                  setDefaultHours(sanitizeHoursInput(e.target.value))
                }
                className="max-w-[120px]"
              />
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fullDay}
                >
                  Full day (8h)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={halfDay}
                >
                  Half day (4h)
                </Button>
                <p className="mt-1">
                  Changing this will reset the hours for all days in the list.
                </p>
              </div>
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1">
            <Label htmlFor="vac-note">Note (optional)</Label>
            <Textarea
              id="vac-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Summer vacation, Christmas break…"
              className="min-h-[80px]"
            />
          </div>

          {/* Summary */}
          <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <div>
              Days to register:{" "}
              <span className="font-medium">{totalDays}</span>
            </div>
            <div>
              Total hours:{" "}
              <span className="font-medium">{totalHours.toFixed(2)} h</span>
            </div>
            <p>
              You can adjust hours per day below. Days with 0 hours will be
              skipped when registering.
            </p>
          </div>

          {/* Day list */}
          <div className="mt-2 border rounded-md max-h-64 overflow-y-auto text-xs">
            {dayEntries.length === 0 ? (
              <div className="p-3 text-muted-foreground">
                No days in the selected range with current filters.
              </div>
            ) : (
              dayEntries.map((d, idx) => (
                <div
                  key={d.date}
                  className="flex items-center justify-between gap-3 px-3 py-2 border-b last:border-b-0"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{d.date}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {d.isWeekend && "Weekend"}{" "}
                      {d.isHoliday && (d.isWeekend ? " / Holiday" : "Holiday")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.25"
                      min="0"
                      max="24"
                      value={d.hours}
                      onChange={(e) =>
                        handleChangeDayHours(idx, e.target.value)
                      }
                      className="w-20 h-7 text-xs"
                    />
                    <span className="text-[11px] text-muted-foreground">h</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
          {success && <p className="text-sm text-green-600 mt-1">{success}</p>}

          <div className="pt-2 flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Registering…" : "Register vacation"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
