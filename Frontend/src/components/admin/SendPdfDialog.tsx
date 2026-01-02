import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../ui/select";
import { X } from "lucide-react";
import type { SendOverlayState, SendPdfConfirmPayload } from "../../models/Invoice";

type Lang = "sv" | "en";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  subtitle?: string;
  initialRecipients?: string[];
  defaultLang?: string;
  defaultSaveNew?: boolean;
  onConfirmEmail?: (payload:SendPdfConfirmPayload) => Promise<string> | string;
  PdfId?: string | number
  companyId?:number
  setSentSuccess:Dispatch<SetStateAction<SendOverlayState | null>>;
};

function toLang(v?: string): Lang {
  return v === "en" ? "en" : "sv";
}

export function SendPdfDialog({
  open,
  onOpenChange,
  title = "Send PDF",
  subtitle,
  initialRecipients = [],
  defaultLang = "sv",
  defaultSaveNew = true,
  onConfirmEmail,
  PdfId,
  companyId,
  setSentSuccess
}: Props) {

  const savedOptions = useMemo(
    () =>
      Array.from(
        new Set(
          initialRecipients
            .map((e) => (e ?? "").trim().toLowerCase())
            .filter(Boolean)
        )
      ),
    [initialRecipients]
  );

  const [selectedSaved, setSelectedSaved] = useState<string>("");
  const [input, setInput] = useState("");
  const [manual, setManual] = useState<string[]>([]);
  const [lang, setLang] = useState<Lang>(toLang(defaultLang));
  const [saveNew, setSaveNew] = useState<boolean>(defaultSaveNew);

  

  useEffect(() => {
    setLang(toLang(defaultLang));
    setSaveNew(defaultSaveNew);
  }, [defaultLang, defaultSaveNew]);

  const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  const normalize = (s: string) => s.trim().toLowerCase();

  const allRecipients = useMemo(
    () => Array.from(new Set(manual.map(normalize).filter(isEmail))),
    [manual]
  );

  function addRecipients() {
    const typed = input
      .split(/[,;\s]+/)
      .map(normalize)
      .filter(isEmail);

    const fromSaved =
      selectedSaved && isEmail(normalize(selectedSaved))
        ? [normalize(selectedSaved)]
        : [];

    const next = Array.from(new Set([...manual, ...typed, ...fromSaved]));
    setManual(next);
    setInput("");
    setSelectedSaved("");
  }

  function removeManual(email: string) {
    setManual((m) => m.filter((x) => x !== email));
  }

  async function handleConfirm() {
    const savedSet = new Set(savedOptions);
    const newRecipients = allRecipients.filter((r) => !savedSet.has(r));
    
    const payload = {
      recipients: allRecipients,
      newRecipients: newRecipients,
      lang,
      saveNew,
      PdfId,
      companyId
    };
 
    if (!onConfirmEmail) {
      onOpenChange(false);
      return;
    }

   const res = await onConfirmEmail(payload);
    setSentSuccess({ pdfId: payload.PdfId!, message: res || true })
    onOpenChange(false);
  }

  const addDisabled =
    !input.trim() && !(selectedSaved && isEmail(normalize(selectedSaved)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
        </DialogHeader>

        <div className="space-y-5">
          {/* Multifält: fritext + saved dropdown + Add */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Add recipient(s)</div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="email1@example.com, email2@example.com"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" ? addRecipients() : undefined
                }
              />

              <div className="flex gap-2">
                {savedOptions.length > 0 && (
                  <Select
                    value={selectedSaved}
                    onValueChange={setSelectedSaved}
                  >
                    <SelectTrigger className="min-w-[220px]">
                      <SelectValue placeholder="Pick saved email…" />
                    </SelectTrigger>
                    <SelectContent>
                      {savedOptions.map((e) => (
                        <SelectItem key={e} value={e}>
                          {e}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  size="sm"
                  onClick={addRecipients}
                  disabled={addDisabled}
                >
                  Add
                </Button>
              </div>
            </div>

            {manual.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {manual.map((email) => (
                  <Badge
                    key={email}
                    variant="outline"
                    className="text-xs flex items-center gap-1"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeManual(email)}
                      className="ml-1 inline-flex"
                      aria-label={`Remove ${email}`}
                      title="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          <Separator />

          {/* Options */}
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={saveNew}
                onCheckedChange={(v) => setSaveNew(Boolean(v))}
              />
              Save newly added recipients to this customer
            </label>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Language:</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={lang === "sv" ? "default" : "outline"}
                  onClick={() => setLang("sv")}
                >
                  SV
                </Button>
                <Button
                  size="sm"
                  variant={lang === "en" ? "default" : "outline"}
                  onClick={() => setLang("en")}
                >
                  EN
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Total recipients: {allRecipients.length}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={allRecipients.length === 0}>
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
