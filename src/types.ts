/**
 * nen - shared type definitions
 * Wire protocol types and internal domain types.
 */

// ---------------------------------------------------------------------------
// Wire protocol (HTTP/1.1 over UNIX socket)
// ---------------------------------------------------------------------------

/** Request body sent by the ZSH widget to the daemon. */
export interface SuggestionRequest {
  /** The current buffer content (partial command). */
  buffer: string;
  /** Max number of suggestions to return. */
  limit?: number;
}

/** Response body returned by the daemon to the ZSH widget. */
export interface SuggestionResponse {
  /** Ordered list of suggestions (best match first). */
  suggestions: Suggestion[];
  /** Whether the top suggestion has a danger warning. */
  hasDanger: boolean;
}

/** A single completion suggestion. */
export interface Suggestion {
  /** The full command text to display / insert. */
  text: string;
  /** Short description shown in the dropdown (optional). */
  description?: string;
  /** Origin of this suggestion. */
  source: "history" | "command";
  /** Relevance score (higher = better). */
  score: number;
  /** Danger assessment result, if any. */
  danger?: DangerResult;
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

/** A single parsed entry from ~/.zsh_history. */
export interface HistoryEntry {
  /** The command string. */
  command: string;
  /** Unix timestamp (seconds), or undefined if not extended format. */
  timestamp?: number;
  /** Number of seconds the command took (extended format). */
  duration?: number;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/** An intermediate candidate used during matching. */
export interface MatchCandidate {
  /** The command string. */
  text: string;
  /** Source of the candidate. */
  source: "history" | "command";
  /** Usage frequency (higher = more frequent). */
  frequency: number;
  /** Optional description (for PATH commands). */
  description?: string;
}

/** Result of a fuzzy scoring computation. */
export interface FuzzyScore {
  /** The matched text. */
  text: string;
  /** Composite score (higher = better match). */
  score: number;
  /** Character indices in `text` that match `query` chars. */
  matchPositions: number[];
}

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

export type DangerSeverity = "low" | "medium" | "high" | "critical";

/** Result of a danger/security check on a command string. */
export interface DangerResult {
  /** Whether the command is considered dangerous. */
  isDangerous: boolean;
  /** Severity level. */
  severity: DangerSeverity;
  /** Human-readable reason for the warning. */
  reason: string;
  /** The matched pattern description. */
  pattern: string;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/** A row stored in the SQLite cache. */
export interface CacheEntry {
  /** The command string (primary key). */
  command: string;
  /** Source of the entry. */
  source: "history" | "command";
  /** Usage count. */
  frequency: number;
  /** Optional description for PATH commands. */
  description?: string;
  /** Unix timestamp of last use. */
  lastUsed: number;
}

// ---------------------------------------------------------------------------
// Server / Dependency Injection
// ---------------------------------------------------------------------------

/** Dependencies injected into the HTTP request handler. */
export interface HandlerDeps {
  /** Look up candidates matching a prefix. */
  getCandidates: (buffer: string, limit: number) => Promise<MatchCandidate[]>;
  /** Run a danger check on a command string. */
  checkDanger: (command: string) => DangerResult;
}
