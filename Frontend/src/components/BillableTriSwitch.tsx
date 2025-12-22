import { Label } from "./ui/label";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";

type Tri = "false" | "all" | "true";

/**
 * BillableTriSwitch
 *
 * Three-state toggle:
 * - "false" = No
 * - "all"   = All
 * - "true"  = Yes
 *
 * This component is controlled: the parent owns the state and passes `value`.
 * That avoids UI desync issues when the parent resets/updates filters.
 */
export function BillableTriSwitch({
  value = "all",
  onChange,
  label = "Billable",
}: {
  value?: Tri;
  onChange: (v: Tri) => void;
  label?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(val) => {
          if (!val) return; // ToggleGroup can send "" when unselecting
          onChange(val as Tri);
        }}
        className="inline-flex overflow-hidden rounded-full border"
      >
        <ToggleGroupItem
          value="false"
          className="rounded-none first:rounded-l-full -ml-px first:ml-0 data-[state=on]:bg-red-500 data-[state=on]:text-white px-3 py-1"
        >
          No
        </ToggleGroupItem>

        <ToggleGroupItem
          value="all"
          className="rounded-none -ml-px data-[state=on]:bg-muted data-[state=on]:text-foreground px-3 py-1"
        >
          All
        </ToggleGroupItem>

        <ToggleGroupItem
          value="true"
          className="rounded-none last:rounded-r-full -ml-px data-[state=on]:bg-green-500 data-[state=on]:text-white px-3 py-1"
        >
          Yes
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
