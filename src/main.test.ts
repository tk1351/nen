import { assertEquals } from "@std/assert";
import { openStore } from "./cache/store.ts";
import { createDeps, startDaemon } from "./main.ts";
import type { SuggestionResponse } from "./types.ts";

function tmpPath(ext: string): string {
  return `/tmp/nen_test_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
}

/** Send a raw HTTP/1.1 request over a UNIX socket and return status + body. */
async function unixFetch(
  socketPath: string,
  method: string,
  path: string,
  body?: string,
): Promise<{ status: number; body: string }> {
  const conn = await Deno.connect({ transport: "unix", path: socketPath });
  const bodyStr = body ?? "";
  const req = [
    `${method} ${path} HTTP/1.1`,
    `Host: localhost`,
    `Content-Type: application/json`,
    `Content-Length: ${new TextEncoder().encode(bodyStr).length}`,
    `Connection: close`,
    "",
    bodyStr,
  ].join("\r\n");
  await conn.write(new TextEncoder().encode(req));

  const chunks: Uint8Array[] = [];
  const buf = new Uint8Array(4096);
  let n: number | null;
  while ((n = await conn.read(buf)) !== null) {
    chunks.push(new Uint8Array(buf.buffer.slice(0, n)));
  }
  conn.close();

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const merged = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { merged.set(c, off); off += c.length; }
  const raw = new TextDecoder().decode(merged);
  const [head, ...rest] = raw.split("\r\n\r\n");
  const statusLine = head.split("\r\n")[0];
  const status = parseInt(statusLine.split(" ")[1]);
  return { status, body: rest.join("\r\n\r\n") };
}

/** Poll until the UNIX socket file accepts connections (max 10s). */
async function waitForSocket(path: string): Promise<void> {
  for (let i = 0; i < 100; i++) {
    try {
      const conn = await Deno.connect({ transport: "unix", path });
      conn.close();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error(`Socket not ready after 10s: ${path}`);
}

// ---------------------------------------------------------------------------
// createDeps tests
// ---------------------------------------------------------------------------

Deno.test("createDeps - getCandidates returns seeded entries", async () => {
  const dbPath = tmpPath(".db");
  try {
    const store = openStore(dbPath);
    store.bulkInsert([
      { command: "git log --oneline", source: "history", frequency: 5, lastUsed: 0 },
    ]);
    const deps = createDeps(store);
    const results = await deps.getCandidates("git", 10);
    assertEquals(results.some((r) => r.text === "git log --oneline"), true);
    store.close();
  } finally {
    await Deno.remove(dbPath).catch(() => {});
  }
});

Deno.test("createDeps - getCandidates returns empty for unknown prefix", async () => {
  const dbPath = tmpPath(".db");
  try {
    const store = openStore(dbPath);
    const deps = createDeps(store);
    const results = await deps.getCandidates("zzz_nonexistent_nen_prefix", 10);
    assertEquals(results, []);
    store.close();
  } finally {
    await Deno.remove(dbPath).catch(() => {});
  }
});

// ---------------------------------------------------------------------------
// startDaemon tests
// ---------------------------------------------------------------------------

// startDaemon tests: sanitizeOps disabled because background I/O (loadHistory,
// loadCommands) intentionally runs as a floating Promise during daemon startup.

Deno.test({
  name: "startDaemon - GET /health returns 200 OK",
  sanitizeOps: false,
  async fn() {
    const socketPath = tmpPath(".sock");
    const dbPath = tmpPath(".db");
    const ac = new AbortController();
    const daemonPromise = startDaemon({ socketPath, dbPath, signal: ac.signal });
    try {
      await waitForSocket(socketPath);
      const result = await unixFetch(socketPath, "GET", "/health");
      assertEquals(result.status, 200);
    } finally {
      ac.abort();
      await daemonPromise;
      await Deno.remove(dbPath).catch(() => {});
      await Deno.remove(socketPath).catch(() => {});
    }
  },
});

Deno.test({
  name: "startDaemon - POST /suggest returns seeded suggestions",
  sanitizeOps: false,
  async fn() {
    const socketPath = tmpPath(".sock");
    const dbPath = tmpPath(".db");
    const uniqueCmd = "git_nen_unique_seed_xyz_12345";

    // Pre-seed before daemon opens the store
    const preStore = openStore(dbPath);
    preStore.bulkInsert([
      { command: uniqueCmd, source: "history", frequency: 10, lastUsed: 0 },
    ]);
    preStore.close();

    const ac = new AbortController();
    const daemonPromise = startDaemon({ socketPath, dbPath, signal: ac.signal });
    try {
      await waitForSocket(socketPath);
      const reqBody = JSON.stringify({ buffer: "git_nen_unique_seed", limit: 5 });
      const result = await unixFetch(socketPath, "POST", "/suggest", reqBody);
      assertEquals(result.status, 200);
      const response = JSON.parse(result.body) as SuggestionResponse;
      assertEquals(
        response.suggestions.some((s) => s.text === uniqueCmd),
        true,
      );
    } finally {
      ac.abort();
      await daemonPromise;
      await Deno.remove(dbPath).catch(() => {});
      await Deno.remove(socketPath).catch(() => {});
    }
  },
});

Deno.test({
  name: "startDaemon - abort signal shuts down cleanly",
  sanitizeOps: false,
  async fn() {
    const socketPath = tmpPath(".sock");
    const dbPath = tmpPath(".db");
    const ac = new AbortController();
    const daemonPromise = startDaemon({ socketPath, dbPath, signal: ac.signal });
    try {
      await waitForSocket(socketPath);
      ac.abort();
      await daemonPromise; // must resolve without throwing
    } finally {
      await Deno.remove(dbPath).catch(() => {});
      await Deno.remove(socketPath).catch(() => {});
    }
  },
});
