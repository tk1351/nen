# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**nen** is a macOS-only zsh inline suggestion tool. It runs as a Deno background daemon (LaunchAgent) that listens on `/tmp/nen.sock` (UNIX socket, HTTP/1.1). A ZLE widget in `shell/nen.zsh` sends POST requests to `/suggest` on each keystroke and renders ghost-text suggestions.

## Commands

```bash
deno task test     # Run all 46 tests (across src/**/*.test.ts)
deno task check    # Type-check all TypeScript files
deno task dev      # Run daemon with --watch
deno task start    # Run daemon once
deno task compile  # Compile to native aarch64-apple-darwin binary
deno task install  # Install daemon + shell integration
```

Run a single test file:
```bash
deno test --allow-read --allow-env --allow-write --allow-ffi --allow-net src/security/guard.test.ts
```

Format and lint (Deno built-in, no extra install):
```bash
deno fmt src/
deno lint src/
```

## Architecture

**Data flow**: User types → ZLE widget (`shell/nen.zsh`) → `curl --unix-socket /tmp/nen.sock` → Daemon (`src/main.ts`) → fuzzy-rank candidates from SQLite cache → security check → return `SuggestionResponse`.

**Module map** (all under `src/`):

| Module | File | Purpose |
|--------|------|---------|
| Wire protocol | `types.ts` | Shared types for request/response (source of truth for IPC contract) |
| Daemon entry | `main.ts` | Phase 7 — wires all modules, starts `Deno.serve({path: "/tmp/nen.sock"})` |
| HTTP handler | `server/handler.ts` | Routes: `GET /health`, `POST /suggest`; uses dependency injection via `HandlerDeps` |
| Fuzzy matching | `matcher/fuzzy.ts` | `fuzzyScore()` + `rankCandidates()` — pure functions |
| Security checks | `security/guard.ts` | `checkDanger()` — pure function, 8 severity levels via `DANGER_PATTERNS` array |
| History parsing | `history/reader.ts` | Parses `~/.zsh_history` (simple & extended `: ts:dur;cmd` format), deduplicates |
| PATH scanning | `commands/scanner.ts` | Scans `$PATH` directories for executables, returns `MatchCandidate[]` |
| Cache | `cache/store.ts` | SQLite via `@db/sqlite`; schema: `entries(command PK, source, frequency, description, last_used)` |

**IPC protocol**: HTTP/1.1 over UNIX socket. Request: `POST /suggest {"buffer":"git log","limit":5}`. Response: `{"suggestions":[...],"hasDanger":false}`. Shell enforces a 100ms timeout.

## Implementation Status

Phases 1–6 (`security`, `matcher`, `history`, `commands`, `cache`, `server`) are **complete with full test coverage**.

Phases 7–9 are **TODO**:
- **Phase 7** (`main.ts`): Wire CacheStore + HistoryReader + CommandScanner + HandlerDeps + `Deno.serve`
- **Phase 8** (`shell/nen.zsh`): Implement ZLE widget stubs (`_nen_fetch_suggestions`, `_nen_render_ghost_text`, etc.)
- **Phase 9** (`scripts/install.ts`): Compile binary → `~/.local/bin/nen`, install LaunchAgent plist, patch `.zshrc`

## Key Patterns

- **Dependency injection**: `server/handler.ts` exports `createHandler(deps: HandlerDeps)` — pass mock deps in tests.
- **Pure functions for business logic**: `fuzzyScore`, `rankCandidates`, `checkDanger` have zero side-effects; test them without mocks.
- **Deno permissions**: The daemon requires `--allow-read --allow-net --allow-env --allow-write=/tmp --allow-ffi`; tests add `--allow-write` for temp SQLite files.
- **Formatting**: 2-space indent, 100-char line width, double quotes, semicolons (enforced by `deno.json` fmt config).
