import type { TimeReportPatch } from "../models/timeReports";

export function buildTimeReportPatch(input: {
  date?: string;
  hours?: number;
  billable?: boolean;
  customerId?: number | null;
  projectId?: number | null;
  categoryId?: number | null;
  workDescription?: string | null;
  note?: string | null;
  items?: TimeReportPatch["items"];
}): TimeReportPatch {
  const patch: TimeReportPatch = {};

  if (input.date !== undefined) patch.date = input.date;
  if (input.hours !== undefined) patch.hours = input.hours;
  if (input.billable !== undefined) patch.billable = input.billable;

  if (input.customerId !== undefined) patch.customerId = input.customerId;
  if (input.projectId !== undefined) patch.projectId = input.projectId;
  if (input.categoryId !== undefined) patch.categoryId = input.categoryId;

  if (input.workDescription !== undefined) patch.workDescription = input.workDescription;
  if (input.note !== undefined) patch.note = input.note;

  if (input.items !== undefined) patch.items = input.items;

  return patch;
}
