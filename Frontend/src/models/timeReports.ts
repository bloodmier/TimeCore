import type { TimeReportItem } from "./Article";


export interface IUser {
  id: number;
  name: string;
  email: string;
}


export type Scope = "me" | "all" | "user";

export type Summary = {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  daysReported: number;
  amount?: number;     
  sickHours: number;
  vacationHours: number;
};


export type TimeReportRow = {
  id: number | string;
  date: string;
  customerId?: number | null;
  projectId?: number | null;
  categoryId?: number | null;
  customerName?: string | null;
  projectName?: string | null;
  category?: string | null;
  categoryName?: string | null;
  hours: number;
  billable: boolean;
  billed: boolean;
  invoiceNumber?: number | null;
  workDescription?: string | null;
  note?: string | null;
  items: TimeReportItem[];
};


export type TimeReportsPage<T> = {
  items: T[];
  nextCursor?: string;
};


export type GetTimeReportsParams = {
  start?: string;
  end?: string;
  q?: string;
  billed?: boolean;
  status?: "billed" | "unbilled";
  scope?: Scope;
  userId?: number;
  userIds?: number[];
  limit?: number;
  cursor?: string;
};


export type TimeReportPatch = Partial<{
  date: string;
  hours: number;
  billable: boolean;
  customerId: number | null;
  projectId: number | null;
  categoryId: number | null;
  workDescription: string | null;
  note: string | null;
  items: {
    upsert: Array<{
      id?: number;
      articleId: number | null;
      amount: number;
      description: string;
    }>;
    delete: number[];
  };
}>;
