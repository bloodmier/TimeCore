import { deleteData, getData, putData } from "./basicservice";
import type {
  GetTimeReportsParams,
  Summary,
  TimeReportPatch,
  TimeReportRow,
  TimeReportsPage,
} from "../models/timeReports";

const BASE = "/time-reports";

function billedFromStatus(status?: "billed" | "unbilled") {
  if (status === "billed") return true;
  if (status === "unbilled") return false;
  return undefined;
}

function normalizeRow(row: any): TimeReportRow {
  return {
    ...row,
    category: row?.category ?? row?.categoryName ?? null,
  };
}

export const TimeReportsService = {
  list: async <T = TimeReportRow>(
    p: GetTimeReportsParams
  ): Promise<TimeReportsPage<T>> => {
    const params: Record<string, any> = {};

    if (p.start) params.start = p.start;
    if (p.end) params.end = p.end;

    const billed =
      typeof p.billed === "boolean" ? p.billed : billedFromStatus(p.status);
    if (typeof billed === "boolean") params.billed = billed;

    if (p.q) params.q = p.q;
    if (Number.isFinite(p.limit as any)) params.limit = p.limit;
    if (p.cursor) params.cursor = p.cursor;

    const res = await getData<any>(BASE, { params });

    if (Array.isArray(res)) {
      return { items: res as T[], nextCursor: undefined };
    }

    return {
      items: Array.isArray(res?.items) ? (res.items as T[]) : [],
      nextCursor: res?.nextCursor,
    };
  },

  summary: async (p: GetTimeReportsParams): Promise<Summary> => {
    const params: Record<string, any> = {};

    if (p.start) params.start = p.start;
    if (p.end) params.end = p.end;

    const billed =
      typeof p.billed === "boolean" ? p.billed : billedFromStatus(p.status);
    if (typeof billed === "boolean") params.billed = billed;

    if (p.q) params.q = p.q;

    return getData<Summary>(`${BASE}/summary`, { params });
  },

  update: async (id: number, payload: TimeReportPatch): Promise<TimeReportRow> =>
    putData<TimeReportRow>(`${BASE}/${id}`, payload),

  remove: async (id: number): Promise<{ success: boolean; deletedId: number }> =>
    deleteData<{ success: boolean; deletedId: number }>(`${BASE}/${id}`),

  normalizeRow,
};
