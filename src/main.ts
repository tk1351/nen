/**
 * main.ts - nen daemon entry point.
 *
 * Starts an HTTP server over a UNIX socket at /tmp/nen.sock.
 *
 * TODO (Phase 7 - actual wiring):
 *   1. Open SQLite cache (CacheStore)
 *   2. Load zsh history via readHistory() and bulkInsert into cache
 *   3. Scan PATH commands via scanPathCommands() and bulkInsert into cache
 *   4. Wire HandlerDeps:
 *      - getCandidates: prefix query from cache → rankCandidates()
 *      - checkDanger: guard.checkDanger()
 *   5. Start Deno.serve({ path: SOCKET_PATH }, createHandler(deps))
 *   6. Handle graceful shutdown on SIGTERM / SIGINT
 *   7. Periodically refresh history/PATH in background
 */

const SOCKET_PATH = "/tmp/nen.sock";

console.log(`[nen] daemon starting on ${SOCKET_PATH}`);

// TODO: implement daemon startup (see Phase 7)
