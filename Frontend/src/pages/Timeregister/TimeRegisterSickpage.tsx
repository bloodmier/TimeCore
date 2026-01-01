/**
 * TimeRegisterSickpage
 *
 * Page for registering sick leave for the current user.
 * - Lets the user select date, hours, category and an optional note
 * - Uses the time reporting API to store non-billable sick time
 * - Reuses the same category data as the regular time reporting flow
 */


import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "../../components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "../../components/ui/calendar";
import { Checkbox } from "../../components/ui/checkbox";
import { sv } from "date-fns/locale";
import { useCategory } from "../../hooks/useCategory";
import { TimeReportService } from "../../services/timeReportService";
import type { TimeReportCreateDTO } from "../../models/Draft";
import { today } from "../../helpers/TimeHelpersfunctions";
import { fromYMD, toYMD } from "../../helpers/dateHelpers";
import {TenantService} from "../../services/tenantService"



export const TimeRegisterSickpage = () => {
  const { category } = useCategory();
  
  const [date, setDate] = useState<string>(today);
  const [hours, setHours] = useState<string>("8");
  const [note, setNote] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openDate, setOpenDate] = useState(false);
  const [halfDay, setHalfDay] = useState(false);
  const [customerId, setCustomerID] = useState<number>(0)
 
  
  useEffect(()=>{
    const getCompanyId = async () => {
      const res = await TenantService.getCompany();
      setCustomerID(res.customerId)
    }
    getCompanyId()
    
  },[])
  const CUSTOMER_DB_ID = customerId;
 
  const fullDay = () => {
    setHours("8");
    setHalfDay(false);
  };

  const toggleHalfDay = (checked: boolean | string) => {
    const val = Boolean(checked);
    setHalfDay(val);
    setHours(val ? "4" : "8");
  };

  const handleSubmit = async () => {


    setError(null);
    setSuccess(null);

    if (!date) {
      setError("Please choose a date.");
      return;
    }

    const numHours = Number(String(hours).replace(",", "."));
    if (!hours || Number.isNaN(numHours) || numHours <= 0) {
      setError("Please enter a valid number of hours.");
      return;
    }
    if (numHours > 24) {
      setError("Maximum 24 hours per day.");
      return;
    }

    const sickCategory = category.find(
      (c) => c.name.toLowerCase() === "sick" || c.name.toLowerCase() === "sick leave"
    );

    if (!sickCategory) {
      setError('Category "sick" not found. Ask an administrator to create it.');
      return;
    }

    const payload: TimeReportCreateDTO = {
      customer_id: CUSTOMER_DB_ID,
      note: note.trim(),
      work_labor: "Sick leave",
      category: sickCategory.id,
      date,
      hours: numHours,
      billable: false,
      project_id: null,
      items: [],
    };

    try {
      setSubmitting(true);
      await TimeReportService.registerTime([payload]);
      setSuccess("Sick leave registered successfully ✔");
      setHours(halfDay ? "4" : "8");
      setNote("");
    } catch (e) {
      console.error(e);
      setError("Could not register sick leave. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Register sick leave</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Time will be registered on DB (internal) and marked as non-billable.
          </p>
        </div>

        <div className="space-y-4 rounded-lg border p-4 bg-card w-full">
          {/* Date */}
          <div className="space-y-1">
            <Label>Date</Label>
            <Popover open={openDate} onOpenChange={setOpenDate}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                >
                  {date || "Pick a date"}
                  <CalendarIcon className="w-4 h-4 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-0">
                <Calendar
                  mode="single"
                  selected={fromYMD(date)}
                  onSelect={(d) => {
                    if (!d) return;
                    setDate(toYMD(d));
                    setOpenDate(false);
                  }}
                  locale={sv}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <Label htmlFor="sick-hours">Hours</Label>
            <div className="flex gap-3 items-start">
              <Input
                id="sick-hours"
                type="number"
                step="0.25"
                min="0"
                max="24"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
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
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="sick-halfday"
                    checked={halfDay}
                    onCheckedChange={toggleHalfDay}
                  />
                  <Label htmlFor="sick-halfday" className="text-xs font-normal">
                    Half day (4h)
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="sick-note">Note (optional)</Label>
            <Textarea
              id="sick-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. flu, doctor visit, child sick…"
              className="min-h-[80px]"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

          <div className="pt-2 flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Registering…" : "Register time"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};