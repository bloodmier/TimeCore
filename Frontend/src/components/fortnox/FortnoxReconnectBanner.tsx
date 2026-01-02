import { Button } from "../ui/button";
import { openFortnoxPopup } from "../../lib/fortnoxPopup";


export function FortnoxReconnectBanner({ needsReauth }: { needsReauth: boolean }) {
  if (!needsReauth) return null;

  const handleReconnect = async () => {

    try {
        
      await openFortnoxPopup();
      // Här kan du sedan trigga omstatus, t.ex. refetch Fortnox-status
      console.log("✅ Fortnox reauthorized!");
    } catch (err) {
      console.error("Fortnox reconnect failed:", err);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-md bg-amber-100 text-amber-900 border border-amber-300 px-3 py-2 mb-2">
      <span className="text-sm font-medium">
        Fortnox connection expired. Please reconnect.
      </span>
      <Button size="sm" onClick={handleReconnect}>
        Reconnect Fortnox
      </Button>
    </div>
  );
}
