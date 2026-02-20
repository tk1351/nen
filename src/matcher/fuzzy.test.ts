import { assertEquals, assertNotEquals } from "@std/assert";
import { fuzzyScore, rankCandidates } from "./fuzzy.ts";
import type { MatchCandidate } from "../types.ts";

// ---------------------------------------------------------------------------
// fuzzyScore
// ---------------------------------------------------------------------------

Deno.test("fuzzyScore - exact prefix match returns high score", () => {
  const result = fuzzyScore("git", "git commit");
  assertNotEquals(result, null);
  assertEquals(result!.matchPositions, [0, 1, 2]);
  // Prefix matches should score >= 1000
  assertEquals(result!.score >= 1000, true);
});

Deno.test("fuzzyScore - subsequence match returns non-null", () => {
  const result = fuzzyScore("gc", "git commit");
  assertNotEquals(result, null);
  assertEquals(result!.matchPositions.length, 2);
});

Deno.test("fuzzyScore - non-matching query returns null", () => {
  const result = fuzzyScore("xyz", "git commit");
  assertEquals(result, null);
});

Deno.test("fuzzyScore - empty query returns score 0", () => {
  const result = fuzzyScore("", "git commit");
  assertNotEquals(result, null);
  assertEquals(result!.score, 0);
  assertEquals(result!.matchPositions, []);
});

Deno.test("fuzzyScore - case insensitive matching", () => {
  const result = fuzzyScore("GIT", "git commit");
  assertNotEquals(result, null);
});

Deno.test("fuzzyScore - prefix beats subsequence in score", () => {
  const prefix = fuzzyScore("git", "git log");
  const subseq = fuzzyScore("git", "g_i_t_command");
  assertNotEquals(prefix, null);
  assertNotEquals(subseq, null);
  assertEquals(prefix!.score > subseq!.score, true);
});

Deno.test("fuzzyScore - shorter text beats longer text for same prefix", () => {
  const short = fuzzyScore("git", "git log");
  const long = fuzzyScore("git", "git log --oneline --all --graph");
  assertNotEquals(short, null);
  assertNotEquals(long, null);
  assertEquals(short!.score >= long!.score, true);
});

// ---------------------------------------------------------------------------
// rankCandidates
// ---------------------------------------------------------------------------

Deno.test("rankCandidates - returns up to limit results", () => {
  const candidates: MatchCandidate[] = [
    { text: "git commit", source: "history", frequency: 5 },
    { text: "git clone", source: "history", frequency: 3 },
    { text: "git log", source: "history", frequency: 8 },
    { text: "git status", source: "history", frequency: 10 },
    { text: "git push", source: "history", frequency: 2 },
  ];
  const results = rankCandidates("git", candidates, 3);
  assertEquals(results.length, 3);
});

Deno.test("rankCandidates - filters out non-matching candidates", () => {
  const candidates: MatchCandidate[] = [
    { text: "docker run", source: "command", frequency: 1 },
    { text: "git commit", source: "history", frequency: 5 },
  ];
  const results = rankCandidates("git", candidates, 10);
  assertEquals(results.length, 1);
  assertEquals(results[0].text, "git commit");
});

Deno.test("rankCandidates - higher frequency boosts rank", () => {
  const candidates: MatchCandidate[] = [
    { text: "git log", source: "history", frequency: 1 },
    { text: "git log --oneline", source: "history", frequency: 100 },
  ];
  const results = rankCandidates("git log", candidates, 10);
  // Higher frequency candidate should appear first
  assertEquals(results[0].text, "git log --oneline");
});

Deno.test("rankCandidates - returns correct source on suggestion", () => {
  const candidates: MatchCandidate[] = [
    { text: "ls", source: "command", frequency: 1 },
  ];
  const results = rankCandidates("ls", candidates, 5);
  assertEquals(results[0].source, "command");
});

Deno.test("rankCandidates - empty candidates returns empty array", () => {
  const results = rankCandidates("git", [], 10);
  assertEquals(results, []);
});
