import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { Button } from "../ui/button";

export type InvoiceStatus = "unbilled" | "billed" | "all";

type Props = {
  status: InvoiceStatus;
  onlyBillable: boolean;
  onChange: (v: { status?: InvoiceStatus; onlyBillable?: boolean }) => void;
  onApply?: () => void;
  showApplyButton?: boolean;
};

export const InvoiceFilterControls: React.FC<Props> = ({
  status,
  onlyBillable,
  onChange,
  onApply,
  showApplyButton = false,
}) => {
  return (
    <div className="flex w-full min-w-0 flex-wrap items-end justify-center gap-3">
      <div className="flex min-w-0 flex-col">
        <Label className="text-xs">Status</Label>

        <Select
          value={status}
          onValueChange={(v: InvoiceStatus) => onChange({ status: v })}
        >
          <SelectTrigger className="w-full sm:w-40 min-w-0">
            <SelectValue placeholder="Status" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="unbilled">Unbilled</SelectItem>
            <SelectItem value="billed">Billed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <Switch
          id="onlyBillable"
          checked={onlyBillable}
          onCheckedChange={(v) => onChange({ onlyBillable: !!v })}
        />
        <Label htmlFor="onlyBillable" className="whitespace-nowrap">
          Only billable
        </Label>
      </div>

      {showApplyButton && (
        <Button size="sm" onClick={onApply} className="shrink-0">
          Apply
        </Button>
      )}
    </div>
  );
};
