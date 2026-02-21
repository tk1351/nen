import { assertEquals } from "@std/assert";
import { parseHistoryText } from "./reader.ts";

Deno.test("parseHistoryText - parses simple format", () => {
  const raw = "git commit -m 'fix'\ngit push\n";
  const entries = parseHistoryText(raw);
  assertEquals(entries.length, 2);
  assertEquals(entries[0].command, "git commit -m 'fix'");
  assertEquals(entries[1].command, "git push");
});

Deno.test("parseHistoryText - parses extended format", () => {
  const raw = ": 1700000000:5;git log --oneline\n";
  const entries = parseHistoryText(raw);
  assertEquals(entries.length, 1);
  assertEquals(entries[0].command, "git log --oneline");
  assertEquals(entries[0].timestamp, 1700000000);
  assertEquals(entries[0].duration, 5);
});

Deno.test("parseHistoryText - skips blank lines", () => {
  const raw = "git status\n\n\ngit diff\n";
  const entries = parseHistoryText(raw);
  assertEquals(entries.length, 2);
});

Deno.test("parseHistoryText - skips comment lines", () => {
  const raw = "# this is a comment\ngit status\n";
  const entries = parseHistoryText(raw);
  assertEquals(entries.length, 1);
  assertEquals(entries[0].command, "git status");
});

Deno.test("parseHistoryText - deduplicates commands (last wins)", () => {
  const raw = "git status\ngit push\ngit status\n";
  const entries = parseHistoryText(raw);
  const commands = entries.map((e) => e.command);
  // "git status" appears twice; only one should remain
  assertEquals(commands.filter((c) => c === "git status").length, 1);
  assertEquals(commands.length, 2);
});

Deno.test("parseHistoryText - empty input returns empty array", () => {
  const entries = parseHistoryText("");
  assertEquals(entries, []);
});

Deno.test("parseHistoryText - mixed simple and extended format", () => {
  const raw = [
    ": 1700000001:0;docker ps",
    "ls -la",
    ": 1700000002:3;npm install",
  ].join("\n");
  const entries = parseHistoryText(raw);
  assertEquals(entries.length, 3);
  assertEquals(entries[0].command, "docker ps");
  assertEquals(entries[0].timestamp, 1700000001);
  assertEquals(entries[1].command, "ls -la");
  assertEquals(entries[1].timestamp, undefined);
});

Deno.test("parseHistoryText - extended format with zero duration", () => {
  const raw = ": 1700000000:0;echo hello\n";
  const entries = parseHistoryText(raw);
  assertEquals(entries[0].duration, 0);
});

Deno.test("parseHistoryText - caps output at 10,000 entries", () => {
  // Generate 11,000 unique commands
  const lines = Array.from({ length: 11_000 }, (_, i) => `echo cmd_${i}`).join("\n");
  const entries = parseHistoryText(lines);
  assertEquals(entries.length, 10_000);
});
