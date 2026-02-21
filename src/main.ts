/**
 * main.ts - nen daemon entry point.
 *
 * Starts an HTTP server over a UNIX socket at /tmp/nen.sock.
 * Exports createDeps and startDaemon for testability.
 */

import { openStore } from "./cache/store.ts";
import type { CacheStore } from "./cache/store.ts";
import { readHistory } from "./history/reader.ts";
import { scanPathCommands } from "./commands/scanner.ts";
import { createHandler } from "./server/handler.ts";
import { checkDanger } from "./security/guard.ts";
import type { HandlerDeps } from "./types.ts";

const LOG_DIR = `${Deno.env.get("HOME")}/Library/Logs/nen`;
const LOG_FILE = `${LOG_DIR}/daemon.log`;

/** Appends an error message to the nen daemon log file. */
async function logError(context: string, err: unknown): Promise<void> {
  const ts = new Date().toISOString();
  const msg = `${ts} [ERROR] ${context}: ${err instanceof Error ? err.message : String(err)}\n`;
  try {
    await Deno.mkdir(LOG_DIR, { recursive: true });
    await Deno.writeTextFile(LOG_FILE, msg, { append: true });
  } catch {
    // If logging itself fails, silently drop — never crash the daemon over logging.
  }
}

/** Builds HandlerDeps wired to the given CacheStore. */
export function createDeps(store: CacheStore): HandlerDeps {
  return {
    getCandidates: (buffer, limit) => Promise.resolve(store.queryPrefix(buffer, limit)),
    checkDanger,
  };
}

/** Loads zsh history into the cache (INSERT OR IGNORE). */
async function loadHistory(store: CacheStore): Promise<void> {
  const entries = await readHistory();
  store.bulkInsert(
    entries.map((e) => ({
      command: e.command,
      source: "history" as const,
      frequency: 1,
      lastUsed: e.timestamp ?? Math.floor(Date.now() / 1000),
    })),
  );
}

/** Scans PATH executables into the cache (INSERT OR IGNORE). */
async function loadCommands(store: CacheStore): Promise<void> {
  const candidates = await scanPathCommands();
  store.bulkInsert(
    candidates.map((c) => ({
      command: c.text,
      source: "command" as const,
      frequency: 0,
      description: c.description,
      lastUsed: 0,
    })),
  );
}

export interface DaemonOpts {
  /** UNIX socket path (default: /tmp/nen.sock). */
  socketPath?: string;
  /** SQLite database path (default: /tmp/nen.db). */
  dbPath?: string;
  /** AbortSignal for graceful shutdown (used by tests). */
  signal?: AbortSignal;
}

/**
 * Starts the nen daemon.
 * - Opens the SQLite cache.
 * - Loads history + PATH commands in background (server starts immediately).
 * - Serves HTTP/1.1 over the UNIX socket.
 * - Shuts down cleanly when signal is aborted (or SIGTERM/SIGINT in daemon mode).
 */
export async function startDaemon(opts?: DaemonOpts): Promise<void> {
  const socketPath = opts?.socketPath ?? "/tmp/nen.sock";
  const dbPath = opts?.dbPath ?? "/tmp/nen.db";

  // Remove stale socket file if present
  try {
    await Deno.remove(socketPath);
  } catch {
    // Not present — fine
  }

  const store = openStore(dbPath);
  const ac = new AbortController();

  opts?.signal?.addEventListener("abort", () => ac.abort());

  // Register OS signal handlers only when running as a real daemon (not in tests)
  if (!opts?.signal) {
    const cleanup = () => ac.abort();
    Deno.addSignalListener("SIGTERM", cleanup);
    Deno.addSignalListener("SIGINT", cleanup);
  }

  // Periodic history refresh every 5 minutes
  const refreshTimer = setInterval(() => {
    loadHistory(store).catch((err) => logError("history refresh", err));
  }, 5 * 60 * 1000);
  ac.signal.addEventListener("abort", () => clearInterval(refreshTimer));

  // Load initial data in background so the server starts immediately
  loadHistory(store).catch((err) => logError("initial history load", err));
  loadCommands(store).catch((err) => logError("initial command scan", err));

  await Deno.serve(
    {
      path: socketPath,
      signal: ac.signal,
      onListen: () => {
        // Restrict socket to owner only (prevent other users from reading history)
        Deno.chmod(socketPath, 0o600).catch((err) =>
          logError("chmod socket", err)
        );
      },
    },
    createHandler(createDeps(store)),
  ).finished;

  store.close();
}

if (import.meta.main) {
  await startDaemon();
}
