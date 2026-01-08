// src/components/time/TimeRegisterForm.tsx
import React from "react";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "../../components/ui/calendar";
import { CustomerSearchPopover } from "../../components/timeReport/CustomerSearchPopover";
import { AddReportItemRow } from "../../components/timeReport/AddReportItemRow";
import { fromYMD, toYMD } from "../../helpers/dateHelpers";
import { sv } from "date-fns/locale";
import type { FormEvent } from "react";
import type { Category } from "../../models/Article";
import type { LaborTemplate } from "../../models/labortemplate";
import type { Customer } from "../../models/customer";
import type { FormState } from "../../models/Draft";
import type { Project } from "../../models/project";
import type { ReportItemInput, Article } from "../../models/Article";
import type { ReportTemplate } from "../../models/Draft";
import { LaborTemplateQuickFill } from "../../components/timeReport/LaborTemplateQuickFill";

type FormErrors = Partial<Record<keyof FormState, string>>;

type Props = {
  values: FormState;
  errors: FormErrors;
  submitting: boolean;
  serverError: string | null;
  success: string | null;

  templates: ReportTemplate[];
  templateName: string;
  setTemplateName: (v: string) => void;
  saveTemplate: (
    e: React.MouseEvent<HTMLButtonElement>,
    tmplate: FormState,
    name: string
  ) => Promise<void>;
  pickTemplate: (id: string) => Promise<void>;
  selectedTemplateId: number | string | null;

  customer: Customer[];
  searchCustomerfromapi: (q: string) => Promise<Customer[] | undefined>;
  recentCustomers: Customer[];
  ownerCompanies: Customer[];
  quickAdd: (company: string, ownerId: number) => Promise<Customer>;
  category: Category[];
  laborTemplates: LaborTemplate[];
  onCreateLaborTemplate: (name: string, description: string) => Promise<void>;
  onDeleteLaborTemplate: (id: number) => Promise<void>;

  projecttocustomer: Project[] | null;
  loadingProjects: boolean;

  runSearch: (q: string, limit?: number, offset?: number) => Promise<Article[]>;
  items: ReportItemInput[];
  addItemFromArticle: (
    article: { id: number; name: string },
    amount: number,
    purchasePrice: number | null
  ) => void;
  addOtherItem: (
    description: string,
    amount: number,
    purchasePrice: number | null
  ) => void;
  updateItem: (index: number, partial: Partial<ReportItemInput>) => void;
  setItemAmount: (index: number, amount: number) => void;
  removeItem: (index: number) => void;
  clearItems: () => void;
  summarizeItems: () => string;
  mapitemsforDraft: () => any[];

  draftsCount: number;
  dateOpen: boolean;
  setDateOpen: (v: boolean) => void;

  setField: <K extends keyof FormState>(key: K, val: FormState[K]) => void;
  onChangeCustomer: (customerId: number) => void;
  onSubmit: (e: FormEvent) => void;
  onRestore: () => void;
};

export const TimeRegisterForm: React.FC<Props> = ({
  values,
  errors,
  submitting,
  serverError,
  success,
  templates,
  templateName,
  setTemplateName,
  saveTemplate,
  pickTemplate,
  selectedTemplateId,
  customer,
  searchCustomerfromapi,
  recentCustomers,
  ownerCompanies,
  quickAdd,
  category,
  laborTemplates,
  onCreateLaborTemplate,
  onDeleteLaborTemplate,
  projecttocustomer,
  loadingProjects,
  runSearch,
  items,
  addItemFromArticle,
  addOtherItem,
  updateItem,
  setItemAmount,
  removeItem,
  clearItems,
  summarizeItems,
  mapitemsforDraft,
  draftsCount,
  dateOpen,
  setDateOpen,
  setField,
  onChangeCustomer,
  onSubmit,
  onRestore,
}) => {
  return (
    <div className="w-full">
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {templates.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="template-select">Templates</Label>
            <Select
              value={
                selectedTemplateId ? String(selectedTemplateId) : "__none__"
              }
              onValueChange={(val) => {
                if (val === "__none__") return;
                pickTemplate(val);
              }}
            >
              <SelectTrigger id="template-select" aria-label="Choose template">
                <SelectValue placeholder="Choose template" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {templates.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Date + customer */}
        <div className="flex space-y-2 gap-4 justify-between flex-col">
          <div className="space-y-1">
            <Label htmlFor="date">Date</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant="outline"
                  className={`w-full justify-between text-left font-normal ${
                    errors.date ? "border-red-500" : ""
                  }`}
                  aria-invalid={!!errors.date}
                  aria-describedby={errors.date ? "date-error" : undefined}
                >
                  {values.date || "Pick a date"}
                  <CalendarIcon
                    className="ml-2 h-4 w-4 opacity-50"
                    aria-hidden="true"
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start" side="bottom">
                <Calendar
                  mode="single"
                  selected={fromYMD(values.date)}
                  onSelect={(d) => {
                    if (!d) return;
                    setField("date", toYMD(d));
                    setDateOpen(false);
                  }}
                  locale={sv}
                  autoFocus
                />
              </PopoverContent>
            </Popover>

            {errors.date && (
              <p id="date-error" className="text-sm text-red-600">
                {errors.date}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1 space-y-2 min-w-0">
              <Label>Customer</Label>
              <CustomerSearchPopover
                value={values.customerId ?? null}
                onPick={(id) => {
                  setField("customerId", id);
                  onChangeCustomer?.(id);
                }}
                customers={customer}
                onSearch={searchCustomerfromapi}
                recentCustomers={recentCustomers}
                ownerCompanies={ownerCompanies}
                quickAdd={quickAdd}
                buttonLabel="Choose customer"
                onQuickAdd={(newCustomer) => {
                  setField("customerId", newCustomer.id);
                  onChangeCustomer?.(newCustomer.id);
                }}
                resetKey={draftsCount}
              />
            </div>
          </div>

          {projecttocustomer && projecttocustomer.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="project-select">
                {loadingProjects ? "Getting projects" : "Project for customer"}
              </Label>
              <Select
                onValueChange={(val) => setField("projectId", Number(val))}
                disabled={loadingProjects}
              >
                <SelectTrigger
                  id="project-select"
                  aria-invalid={!!errors.customerId}
                  aria-label="Project for customer"
                >
                  <SelectValue placeholder="Choose project for customer" />
                </SelectTrigger>
                <SelectContent>
                  {projecttocustomer.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.projectname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {errors.customerId && (
            <p className="text-sm text-red-600">{errors.customerId}</p>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="note">Notes</Label>
          <Input
            id="note"
            value={values.note}
            onChange={(e) => setField("note", e.target.value)}
            placeholder="Short internal note"
            aria-invalid={!!errors.note}
            aria-describedby={errors.note ? "note-error" : undefined}
          />
        </div>
        {errors.note && (
          <p id="note-error" className="text-sm text-red-600">
            {errors.note}
          </p>
        )}

        {/* Work description + labor template */}
        <div className="space-y-2">
          <Label htmlFor="workDescription">Provided labor</Label>

          <LaborTemplateQuickFill
            laborTemplates={laborTemplates}
            currentTemplateId={values.laborTemplateId ?? null}
            workDescription={values.workDescription}
            onChangeTemplateId={(id) => setField("laborTemplateId", id)}
            onChangeWorkDescription={(text) =>
              setField("workDescription", text)
            }
            onCreateTemplate={onCreateLaborTemplate}
            onDeleteTemplate={onDeleteLaborTemplate}
          />

          <Textarea
            id="workDescription"
            value={values.workDescription}
            onChange={(e) => setField("workDescription", e.target.value)}
            placeholder="Description of work done, shown on customer invoice"
            className="min-h-[120px]"
            aria-invalid={!!errors.workDescription}
            aria-describedby={
              errors.workDescription ? "workDescription-error" : undefined
            }
          />
          {errors.workDescription && (
            <p id="workDescription-error" className="text-sm text-red-600">
              {errors.workDescription}
            </p>
          )}
        </div>

        {/* Articles */}
        <div className="space-y-3">
          <Label>Articles</Label>

          <AddReportItemRow
            onSearch={(q) => runSearch(q, 10, 0)}
            onAdd={(payload) => {
              if (payload.articleId) {
                addItemFromArticle(
                  {
                    id: payload.articleId,
                    name: payload.description || "Article",
                  } as any,
                  payload.amount || 1,
                  payload.purchasePrice ?? null
                );
              } else if (payload.description && payload.description.trim()) {
                addOtherItem(
                  payload.description.trim(),
                  payload.amount || 1,
                  payload.purchasePrice ?? null
                );
              }
            }}
          />

          {items.length > 0 && (
            <div className="grid gap-2" aria-label="Added articles">
              <div className="flex flex-col gap-2">
                {items.map((it, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center min-w-0"
                  >
                    <Input
                      value={it.description ?? ""}
                      onChange={(e) =>
                        updateItem(idx, { description: e.target.value })
                      }
                      placeholder="Description"
                      className="flex-1"
                      aria-label={`Article ${idx + 1} description`}
                    />
                    <Input
                      type="number"
                      min={1}
                      value={it.amount ?? 1}
                      onChange={(e) =>
                        setItemAmount(idx, Number(e.target.value))
                      }
                      className="w-16"
                      aria-label={`Article ${idx + 1} quantity`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeItem(idx)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button type="button" variant="ghost" onClick={clearItems}>
                  Clear all
                </Button>
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Saved as: <em>{summarizeItems() || "—"}</em>
          </div>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor="category-select">Category</Label>
          <Select
            onValueChange={(val) =>
              setField("category", val ? Number(val) : null)
            }
            value={values.category !== null ? String(values.category) : ""}
          >
            <SelectTrigger
              id="category-select"
              aria-invalid={!!errors.category}
              aria-label="Category"
            >
              <SelectValue placeholder="Choose category" />
            </SelectTrigger>
            <SelectContent>
              {category
                .filter(
                  (cat) =>
                    !["vacation", "sick"].includes(cat.name.toLowerCase())
                )
                .map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-sm text-red-600">{errors.category}</p>
          )}
        </div>

        {/* Hours + billable */}
        <div className="flex items-end gap-4">
          <div className="flex flex-col space-y-2 w-34">
            <Label htmlFor="hours">Hours</Label>
            <Input
              id="hours"
              type="number"
              inputMode="decimal"
              step="0.25"
              min="0"
              max="24"
              value={values.hours}
              onChange={(e) => setField("hours", e.target.value)}
              aria-invalid={!!errors.hours}
              aria-describedby={errors.hours ? "hours-error" : undefined}
              placeholder="e.g. 1, 1.5, 7.75"
            />
            {errors.hours && (
              <p id="hours-error" className="text-sm text-red-600">
                {errors.hours}
              </p>
            )}
          </div>

          <div className="flex flex-col space-y-2">
            <Label htmlFor="billable">Billable</Label>
            <Checkbox
              id="billable"
              checked={values.billable}
              onCheckedChange={(val) => setField("billable", Boolean(val))}
              aria-label="Is this time billable?"
            />
          </div>
        </div>

        {/* Save template */}
        <div className="flex gap-3">
          <Input
            type="text"
            placeholder="Name template"
            onChange={(e) => setTemplateName(e.target.value)}
            value={templateName}
            aria-label="Template name"
          />
          <Button
            type="button"
            onClick={(e) => {
              saveTemplate(
                e,
                { ...values, items: mapitemsforDraft() },
                templateName
              );
            }}
            disabled={templateName.length <= 2}
          >
            Save template
          </Button>
        </div>

        {/* Form actions */}
        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
          <Button type="button" variant="outline" onClick={onRestore}>
            Restore
          </Button>
        </div>

        {serverError && (
          <p className="text-sm text-red-600" role="alert">
            {serverError}
          </p>
        )}
        {success && (
          <p className="text-sm text-green-600" role="status">
            {success}
          </p>
        )}
      </form>
    </div>
  );
};
