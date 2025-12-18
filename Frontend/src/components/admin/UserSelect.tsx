import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import type { IUser } from "../../models/timeReports";
import { Label } from "../../components/ui/label";
import { useId } from "react";

type Props = {
  users: IUser[];
  selectedUserId: number | null;
  onSelect: (user: IUser | null) => void; 
  includeAll?: boolean;
  className?: string;
};

export function UserSelect({
  users,
  onSelect,
  includeAll = true,
  className,
  selectedUserId,
}: Props) {
  const labelId = useId();
  const value = selectedUserId == null ? "all" : String(selectedUserId);

  const handleChange = (v: string) => {
    if (v === "all") return onSelect(null);
    const u = users.find((x) => String(x.id) === v) ?? null;
    onSelect(u);
  };

  return (
    <div className="space-y-1">
      <Label id={labelId}>Filter by user</Label>

      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger
          className={className ?? "w-full"}
          aria-labelledby={labelId}
        >
          <SelectValue placeholder="Select user" />
        </SelectTrigger>

        <SelectContent>
          {includeAll && <SelectItem value="all">All</SelectItem>}
          {users.map((u) => (
            <SelectItem key={u.id} value={String(u.id)}>
              {u.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
