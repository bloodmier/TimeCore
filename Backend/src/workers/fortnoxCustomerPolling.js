import { syncCustomersFromFortnox } from "../controller/fortnoxController.js";

let started = false;

export function startFortnoxCustomerPolling() {
  if (started) return; 
  started = true;

  const intervalMs = 15 * 60 * 1000;

  const run = async () => {
    try {
      const res = await syncCustomersFromFortnox({ limit: 500 });
      console.log("[Fortnox Customers Poll] OK", res);
    } catch (err) {
      if (err?.code === "REAUTHORIZE") {
        console.warn("[Fortnox Customers Poll] Needs reauth - skipping until reauthorized");
        return;
      }
      console.error("[Fortnox Customers Poll] ERROR", err);
    }
  };


  run();
  setInterval(run, intervalMs);
}
