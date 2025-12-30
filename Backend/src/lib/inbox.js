import { callFortnoxApi } from "./fortnox.js";

/**
 * uploadPdfToInbox
 *
 * What it does:
 * - Uploads a PDF file to the Fortnox Inbox.
 * - Returns identifiers that can later be used to attach the file to
 *   invoices or other Fortnox entities.
 *
 * Parameters:
 * - filename:
 *   - The filename that will be shown in Fortnox (e.g. "worklog.pdf").
 *
 * - buffer:
 *   - A Buffer containing the raw PDF data.
 *
 * - path:
 *   - Optional Fortnox inbox path/folder.
 *   - Defaults to "inbox_kf".
 *
 * How it works:
 * 1) Builds a multipart/form-data payload using FormData.
 * 2) Appends the PDF buffer as a Blob with content type application/pdf.
 * 3) Sends a POST request to the Fortnox "inbox" endpoint.
 * 4) Reads the response and extracts:
 *    - File Id
 *    - ArchiveFileId (required for later attachment to invoices)
 * 5) Throws an error if the upload succeeds but Fortnox does not return
 *    an ArchiveFileId.
 *
 * Returns:
 * - An object with:
 *   - id: optional Fortnox file id (string or null)
 *   - archiveFileId: required identifier used when attaching the file
 *     to invoices or other entities in Fortnox
 */
export async function uploadPdfToInbox(
  filename,
  buffer,
  path = "inbox_kf"
) {
  // Build multipart/form-data payload
  const form = new FormData();
  form.append(
    "file",
    new Blob([buffer], { type: "application/pdf" }),
    filename
  );

  // Upload file to Fortnox inbox
  const r = await callFortnoxApi("inbox", { path }, "POST", form);

  // Fortnox responses can vary slightly in shape, so we normalize access
  const f = r?.File ?? r ?? {};
  const id = f.Id ?? f.id ?? null;
  const aid = f.ArchiveFileId ?? f.archiveFileId ?? null;

  // ArchiveFileId is required to later attach the file to an invoice
  if (!aid) {
    throw new Error(
      `Upload OK but missing ArchiveFileId in response: ${JSON.stringify(f)}`
    );
  }

  // Return normalized identifiers
  return {
    id: id ? String(id) : null,
    archiveFileId: String(aid),
  };
}
