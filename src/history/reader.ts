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
    raw = await Deno.readTextFile(path);
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

  return Array.from(seen.values());
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
