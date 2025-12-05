import { Card, CardHeader, CardTitle, CardContent} from "../ui/card";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import type { ApiUser } from "../../models/common";

const header = `
  relative !p-4 rounded-t-xl border-b bg-[var(--background)]
  border-[color-mix(in_oklch,var(--foreground)_12%,transparent)]
  shadow-sm overflow-hidden
  before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,var(--primary)_0,transparent_55%)] before:opacity-35
  after:absolute after:bottom-0 after:left-0 after:h-[3px] after:w-full after:bg-[var(--secondary)]
`;
type props = {
   user: ApiUser | null;
}

export const ProfileCard = ({ user }: props) => {
  return (
    <Card className="pb-3">
      <CardHeader className={header}>
        <CardTitle>Profile</CardTitle>
      </CardHeader>

      <CardContent className="grid gap-4 md:grid-cols-2 py-6">
        <div>
          <Label>Full name</Label>
          <Input value={user?.name ?? ""} readOnly />
        </div>

        <div>
          <Label>Email</Label>
          <Input value={user?.email ?? ""} readOnly />
        </div>

        <div>
          <Label>Role</Label>
          <Input value={user?.role ?? ""} readOnly />
        </div>

        <div>
          <Label>Organization</Label>
          <Input value={user?.tenantName ?? "—"} readOnly />
        </div>
      </CardContent>
    </Card>
  );
}
