// components/billing/BillingSelectionBar.tsx
import { Button } from "../ui/button";

type Props = {
  selectMode: boolean; 
  selectedCount: number;
  totalCount: number; 
  selectableCount?: number;
  onToggleSelectMode: () => void;
  onToggleAll: () => void; 
  onProceed: () => void; 
  onOpenGeneratePdfs?: () => void;
  canGeneratePdfs?: boolean;
  onShowAllPdfs?: (term: string) => void; 
};

export function BillingSelectionBar({
  selectMode,
  selectedCount,
  totalCount,
  selectableCount = totalCount,
  onToggleSelectMode,
  onToggleAll,
  onProceed,
  onOpenGeneratePdfs,
  canGeneratePdfs = true,
  onShowAllPdfs
}: Props) {
  const allSelectableChosen = selectedCount === selectableCount;
  const selectLabel = !selectMode
    ? "Select"
    : selectedCount > 0
      ? "Unselect"
      : "Cancel";
  const pdfDisabled =
    !selectMode || selectedCount === 0 || !canGeneratePdfs || !onOpenGeneratePdfs;
  return (
    <div className="mt-3 flex justify-end flex-wrap items-center gap-2">
      <Button variant="outline" className="mr-auto" onClick={() => onShowAllPdfs?.("")}>Show all pdf</Button>
      {selectMode && (
        <span className="text-sm text-muted-foreground">
          {selectedCount} selected of {totalCount}
        </span>
      )}
      <Button
        variant={selectMode ? "secondary" : "outline"}
        onClick={onToggleSelectMode}
      >
        {selectLabel}
      </Button>

      <Button
        variant="outline"
        disabled={!selectMode || totalCount === 0}
        onClick={onToggleAll}
      >
        {allSelectableChosen ? "Unselect all" : "Select all"}
      </Button>
       <Button
        variant="outline"
        disabled={pdfDisabled}
        onClick={onOpenGeneratePdfs}
      >
        Generate PDFs ({selectedCount})
      </Button>
      <Button
        variant="default"
        disabled={!selectMode || selectedCount === 0}
        onClick={onProceed}
      >
        Proceed ({selectedCount})
      </Button>
    </div>
  );
}
