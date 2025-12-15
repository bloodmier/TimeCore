/**
 * useLaborTemplates
 *
 * Fetches, stores and exposes labor templates for the current user.
 * Also provides actions for creating and deleting templates.
 *
 * Used in TimeRegisterForm for quick-fill functionality.
 */
import { useEffect, useState } from "react";
import type { LaborTemplate } from "../models/labortemplate";
import { TimeReportService } from "../services/timeReportService";

export const useLaborTemplates = () => {
  const [laborTemplates, setLaborTemplates] = useState<LaborTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await TimeReportService.getLaborTemplates();
      setLaborTemplates(res);
    } catch (err) {
      console.error("Error fetching labor templates:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (laborTemplates.length === 0) {
      void fetchTemplates();
    }
  }, [laborTemplates.length]);

  const createLaborTemplate = async (name: string, description: string) => {
    const created = await TimeReportService.postLaborTemplates({
      name,
      extendedDescription: description,
    });
    setLaborTemplates((prev) => [...prev, created]);
  };

  const deleteLaborTemplate = async (id: number) => {
    await TimeReportService.deleteLaborTemplates(id);
    setLaborTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  return {
    laborTemplates,
    loading,
    createLaborTemplate,
    deleteLaborTemplate,
    refreshLaborTemplates: fetchTemplates,
  };
};
