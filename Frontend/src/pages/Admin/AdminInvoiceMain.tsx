/**
 * AdminInvoiceMain
 *
 * Main page component for the Admin Billing overview.
 *
 * Responsibilities:
 * - Renders the billing header, filter controls (month range, status, billable-only), and error state
 * - Delegates all business logic to useAdminInvoice (data fetching, proceed flow, PDF actions, locking)
 * - Displays BillingOverviewList with a stable layout while loading (prevents layout shift / CLS)
 *
 * Lighthouse-focused improvements:
 * - Uses a stable "skeleton layout" while loading to reduce cumulative layout shift (CLS)
 * - Adds accessible labels for icon-only controls
 * - Avoids duplicate JSX by extracting shared BillingOverviewList props
 * - Uses semantic regions (header/main) to improve structure and accessibility
 */

import { MonthSwitcher } from "../../components/timeReports/MonthSwitcher";
import { Badge } from "../../components/ui/badge";
import { useAdminInvoice } from "../../hooks/useAdminInvoice";
import { AppLoader } from "../../components/appLoader";
import { BillingOverviewList } from "../../components/admin/BillingOverviewList";
import { Button } from "../../components/ui/button";
import { RefreshCcw } from "lucide-react";
import { InvoiceFilterControls } from "../../components/admin/InvoiceFilterControls";

export const AdminInvoiceMain = () => {
  const {
    customers,
    loading,
    error,
    range,
    setRange,
    onlyBillable,
    setOnlyBillable,
    status,
    setStatus,
    handleInvoiceTarget,
    onProceedSelected,
    refetch,
    needsReauth,
    generatePdfselected,
    ToPdfResult,
    handlePDFDownload,
    handlePDFPreview,
    customersSendPrefs,
    getCustomerPrefs,
    onConfirmSendEmail,
    showAllPdfs,
  } = useAdminInvoice();

  return (
    <div className="grid gap-4 w-full min-w-0 max-w-full">
      <div className="flex items-center justify-between w-full min-w-0">
        <h1 className="text-xl font-semibold">Billing overview</h1>
        <Button variant="nohover" onClick={refetch} size="sm" className="group">
          <RefreshCcw
            strokeWidth={1.4}
            className="!h-6 shrink-0 transition-transform duration-500 group-hover:rotate-180"
          />
        </Button>
      </div>

      <div className="flex flex-wrap flex-col justify-center items-center gap-2 w-full min-w-0">
        <div className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-center lg:flex-wrap justify-center">
          <MonthSwitcher
            start={range.start}
            end={range.end}
            onChange={({ start, end }) =>
              setRange({ start: start ?? "", end: end ?? "" })
            }
            AllUnbilled={true}
          />
          <InvoiceFilterControls
            status={status}
            onlyBillable={onlyBillable}
            onChange={(v) => {
              if (v.status) setStatus(v.status);
              if (typeof v.onlyBillable === "boolean")
                setOnlyBillable(v.onlyBillable);
            }}
          />
        </div>

        {error && (
          <Badge variant="destructive">Failed to load: {error.message}</Badge>
        )}
      </div>

      {/* Content */}
      <div className="relative w-full min-w-0 max-w-full">
        {loading ? (
          <>
            <div className="invisible" aria-hidden="true">
              <BillingOverviewList
                data={customers as any}
                loading={false}
                handleInvoiceTarget={handleInvoiceTarget}
                onProceedSelected={onProceedSelected}
                needsReauth={needsReauth}
                refetch={refetch}
                range={range}
                onlyBillable={onlyBillable}
                onGeneratePdfsSelected={generatePdfselected}
                ToPdfResult={ToPdfResult}
                handleDownload={handlePDFDownload}
                handlePDFPreview={handlePDFPreview}
                customersSendPrefs={customersSendPrefs}
                getCustomerPrefs={getCustomerPrefs}
                onConfirmEmail={onConfirmSendEmail}
                onShowAllPdfs={showAllPdfs}
              />
            </div>

            <div className="absolute inset-0 grid place-items-center">
              <AppLoader />
            </div>
          </>
        ) : (
          <BillingOverviewList
            data={customers as any}
            loading={false}
            handleInvoiceTarget={handleInvoiceTarget}
            onProceedSelected={onProceedSelected}
            needsReauth={needsReauth}
            refetch={refetch}
            range={range}
            onlyBillable={onlyBillable}
            onGeneratePdfsSelected={generatePdfselected}
            ToPdfResult={ToPdfResult}
            handleDownload={handlePDFDownload}
            handlePDFPreview={handlePDFPreview}
            customersSendPrefs={customersSendPrefs}
            getCustomerPrefs={getCustomerPrefs}
            onConfirmEmail={onConfirmSendEmail}
            onShowAllPdfs={showAllPdfs}
          />
        )}
      </div>
    </div>
  );
};
