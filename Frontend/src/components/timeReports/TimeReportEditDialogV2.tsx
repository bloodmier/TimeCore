import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Textarea } from "../../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Separator } from "../../components/ui/separator";
import { Calendar } from "../../components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";

import type { TimeReportPatch, TimeReportRow } from "../../models/timeReports";
import type { Project } from "../../models/project";
import type { Article, ReportItemInput, TimeReportItem } from "../../models/Article";

import { CustomerSearchPopover } from "../../components/timeReport/CustomerSearchPopover";
import { AddReportItemRow } from "../../components/timeReport/AddReportItemRow";

import type { ArticleSearch, CustomerData, LookupData } from "../../hooks/useTimeOverveiw";
import { fromYMD, toHoursString, toYMD } from "../../helpers/dateHelpers";

// ---------- Helpers ----------
function normalizeItems(v: unknown): any[] {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (typeof v === "object") {
    const obj = v as any;
    if (Array.isArray(obj.items)) return obj.items;
    return Object.values(obj);
  }
  return [];
}

const itemWireToInput = (it: TimeReportItem): ReportItemInput => ({
  articleId: (it as any).article_id ?? null,
  description: (it as any).description ?? "",
  amount: Number((it as any).amount ?? 1),
  // @ts-ignore
  _id: (it as any).id,
});

const inputToWire = (it: ReportItemInput) => ({
  articleId: (it as any).articleId ?? (it as any).article_id ?? null,
  description: (it as any).description ?? "",
  amount: Math.max(1, Number((it as any).amount ?? 1)),
  id: (it as any)._id ?? (it as any).id,
});

function computeItemsDelta(original: TimeReportItem[] | undefined, currentUI: ReportItemInput[]) {
  const origById = new Map<number, TimeReportItem>();
  (original ?? []).forEach((o: any) => origById.set(o.id, o));

  const curWithIds = currentUI.map(inputToWire);
  const keepIds = new Set<number>();

  const upsert: Array<{ id?: number; articleId: number | null; amount: number; description: string }> = [];
  const del: number[] = [];

  for (const c of curWithIds) {
    const id = typeof c.id === "number" ? c.id : undefined;

    if (id && origById.has(id)) {
      keepIds.add(id);
      const o: any = origById.get(id)!;
      const changed =
        (o.article_id ?? null) !== (c.articleId ?? null) ||
        (o.amount ?? 1) !== (c.amount ?? 1) ||
        (o.description ?? "") !== (c.description ?? "");

      if (changed) {
        upsert.push({
          id,
          articleId: c.articleId ?? null,
          amount: c.amount,
          description: c.description,
        });
      }
    } else {
      upsert.push({
        articleId: c.articleId ?? null,
        amount: c.amount,
        description: c.description,
      });
    }
  }

  for (const o of original ?? []) {
    const oid = (o as any).id;
    if (typeof oid === "number" && !keepIds.has(oid)) del.push(oid);
  }

  if (upsert.length === 0 && del.length === 0) return undefined;
  return { upsert, delete: del };
}

// ---------- Component ----------
type Props = {
  row: TimeReportRow;
  onSave?: (id: string | number, patch: TimeReportPatch) => Promise<void> | void;
  trigger?: ReactNode;
  defaultOpen?: boolean;
  customerData: CustomerData;
  lookupData: LookupData;
  articleSearch: ArticleSearch;
};

type EditForm = {
  date: string;
  hours: string;
  billable: boolean;
  customerId: number | null;
  projectId: number | null;
  categoryId: number | null;
  workDescription: string;
  note: string;
  items: ReportItemInput[];
};

export function TimeReportEditDialogV2({
  row,
  onSave,
  trigger,
  defaultOpen = false,
  customerData,
  lookupData,
  articleSearch,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  const initial: EditForm = useMemo(
    () => ({
      date: row.date ?? "",
      hours: toHoursString(row.hours),
      billable: !!row.billable,
      customerId: (row as any).customerId ?? null,
      projectId: (row as any).projectId ?? null,
      categoryId: (row as any).categoryId ?? null,
      workDescription: row.workDescription ?? "",
      note: row.note ?? "",
      items: normalizeItems((row as any).items).map(itemWireToInput),
    }),
    [row]
  );

  const [form, setForm] = useState<EditForm>(initial);
  const [saving, setSaving] = useState(false);

  const categories = lookupData.categories;
  const { customers, ownerCompanies, recentCustomers, quickAdd, searchCustomers } = customerData;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => setForm(initial), [initial]);

  useEffect(() => {
    if (!open) return;
    const cid = form.customerId;
    if (cid == null) {
      setProjects([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoadingProjects(true);
        const proj = await lookupData.loadProjectsForCustomer(cid);
        if (!cancelled) setProjects(proj ?? []);
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, form.customerId, lookupData]);

  const setField = useCallback(<K extends keyof EditForm>(k: K, v: EditForm[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }));
  }, []);

  const buildPatch = (): TimeReportPatch => {
    const patch: TimeReportPatch = {};

    if (form.date !== (row.date ?? "")) patch.date = form.date;

    const newHoursNum = form.hours.trim() === "" ? null : Number(form.hours);
    if (Number.isFinite(newHoursNum as any) && newHoursNum !== row.hours) {
      patch.hours = newHoursNum as number;
    }

    if (form.billable !== !!row.billable) patch.billable = form.billable;

    const origCustomerId = (row as any).customerId ?? null;
    if (form.customerId !== origCustomerId) patch.customerId = form.customerId;

    const origProjectId = (row as any).projectId ?? null;
    if (form.projectId !== origProjectId) patch.projectId = form.projectId;

    const origCategoryId = (row as any).categoryId ?? null;
    if (form.categoryId !== origCategoryId) patch.categoryId = form.categoryId;

    if ((form.workDescription ?? "") !== (row.workDescription ?? "")) {
      patch.workDescription = form.workDescription.trim() || null;
    }
    if ((form.note ?? "") !== (row.note ?? "")) {
      patch.note = form.note.trim() || null;
    }

    const itemsDelta = computeItemsDelta(row.items as any, form.items);
    if (itemsDelta) patch.items = itemsDelta;

    return patch;
  };

  const isInteractive = (el: HTMLElement | null) => {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if ((el as any).isContentEditable) return true;
    if (el.getAttribute("role") === "combobox" || el.closest("[role='combobox']")) return true;
    return false;
  };

  const addItemFromPicker = (payload: ReportItemInput) => {
    setForm((prev) => ({ ...prev, items: [...prev.items, payload] }));
  };

  const updateItemAt = (idx: number, next: Partial<ReportItemInput>) => {
    setForm((prev) => {
      const arr = prev.items.slice();
      arr[idx] = { ...arr[idx], ...next };
      return { ...prev, items: arr };
    });
  };

  const removeItemAt = (idx: number) => {
    setForm((prev) => {
      const arr = prev.items.slice();
      arr.splice(idx, 1);
      return { ...prev, items: arr };
    });
  };

  const clearAllItems = () => setForm((prev) => ({ ...prev, items: [] }));

  const handleSave = async () => {
    if (saving) return;

    const patch = buildPatch();
    if (Object.keys(patch).length === 0) {
      setOpen(false);
      return;
    }

    try {
      setSaving(true);
      await onSave?.(row.id, patch);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        asChild
        onClick={(e: any) => e.stopPropagation?.()}
        onMouseDown={(e: any) => e.stopPropagation?.()}
      >
        {trigger ?? (
          <Button variant="outline" size="sm" aria-label={`Edit time report ${String(row.id)}`}>
            Edit
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        onClick={(e) => e.stopPropagation()}
        className="sm:max-w-[720px] max-h-[95vh] overflow-y-auto"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          firstFieldRef.current?.focus();
        }}
        onKeyDownCapture={(e) => {
          if (e.key === " " || e.key === "Spacebar") {
            const t = e.target as HTMLElement | null;
            if (!isInteractive(t)) {
              e.preventDefault();
              e.stopPropagation();
            }
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Edit time report</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Customer</Label>
            <CustomerSearchPopover
              value={form.customerId}
              onPick={(id) => {
                setField("customerId", id);
                setField("projectId", null);
              }}
              onSearch={searchCustomers}
              customers={customers ?? []}
              recentCustomers={recentCustomers}
              ownerCompanies={ownerCompanies}
              quickAdd={quickAdd}
              buttonLabel={row.customerName ?? "Choose customer"}
              disabled={false}
            />
          </div>

          <div className="space-y-2">
            <Label>{loadingProjects ? "Loading projects…" : "Project"}</Label>
            <Select
              value={form.projectId != null ? String(form.projectId) : ""}
              onValueChange={(val) => setField("projectId", val ? Number(val) : null)}
              disabled={loadingProjects || !form.customerId || projects.length === 0}
            >
              <SelectTrigger aria-label="Project">
                <SelectValue placeholder={projects.length ? "Choose project…" : "No projects"} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.projectname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.categoryId != null ? String(form.categoryId) : ""}
              onValueChange={(val) => setField("categoryId", val ? Number(val) : null)}
            >
              <SelectTrigger aria-label="Category">
                <SelectValue placeholder="Choose category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="date">Date</Label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between text-left font-normal"
                    aria-label="Pick date"
                  >
                    {form.date || "Pick a date"}
                    <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fromYMD(form.date)}
                    onSelect={(d) => {
                      if (!d) return;
                      setField("date", toYMD(d));
                      setDateOpen(false);
                    }}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <Label htmlFor="hours">Hours</Label>
              <Input
                id="hours"
                ref={firstFieldRef}
                type="number"
                inputMode="decimal"
                step="0.25"
                min="0"
                max="24"
                value={form.hours}
                onChange={(e) => setField("hours", e.target.value)}
                placeholder="e.g. 1, 1.5, 7.75"
                aria-label="Hours"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="billable">Billable</Label>
              <div className="h-10 flex items-center">
                <Switch
                  id="billable"
                  checked={form.billable}
                  onCheckedChange={(v) => setField("billable", v)}
                  aria-label="Billable"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              value={form.note}
              onChange={(e) => setField("note", e.target.value)}
              rows={2}
              placeholder="Internal note"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workDescription">Work description</Label>
            <Textarea
              id="workDescription"
              value={form.workDescription}
              onChange={(e) => setField("workDescription", e.target.value)}
              rows={3}
              placeholder="Description of work done"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Items</Label>

            <AddReportItemRow
              onSearch={(q: string) => articleSearch.run(q, 10, 0) as Promise<Article[]>}
              onAdd={(payload) => addItemFromPicker(payload)}
            />

            {form.items.length > 0 ? (
              <div className="grid gap-2">
                {form.items.map((it, idx) => (
                  <div key={(it as any)._id ?? idx} className="flex items-center gap-2">
                    <Input
                      value={it.description ?? ""}
                      onChange={(e) => updateItemAt(idx, { description: e.target.value })}
                      placeholder="Description"
                      className="flex-1"
                      aria-label={`Item ${idx + 1} description`}
                    />
                    <Input
                      type="number"
                      min={1}
                      value={Number(it.amount ?? 1)}
                      onChange={(e) =>
                        updateItemAt(idx, { amount: Math.max(1, Number(e.target.value) || 1) })
                      }
                      className="w-20"
                      aria-label={`Item ${idx + 1} quantity`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeItemAt(idx)}
                      aria-label={`Remove item ${idx + 1}`}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" onClick={clearAllItems} aria-label="Clear all items">
                    Clear all
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No items added.</div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving} aria-label="Cancel">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} aria-label="Save changes">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
