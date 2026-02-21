/**
 * reader.ts - ~/.zsh_history parser.
 *
 * Supports both formats:
 *   - Simple:   "git commit -m 'fix'"
 *   - Extended: ": 1700000000:5;git commit -m 'fix'"
 */

import type { HistoryEntry } from "../types.ts";

/** Default path to the zsh history file. */
export const DEFAULT_HISTORY_PATH = `${Deno.env.get("HOME")}/.zsh_history`;

/** Maximum bytes to read from the tail of a large history file (2 MB). */
const MAX_HISTORY_BYTES = 2 * 1024 * 1024;

/** Maximum parsed entries kept after deduplication. */
const MAX_HISTORY_ENTRIES = 10_000;

/**
 * Reads and parses the zsh history file at the given path.
 * Lines that cannot be parsed are silently skipped.
 * Duplicate commands are deduplicated (latest occurrence wins).
 *
 * @param path - Path to the history file (default: ~/.zsh_history)
 * @returns Array of HistoryEntry, most-recent last.
 */
export async function readHistory(
  path: string = DEFAULT_HISTORY_PATH,
): Promise<HistoryEntry[]> {
  let raw: string;
  try {
    const info = await Deno.stat(path);
    if (info.size <= MAX_HISTORY_BYTES) {
      raw = await Deno.readTextFile(path);
    } else {
      // Read only the tail to avoid OOM on huge history files
      const file = await Deno.open(path, { read: true });
      try {
        await file.seek(-MAX_HISTORY_BYTES, Deno.SeekMode.End);
        const buf = new Uint8Array(MAX_HISTORY_BYTES);
        const nRead = await file.read(buf);
        const tail = new TextDecoder().decode(buf.subarray(0, nRead ?? 0));
        // Drop any partial first line introduced by the mid-file seek
        const newlineIdx = tail.indexOf("\n");
        raw = newlineIdx >= 0 ? tail.slice(newlineIdx + 1) : tail;
      } finally {
        file.close();
      }
    }
  } catch {
    return [];
  }

  return parseHistoryText(raw);
}

/**
 * Parses the raw text content of a zsh history file.
 * Exported for unit testing without filesystem access.
 */
export function parseHistoryText(raw: string): HistoryEntry[] {
  const lines = raw.split("\n");
  const seen = new Map<string, HistoryEntry>();

  for (const line of lines) {
    const entry = parseLine(line.trimEnd());
    if (entry) {
      // Dedup: last occurrence wins
      seen.set(entry.command, entry);
    }
  }

  const all = Array.from(seen.values());
  // Cap total entries to avoid unbounded memory after deduplication
  return all.length > MAX_HISTORY_ENTRIES ? all.slice(-MAX_HISTORY_ENTRIES) : all;
}

/**
 * Parses a single history line.
 * Returns null for blank lines or unparseable content.
 */
function parseLine(line: string): HistoryEntry | null {
  if (!line) return null;

  // Extended format: ": <timestamp>:<duration>;<command>"
  const extendedMatch = line.match(/^:\s*(\d+):(\d+);(.+)$/);
  if (extendedMatch) {
    const command = extendedMatch[3].trim();
    if (!command) return null;
    return {
      command,
      timestamp: parseInt(extendedMatch[1], 10),
      duration: parseInt(extendedMatch[2], 10),
    };
  }

  // Simple format: just the command
  const command = line.trim();
  if (!command || command.startsWith("#")) return null;

  return { command };
}
