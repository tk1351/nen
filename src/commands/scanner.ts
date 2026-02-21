/**
 * scanner.ts - Scans directories in PATH for available commands.
 */

import type { MatchCandidate } from "../types.ts";

/**
 * Scans all directories in the given PATH string for executable files.
 * Returns a list of MatchCandidate with source="command".
 *
 * @param pathEnv - The PATH environment variable value (default: Deno.env.get("PATH"))
 * @returns Array of MatchCandidate for each discovered executable.
 */
export async function scanPathCommands(
  pathEnv: string = Deno.env.get("PATH") ?? "",
): Promise<MatchCandidate[]> {
  const dirs = pathEnv.split(":").filter((d) => d.length > 0);
  const seen = new Set<string>();
  const candidates: MatchCandidate[] = [];

  for (const dir of dirs) {
    const entries = await readDirSafe(dir);
    const toCheck: Array<{ name: string; path: string }> = [];
    for (const entry of entries) {
      if (!entry.isFile && !entry.isSymlink) continue;
      if (seen.has(entry.name)) continue;
      seen.add(entry.name);
      toCheck.push({ name: entry.name, path: `${dir}/${entry.name}` });
    }

    const results = await Promise.all(
      toCheck.map(async ({ name, path }) => ({
        name,
        isExecutable: await checkExecutable(path),
      })),
    );

    for (const { name, isExecutable } of results) {
      if (isExecutable) {
        candidates.push({ text: name, source: "command", frequency: 0 });
      }
    }
  }

  return candidates;
}

/**
 * Reads a directory, returning an empty array on any error.
 */
async function readDirSafe(dir: string): Promise<Deno.DirEntry[]> {
  try {
    const entries: Deno.DirEntry[] = [];
    for await (const entry of Deno.readDir(dir)) {
      entries.push(entry);
    }
    return entries;
  } catch {
    return [];
  }
}

/**
 * Checks whether a file path is executable by the current user.
 * Returns false on any error (e.g., broken symlinks).
 */
async function checkExecutable(filePath: string): Promise<boolean> {
  try {
    const info = await Deno.stat(filePath);
    if (!info.isFile) return false;
    // Deno.FileInfo does not expose permission bits directly on all platforms.
    // We use a heuristic: if stat succeeds and it's a file, attempt access check.
    // On macOS/Linux the mode is available via info.mode.
    if (info.mode !== null && info.mode !== undefined) {
      // Check owner execute (0o100) or group execute (0o010) or other execute (0o001)
      return (info.mode & 0o111) !== 0;
    }
    return true; // fallback: assume executable if we can stat it
  } catch {
    return false;
  }
}
