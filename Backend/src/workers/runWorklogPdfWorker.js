
/**
 * CLI worker entrypoint.
 *
 * What it does:
 * - Continuously calls processOneJob() to pick and process jobs from the PDF queue.
 * - Stops when processOneJob() reports that no job was picked (queue is empty).
 * - If the worker crashes, it logs the error and exits with code 1.
 */

import { processOneJob } from "./worklogPdfWorker.js";

async function run() {
  while (true) {
    const res = await processOneJob();
    if (!res.picked) break; 
  }
}

run().catch(err => {
  console.error("Worker crashed:", err);
  process.exit(1);
});
