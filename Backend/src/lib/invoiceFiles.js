import { callFortnoxApi } from "./fortnox.js";

/**
 * connectFileToInvoice
 *
 * What it does:
 * - Connects an uploaded file (from Fortnox inbox) to a Fortnox invoice.
 * - The file must already exist in Fortnox and have an ArchiveFileId.
 *
 * Parameters:
 * - file:
 *   - Either a string containing the archiveFileId, or
 *   - An object that includes an `archiveFileId` property (e.g. response from inbox upload).
 *
 * - invoiceNumber:
 *   - The Fortnox invoice identifier the file should be attached to.
 *   - Can be numeric or string; it is normalized before sending.
 *
 * - includeOnSend:
 *   - Boolean flag that controls whether the attached file should be included
 *     automatically when the invoice is sent from Fortnox.
 *
 * How it works:
 * 1) Extracts the archiveFileId from the input.
 * 2) Normalizes the invoice number into an entityId accepted by Fortnox.
 * 3) Builds a FileAttachments payload with:
 *    - entityType "F" (Fortnox invoice)
 *    - fileId (archiveFileId)
 *    - includeOnSend flag
 * 4) Sends a POST request to Fortnox's file attachment API.
 *
 * Returns:
 * - The parsed response from the Fortnox API call.
 */
export async function connectFileToInvoice(
  file,
  invoiceNumber,
  includeOnSend = false
) {
  // Resolve archiveFileId from either a string or an object
  const archiveFileId =
    typeof file === "string" ? file : file?.archiveFileId;

  if (!archiveFileId) {
    throw new Error(
      "connectFileToInvoice: missing archiveFileId (use the ArchiveFileId from inbox upload)"
    );
  }

  // Normalize invoice identifier for Fortnox
  const entityId = Number.isFinite(Number(invoiceNumber))
    ? Number(invoiceNumber)
    : String(invoiceNumber);

  // Fortnox expects an array of attachment instructions
  const body = [
    {
      entityId,               // Invoice identifier in Fortnox
      entityType: "F",         // "F" = Invoice in Fortnox
      fileId: String(archiveFileId),
      includeOnSend: !!includeOnSend,
    },
  ];

  // Send attachment request to Fortnox
  return callFortnoxApi(
    "api/fileattachments/attachments-v1",
    {},
    "POST",
    body
  );
}
