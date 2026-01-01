// src/models/invoice.ts

// --- Shared basics -----------------------------------------------------------

export type VatRate = 0 | 6 | 12 | 25;

export type BillingGroupOptions = {
  labor?: "single" | "byCategory" | "byWorkLabel"; // default: "byWorkLabel"
  items?: "byArticle" | "byDescription";            // default: "byArticle"
  includeProjectDimension?: boolean;                // default: false
};

export type CollectStatus = "unbilled" | "billed" | "all";

export type CollectRequest = {
  start: string; // "YYYY-MM-DD"
  end: string;   // "YYYY-MM-DD"
  onlyBillable?: boolean; // default: true
  status?: CollectStatus; // default: "unbilled"
  group?: BillingGroupOptions;
};

// --- Invoice line model (for billing draft) ----------------------------------

export type LineKind = "labor" | "registered" | "custom";

export type LineSource =
  | { type: "hours"; ids: number[] }
  | { type: "item"; ids: number[] };

export type BaseLine = {
  kind: LineKind;
  source: LineSource;
  description: string | null;
  qty: number;            // hours (h) or units (pcs)
  unit: "h" | "pcs";
  unitPrice: number | null;
  vatPercent: VatRate;
  projectId: number | null;
  projectName: string | null;
};

// For registered/custom items we can have article meta:
export type RegisteredLine = BaseLine & {
  kind: "registered";
  articleId: number | null;     // id if known
  articleNumber: string | null; // article.art_nr
};

export type CustomLine = BaseLine & {
  kind: "custom";
  articleId: null;
  articleNumber: null;
};

export type LaborLine = BaseLine & {
  kind: "labor";
  articleId: null;
  articleNumber: null;
};

export type Line = RegisteredLine | CustomLine | LaborLine;

// --- Entities mirrored from backend grouping --------------------------------

export type CompanyRef = {
  id: number | null;
  name: string;
  customer_id: string | null; // Fortnox customer id (nullable)
};

export type OwnerRef = {
  id: number;
  name: string;
  customer_id: string | null;
};

// --- Per-company article aggregations (within timecards block) ---------------

export type RegisteredArticleSum = {
  article: {
    id: number;
    number: string | null;
    name: string | null;
  };
  qty: number;
};

export type CustomArticleSum = {
  description: string;
  qty: number;
};

export type TimecardsArticles = {
  registered: RegisteredArticleSum[];
  custom: CustomArticleSum[];
};

export type TimecardsBlock = {
  // Company-wide article totals for the selected period
  articles: TimecardsArticles;
  // All timecards for the company within the period (with items)
  rows: TimecardRow[];
};

// --- Totals & meta per company ----------------------------------------------

export type CompanyTotals = {
  hoursSum: number;               // sum of hours for the company
  timeReportCount: number;        // count of time reports (rows)
  itemCount: number;              // count of item rows (tri) included
  registeredArticleCount: number; // number of unique registered article ids
  customArticleCount: number;     // number of unique custom descriptions
};

export type CompanyLocks = {
  timeReportIds: number[];
  timeReportItemIds: number[];
};

export type CompanyMeta = {
  sourceRowCount: number; // how many time_report rows touched
  periodHours: number;    // sum of hours (dup of hoursSum but kept for parity)
  firstDate: string | null;
  lastDate: string | null;
  projects: number[]; 
  flags: CompanyMetaFlags  
  billing: { state: BillingState };
};

export type CompanyMetaFlags = {
    hasUnbilledBeforeStart: boolean;
    hasUnbilledAfterEnd: boolean;
    hasBilledInRange: boolean;        
  hasUnbilledInRange: boolean;      
  isFullyBilledInRange: boolean;
}
// --- The main customer/company bucket ---------------------------------------

export type CollectAllCustomer = {
  company: CompanyRef;     
  billingInfo: BillingInfo;
  total: CompanyTotals;
  timecards: TimecardsBlock;
  lines: Line[];          
  locks: CompanyLocks;
  meta: CompanyMeta;
  materialsInvoice?: Invoice | null;
  materialsRaw?:MaterialRaw[]
};

export type MaterialRaw = {
id: number;
    amount: number;
    description: string | null;
    unit: string;
    vatPercent: number;
    articleNumber: string;
    timeReportId?: number;
    date?: string;

}

export type InvoiceRow = {
  ArticleNumber: string;           // t.ex. "87"
  DeliveredQuantity: number;       // antal
  Description: string;             // beskrivning per item
};

export type Invoice = {
  Invoice: {
    CustomerNumber: string;        // Fortnox kundnummer
    InvoiceDate: string;           // "YYYY-MM-DD"
    DueDate: string;               // "YYYY-MM-DD"
    InvoiceRows: InvoiceRow[];
  };
};
// --- Envelope returned by the endpoint --------------------------------------

export type GroupResolved = {
  labor: NonNullable<BillingGroupOptions["labor"]>;
  items: NonNullable<BillingGroupOptions["items"]>;
  includeProjectDimension: boolean;
};

export type CollectAllEnvelope = {
  start: string;                 // "YYYY-MM-DD"
  end: string;                   // "YYYY-MM-DD"
  onlyBillable: boolean;
  status: CollectStatus;
  group: GroupResolved;
  count: number;                 // customers.length
  customers: CollectAllCustomer[];
};


// models/Billing.ts
export type TimecardItem = {
  id: number;
  amount: number;
  description: string | null;
  article?: {
    id: number;
    number: string | null;
    name: string | null;
  } | null;
  project?: {
    id: number;
    name: string | null;
  } | null;
};

export type TimecardRow = {
  id: number;
  date: string;              // "YYYY-MM-DD"
  hours: number;
  billable: boolean;
  project: string | null;
  note: string | null;
  work_labor: string | null; // "Arbete med Nätverk" etc.
  category: string | null;        // ✅ now a name
  category_id?: number | null;
  user_id:number;
  user_name:string;
  customer: { id: number; name: string };
  items: TimecardItem[];
  billing:BillingStatusTimeRow
};

export type BillingStatusTimeRow = {
billed:boolean;
invoiceNumber:number;
}

export type BillingState = "billed" | "unbilled" | "mixed" | "empty";

export type BillingInfo = {
  customer_id: string | null; // where to invoice
  source: "company" | "owner" | null;
  company: { id: number; name: string; customer_id: string | null };
  owner: { id: number; name: string; customer_id: string | null } | null;
};

export type CompanyLite = { id: number; name: string; customer_id: string | null };

export type Totals = {
  hoursSum: number;
  timeReportCount: number;
  itemCount: number;
  registeredArticleCount: number;
  customArticleCount: number;
};

export type LinesLockMeta = {
  timeReportIds: number[];
  timeReportItemIds: number[];
};

export type MetaBlock = {
  sourceRowCount: number;
  periodHours: number;
  firstDate: string;
  lastDate: string;
  projects: Array<{ id: number; name: string }> | [];
  flags:CompanyMetaFlags
  billing: { state: BillingState };
};

// This is one element in the array you said you fetch (“array med flera företag”)
export type BillingEnvelope = {
  company: CompanyLite;
  billingInfo: BillingInfo;
  total: Totals;
  timecards: {
    articles: TimecardsArticles;
    rows: TimecardRow[];
  };
  lines: Line[];
  locks: LinesLockMeta;
  meta: MetaBlock;
};

export type FortnoxInvoiceRow = {
  ArticleNumber: string;        // "100" eller "87"
  DeliveredQuantity: number;    // timmar eller antal
  UserId: number;
  Description?: string;
  Price?: number;               // lämna bort => låt Fortnox prislista gälla
  VAT?: number;                 // 0 | 6 | 12 | 25
  Unit?: string;                // "h" | "pcs"
};

export type FortnoxInvoice = {
  Invoice: {
    CustomerNumber: string;
    InvoiceDate: string;        // "YYYY-MM-DD"
    DueDate: string;            // "YYYY-MM-DD"
    YourReference?: string;
    InvoiceRows: FortnoxInvoiceRow[];
  };
};


export type ProceedOptions = {
  invoiceDate?: string | null; 
};


export type LockAndMarkRequest = {
  invoiceNumber: string;
  locks: {
    timeReportIds: number[];
  };
};
export type LockAndMarkItemsRequest = {
  invoiceNumber: string;
  locks: {
    timeReportItemIds: number[];
  };
};

export type FortnoxOkEntry = {
  index: number;
  envelopeCompanyId: number;
  kind: "labor" | "materials";
  response: { Invoice: { DocumentNumber?: string; ["@url"]?: string } };
};

export type FortnoxCreateResult = { ok: FortnoxOkEntry[]; failed: unknown[] };

export type CollectAllCardItem = {
  name: string;
  customerId: string | null;
  lines: Line[];
  locks: CompanyLocks;
};

export type WorklogRow = {
  date: string;     // "YYYY-MM-DD"
  desc?: string;
  hours: number;  
  user_name?:string; 
  category?:string
};

export type WorklogGeneratePayload = {
  invoiceId: number;                       // vi kör Fortnox DocumentNumber som id (nummersträng -> number)
  invoiceNumber: string;                   // Fortnox fakturanummer (DocumentNumber)
  customerName?: string | null;
  companyId?: number | null;
  period?: { from?: string; to?: string } | null;
  rows: WorklogRow[];
};

export type TimecardRowLike = {
  date: string;
  work_labor?: string | null;  // beskrivning (om du använder detta)
  note?: string | null;        // alternativ beskrivning
  hours?: number;              // timmar
  hour?: number;               // fallback om du heter hour
  time?: number;               // fallback (om du heter time)
  user_name?:string;
  category?:string
};


export type BillingEnvelopeLike = {
  company: { id: number; name: string };
  timecards?: {
    rows?: TimecardRowLike[];
  } | TimecardRowLike[];       // vissa ställen kanske har en array direkt
  locks: {
    timeReportIds?: number[];
    timeReportItemIds?: number[];
  };
};

//--------------------------------- pdf -----------------------------------------

// === Per-rad val från din modal ===
export type AttachMode = "none" | "manual";

export type PdfRowOption = {
  companyId: number;
  include: boolean;
  attachMode: AttachMode;
  invoiceNumber?: string;
};

export type PdfRowOptionWithOverrides = PdfRowOption & {
  periodStartOverride?: string | null;
  periodEndOverride?: string | null;
  selectedTimeReportIds?: number[];
};

export type PdfGlobalOptions = {
  periodStart?: string;
  periodEnd?: string;
  language: "en" | "sv";
  includePrices: boolean;
  onlyBillable: boolean;
  note?: string | null;
};

// === Request till backend (MVP) ===
export type WorklogGenerateRequest = {
  companyId: number;
  period?: { from?: string; to?: string } | null;
  attachMode?: "none" | "manual";
  invoiceNumber?: string | null;
  language?: "en" | "sv";
  onlyBillable?: boolean;
  // Ta bort dessa om backend inte använder dem:
  includePrices?: boolean;
  note?: string | null;

  selectedTimeReportIds?: number[];
};

// === Svar från backend ===
export type WorklogGenerateResponse = {
  success: boolean;

  companyId: number;
  companyName?: string | null;
  period?: { from?: string | null; to?: string | null };

  invoiceId?: number;
  fileName?: string;
  bytes?: number;
  sha256?: string;
  lang?: "en" | "sv";
 fileId?: string | number; 

  attached?: { attempted: boolean; ok?: boolean; invoiceNumber?: string };
  error?: string;
};



// === Batch-svar (om du använder batch senare) ===
export type WorklogBatchResponse = {
  results: Array<WorklogGenerateResponse & { companyId: number }>;
};

export type ToPdfResultType = {
  resultModalOpen: boolean;
  setResultModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  results: WorklogGenerateResponse[];
};
//------------------------------------------------------------

export type CustomersSendPrefs = {
  emails:string[]
  language:string
}

export type SendPdfConfirmPayload = {
  recipients: string[];
  newRecipients: string[];
  lang: "sv" | "en";
  saveNew: boolean;
  PdfId:string | number | undefined;
  companyId:number | undefined
};

export type SendOverlayState = {
  pdfId: string | number;
  message: string | boolean; 
};

export type RangeInvocie = {
  start:string | undefined
  end:string | undefined
  query?: string;
}