// src/config/db.js
/**
 * Database connection and pooling for the TimeCore backend.
 *
 * - Uses mysql2/promise with a shared connection pool.
 * - Reads configuration from environment variables:
 *   - DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT
 * - Adds retry logic for transient database errors.
 * - Adds default timeouts and simple performance logging.
 * - Ensures the pool is only created once (globalThis.__dbPool).
 * - Gracefully closes the pool on process shutdown (SIGTERM/SIGINT).
 */

import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

/**
 * Create a new MySQL connection pool.
 *
 * This function is only called once thanks to the globalThis caching
 * further down in the file.
 */
const makePool = () =>
  mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || "3306", 10),
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 15000,
  });

/**
 * Shared database pool instance.
 *
 * - Stored on globalThis.__dbPool to avoid creating multiple pools
 *   when the server reloads (e.g. with nodemon).
 */
export const db = globalThis.__dbPool ?? (globalThis.__dbPool = makePool());

/**
 * Patch the pool only once.
 *
 * We mark the pool with a non-enumerable flag `__patched` to avoid
 * re-wrapping execute/query multiple times on hot-reload.
 */
if (!db.__patched) {
  /**
   * Error codes that are considered *transient* and safe to retry.
   * Typical examples: connection resets, timeouts, deadlocks.
   */
  const TRANSIENT_DB_CODES = new Set([
    "ECONNRESET",
    "PROTOCOL_CONNECTION_LOST",
    "PROTOCOL_SEQUENCE_TIMEOUT",
    "ETIMEDOUT",
    "ER_LOCK_DEADLOCK",
    "ER_LOCK_WAIT_TIMEOUT",
    "EPIPE",
  ]);

  // Default timeout for queries/commands in milliseconds
  const DEFAULT_TIMEOUT_MS = 20000;

  /**
   * Execute a function with retry support for transient DB errors.
   *
   * @template T
   * @param {() => Promise<T>} fn - The DB operation to execute.
   * @param {number} [attempts=3] - Maximum number of attempts.
   * @returns {Promise<T>} - Result of the DB operation.
   * @throws {Error} - If all attempts fail.
   */
  async function withRetry(fn, attempts = 3) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        if (!TRANSIENT_DB_CODES.has(err?.code)) throw err;

        const delay = 150 * 2 ** i;
        console.warn(
          `[DB] transient ${err.code}; retry ${i + 1}/${attempts} in ${delay}ms`
        );

        await new Promise((r) => setTimeout(r, delay));
        lastErr = err;
      }
    }
    throw lastErr;
  }

  const _execute = db.execute.bind(db);
  const _query = db.query.bind(db);

  /**
   * Normalize arguments to a common options object form.
   *
   * mysql2's pool.execute/query accept either:
   *  - (sqlString, values)
   *  - (optionsObject)
   *
   * Here we always convert to the optionsObject format and enforce
   * a default timeout.
   */
  const normalizeArgs = (sqlOrOptions, values) => {
    if (typeof sqlOrOptions === "string") {
      return [
        {
          sql: sqlOrOptions,
          values: values ?? [],
          timeout: DEFAULT_TIMEOUT_MS,
        },
      ];
    }
    return [{ timeout: DEFAULT_TIMEOUT_MS, ...sqlOrOptions }];
  };

  /**
   * Patched version of pool.execute with:
   * - retry logic for transient errors
   * - default timeout
   * - simple slow-query logging
   */
  db.execute = async function patchedExecute(sqlOrOptions, values) {
    const [opts] = normalizeArgs(sqlOrOptions, values);
    const t0 = Date.now();
    try {
      return await withRetry(() => _execute(opts), 3);
    } finally {
      const ms = Date.now() - t0;
      if (ms > 500) console.log(`[DB] execute ${ms}ms`);
    }
  };

  /**
   * Patched version of pool.query with:
   * - retry logic for transient errors
   * - default timeout
   * - simple slow-query logging
   */
  db.query = async function patchedQuery(sqlOrOptions, values) {
    const [opts] = normalizeArgs(sqlOrOptions, values);
    const t0 = Date.now();
    try {
      return await withRetry(() => _query(opts), 3);
    } finally {
      const ms = Date.now() - t0;
      if (ms > 500) console.log(`[DB] query ${ms}ms`);
    }
  };
  Object.defineProperty(db, "__patched", { value: true, enumerable: false });
}

/**
 * Test the database connection at startup.
 *
 * - Acquires a connection from the pool.
 * - Executes a simple ping.
 * - Releases the connection back to the pool.
 */
export const connectDB = async () => {
  try {
    const conn = await db.getConnection();
    await conn.ping();
    conn.release();
    console.log("✅ Connected to MySQL database");
  } catch (err) {
    console.error("❌ Error connecting to DB:", err.message);
    throw err;
  }
};

/**
 * Gracefully close the DB pool on process termination signals.
 * This helps avoid hanging connections in environments like Docker.
 */
process.on("SIGTERM", async () => {
  console.log("🔻 Closing DB pool...");
  await db.end();
  console.log("DB pool closed. Bye!");
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("🔻 Closing DB pool...");
  await db.end();
  console.log("DB pool closed. Bye!");
  process.exit(0);
});
