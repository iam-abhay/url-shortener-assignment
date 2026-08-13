import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

let dbMode = "pg";
let pool = null;
let sqliteDb = null;

export async function initDatabase() {
  const connectionString =
    process.env.DATABASE_URL ||
    (process.env.NODE_ENV === "production"
      ? "postgresql://linklite_db_lmmm_user:2dBEyoMbvpWvZeAwOiI5YRyoLX9nUxXt@dpg-d9uuu2favr4c73bjs38g-a.virginia-postgres.render.com/linklite_db_lmmm"
      : null);

  if (connectionString && !connectionString.startsWith("sqlite:")) {
    try {
      pool = new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 5000
      });

      await pool.query("SELECT 1");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS links (
          id SERIAL PRIMARY KEY,
          original_url TEXT NOT NULL,
          short_code VARCHAR(12) UNIQUE NOT NULL,
          clicks INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      dbMode = "pg";
      console.log("Connected to PostgreSQL database.");
      return;
    } catch (err) {
      console.warn("PostgreSQL connection failed, using local SQLite database fallback:", err.message);
    }
  }

  dbMode = "sqlite";
  const dbPath = path.join(__dirname, "../links.db");
  const { default: Database } = await import("better-sqlite3");
  sqliteDb = new Database(dbPath);
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_url TEXT NOT NULL,
      short_code VARCHAR(12) UNIQUE NOT NULL,
      clicks INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log(`Using SQLite database at ${dbPath}`);
}

export function getDbMode() {
  return dbMode;
}

export async function healthCheck() {
  if (dbMode === "pg") {
    await pool.query("SELECT 1");
    return true;
  }
  sqliteDb.prepare("SELECT 1").get();
  return true;
}

export async function codeExists(shortCode) {
  if (dbMode === "pg") {
    const result = await pool.query("SELECT 1 FROM links WHERE short_code = $1", [shortCode]);
    return result.rowCount > 0;
  }
  const row = sqliteDb.prepare("SELECT 1 FROM links WHERE short_code = ?").get(shortCode);
  return Boolean(row);
}

export async function insertLink(originalUrl, shortCode) {
  if (dbMode === "pg") {
    const result = await pool.query(
      `INSERT INTO links (original_url, short_code)
       VALUES ($1, $2)
       RETURNING id, original_url, short_code, clicks, created_at`,
      [originalUrl, shortCode]
    );
    const row = result.rows[0];
    return {
      id: row.id,
      originalUrl: row.original_url,
      shortCode: row.short_code,
      clicks: row.clicks,
      createdAt: row.created_at
    };
  }

  const stmt = sqliteDb.prepare("INSERT INTO links (original_url, short_code) VALUES (?, ?)");
  const info = stmt.run(originalUrl, shortCode);
  const row = sqliteDb.prepare("SELECT id, original_url, short_code, clicks, created_at FROM links WHERE id = ?").get(info.lastInsertRowid);
  return {
    id: row.id,
    originalUrl: row.original_url,
    shortCode: row.short_code,
    clicks: row.clicks,
    createdAt: row.created_at
  };
}

export async function getAllLinks() {
  if (dbMode === "pg") {
    const result = await pool.query(
      `SELECT id, original_url, short_code, clicks, created_at
       FROM links
       ORDER BY created_at DESC`
    );
    return result.rows.map((row) => ({
      id: row.id,
      originalUrl: row.original_url,
      shortCode: row.short_code,
      clicks: row.clicks,
      createdAt: row.created_at
    }));
  }

  const rows = sqliteDb.prepare(
    `SELECT id, original_url, short_code, clicks, created_at
     FROM links
     ORDER BY created_at DESC`
  ).all();

  return rows.map((row) => ({
    id: row.id,
    originalUrl: row.original_url,
    shortCode: row.short_code,
    clicks: row.clicks,
    createdAt: row.created_at
  }));
}

export async function incrementAndGetOriginalUrl(shortCode) {
  if (dbMode === "pg") {
    const result = await pool.query(
      `UPDATE links
       SET clicks = clicks + 1
       WHERE short_code = $1
       RETURNING original_url`,
      [shortCode]
    );
    return result.rows[0]?.original_url || null;
  }

  const updateStmt = sqliteDb.prepare("UPDATE links SET clicks = clicks + 1 WHERE short_code = ?");
  const info = updateStmt.run(shortCode);
  if (info.changes === 0) return null;

  const row = sqliteDb.prepare("SELECT original_url FROM links WHERE short_code = ?").get(shortCode);
  return row?.original_url || null;
}
