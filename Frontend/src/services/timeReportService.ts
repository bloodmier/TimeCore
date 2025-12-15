// src/services/timeReportService.ts
import type { AxiosRequestConfig } from "axios";
import { deleteData, getData, postData, putData } from "./basicservice";

import type { Project } from "../models/project";
import type { icustomer } from "../models/icustomer";
import type { LaborTemplate } from "../models/labortemplate";

import type {
  Article,
  ReportItemInput,
  TimeReportItem,
  Category
} from "../models/Article";

import {
  DEFAULT_FILTERS,
} from "../reducers/draftFilterreducer";

import type {
  DraftFilters,
  DraftUpdateDTO,
  Entry,
  FormState,
  ReportItemWire,
  ReportTemplate,
  TimeReportCreateDTO,
} from "../models/Draft";

const BASE = "/timereport";

export const TimeReportService = {
  // ---------- MAIN TIME REPORTING ----------
  registerTime: (payload: TimeReportCreateDTO[]) =>
    postData<void>(`${BASE}/addtime`, payload),

  getProjectsByCustomerId: (customerId: number) =>
    postData<Project[]>(`${BASE}/getregisterdtime`, { customerId }),

  // ---------- CUSTOMERS ----------
  getAllCustomers: () =>
    getData<icustomer[]>(`${BASE}/getallcustomers`),

  searchCustomer: (query: string) =>
    getData<icustomer[]>(`${BASE}/searchcustomers`, {
      params: { q: query },
    }),

  getCategories: () =>
    getData<Category[]>(`${BASE}/getcategories`),

  getLaborTemplates: () =>
    getData<LaborTemplate[]>(`${BASE}/labor-templates`),

  postLaborTemplates: (payload:{name: string;
    extendedDescription: string; })=> postData<LaborTemplate>(`${BASE}/labor-templates`,payload),

  deleteLaborTemplates: (id:number)=> deleteData<void>(`${BASE}/labor-templates/${id}`),

  getOwnerCompanies: () =>
    getData<icustomer[]>(`${BASE}/customer/owners`),

  quickAddCustomer: (company: string, ownerId: number) =>
    postData<icustomer>(`${BASE}/customer/quick-add`, {
      company,
      owner_id: ownerId,
    }),

  getRecentCustomers: () =>
    getData<icustomer[]>(`${BASE}/customer/recent`),

  touchCustomerUsage: (customerId: number) =>
    postData<void>(`${BASE}/customer/touch`, { customerId }),

  // ---------- DRAFT ITEMS ----------
  fetchDraftItems: (draftId: number) =>
    getData<ReportItemWire[]>(`${BASE}/drafts/${draftId}/items`),

  saveDraft: (draft: Entry) => {
    const items: ReportItemWire[] = (draft.items ?? [])
      .map((it: any) => ({
        article_id: it.article_id ?? it.articleId ?? null,
        amount: Math.max(1, Number(it.amount ?? 1)),
        description: String(it.description ?? "").trim(),
        purchase_price:
          it.purchase_price != null
            ? Number(it.purchase_price)
            : it.purchasePrice != null
            ? Number(it.purchasePrice)
            : null,
      }))
      .filter(
        (x) => x.article_id != null || (x.description?.length ?? 0) > 0
      );

    const payload = {
      customer_id: draft.customerId,
      note: draft.note,
      work_labor: draft.workDescription,
      category: draft.category_id,
      date: draft.date,
      hours: draft.hours,
      billable: draft.billable,
      project_id: draft.projectId,
      items,
    };

    return postData(`${BASE}/draft/save`, payload);
  },

  getDrafts: async (
    filters: Partial<DraftFilters> = {}
  ): Promise<Entry[]> => {
    const f: DraftFilters = { ...DEFAULT_FILTERS, ...filters };

    const qs = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        qs.set(k, String(v));
      }
    });

    const url = `${BASE}/drafts${
      qs.toString() ? `?${qs.toString()}` : ""
    }`;

    const rows = await getData<any[]>(url);
    const num = (v: any) =>
      Number.isFinite(Number(v)) ? Number(v) : 0;

    return rows.map((r) => ({
      id: String(r.id),
      draft_id: Number(r.id),
      customerId: Number(r.customer_id),
      customerName: r.company_name ?? "",
      note: r.note ?? "",
      workDescription: r.work_labor ?? "",
      category_id: r.category,
      category_name: r.category_name,
      date: (r.date ?? "").slice(0, 10),
      hours: num(r.hours),
      billable: r.billable,
      projectId:
        r.project_id != null ? Number(r.project_id) : null,
      items: Array.isArray(r.items) ? r.items : [],
    }));
  },

  updateDraft: (draftId: number, dto: DraftUpdateDTO) =>
    putData<void>(`${BASE}/draft/update/${draftId}`, dto),

  deleteDraft: (draftId: number) =>
    postData<void>(`${BASE}/draft/delete`, { draftId }),

  clearDrafts: () =>
    postData<void>(`${BASE}/drafts/clear`, {}),

  duplicateDraftToApi: async (draftId: number) => {
    const dubdraft = await getData<Entry>(
      `${BASE}/drafts/${draftId}`
    );

    const toMySQLDateLocal = (input: string | Date) => {
      if (
        typeof input === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(input)
      ) {
        return input;
      }

      const d = new Date(input);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    const newDraft: Entry = {
      ...dubdraft,
      date: toMySQLDateLocal(dubdraft.date),
    };

    return postData(`${BASE}/draft/save`, newDraft);
  },

  // ---------- TEMPLATES ----------
  saveTimeRegisterTemplate: (
    templates: FormState,
    name: string
  ) =>
    postData<FormState>(`${BASE}/template/save`, {
      templates,
      name,
    }),

  getAllTimeRegisterTemplate: () =>
    getData<ReportTemplate[]>(`${BASE}/template/all`),

  getTimeRegisterTemplateById: (id: number) =>
    getData<ReportTemplate[]>(`${BASE}/template/${id}`),

  deleteTimeRegisterTemplateById: (id: number) =>
    deleteData<FormState>(`${BASE}/template/${id}`),

  // ---------- ARTICLES / ITEMS ----------
  searchArticles: (
    q: string,
    limit = 10,
    offset = 0,
    config?: AxiosRequestConfig
  ) =>
    getData<Article[]>(`${BASE}/articles`, {
      ...(config ?? {}),
      params: {
        q: q.trim(),
        limit,
        offset,
      },
    }),

  replaceReportItems: (
    reportId: number,
    items: ReportItemInput[],
    config?: AxiosRequestConfig
  ) =>
    putData<{ ok: boolean; count: number }>(
      `${BASE}/${reportId}/items`,
      { items },
      config
    ),

  fetchReportItems: (
    reportId: number,
    config?: AxiosRequestConfig
  ) =>
    getData<TimeReportItem[]>(`${BASE}/${reportId}/items`, config),

  // ---------- TEST ----------
  testCall: () => getData<string>("/test"),
};
