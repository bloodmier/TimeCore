import type {
  adminParams,
  FacetItem,
  StatsResponseWithFacets,
  RegisteredArticleOpt,
  CustomTopItem,
} from "../models/admin";
import { getData } from "./basicservice";

export type AdminFacets = {
  customers: FacetItem[];
  projects: FacetItem[];
  users: FacetItem[];
  categories: FacetItem[];
  articles: {
    registered: RegisteredArticleOpt[];
    customTop: CustomTopItem[];
  };
};

export type AdminStatsQuery = adminParams & {
  includeMissing?: 0 | 1;
  missingExcludeWeekends?: 0 | 1;
  missingIncludeDates?: 0 | 1;
  usersScope?: "active" | "tenantAll" | "recent";
  includeArticleTimecards?: 0 | 1;
  includeFacets?: 0 | 1;
};

const ADMIN_STATS_PATH = "/admin/timeoverveiw/stats";

const setNum = (qs: URLSearchParams, k: string, v?: number) => {
  if (typeof v === "number" && Number.isFinite(v)) qs.set(k, String(v));
};

const setBool10 = (qs: URLSearchParams, k: string, v?: boolean) => {
  if (v === true) qs.set(k, "1");
  if (v === false) qs.set(k, "0");
};

const buildAdminStatsQueryString = (p: AdminStatsQuery): string => {
  const qs = new URLSearchParams();
  const from = p.from ?? p.start;
  const to = p.to ?? p.end;

  if (from) {
    qs.set("from", from);
    qs.set("start", from);
  }
  if (to) {
    qs.set("to", to);
    qs.set("end", to);
  }

  if (p.includeFacets != null) qs.set("includeFacets", String(p.includeFacets));

  setNum(qs, "customerId", p.customerId);
  setNum(qs, "projectId", p.projectId);
  setNum(qs, "userId", p.userId);
  setNum(qs, "category", p.category);

  setBool10(qs, "billable", p.billable);
  setBool10(qs, "billed", p.billed);

  if (p.userIds?.length) qs.set("userIds", p.userIds.join(","));
  if (typeof p.minH === "number") qs.set("minH", String(p.minH));
  if (typeof p.maxH === "number") qs.set("maxH", String(p.maxH));

  const search = (p.search ?? p.q)?.toString().trim();
  if (search) qs.set("search", search);

  if (p.articleMode) qs.set("articleMode", p.articleMode);
  if (p.articleIds?.length) qs.set("articleIds", p.articleIds.join(","));
  if (p.customArticleQuery?.trim()) qs.set("customArticleQuery", p.customArticleQuery.trim());

  // Missing-report options (optional)
  if (p.includeMissing != null) qs.set("includeMissing", String(p.includeMissing));
  if (p.missingExcludeWeekends != null)
    qs.set("missingExcludeWeekends", String(p.missingExcludeWeekends));
  if (p.missingIncludeDates != null)
    qs.set("missingIncludeDates", String(p.missingIncludeDates));
  if (p.usersScope) qs.set("usersScope", p.usersScope);
  if (p.includeArticleTimecards != null)
    qs.set("includeArticleTimecards", String(p.includeArticleTimecards));

  return qs.toString();
};

export const AdminFilterReportsService = {
  stats: (params: AdminStatsQuery, opts?: { signal?: AbortSignal }) => {
    const qs = buildAdminStatsQueryString(params);
    return getData<StatsResponseWithFacets>(`${ADMIN_STATS_PATH}?${qs}`, opts);
  },

  facets: (params: AdminStatsQuery, opts?: { signal?: AbortSignal }) => {
    const qs = buildAdminStatsQueryString({ ...params, includeFacets: 1 });
    return getData<StatsResponseWithFacets>(`${ADMIN_STATS_PATH}?${qs}`, opts);
  },
};
