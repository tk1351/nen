/**
 * store.ts - SQLite-backed cache for history entries and PATH commands.
 */

import { Database } from "@db/sqlite";
import type { CacheEntry, MatchCandidate } from "../types.ts";

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS entries (
    command     TEXT    PRIMARY KEY,
    source      TEXT    NOT NULL,
    frequency   INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    last_used   INTEGER NOT NULL DEFAULT 0
  )
`;

const CREATE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_frequency ON entries (frequency DESC)
`;

/**
 * Opens (or creates) the SQLite cache at the given path.
 * Returns a CacheStore instance.
 */
export function openStore(dbPath: string): CacheStore {
  const db = new Database(dbPath);
  db.exec(CREATE_TABLE_SQL);
  db.exec(CREATE_INDEX_SQL);
  return new CacheStore(db);
}

export class CacheStore {
  #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  /** Upserts a cache entry, incrementing frequency if it already exists. */
  upsert(entry: CacheEntry): void {
    this.#db.exec(
      `INSERT INTO entries (command, source, frequency, description, last_used)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(command) DO UPDATE SET
         frequency  = frequency + 1,
         last_used  = excluded.last_used`,
      entry.command,
      entry.source,
      entry.frequency,
      entry.description ?? null,
      entry.lastUsed,
    );
  }

  /** Bulk-inserts entries (ignores duplicates). */
  bulkInsert(entries: CacheEntry[]): void {
    if (entries.length === 0) return;
    const stmt = this.#db.prepare(
      `INSERT OR IGNORE INTO entries (command, source, frequency, description, last_used)
       VALUES (?, ?, ?, ?, ?)`,
    );
    this.#db.exec("BEGIN");
    try {
      for (const e of entries) {
        stmt.run(e.command, e.source, e.frequency, e.description ?? null, e.lastUsed);
      }
      this.#db.exec("COMMIT");
    } catch (err) {
      this.#db.exec("ROLLBACK");
      throw err;
    }
  }

  /**
   * Returns MatchCandidates whose command starts with `prefix`,
   * ordered by frequency descending, limited to `limit` results.
   */
  queryPrefix(prefix: string, limit: number): MatchCandidate[] {
    const rows = this.#db.prepare(
      `SELECT command, source, frequency, description
       FROM entries
       WHERE command LIKE ? ESCAPE '\\'
       ORDER BY frequency DESC
       LIMIT ?`,
    ).all(`${escapeLike(prefix)}%`, limit) as Array<{
      command: string;
      source: string;
      frequency: number;
      description: string | null;
    }>;

    return rows.map((r) => ({
      text: r.command,
      source: r.source as "history" | "command",
      frequency: r.frequency,
      description: r.description ?? undefined,
    }));
  }

  /** Returns total number of entries in the cache. */
  count(): number {
    const row = this.#db.prepare("SELECT COUNT(*) as n FROM entries").get() as {
      n: number;
    };
    return row.n;
  }

  /** Clears all entries from the cache. */
  clear(): void {
    this.#db.exec("DELETE FROM entries");
  }

  /** Closes the database connection. */
  close(): void {
    this.#db.close();
  }
}

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, (c) => `\\${c}`);
}
