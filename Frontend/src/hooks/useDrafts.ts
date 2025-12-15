/**
 * useDrafts
 *
 * Manages time report drafts for the current user.
 * - Keeps local state of drafts with filtering and debounced refresh
 * - Exposes actions to save, delete and clear drafts via the API
 * - Can duplicate a draft into a FormState for editing in the register form
 */


import { useState, useCallback, useEffect, useReducer } from "react";
import type { Entry, FormState } from "../models/Draft";
import { TimeReportService } from "../services/timeReportService";
import {
  DEFAULT_FILTERS,
  filtersReducer,
} from "../reducers/draftFilterreducer";
import { wireToInput } from "../helpers/TimeHelpersfunctions";

export function useDrafts() {
  const [drafts, setDrafts] = useState<Entry[]>([]);
  const [filters, dispatch] = useReducer(
    filtersReducer,
    DEFAULT_FILTERS
  );

  const refreshDrafts = useCallback(async () => {
    try {
      const rows = await TimeReportService.getDrafts(filters);
      setDrafts(rows);
    } catch (err) {
      console.error("Failed to load drafts from backend:", err);
    }
  }, [filters]);

  useEffect(() => {
    const id = setTimeout(() => {
      void refreshDrafts();
    }, 300);
    return () => clearTimeout(id);
  }, [refreshDrafts]);

  const saveDraftEntry = useCallback(
    async (entry: Entry) => {
      try {
        await TimeReportService.saveDraft(entry);
        await refreshDrafts();
      } catch (err) {
        console.error("Failed to save draft:", err);
      }
    },
    [refreshDrafts]
  );

  const deleteDraftEntry = useCallback(
    async (draftId: number) => {
      try {
        await TimeReportService.deleteDraft(draftId);
        await refreshDrafts();
      } catch (err) {
        console.error("Failed to delete draft:", err);
      }
    },
    [refreshDrafts]
  );

  const clearDraftsEntry = useCallback(async () => {
    try {
      await TimeReportService.clearDrafts();
      await refreshDrafts();
    } catch (err) {
      console.error("Failed to clear drafts:", err);
    }
  }, [refreshDrafts]);

  const duplicateDraft = async (it: Entry): Promise<FormState> => {
    let sourceItems = it.items ?? [];
    if ((!sourceItems || sourceItems.length === 0) && it.draft_id) {
      sourceItems = await TimeReportService.fetchDraftItems(
        it.draft_id
      );
    }

    const mapped = sourceItems.map(wireToInput);

    return {
      customerId: it.customerId,
      note: it.note,
      workDescription: it.workDescription,
      items: mapped,
      category: it.category_id,
      hours: String(it.hours),
      date: it.date,
      projectId: it.projectId ?? null,
      laborTemplateId: null,
      billable: it.billable ?? true,
    };
  };

  return {
    drafts,
    saveDraft: saveDraftEntry,
    deleteDraft: deleteDraftEntry,
    clearDrafts: clearDraftsEntry,
    refreshDrafts,
    duplicateDraft,
    filters,
    dispatch,
  };
}
