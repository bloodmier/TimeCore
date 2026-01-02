import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  Download,
  MailPlus,
  Search, 
} from "lucide-react";
import { SendPdfDialog } from "./SendPdfDialog";
import type {
  CustomersSendPrefs,
  SendOverlayState,
  SendPdfConfirmPayload,
  WorklogGenerateResponse,
} from "../../models/Invoice";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "../ui/input"; 

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  results: WorklogGenerateResponse[];
  title?: string;
  onOpenLibrary?: () => void;
  handleDownload: (Pdfid: string | number | undefined) => void;
  handlePDFPreview: (Pdfid: string | number | undefined) => void;
  customersSendPrefs: CustomersSendPrefs;
  getCustomerPrefs: (id: number) => void;
  onConfirmEmail?: (payload: SendPdfConfirmPayload) => Promise<string> | string;
  onSearchPdfs?: (term: string) => void; 
};

export function WorklogResultModal({
  open,
  onOpenChange,
  results,
  title = "PDF generation results",
  handleDownload,
  handlePDFPreview,
  customersSendPrefs,
  getCustomerPrefs,
  onConfirmEmail,
  onSearchPdfs,
}: Props) {
  const stats = useMemo(() => {
    const total = results.length;
    const ok = results.filter((r) => r.success && !r.error).length;
    const failed = total - ok;
    const manualTried = results.filter((r) => r.attached?.attempted).length;
    const manualOk = results.filter(
      (r) => r.attached?.attempted && r.attached?.ok
    ).length;
    return { total, ok, failed, manualTried, manualOk };
  }, [results]);
  console.log(results);
  
  const [sentSuccess, setSentSuccess] = useState<SendOverlayState | null>(null);
  const [openSendPopup, setOpenSendPopup] = useState<boolean>(false);
  const [sendTarget, setSendTarget] = useState<{
    companyId: number;
    invoiceId?: number | string;
    fileName?: string;
    pdfId: string | number;
  } | null>(null);


  const [search, setSearch] = useState("");

const lastSentRef = useRef<string>("");
const timeoutRef = useRef<number | null>(null);

 const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  setSearch(value);
};

useEffect(() => {
  if (!onSearchPdfs) return;
  if (!open) return;

  const term = search.trim();


  if (term === lastSentRef.current) return;

  if (timeoutRef.current !== null) {
    window.clearTimeout(timeoutRef.current);
  }

  timeoutRef.current = window.setTimeout(() => {
    lastSentRef.current = term;
    onSearchPdfs(term);
  }, 400);

  return () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
  };
}, [search, onSearchPdfs, open]);

  const fmtBytes = (b?: number) => {
    if (!b && b !== 0) return "—";
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  const Row = ({ r, idx }: { r: WorklogGenerateResponse; idx: number }) => {
    const id = r.invoiceId ?? r.fileId ?? idx;
    const showid = r.fileId ?? idx; 
    const ok = !!(r.success && !r.error);

    const HandleSend = (companyId: number) => {
      getCustomerPrefs(companyId);
      setOpenSendPopup(true);
      setSendTarget({
        companyId,
        invoiceId: r.invoiceId ?? r.fileId,
        fileName: r.fileName,
        pdfId: id,
      });
    };

    const [showOverlay, setShowOverlay] = useState(false);

    useEffect(() => {
      if (!sentSuccess) return;

      const matchesId = String(sentSuccess.pdfId) === String(id);
      const isOk = !!sentSuccess.message;

      if (matchesId && isOk) {
        setShowOverlay(true);
        const t = setTimeout(() => {
          setShowOverlay(false);
        }, 1300);
        return () => clearTimeout(t);
      }
    }, [sentSuccess, id]);




  
    return (
      <div className="relative rounded-md border p-3 bg-background overflow-hidden">
        <AnimatePresence>
          {showOverlay && (
            <motion.div
              initial={{
                x: "100%",
                opacity: 0,
                borderRadius: "50px",
                scaleX: 0.5,
              }}
              animate={{
                x: "0%",
                opacity: 1,
                borderRadius: "0.75rem",
                scaleX: 1,
              }}
              exit={{
                opacity: 0,
              }}
              transition={{
                duration: 0.9,
                ease: [0.25, 0.8, 0.25, 1],
              }}
              className="absolute inset-0 bg-gradient-to-r from-green-500/40 to-green-900/60 flex items-center justify-center z-10 shadow-xl backdrop-blur-sm"
            >
              <motion.span
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="text-white text-lg font-semibold tracking-wide drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]"
              >
                Mail successfully sent
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-start justify-between gap-3 relative z-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium break-all">
                {r.fileName || `PDF #${id}`}
              </span>
              {ok ? (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> OK
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3.5 w-3.5" /> Failed
                </Badge>
              )}
            </div>

            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
              <span>ID: {String(showid)}</span>
              <span>•</span>
              <span>Size: {fmtBytes(r.bytes)}</span>
              {r.lang ? (
                <>
                  <span>•</span>
                  <span>Lang: {r.lang.toUpperCase()}</span>
                </>
              ) : null}
              {r.attached?.attempted ? (
                <>
                  <span>•</span>
                  {r.attached.ok ? (
                    <Badge variant="outline" className="h-5">
                      Manual #{r.attached.invoiceNumber}
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="h-5">
                      Manual attach failed
                    </Badge>
                  )}
                </>
              ) : null}

              {r.error ? (
                <>
                  <span>•</span>
                  <span className="text-red-600">Error: {r.error}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePDFPreview(id)}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              View
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload(id)}
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => HandleSend(r.companyId)}
            >
              <MailPlus className="h-4 w-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[95vw] md:max-w-[900px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Summary + Search */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Total: {stats.total}</Badge>
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-4 w-4" /> OK: {stats.ok}
            </Badge>
            {stats.failed > 0 ? (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-4 w-4" /> Failed: {stats.failed}
              </Badge>
            ) : null}
            {stats.manualTried > 0 ? (
              <Badge variant="outline">
                Manual: {stats.manualOk}/{stats.manualTried}
              </Badge>
            ) : null}
          </div>

          {/* 🔍 Search input */}
          <div className="w-full sm:w-auto">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={handleSearchChange}
                placeholder="by name, ID or invoice number"
                className="pl-8 h-8 w-full sm:w-64"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* List */}
        <div className="max-h-[55vh] overflow-auto space-y-2 scrollbar-dark h-[55vh]">
          {results.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">
              No items.
            </div>
          ) : (
            results.map((r, i) => (
              <Row
                key={(r.invoiceId ?? r.fileId ?? i).toString()}
                r={r}
                idx={i}
              />
            ))
          )}
        </div>

        <SendPdfDialog
          open={openSendPopup}
          onOpenChange={setOpenSendPopup}
          title={`Send PDF${
            sendTarget?.invoiceId ? ` – Invoice #${sendTarget.invoiceId}` : ""
          }`}
          subtitle={sendTarget?.fileName}
          initialRecipients={customersSendPrefs.emails}
          defaultLang={customersSendPrefs.language}
          onConfirmEmail={onConfirmEmail}
          PdfId={sendTarget?.pdfId}
          companyId={sendTarget?.companyId}
          setSentSuccess={setSentSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
