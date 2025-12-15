
import type { ReportItemInput } from "../models/Article";
import type { AnyItem, FormState, ReportItemWire, ReportTemplate, TemplateLike } from "../models/Draft";

export const wireToInput = (w: any): ReportItemInput => ({
  articleId: Number.isFinite(Number(w?.article_id ?? w?.articleId))
    ? Number(w.article_id ?? w.articleId)
    : 1,
  amount: Math.max(1, Number(w?.amount) || 1),
  description: String(w?.description ?? "").trim() || "Article",
});

export const toWireItems = (items: any[]) =>
  (items ?? []).map((it) => ({
    article_id: it.article_id ?? it.articleId ?? null,
    amount: Math.max(1, Number(it.amount ?? 1)),
    description: String(it.description ?? "").trim(),
  }));

export const summarizeDraftItems = (
  items: AnyItem[] | undefined | null
): string => {
  if (Array.isArray(items) && items.length) {
    return items
      .map(wireToInput)
      .map((i) => `${i.amount}x ${i.description}`)
      .join(", ");
  }
  return "";
};

export const parseItems = (raw: unknown): ReportItemWire[] => {
  if (!raw) return [];
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return (arr as any[]).map((it) => ({
    articleId: it.articleId ?? it.article_id ?? null,
    amount: Number.isFinite(Number(it.amount)) ? Number(it.amount) : 1,
    description: (it.description ?? "").trim(),
  }));
};

export const toFormPatch = (t: TemplateLike) => {
  if ("customer_id" in t || "work_labor" in t) {
    const tpl = t as ReportTemplate;
    return {
      customerId: tpl.customer_id,
      note: tpl.note ?? "",
      workDescription: tpl.work_labor ?? "",
      category: (tpl as any).category ?? null,
      hours: String((tpl as any).hours ?? ""),
      date: ((tpl as any).date ?? "").slice(0, 10),
      projectId: (tpl as any).project_id ?? null,
      items: parseItems((tpl as any).items),
    } as Partial<FormState>;
  }
  const fs = t as FormState;
  return {
    customerId: fs.customerId,
    note: fs.note ?? "",
    workDescription: fs.workDescription ?? "",
    category: fs.category ?? null,
    hours: fs.hours ?? "",
    date: fs.date ?? "",
    projectId: fs.projectId ?? null,
    items: parseItems((fs as any).items),
  } as Partial<FormState>;
};

export const applyTemplateToForm = (
  v: FormState,
  t: TemplateLike
): FormState => {
  const patch = toFormPatch(t);
  return {
    ...v,
    ...patch,
    date: patch.date ?? v.date,
    items: patch.items ?? v.items ?? [],
  };
};

export const toInput = (w: ReportItemWire): ReportItemInput => ({
  articleId: Number.isFinite(Number(w.article_id)) ? Number(w.article_id) : 1,
  amount: Number.isFinite(Number(w.amount)) ? Number(w.amount) : 1,
  description: (w.description ?? "").trim() || "Article",
});


export function getMonthRange(offset = 0, base = new Date()) {
  const first = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0); // dag 0 = sista i föregående månad
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: ymd(first), end: ymd(last) };
}
export const today = new Date().toISOString().split("T")[0];
export const initialValues: FormState = {
  customerId: 0,
  note: "",
  items: [],
  workDescription: "",
  category: null,
  hours: "",
  billable: true,
  date: today,
  projectId: null,
  laborTemplateId: null,
};

