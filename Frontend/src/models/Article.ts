export interface Category {
  id: number;
  name: string;
}

export interface Article {
  id: number;
  art_nr?: string | null;
  name: string;
  description?: string | null;
  purchase_price?: number | null;
}

export interface ReportItemInput {
  articleId?: number | null;   
  description: string;         
  amount: number;             
  purchasePrice?: number | null;
}

export interface TimeReportItem {
  id: number;
  time_report_id: number;
  article_id: number | null;
  amount: number | null;
  description: string;
  articleName?: string | null;
  articlePrice?: number | null;
  articleUnit?: string | null;
}
