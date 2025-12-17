// src/services/AdminTimeoverveiwservice.ts
import type {
  GetTimeReportsParams,
  IUser,
  Summary,
  TimeReportPatch,
  TimeReportRow,
  TimeReportsPage,
} from "../models/timeReports";
import { deleteData, getData, putData } from "../services/basicservice";

function buildAdminReportsParams(p: GetTimeReportsParams) {
  const qs = new URLSearchParams();

  if (p.start) qs.set("start", p.start);
  if (p.end) qs.set("end", p.end);

  if (p.q) qs.set("q", p.q);
  if (p.billed !== undefined) qs.set("billed", String(p.billed));

  if (Number.isFinite(p.userId as any)) qs.set("userId", String(p.userId));
  if (p.userIds?.length) qs.set("userIds", p.userIds.join(","));

  if (Number.isFinite(p.limit as any)) qs.set("limit", String(p.limit));
  if (p.cursor) qs.set("cursor", p.cursor);

  if (p.scope) qs.set("scope", p.scope);

  return qs;
}

export const AdminTimeOverviewService = {
  // GET /admin/timeoverveiw/entries
  getEntries: async <T = TimeReportRow>(
    p: GetTimeReportsParams
  ): Promise<TimeReportsPage<T>> => {
    const qs = buildAdminReportsParams(p);
    const res = await getData<any>(`/admin/timeoverveiw/entries?${qs.toString()}`);

    if (Array.isArray(res)) {
      return { items: res as T[], nextCursor: undefined };
    }

    return {
      items: Array.isArray(res?.items) ? (res.items as T[]) : [],
      nextCursor: res?.nextCursor,
    };
  },

  // GET /admin/timeoverveiw/timereportsummary
  getSummary: async (p: GetTimeReportsParams): Promise<Summary> => {
    const billed =
      p.billed !== undefined
        ? p.billed
        : p.status === "billed"
        ? true
        : p.status === "unbilled"
        ? false
        : undefined;

    const qs = new URLSearchParams();
    if (p.start) qs.set("start", p.start);
    if (p.end) qs.set("end", p.end);
    if (p.q) qs.set("q", p.q);
    if (billed !== undefined) qs.set("billed", String(billed));
    if (p.userId != null) qs.set("userId", String(p.userId));
    if (p.userIds?.length) qs.set("userIds", p.userIds.join(","));

    return getData<Summary>(`/admin/timeoverveiw/timereportsummary?${qs.toString()}`);
  },

  // PUT /admin/timeoverveiw/updateentries/:id
  updateEntry: (id: number, payload: TimeReportPatch) =>
    putData<TimeReportRow>(`/admin/timeoverveiw/updateentries/${id}`, payload),

  // DELETE /admin/timeoverveiw/entries/:id
  deleteEntry: (id: number) =>
    deleteData<{ message?: string }>(`/admin/timeoverveiw/entries/${id}`),

  // GET /admin/users
  getUsers: () =>
    getData<IUser[]>(`/admin/users`),
};
