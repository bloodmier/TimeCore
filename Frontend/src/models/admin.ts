import type { TimeReportRow } from "./timeReports";


export type AdminFilter = {
  from: string; 
  to: string;   
  customerId?: number;
  projectId?: number;
  userId?: number;
  category?: number;
  billable?: boolean;
  billed?: boolean;
  search?: string; 
  minH?: number;
  maxH?: number;

  articleMode?: "all" | "registered" | "custom";
  articleIds?: number[];
  customArticleQuery?: string;
};

export type AdminSummary = {
  rowsCount: number;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  activeDays: number;
  topCustomers: { customerName: string; hours: number }[];
};

export type AdminReportsResponse<T = AdminTimeReportRow> = {
  items: T[];
  nextCursor?: string;
  summary?: AdminSummary;
};

export type AdminItem = {
  id: number;
  timeReportId: number;
  articleId: number | null;
  amount: number | null;
  description: string;
  articleName?: string | null;
  articlePrice?: number | null;
  articleUnit?: string | null;
};

export interface AdminTimeReportRow extends Omit<TimeReportRow, "items"> {
  items: AdminItem[];
  userId: number;
  userName?: string | null;
  userEmail?: string | null;
}

export type StatsResponse = {
  summary: {
    rowsCount: number;
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    activeDays: number;
    sickHours: number;
    vacationHours: number;
  };
  weekHours: Array<{ isoWeek: string; hours: number }>;
  byCustomer: Array<{ customerId: number | null; customerName: string; hours: number }>;
  byUser: Array<{ userId: number; name: string; hours: number }>;
  byCategory: Array<{ categoryId: number | null; name: string; hours: number }>;
  articles: {
    registered: Array<{ articleId: number; label: string; count: number }>;
    custom: Array<{ label: string; count: number }>;
  };
  missingDays?: Array<{ userId: number; name: string; missingCount: number; missingDates?: string[] }>;
  articlesByCustomer: Array<{
    customerId: number | null;
    customerName: string;
    registered: Array<{ kind: "registered"; articleId: number; label: string; count: number }>;
    custom: Array<{ kind: "custom"; label: string; count: number }>;
  }>;
  articlesByCustomerTimecards?: Array<{
    customerId: number | null;
    customerName: string;
    timecards: Array<{
      timeReportId: number;
      date: string;
      totalQty: number;
      items: Array<{
        kind: "registered" | "custom";
        articleId?: number;
        label: string;
        qty: number;
      }>;
    }>;
  }>;
};


export type adminParams = Partial<AdminFilter> & {
  start?: string;   
  end?: string;     
  userIds?: number[];
  billed?: boolean;
  q?: string;       
  limit?: number;
  cursor?: string;
  includeSummary?: boolean; 
  scope?: string;    
  includeFacets?: number    
  articleMode?: "all" | "registered" | "custom";
  articleIds?: number[];
  customArticleQuery?: string;
};

export type FacetItem = { id: number; name: string };

export type StatsResponseWithFacets = StatsResponse & { facets?: AdminFacets };

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

export type RegisteredArticleOpt = { id: number; name: string; count: number };

export type CustomTopItem = {id:number, label: string; count: number };