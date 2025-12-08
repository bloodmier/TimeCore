import type { FormEvent } from "react";
import type { ApiUser } from "../../models/common";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";
import { Camera } from "lucide-react";

interface AccountAvatarSectionProps {
  user: ApiUser | null;
  previewUrl: string | null;
  selectedFile: File | null;
  saveMessage: string | null;
  updating: boolean;
  loading: boolean;
  getInitials: () => string;
  onAvatarClick: () => void;
  onSave: (e: FormEvent<HTMLFormElement>) => void;
}


export const AccountAvatarSection = ({
  previewUrl,
  selectedFile,
  saveMessage,
  updating,
  getInitials,
  onAvatarClick,
  onSave,
}:AccountAvatarSectionProps) => {
  return (
    <div className="flex justify-between items-start gap-4">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Account overview</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Manage your personal TimeCore account settings.
        </p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={onAvatarClick}
          className="relative rounded-full border border-border p-1"
          aria-label="Change profile picture"
        >
          <Avatar className="h-28 w-28">
            {previewUrl && (
              <AvatarImage src={previewUrl} alt="Profile picture" />
            )}
            <AvatarFallback>{getInitials()}</AvatarFallback>
          </Avatar>

          <span className="pointer-events-none absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-background shadow-md ring-1 ring-border">
            <Camera className="h-4 w-4" />
          </span>
        </button>

        <p className="text-[11px] mb-3 text-muted-foreground">
          Click your picture to select a new one.
        </p>

        {selectedFile && (
          <form onSubmit={onSave} className="w-full flex flex-col items-center">
            <Button size="sm" className="w-full" disabled={updating}>
              {updating ? "Saving..." : "Save picture"}
            </Button>
            {saveMessage && (
              <p className="text-[11px] text-muted-foreground">{saveMessage}</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
