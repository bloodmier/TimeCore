// src/components/time/TimeRegisterDraftsPanel.tsx
import React from "react";
import { Button } from "../../components/ui/button";
import { DraftsSortBar } from "../../components/timeReport/DraftsortBar";
import { summarizeDraftItems } from "../../helpers/TimeHelpersfunctions";
import type { AnyItem, Entry } from "../../models/Draft";

type Props = {
  drafts: Entry[];
  filters: any;
  dispatch: React.Dispatch<any>;
  editingDraftId: number | null;
  submitting: boolean;
  serverError: string | null;
  success: string | null;
  onDuplicateDraft: (draft: Entry) => void;
  onEditDraft: (draft: Entry) => void;
  onRemoveDraft: (draftId: number | undefined | null) => void;
  onSubmitAll: () => void;
  clearDrafts: () => void;
};

export const TimeRegisterDraftsPanel: React.FC<Props> = ({
  drafts,
  filters,
  dispatch,
  editingDraftId,
  submitting,
  serverError,
  success,
  onDuplicateDraft,
  onEditDraft,
  onRemoveDraft,
  onSubmitAll,
  clearDrafts,
}) => {
  const totalHours = drafts
    .reduce((sum, x) => sum + x.hours, 0)
    .toFixed(2);

  return (
    <section className="w-full" aria-label="Draft time reports">
      <div className="md:col-span-2 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">Drafts (not sent)</h2>
          <div className="text-sm">
            Total: <span className="font-medium">{totalHours} h</span>
          </div>
        </div>

        {drafts.length > 0 && (
          <DraftsSortBar filters={filters} dispatch={dispatch} />
        )}

        <div
          className={`rounded-lg border ${
            drafts.length ? "divide-y" : "p-4 text-sm text-muted-foreground"
          }`}
        >
          {drafts.length === 0 ? (
            <>No lines – add from form</>
          ) : (
            drafts.map((it: Entry) => {
              const articleLine =
                summarizeDraftItems(it.items as AnyItem[]) ||
                (it as any).hardware ||
                "";

              const key = it.draft_id ?? it.id;

              return (
                <div
                  key={key}
                  className={`p-3 grid gap-2 md:grid-cols-[1fr_auto] md:items-center rounded-xl border mb-2 m-2 ${
                    editingDraftId === it.draft_id ? "opacity-50" : ""
                  } ${it.billable ? "" : "bg-orange-600/20"}`}
                >
                  <div className="space-y-1">
                    <div className="text-sm">
                      <span className="font-medium">{it.customerName}</span> •{" "}
                      {it.category_name} • {it.hours} h • {it.date}
                    </div>
                    <div className="text-sm">{it.workDescription}</div>
                    <div className="text-xs text-muted-foreground">
                      {it.note ? (
                        <>
                          Note: {it.note}
                          {articleLine && (
                            <div>
                              Articles{": "}🧰 {articleLine}
                            </div>
                          )}
                        </>
                      ) : articleLine ? (
                        <>
                          Articles: 🧰 {articleLine}
                        </>
                      ) : (
                        "No note"
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {!it.billable ? "Not billable" : ""}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end md:flex-col lg:flex-row">
                    <Button
                      type="button"
                      onClick={() => onDuplicateDraft(it)}
                    >
                      Duplicate
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => onEditDraft(it)}
                    >
                      Edit
                    </Button>

                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => onRemoveDraft(it.draft_id)}
                    >
                      Remove
                    </Button>
                  </div>
                  {editingDraftId === it.draft_id && (
                    <div className="text-xs text-muted-foreground">
                      Editing…
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <Button
          type="button"
          onClick={onSubmitAll}
          disabled={!drafts.length || submitting}
        >
          {submitting ? "Sending…" : "Send all"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={clearDrafts}
          disabled={!drafts.length || submitting}
        >
          Empty list
        </Button>
      </div>

      {serverError && (
        <p className="text-sm text-red-600 mt-2" role="alert">
          {serverError}
        </p>
      )}
      {success && (
        <p className="text-sm text-green-600 mt-2" role="status">
          {success}
        </p>
      )}
    </section>
  );
};
