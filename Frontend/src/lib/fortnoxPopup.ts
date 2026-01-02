import { FortnoxService } from "../services/FortnoxService";

let inflight: Promise<void> | null = null;

const API_URL = import.meta.env.VITE_BACKEND_URL; // e.g. "http://localhost:5000/api"

export function openFortnoxPopup(): Promise<void> {
  if (inflight) return inflight;

  const apiOrigin = new URL(API_URL).origin; // "http://localhost:5000"

  inflight = (async () => {
    const sid = await FortnoxService.createOAuthSession();

    const url = `${API_URL}/fortnox/oauth/start?sid=${encodeURIComponent(sid)}`;

    const popup = window.open(url, "fortnox_oauth", "width=520,height=720");
    if (!popup) throw new Error("Popup blocked. Please allow popups and try again.");

    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        window.clearTimeout(timeout);
        window.removeEventListener("message", onMsg);
        inflight = null;
      };

      const onMsg = (ev: MessageEvent) => {
        console.log("[Fortnox message received]", {
          origin: ev.origin,
          data: ev.data,
          expectedOrigin: apiOrigin,
        });

        if (ev.origin !== apiOrigin) return;
        if (ev.data === "FORTNOX_AUTH_OK") {
          cleanup();
          try { popup.close(); } catch {}
          resolve();
        }
      };

      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("Fortnox reauthorization timed out."));
      }, 2 * 60 * 1000);

      window.addEventListener("message", onMsg);
    });
  })();

  return inflight;
}
