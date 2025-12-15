import type { TimeReportItem, ReportItemInput } from "./Article";

export type TimeReportRow = {
  id: string | number;
  date: string;
  customerId?: number | null;
  projectId?: number | null;
  categoryId?: number | null;
  customerName?: string | null;
  projectName?: string | null;
  category?: string | null;
  hours: number;
  billable?: boolean;
  billed?: boolean;
  invoiceNumber?: number | null;
  workDescription?: string | null;
  note?: string | null;
  items?: TimeReportItem[];
};

export type Summary = {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  amount: number;
  daysReported: number;
  sickHours: number;
  vacationHours: number;
};

export type TimeReportFilters = {
  start: string;
  end: string;
  status?: string;
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

export type TimeReportDraft = {
  projectId: number | null;
  categoryId: number | null;
  workDescription: string;
  note: string;
  hours: string;
  billable: boolean;
};

export type Scope = "me" | "all" | "user";

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

export type TimeReportsPage<T> = {
  items: T[];
  nextCursor?: string;
};

export type GetTimeReportEntriesParams = {
  start?: string;
  end?: string;
  billed?: boolean;
};

export type DraftRow = {
  projectName: string;
  category: string;
  workDescription: string;
  hours: string;
};

export type DraftMap = Record<string, DraftRow>;

// ------------- FORM STATE --------------------

export type FormState = {
  customerId: number;
  note: string;
  items?: ReportItemInput[];
  workDescription: string;
  category: number | null;
  hours: string;
  billable: boolean;
  date: string;
  projectId?: number | null;
  laborTemplateId?: number | null;
};

// ------------- TEMPLATE -----------------------

export interface ReportTemplate extends FormState {
  id: number;
  name: string;
  customer_id: number;
  work_labor: string;
}

export type TemplateLike = ReportTemplate | FormState;

// ------------- ENTRY --------------------------

export type ReportItemWire = {
  article_id?: number | null;
  amount?: number;
  description?: string;
};

export type Entry = {
  id: string;
  draft_id?: number;
  customerId: number;
  customerName: string;
  note: string;
  workDescription: string;
  category_id: number | null;
  category_name: string;
  hours: number;
  billable: boolean;
  date: string;
  projectId?: number | null;
  laborTemplateId?: number | null;
  company_name?: string;
  items?: ReportItemWire[];
};

// -------- CREATE DTO --------------------

export type TimeReportCreateDTO = {
  customer_id: number | undefined;
  note: string;
  work_labor: string;
  category: number;
  date: string;
  hours: number;
  billable: boolean;
  project_id?: number | null;
  items?: ReportItemWire[];
  draft_id?: number;
};

// ------------- FILTER ------------------------

export type SortKey = "company_name" | "modified" | "date" | "created_date";
export type OrderKey = "asc" | "desc";

export type DraftFilters = {
  q?: string;
  from?: string;
  to?: string;
  sort: SortKey;
  order: OrderKey;
  limit: number;
  offset: number;
};

export type DraftUpdateDTO = {
  customer_id: number;
  note: string;
  work_labor: string;
  category: number;
  date: string;
  hours: number;
  billable: boolean;
  project_id: number | null;
  items?: Array<{
    article_id: number | null;
    amount: number;
    description: string;
  }>;
};

export type AnyItem = {
  article_id?: number;
  articleId?: number;
  amount?: number;
  description?: string;
};
