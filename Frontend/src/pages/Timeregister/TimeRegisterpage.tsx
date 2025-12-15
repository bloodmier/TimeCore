/**
 * TimeRegisterPage
 *
 * Main orchestrator for the time reporting flow:
 * - Handles form state
 * - Loads customers, projects, categories, templates, drafts
 * - Submits drafts and full time reports
 */



import { useDrafts } from "../../hooks/useDrafts";

import { TimeReportService } from "../../services/timeReportService";

import type { Project } from "../../models/project";
import { useCustomer } from "../../hooks/useCustomer";

import { useCategory } from "../../hooks/useCategory";
import { useLaborTemplates } from "../../hooks/useLaborTemplates";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useReportTemplates } from "../../hooks/useReportTemplates";
import { useArticles } from "../../hooks/useArticles";
import {
  applyTemplateToForm,
  initialValues,
  parseItems,
  toInput,
  toWireItems,
  wireToInput,
} from "../../helpers/TimeHelpersfunctions";
import type {
  Entry,
  FormState,
  ReportItemWire,
  TemplateLike,
  TimeReportCreateDTO,
} from "../../models/Draft";

import { TimeRegisterForm } from "../../components/timeReport/TimeRegisterForm";
import { TimeRegisterDraftsPanel } from "../../components/timeReport/TimeRegisterDraftsPanel";

export const TimeRegisterpage = () => {
  const [values, setValues] = useState<FormState>(initialValues);
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [appliedTemplateId, setAppliedTemplateId] = useState<number | null>(
    null
  );
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null);
  const [dateOpen, setDateOpen] = useState(false);

  // ---- Data hooks ----
  const {
    templates,
    templateName,
    setTemplateName,
    saveTemplate,
    pickTemplate,
    selectedTemplate,
    selectedTemplateId,
    resetTemplate,
  } = useReportTemplates();

  const {
    customer,
    searchCustomerfromapi,
    refreshRecent,
    recentCustomers,
    ownerCompanies,
    quickAdd,
  } = useCustomer();

  const { category } = useCategory();
  const { laborTemplates, createLaborTemplate, deleteLaborTemplate } =
    useLaborTemplates();

  // ---- Projects per customer ----
  const [projecttocustomer, setProjecttocustomer] = useState<Project[] | null>(
    null
  );
  const [loadingProjects, setLoadingProjects] = useState(false);

  // ---- Articles / Items ----
  const {
    runSearch,
    items,
    setItems,
    addItemFromArticle,
    addOtherItem,
    updateItem,
    setItemAmount,
    removeItem,
    clearItems,
  } = useArticles({ limit: 10, debounceMs: 250 });

  // ---- Drafts ----
  const {
    drafts,
    saveDraft,
    deleteDraft,
    clearDrafts,
    refreshDrafts,
    duplicateDraft,
    filters,
    dispatch,
  } = useDrafts();

  // ---- Helpers ----
  const setField = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setValues((v) => ({ ...v, [key]: val }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setServerError(null);
    setSuccess(null);
  };

  const onChangeCustomer = async (customerId: number) => {
    setLoadingProjects(true);
    try {
      const project = await TimeReportService.getProjectsByCustomerId(
        customerId
      );
      setProjecttocustomer(project);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const summarizeItems = (): string => {
    if (!items.length) return "";
    return items
      .map(
        (it) =>
          `${Math.max(1, Number(it.amount ?? 1))}x ${
            (it.description ?? "").trim() || "Article"
          }`
      )
      .join(", ");
  };

  const mapitemsforDraft = () => {
    if (!items.length) return values.items ?? [];
    return items.map((it) => ({
      amount: it.amount,
      article_id: (it as any).article_id ?? it.articleId,
      description: it.description,
    }));
  };

  const validate = (v: FormState) => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!v.customerId) next.customerId = "Select a customer.";
    if (v.note.length > 1500) next.note = "Maximum 1500 characters.";
    if (v.workDescription.trim().length < 3)
      next.workDescription = "Describe the work performed.";
    if (!v.category) next.category = "Select a category.";
    if (!v.date) next.date = "Enter a date.";
    const num = Number(v.hours);
    if (!v.hours) next.hours = "Enter the number of hours.";
    else if (Number.isNaN(num) || num <= 0)
      next.hours = "Enter a positive number.";
    else if (num > 24) next.hours = "Maximum 24 hours per entry.";
    return next;
  };

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(null), 3500);
    return () => window.clearTimeout(t);
  }, [success]);

  // Applicera template
  useEffect(() => {
    if (selectedTemplate && selectedTemplateId !== appliedTemplateId) {
      setValues((v) =>
        applyTemplateToForm(v, selectedTemplate as TemplateLike)
      );

      const cid =
        "customer_id" in (selectedTemplate as any)
          ? (selectedTemplate as any).customer_id
          : (selectedTemplate as any).customerId;
      if (cid) onChangeCustomer(Number(cid));

      const raw = (selectedTemplate as any).items;
      setItems(parseItems(raw).map(toInput));

      setAppliedTemplateId(Number(selectedTemplateId));
    }
  }, [selectedTemplate, selectedTemplateId, appliedTemplateId]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const fieldErrors = validate(values);
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      return;
    }

    const selectedCustomer = customer.find((c) => c.id === values.customerId);

    // gemensamt för båda flöden
    const wireItems = toWireItems(items);

    try {
      await TimeReportService.touchCustomerUsage(values.customerId);
      await refreshRecent();

      if (editingDraftId != null) {
        await TimeReportService.updateDraft(editingDraftId, {
          customer_id: values.customerId,
          note: values.note.trim(),
          work_labor: (values.workDescription ?? "").trim(),
          category: values.category ?? 0,
          date: values.date,
          hours: Number(values.hours),
          billable: values.billable,
          project_id: values.projectId ?? null,
          ...(wireItems.length ? { items: wireItems } : {}),
        });

        await refreshDrafts();
        setSuccess("Draft updated ✔");
        setEditingDraftId(null);
        clearItems();
        setValues({
          ...initialValues,
          date: new Date().toISOString().split("T")[0],
        });
      } else {
        // === CREATE-FLÖDE: spara ny draft ===
        const newEntry: Entry = {
          id: "",
          draft_id: 0,
          customerId: values.customerId,
          customerName: selectedCustomer?.company ?? String(values.customerId),
          note: values.note.trim(),
          workDescription: (values.workDescription ?? "").trim(),
          category_id: values.category,
          category_name: "",
          hours: Number(values.hours),
          billable: values.billable,
          date: values.date,
          projectId: values.projectId ?? null,
          items: items,
        };

        await saveDraft(newEntry);
        await refreshDrafts();
        resetTemplate();
        clearItems();
        setValues({
          ...initialValues,
          date: new Date().toISOString().split("T")[0],
        });
      }

      setErrors({});
      setServerError(null);
    } catch (err) {
      console.error("Failed to save:", err);
      setServerError("Network error – try again.");
    }
  };

  const submitAll = async () => {
    if (!drafts.length) return;
    setSubmitting(true);
    setServerError(null);
    setSuccess(null);

    try {
      const payload: TimeReportCreateDTO[] = await Promise.all(
        drafts.map(async (d: Entry) => {
          let dItems = (d.items ?? []) as ReportItemWire[];
          if (!dItems.length && d.draft_id) {
            dItems = await TimeReportService.fetchDraftItems(d.draft_id);
          }
          const wireItems = dItems.map((it: any) => ({
            article_id: it.article_id ?? it.articleId ?? null,
            amount: Math.max(1, Number(it.amount ?? 1)),
            description: String(it.description ?? "").trim(),
            purchasePrice: it.purchasePrice ?? null,
          }));

          return {
            customer_id: d.customerId,
            note: d.note,
            work_labor: d.workDescription,
            category: d.category_id ?? 0,
            date: d.date,
            hours: d.hours,
            billable: d.billable,
            project_id: d.projectId ?? null,
            draft_id: d.draft_id,
            ...(wireItems.length ? { items: wireItems } : {}),
          };
        })
      );
      await TimeReportService.registerTime(payload);
      await refreshRecent();
      await refreshDrafts();
      resetTemplate();
      setSuccess("All timesheets were submitted ✔");
      clearItems();
    } catch {
      setServerError("Networkerror – Try again or contact the FatKing.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = () => {
    setValues({
      ...initialValues,
      date: new Date().toISOString().split("T")[0],
    });
    setErrors({});
    setServerError(null);
    setSuccess(null);
    clearItems();
    setEditingDraftId(null);
  };

  const handleDuplicateDraft = async (it: Entry) => {
    const duplicate = await duplicateDraft(it);
    setValues(duplicate);
    setItems(duplicate.items ?? []);
    setValues((v) => ({
      ...v,
      items: duplicate.items ?? [],
    }));
  };

  const handleEditDraft = async (it: Entry) => {
    let sourceItems = (it.items ?? []) as any[];
    if ((!sourceItems || sourceItems.length === 0) && it.draft_id) {
      sourceItems = await TimeReportService.fetchDraftItems(it.draft_id);
    }
    const mapped = sourceItems.map(wireToInput);

    setValues({
      customerId: it.customerId,
      note: it.note,
      workDescription: it.workDescription,
      category: it.category_id,
      hours: String(it.hours),
      billable: Boolean(it.billable),
      date: it.date,
      projectId: it.projectId ?? null,
      items: mapped,
      laborTemplateId: null,
    });

    setItems(mapped);
    setEditingDraftId(it.draft_id ?? null);
  };

  const handleRemoveDraft = (draftId: number | undefined | null) => {
    if (!draftId) return;
    deleteDraft(draftId);
    if (editingDraftId === draftId) {
      setEditingDraftId(null);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      <TimeRegisterForm
        values={values}
        errors={errors}
        submitting={submitting}
        serverError={serverError}
        success={success}
        templates={templates}
        templateName={templateName}
        setTemplateName={setTemplateName}
        saveTemplate={saveTemplate}
        pickTemplate={pickTemplate}
        selectedTemplateId={selectedTemplateId}
        customer={customer}
        searchCustomerfromapi={searchCustomerfromapi}
        recentCustomers={recentCustomers}
        ownerCompanies={ownerCompanies}
        quickAdd={quickAdd}
        category={category}
        laborTemplates={laborTemplates}
        onCreateLaborTemplate={createLaborTemplate}
        onDeleteLaborTemplate={deleteLaborTemplate}
        projecttocustomer={projecttocustomer}
        loadingProjects={loadingProjects}
        runSearch={runSearch}
        items={items}
        addItemFromArticle={addItemFromArticle}
        addOtherItem={addOtherItem}
        updateItem={updateItem}
        setItemAmount={setItemAmount}
        removeItem={removeItem}
        clearItems={clearItems}
        summarizeItems={summarizeItems}
        mapitemsforDraft={mapitemsforDraft}
        draftsCount={drafts.length}
        dateOpen={dateOpen}
        setDateOpen={setDateOpen}
        setField={setField}
        onChangeCustomer={onChangeCustomer}
        onSubmit={onSubmit}
        onRestore={handleRestore}
      />

      <TimeRegisterDraftsPanel
        drafts={drafts}
        filters={filters}
        dispatch={dispatch}
        editingDraftId={editingDraftId}
        submitting={submitting}
        serverError={serverError}
        success={success}
        onDuplicateDraft={handleDuplicateDraft}
        onEditDraft={handleEditDraft}
        onRemoveDraft={handleRemoveDraft}
        onSubmitAll={submitAll}
        clearDrafts={clearDrafts}
      />
    </div>
  );
};
