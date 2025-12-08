import { db } from "../config/db.js";

/**
 * Skapar ett gäng anslutningar direkt vid start
 * för att undvika att poolen är "kall" vid första queryn.
 */
export async function prefillPool(n = 10) {
  const conns = [];
  try {
    for (let i = 0; i < n; i++) {
      const c = await db.getConnection();
      await c.ping();
      conns.push(c);
    }
    conns.forEach((c) => c.release());
    console.log(`[DB] Prefilled pool with ${n} connections`);
  } catch (err) {
    console.warn("[DB warmup] prefill failed:", err.message);
  }
}

/**
 * Kör några enkla queries så DNS/TLS/planer cacheas
 */
export async function warmTypicalQueries() {
  try {
    await db.query("SELECT 1");
    // Lägg gärna till vanliga queries som körs direkt i appen:
    // await db.query("SELECT id FROM users LIMIT 1");
    console.log("[DB] Typical queries warmed");
  } catch (err) {
    console.warn("[DB warmup] query failed:", err.message);
  }
}

/**
 * Kör båda warmup-funktionerna
 */
export async function runWarmup() {
  await prefillPool(6);
  await warmTypicalQueries();
}
