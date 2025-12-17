/**
 * useReportItemsEditor
 *
 * Small UI state helper for editing the "items" (materials/articles) of a single time report.
 *
 * Responsibilities:
 * - Tracks which report row is currently being edited (`activeRow`)
 * - Maps backend items -> UI editable items (keeps original item id in `_id`)
 * - Keeps a baseline snapshot from the server to calculate a minimal delta patch:
 *   - `items.upsert` for new/changed rows
 *   - `items.delete` for removed rows
 * - Produces a patch payload compatible with PUT /time-reports/:id
 *
 * This hook does NOT:
 * - fetch any data
 * - save anything to the backend
 * It only prepares the items part of `TimeReportPatch`.
 */


import { useCallback, useMemo, useState } from "react";
import type { TimeReportRow, TimeReportPatch } from "../models/timeReports";
import type { ReportItemInput, TimeReportItem } from "../models/Article";
import { buildItemsDelta, toReportItemInputs } from "../helpers/timeReportItems";

type UiItem = ReportItemInput & { _id?: number };

export function useReportItemsEditor() {
  const [activeRow, setActiveRow] = useState<TimeReportRow | null>(null);

  const baselineItems: TimeReportItem[] = useMemo(() => {
    return (activeRow?.items ?? []) as any;
  }, [activeRow]);


  const [uiItems, setUiItems] = useState<UiItem[]>([]);

  const open = useCallback((row: TimeReportRow) => {
    setActiveRow(row);

    const mapped: UiItem[] = (row.items ?? []).map((it: any) => ({
      articleId: it.article_id ?? null,
      description: it.description ?? "",
      amount: Math.max(1, Number(it.amount ?? 1)),
      _id: Number(it.id),
    }));

    setUiItems(mapped.length ? mapped : []);
  }, []);

  const close = useCallback(() => {
    setActiveRow(null);
    setUiItems([]);
  }, []);

  const setItems = useCallback((next: ReportItemInput[]) => {
    setUiItems((prev) =>
      next.map((n, idx) => ({
        ...n,
        _id: prev[idx]?._id,
      }))
    );
  }, []);

  const buildPatchItems = useCallback((): NonNullable<TimeReportPatch["items"]> => {
    return buildItemsDelta(baselineItems, uiItems);
  }, [baselineItems, uiItems]);

  return {
    activeRow,
    open,
    close,

    uiItems,
    setUiItems,
    setItems,

    buildPatchItems,

    toInputs: (items: TimeReportItem[]) => toReportItemInputs(items),
  };
}
