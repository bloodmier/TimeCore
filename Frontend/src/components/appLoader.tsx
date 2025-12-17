import { Loader2 } from "lucide-react";

export function AppLoader() {
  return (
    <div className="flex w-full min-w-full flex-col items-center justify-center gap-4">
      
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />

    
    </div>
  );
}
