// src/helpers/proceedLogging.ts
/**
 * proceedLogging
 *
 * Shared logging utilities for long-running admin "proceed" operations,
 * such as invoice creation, PDF generation, and locking of billed data.
 *
 * This helper provides:
 * - A strongly typed log model for step-based workflows
 * - Normalization of Fortnox/backend errors into a consistent structure
 * - A simple append-only log helper with automatic timestamps
 *
 * The log output is intended to:
 * - Be shown live in the UI during processing
 * - Be readable and actionable for administrators
 * - Clearly indicate which step and which company an error belongs to
 *
 * The frontend does not interpret or recover from business errors here;
 * it only records and presents them. All validation and retry logic
 * remains backend-driven.
 */

/**
 * Logical steps used in the admin invoice "proceed" workflow.
 * These steps are used for progress reporting and UI grouping.
 */
export type ProceedStep =
  | "prepare"
  | "create-invoices"
  | "lock-hours"
  | "lock-items"
  | "generate-pdf"
  | "final";

/** Severity level for a log entry. */
export type LogLevel = "info" | "success" | "error";

/**
 * One log entry produced during a proceed operation.
 */
export type ProceedLog = {
  ts: number;               // Unix timestamp (ms)
  level: LogLevel;          // Severity of the entry
  step: ProceedStep;        // Workflow step
  companyId?: number;       // Optional company reference
  company?: string;         // Optional company display name
  message: string;          // Human-readable message
  meta?: any;               // Optional raw payload (debug / inspection)
};

/**
 * Aggregated summary returned after a proceed operation completes.
 * Used for high-level UI feedback.
 */
export type ProceedSummary = {
  createdCount: number;
  lockedHoursCount: number;
  lockedItemsCount: number;
  pdfQueuedCount: number;
  errorCount: number;
};

/**
 * Final result returned from a proceed operation.
 */
export type ProceedResult = {
  logs: ProceedLog[];
  summary: ProceedSummary;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a Fortnox or backend error into a consistent shape.
 *
 * The backend is expected to return structured errors, but this function
 * defensively checks several common locations to extract:
 * - HTTP status
 * - Fortnox error code (if available)
 * - Human-readable message
 *
 * This allows the UI to present meaningful error feedback
 * without coupling to backend error formats.
 */
export function normalizeFortnoxError(e: unknown) {
  const any = e as any;

  const status = any?.status ?? any?.response?.status;
  const body = any?.data ?? any?.response?.data;

  const code =
    body?.ErrorInformation?.code ??
    body?.error ??
    body?.Error ??
    body?.id ??
    undefined;

  const messageRaw =
    body?.ErrorInformation?.message ??
    body?.message ??
    any?.message ??
    "Unknown error";

  return {
    status,
    code,
    message: String(messageRaw),
    body,
  };
}

/**
 * Append a new log entry to the given log array.
 * Automatically adds a timestamp to ensure consistent ordering.
 */
export function pushLog(
  arr: ProceedLog[],
  entry: Omit<ProceedLog, "ts">
) {
  arr.push({ ts: Date.now(), ...entry });
}
