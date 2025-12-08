import { Card, CardHeader, CardTitle, CardContent} from "../ui/card";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import type { ApiUser } from "../../models/common";


type props = {
   user: ApiUser | null;
}

export const ProfileCard = ({ user }: props) => {
  return (
    <Card className="pb-3">
      <CardHeader className="relative !p-4 rounded-t-xl border-b bg-[var(--background)]">
        <CardTitle>Profile</CardTitle>
      </CardHeader>

      <CardContent className="grid gap-4 md:grid-cols-2 py-6 ">
        <div>
          <Label htmlFor="profile-full-name">Full name</Label>
          <Input id="profile-full-name" value={user?.name ?? ""} readOnly className="border-var(--border) p-1" />
        </div>

        <div>
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={user?.email ?? ""} readOnly className="border-var(--border) p-1"/>
        </div>

        <div>
          <Label htmlFor="profile-role">Role</Label>
          <Input id="profile-role" value={user?.role ?? ""} readOnly className="border-var(--border) p-1"/>
        </div>

        <div>
          <Label htmlFor="profile-organization">Organization</Label>
          <Input id="profile-organization" value={user?.tenantName ?? "—"} readOnly className="border-var(--border) p-1"/>
        </div>
      </CardContent>
    </Card>
  );
}
