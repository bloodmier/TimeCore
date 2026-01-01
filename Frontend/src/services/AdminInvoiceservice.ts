// src/services/AdminInvoiceservice.ts
// Service for admin invoice workflows: collect invoice data, create Fortnox invoices,
// lock billed time/items, generate/queue worklog PDFs, and download/preview/send PDFs.
// Uses cookie-based auth via baseService (withCredentials + refresh interceptor).

import type {
  CollectAllEnvelope,
  CollectRequest,
  CustomersSendPrefs,
  FortnoxCreateResult,
  LockAndMarkItemsRequest,
  LockAndMarkRequest,
  RangeInvocie,
  SendPdfConfirmPayload,
  WorklogGenerateRequest,
  WorklogGenerateResponse,
} from "../models/Invoice";

import { getData, postData, apiClient } from "../services/basicservice";

export const AdminInvoiceService = {
  // ----- Invoice collection / locking -----

  collectAllInvoiceData: (payload: CollectRequest) =>
    postData<CollectAllEnvelope>("/invoice/collect", payload),

  sendInvoiceToFortKnox: (payload: any) =>
    postData<FortnoxCreateResult>("/fortnox/invoices", payload),

  lockAndMarkBilled: (payload: LockAndMarkRequest) =>
    postData("/invoice/lock-and-mark", payload),

  lockAndMarkItems: (payload: LockAndMarkItemsRequest) =>
    postData("/invoice/lock-and-mark-items", payload),

  // ----- Worklog PDF generation / queue -----

  createWorklogPdf: (payload: WorklogGenerateRequest) =>
    postData<WorklogGenerateResponse>("/worklogpdf/generate", payload),

  sendToWorklogPdfQueue: (payload: any) =>
    postData("/worklogpdf/queue", payload),

  getWorklogQueueStatus: () =>
    getData("/worklogpdf/queue/status"),

  // ----- Download / preview as Blob -----

  getDownloadPdf: async (id: number): Promise<{ blob: Blob; fileName: string }> => {
    const response = await apiClient.get(`/worklogpdf/${id}/pdf`, {
      params: { download: 1 },
      responseType: "blob",
    });

    const disposition = response.headers["content-disposition"];
    let fileName = `worklog_${id}.pdf`;

    if (disposition) {
      const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/);
      const quotedMatch = disposition.match(/filename="([^"]+)"/);
      if (utfMatch?.[1]) fileName = decodeURIComponent(utfMatch[1]);
      else if (quotedMatch?.[1]) fileName = quotedMatch[1];
    }

    // fallback if backend sends custom header
    const xName = response.headers["x-filename"];
    if (xName) fileName = xName;

    return { blob: response.data, fileName };
  },

  getPreviewPdf: async (id: number): Promise<{ blob: Blob; fileName: string }> => {
    const response = await apiClient.get(`/worklogpdf/${id}/pdf`, {
      responseType: "blob",
    });

    const disposition = response.headers["content-disposition"];
    let fileName = `worklog_${id}.pdf`;

    if (disposition) {
      const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/);
      const quotedMatch = disposition.match(/filename="([^"]+)"/);
      if (utfMatch?.[1]) fileName = decodeURIComponent(utfMatch[1]);
      else if (quotedMatch?.[1]) fileName = quotedMatch[1];
    }

    return { blob: response.data, fileName };
  },

  // ----- Customer prefs / send -----

  getCustomerSendPrefs: (customerId: number) =>
    getData<CustomersSendPrefs>(`/worklogpdf/getEmails/${customerId}`),

  sendPdfToCustomer: async (payload: SendPdfConfirmPayload) => {
    const res = await postData<{ message: string }>(
      "/worklogpdf/sendPDFToCustomer",
      payload
    );
    return res.message;
  },

  getAllPdfInRange: (range: RangeInvocie) =>
    postData<WorklogGenerateResponse[]>("/worklogpdf/getpdfsInrange", range),
};
