import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

// --- Skapa pool ---
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

// --- Singleton-pool (även vid hot-reload) ---
export const db = globalThis.__dbPool ?? (globalThis.__dbPool = makePool());

// --- Lägg till global retry/timeout på execute/query (bara en gång) ---
if (!db.__patched) {
  const TRANSIENT_DB_CODES = new Set([
    "ECONNRESET",
    "PROTOCOL_CONNECTION_LOST",
    "PROTOCOL_SEQUENCE_TIMEOUT",
    "ETIMEDOUT",
    "ER_LOCK_DEADLOCK",
    "ER_LOCK_WAIT_TIMEOUT",
    "EPIPE" 
  ]);

  const DEFAULT_TIMEOUT_MS = 20000;

  async function withRetry(fn, attempts = 3) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        if (!TRANSIENT_DB_CODES.has(err?.code)) throw err;
        const delay = 150 * 2 ** i;
        console.warn(`[DB] transient ${err.code}; retry ${i + 1}/${attempts} in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        lastErr = err;
      }
    }
    throw lastErr;
  }

  const _execute = db.execute.bind(db);
  const _query = db.query.bind(db);

  const normalizeArgs = (sqlOrOptions, values) => {
    if (typeof sqlOrOptions === "string") {
      return [{ sql: sqlOrOptions, values: values ?? [], timeout: DEFAULT_TIMEOUT_MS }];
    }
    return [{ timeout: DEFAULT_TIMEOUT_MS, ...sqlOrOptions }];
  };

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

// --- Testa anslutning ---
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

// --- Graceful shutdown ---
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
