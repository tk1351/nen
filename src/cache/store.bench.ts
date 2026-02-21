/**
 * store.bench.ts - Benchmarks for SQLite cache store.
 */

import { openStore } from "./store.ts";
import type { CacheEntry } from "../types.ts";

function tmpPath(): string {
  return `/tmp/nen_bench_${Date.now()}_${Math.random().toString(36).slice(2)}.db`;
}

function makeEntries(n: number): CacheEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    command: `command_${i} --flag-${i % 10} arg${i}`,
    source: i % 2 === 0 ? "history" : "command",
    frequency: i % 50,
    lastUsed: Date.now() - i * 1000,
  }));
}

Deno.bench("bulkInsert 100 entries", () => {
  const store = openStore(tmpPath());
  try {
    store.bulkInsert(makeEntries(100));
  } finally {
    store.close();
  }
});

Deno.bench("bulkInsert 1000 entries", () => {
  const store = openStore(tmpPath());
  try {
    store.bulkInsert(makeEntries(1000));
  } finally {
    store.close();
  }
});

Deno.bench("bulkInsert 5000 entries", () => {
  const store = openStore(tmpPath());
  try {
    store.bulkInsert(makeEntries(5000));
  } finally {
    store.close();
  }
});

Deno.bench("queryPrefix 'command_1' limit 10 (1000 entries pre-loaded)", { baseline: false }, () => {
  const store = openStore(tmpPath());
  store.bulkInsert(makeEntries(1000));
  try {
    store.queryPrefix("command_1", 10);
  } finally {
    store.close();
  }
});
