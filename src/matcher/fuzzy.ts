/**
 * fuzzy.ts - Prefix-first fuzzy scoring (pure functions, zero dependencies).
 */

import type { FuzzyScore, MatchCandidate, Suggestion } from "../types.ts";

/**
 * Computes a fuzzy match score between `query` and `text`.
 * Returns null if the query characters cannot be found in order within text.
 *
 * Scoring heuristics (higher = better):
 *  - Prefix match bonus
 *  - Consecutive character bonus
 *  - Word-boundary match bonus
 *  - Short text bonus (prefer shorter completions)
 */
export function fuzzyScore(query: string, text: string): FuzzyScore | null {
  if (query.length === 0) {
    return { text, score: 0, matchPositions: [] };
  }

  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  // Exact prefix match — shortcut
  if (lowerText.startsWith(lowerQuery)) {
    const positions = Array.from({ length: query.length }, (_, i) => i);
    const score = 1000 + (100 - Math.min(text.length, 100));
    return { text, score, matchPositions: positions };
  }

  // Subsequence check with position tracking
  const positions: number[] = [];
  let qi = 0;
  for (let ti = 0; ti < lowerText.length && qi < lowerQuery.length; ti++) {
    if (lowerText[ti] === lowerQuery[qi]) {
      positions.push(ti);
      qi++;
    }
  }

  if (qi < lowerQuery.length) {
    // Not all query chars found
    return null;
  }

  let score = 0;

  // Consecutive character bonus
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] === positions[i - 1] + 1) {
      score += 10;
    }
  }

  // Word boundary bonus (char after space, dash, underscore, or start)
  for (const pos of positions) {
    if (pos === 0 || /[\s\-_/]/.test(text[pos - 1])) {
      score += 5;
    }
  }

  // Short text bonus
  score += Math.max(0, 50 - text.length);

  return { text, score, matchPositions: positions };
}

/**
 * Ranks `candidates` by their fuzzy match score against `query`.
 * Candidates that don't match are filtered out.
 * Results are sorted descending by score.
 */
export function rankCandidates(
  query: string,
  candidates: MatchCandidate[],
  limit: number,
): Suggestion[] {
  const scored: Array<{ candidate: MatchCandidate; fuzzy: FuzzyScore }> = [];

  for (const candidate of candidates) {
    const fuzzy = fuzzyScore(query, candidate.text);
    if (fuzzy === null) continue;

    // Boost score by frequency (log scale, capped to avoid dominating fuzzy score)
    const freqBoost = Math.log1p(candidate.frequency) * 8;
    // History entries get a slight source bonus
    const sourceBoost = candidate.source === "history" ? 5 : 0;

    scored.push({
      candidate,
      fuzzy: { ...fuzzy, score: fuzzy.score + freqBoost + sourceBoost },
    });
  }

  scored.sort((a, b) => b.fuzzy.score - a.fuzzy.score);

  return scored.slice(0, limit).map(({ candidate, fuzzy }) => ({
    text: candidate.text,
    description: candidate.description,
    source: candidate.source,
    score: fuzzy.score,
  }));
}
