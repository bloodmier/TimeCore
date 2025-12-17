import type { ReportItemInput, TimeReportItem } from "../models/Article";
import type { TimeReportPatch } from "../models/timeReports";

/**
 * Convert server items -> UI edit items
 * (used when opening edit modal)
 */
export function toReportItemInputs(items: TimeReportItem[] = []): ReportItemInput[] {
  return items.map((it) => ({
    articleId: it.article_id ?? null,
    description: it.description ?? "",
    amount: Math.max(1, Number(it.amount ?? 1)),
    // purchasePrice is optional in UI, not always present from server
    purchasePrice: (it as any).purchasePrice ?? null,
  }));
}

/**
 * Build patch.items for updateTimeReport:
 * - Delete items: ids that existed before but are gone now
 * - Upsert items: existing items with id OR new items without id
 *
 * We store item ids in the UI list via a hidden field `_id` (local convention).
 */
export function buildItemsDelta(
  before: TimeReportItem[] = [],
  afterInputs: Array<ReportItemInput & { _id?: number }> = []
): NonNullable<TimeReportPatch["items"]> {
  const beforeIds = new Set(before.map((b) => Number(b.id)).filter(Number.isFinite));

  const upsert: Array<{
    id?: number;
    articleId: number | null;
    amount: number;
    description: string;
  }> = [];

  const keepIds = new Set<number>();

  for (const it of afterInputs) {
    const id = it._id;
    const articleId = it.articleId ?? null;
    const amount = Math.max(1, Number(it.amount ?? 1));
    const description = String(it.description ?? "").trim();

    if (!articleId && !description) continue;

    if (Number.isFinite(id as any)) {
      keepIds.add(Number(id));
      upsert.push({
        id: Number(id),
        articleId,
        amount,
        description,
      });
    } else {
      upsert.push({
        articleId,
        amount,
        description,
      });
    }
  }

  const del: number[] = [];
  for (const id of beforeIds) {
    if (!keepIds.has(id)) del.push(id);
  }

  return { upsert, delete: del };
}
