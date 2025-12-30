import { processOneJob } from "../workers/worklogPdfWorker.js";

/**
 * In-process queue runner.
 *
 * What it does:
 * - drainWorklogQueue(): runs processOneJob() repeatedly until no job is available.
 * - Uses an in-memory lock so multiple drains don't run at the same time in the same process.
 * - pokeWorklogQueue(): triggers drainWorklogQueue() without awaiting it (fire-and-forget),
 *   typically called right after jobs are inserted into the queue table.
 */

let _drainRunning = false;

export async function drainWorklogQueue() {
  if (_drainRunning) return;

  _drainRunning = true;
  try {
    while (true) {
      const res = await processOneJob();
      if (!res.picked) break;
    }
  } catch (e) {
    console.error("[Runner] drain error:", e);
  } finally {
    _drainRunning = false;
  }
}

export function pokeWorklogQueue() {
  console.log("[Runner] poke");
  drainWorklogQueue().catch((err) => {
    console.error("[WorklogRunner] poke error:", err);
  });
}
