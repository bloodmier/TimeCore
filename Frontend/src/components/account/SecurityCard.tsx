import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import type { FormEvent } from "react";

const header = `
  relative !p-4 rounded-xl border-b bg-[var(--background)]
`;

interface SecurityCardProps {
  showPasswordForm: boolean;
  togglePasswordForm: () => void;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  error: string | null;
  message: string | null;
}

export const SecurityCard = ({
  showPasswordForm,
  togglePasswordForm,
  currentPassword,
  newPassword,
  confirmPassword,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  loading,
  error,
  message,
}: SecurityCardProps) => {
  return (
    <Card className="mt-6">
      <CardHeader
        className={`${header} flex flex-row items-center justify-between gap-4`}
      >
        <div className="relative z-10">
          <CardTitle>Security</CardTitle>
          <CardDescription>
            Change your password while you're logged in.
          </CardDescription>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={togglePasswordForm}
          aria-expanded={showPasswordForm}
          className="relative z-10"
        >
          {showPasswordForm ? "Hide form" : "Change password"}
        </Button>
      </CardHeader>

      {showPasswordForm && (
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4 pt-4">
           
            {(error || message) && (
              <p
                className={`text-sm text-center rounded-2xl p-2 ${
                  error
                    ? "bg-red-500/80 text-white"
                    : "bg-green-500/80 text-white"
                }`}
              >
                {error ?? message}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => onCurrentPasswordChange(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => onNewPasswordChange(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => onConfirmPasswordChange(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pb-5">
              <p className="text-xs text-muted-foreground">
                Password must be at least 8 characters long.
              </p>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "Saving..." : "Change password"}
              </Button>
            </div>
          </form>
        </CardContent>
      )}
    </Card>
  );
};
