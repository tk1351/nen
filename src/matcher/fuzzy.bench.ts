/**
 * fuzzy.bench.ts - Benchmarks for fuzzy scoring and candidate ranking.
 */

import { fuzzyScore, rankCandidates } from "./fuzzy.ts";
import type { MatchCandidate } from "../types.ts";

function makeCandidates(n: number): MatchCandidate[] {
  const prefixes = ["git", "docker", "npm", "deno", "kubectl", "terraform", "aws", "gcloud"];
  return Array.from({ length: n }, (_, i) => ({
    text: `${prefixes[i % prefixes.length]}-command-${i}`,
    source: i % 2 === 0 ? "history" : "command",
    frequency: i % 100,
  }));
}

Deno.bench("fuzzyScore - prefix match (best case)", () => {
  fuzzyScore("git", "git commit -m 'fix'");
});

Deno.bench("fuzzyScore - subsequence match", () => {
  fuzzyScore("gc", "git commit");
});

Deno.bench("fuzzyScore - no match (worst case scan)", () => {
  fuzzyScore("xyz", "git commit --amend --no-edit");
});

Deno.bench("rankCandidates 100 candidates, query 'git', limit 10", () => {
  const candidates = makeCandidates(100);
  rankCandidates("git", candidates, 10);
});

Deno.bench("rankCandidates 1000 candidates, query 'git', limit 10", () => {
  const candidates = makeCandidates(1000);
  rankCandidates("git", candidates, 10);
});

Deno.bench("rankCandidates 1000 candidates, query 'dc', limit 5", () => {
  const candidates = makeCandidates(1000);
  rankCandidates("dc", candidates, 5);
});
