/**
 * useReportTemplates
 *
 * Manages reusable time report templates for the current user.
 * - Loads all saved templates from the backend
 * - Can save, pick and delete templates
 * - Converts template rows into FormState for the time register form
 */


import { useEffect, useState, type MouseEvent } from "react";
import { initialValues, today } from "../helpers/TimeHelpersfunctions";
import type { FormState, ReportTemplate } from "../models/Draft";
import { TimeReportService } from "../services/timeReportService";

export const useReportTemplates = () => {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] =
    useState<number | string>("");
  const [selectedTemplate, setSelectedTemplate] =
    useState<FormState | null>(null);
  const [templateName, setTemplateName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const toFormState = (t: ReportTemplate): FormState => ({
    customerId: Number(t.customer_id) ?? 0,
    note: t.note ?? "",
    items: t.items ?? [],
    workDescription: t.work_labor ?? "",
    category: t.category ?? null,
    hours: t.hours ?? "",
    billable: t.billable,
    date: today,
    projectId: t.projectId ?? null,
    laborTemplateId: t.laborTemplateId ?? null,
  });

  const loadAllTemplates = async () => {
    setLoading(true);
    try {
      const temp = await TimeReportService.getAllTimeRegisterTemplate();
      setTemplates(temp);
    } catch (err) {
      console.error("Failed to fetch templates", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAllTemplates();
  }, []);

  const saveTemplate = async (
    e: MouseEvent<HTMLButtonElement>,
    template: FormState,
    name: string
  ) => {
    e.preventDefault();

    try {
      await TimeReportService.saveTimeRegisterTemplate(template, name);
      await loadAllTemplates();
      setSelectedTemplate(null);
      setSelectedTemplateId("");
      resetTemplate();
    } catch {
      console.error("Failed to save template!");
    } finally {
      setTemplateName("");
    }
  };

  const pickTemplate = async (id: string) => {
    try {
      const row = await TimeReportService.getTimeRegisterTemplateById(
        Number(id)
      );
      const pickedTemplate = row[0];
      setSelectedTemplate(toFormState(pickedTemplate));
      setSelectedTemplateId(pickedTemplate.id);
    } catch {
      console.error("Failed to get template!");
    }
  };

  const deleteTemplate = async (id: number) => {
    try {
      await TimeReportService.deleteTimeRegisterTemplateById(id);
      await loadAllTemplates();
      setSelectedTemplate(null);
      setSelectedTemplateId("");
    } catch {
      console.error("Couldn't delete template");
    }
  };

  const resetTemplate = () => {
    setSelectedTemplate(initialValues);
    setSelectedTemplateId("");
  };

  return {
    templates,
    loading,
    templateName,
    setTemplateName,
    saveTemplate,
    pickTemplate,
    deleteTemplate,
    selectedTemplate,
    selectedTemplateId,
    resetTemplate,
  };
};
