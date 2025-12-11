import { useState } from "react";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { ScrollArea } from "../ui/scroll-area";
import { Plus, Trash2 } from "lucide-react";
import type { LaborTemplate } from "../../models/labortemplate";

interface Props {
  laborTemplates: LaborTemplate[];
  currentTemplateId: number | null;
  workDescription: string;
  onChangeTemplateId: (id: number | null) => void;
  onChangeWorkDescription: (value: string) => void;
  onCreateTemplate: (name: string, description: string) => Promise<void>;
  onDeleteTemplate: (id: number) => Promise<void>;
}

export const LaborTemplateQuickFill: React.FC<Props> = ({
  laborTemplates,
  currentTemplateId,
  workDescription,
  onChangeTemplateId,
  onChangeWorkDescription,
  onCreateTemplate,
  onDeleteTemplate,
}) => {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openSaveDialog = () => {
    setError(null);
    setNewName("");
    setNewDescription(workDescription ?? "");
    setSaveDialogOpen(true);
  };

  const handleSave = async () => {
    if (!newName.trim()) {
      setError("Name is required.");
      return;
    }
    if (!newDescription.trim()) {
      setError("Description is required.");
      return;
    }

    try {
      setSaving(true);
      await onCreateTemplate(newName.trim(), newDescription.trim());
      setSaveDialogOpen(false);
    } catch (err) {
      console.error(err);
      setError("Failed to save quick fill. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      setDeletingId(id);
      await onDeleteTemplate(id);
      if (currentTemplateId === id) {
        onChangeTemplateId(null);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleSelect = (val: string) => {
    const id = val ? Number(val) : null;
    onChangeTemplateId(id);

    if (id !== null) {
      const tmpl = laborTemplates.find((t) => t.id === id);
      if (tmpl) {
        onChangeWorkDescription(tmpl.extended_description);
      }
    }
  };

  return (
    <>
      <div className="mb-1 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="workTemplate">Quick fill for labor</Label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={openSaveDialog}
              aria-label="Save current labor description as quick fill"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setManageDialogOpen(true)}
          >
            Manage
          </Button>
        </div>

        <Select
          onValueChange={handleSelect}
          value={currentTemplateId !== null ? String(currentTemplateId) : ""}
        >
          <SelectTrigger id="workTemplate" aria-label="Labor template">
            <SelectValue placeholder="Choose labor template…" />
          </SelectTrigger>
          <SelectContent>
            {laborTemplates.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Save dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save quick fill</DialogTitle>
            <DialogDescription>
              Save this labor description so you can reuse it later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="quickfill-name">Name</Label>
              <Input
                id="quickfill-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Short name"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="quickfill-description">Description</Label>
              <Textarea
                id="quickfill-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={4}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSaveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save quick fill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage quick fills</DialogTitle>
            <DialogDescription>
              Remove quick fills you no longer need.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-64 pr-2">
            <div className="space-y-2">
              {laborTemplates.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  You have no quick fills yet.
                </p>
              )}

              {laborTemplates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-2 rounded-xl border p-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {t.extended_description}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-1 h-7 w-7"
                    onClick={() => handleDelete(t.id)}
                    aria-label={`Delete quick fill ${t.name}`}
                    disabled={deletingId === t.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setManageDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
