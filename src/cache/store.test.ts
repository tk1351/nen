import { assertEquals, assertGreater } from "@std/assert";
import { openStore } from "./store.ts";
import type { CacheEntry } from "../types.ts";

function tmpPath(): string {
  return `/tmp/nen_test_${Date.now()}_${Math.random().toString(36).slice(2)}.db`;
}

Deno.test("CacheStore - upsert and query", () => {
  const path = tmpPath();
  const store = openStore(path);
  try {
    const entry: CacheEntry = {
      command: "git commit",
      source: "history",
      frequency: 1,
      lastUsed: Date.now(),
    };
    store.upsert(entry);
    const results = store.queryPrefix("git", 10);
    assertEquals(results.length, 1);
    assertEquals(results[0].text, "git commit");
    assertEquals(results[0].source, "history");
  } finally {
    store.close();
  }
});

Deno.test("CacheStore - upsert increments frequency on conflict", () => {
  const path = tmpPath();
  const store = openStore(path);
  try {
    const entry: CacheEntry = {
      command: "git push",
      source: "history",
      frequency: 1,
      lastUsed: Date.now(),
    };
    store.upsert(entry);
    store.upsert(entry);
    const results = store.queryPrefix("git push", 10);
    assertEquals(results.length, 1);
    assertGreater(results[0].frequency, 1);
  } finally {
    store.close();
  }
});

Deno.test("CacheStore - bulkInsert ignores duplicates", () => {
  const path = tmpPath();
  const store = openStore(path);
  try {
    const entries: CacheEntry[] = [
      { command: "ls", source: "command", frequency: 0, lastUsed: 0 },
      { command: "ls", source: "command", frequency: 0, lastUsed: 0 },
      { command: "cat", source: "command", frequency: 0, lastUsed: 0 },
    ];
    store.bulkInsert(entries);
    assertEquals(store.count(), 2);
  } finally {
    store.close();
  }
});

Deno.test("CacheStore - queryPrefix returns prefix-matched results only", () => {
  const path = tmpPath();
  const store = openStore(path);
  try {
    store.bulkInsert([
      { command: "git commit", source: "history", frequency: 5, lastUsed: 0 },
      { command: "git push", source: "history", frequency: 3, lastUsed: 0 },
      { command: "docker run", source: "history", frequency: 8, lastUsed: 0 },
    ]);
    const results = store.queryPrefix("git", 10);
    assertEquals(results.length, 2);
    for (const r of results) {
      assertEquals(r.text.startsWith("git"), true);
    }
  } finally {
    store.close();
  }
});

Deno.test("CacheStore - queryPrefix respects limit", () => {
  const path = tmpPath();
  const store = openStore(path);
  try {
    store.bulkInsert([
      { command: "git commit", source: "history", frequency: 1, lastUsed: 0 },
      { command: "git push", source: "history", frequency: 2, lastUsed: 0 },
      { command: "git log", source: "history", frequency: 3, lastUsed: 0 },
      { command: "git status", source: "history", frequency: 4, lastUsed: 0 },
    ]);
    const results = store.queryPrefix("git", 2);
    assertEquals(results.length, 2);
  } finally {
    store.close();
  }
});

Deno.test("CacheStore - queryPrefix returns results ordered by frequency desc", () => {
  const path = tmpPath();
  const store = openStore(path);
  try {
    store.bulkInsert([
      { command: "git commit", source: "history", frequency: 1, lastUsed: 0 },
      { command: "git push", source: "history", frequency: 10, lastUsed: 0 },
      { command: "git log", source: "history", frequency: 5, lastUsed: 0 },
    ]);
    const results = store.queryPrefix("git", 10);
    assertEquals(results[0].text, "git push");
    assertEquals(results[1].text, "git log");
    assertEquals(results[2].text, "git commit");
  } finally {
    store.close();
  }
});

Deno.test("CacheStore - count and clear", () => {
  const path = tmpPath();
  const store = openStore(path);
  try {
    store.bulkInsert([
      { command: "echo hello", source: "history", frequency: 1, lastUsed: 0 },
      { command: "echo world", source: "history", frequency: 1, lastUsed: 0 },
    ]);
    assertEquals(store.count(), 2);
    store.clear();
    assertEquals(store.count(), 0);
  } finally {
    store.close();
  }
});

Deno.test("CacheStore - LIKE special characters in prefix are escaped", () => {
  const path = tmpPath();
  const store = openStore(path);
  try {
    store.bulkInsert([
      { command: "echo %hello", source: "history", frequency: 1, lastUsed: 0 },
      { command: "echo world", source: "history", frequency: 1, lastUsed: 0 },
    ]);
    // Should match only the literal % entry
    const results = store.queryPrefix("echo %", 10);
    assertEquals(results.length, 1);
    assertEquals(results[0].text, "echo %hello");
  } finally {
    store.close();
  }
});
