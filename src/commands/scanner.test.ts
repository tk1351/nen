import { assertEquals, assertGreater } from "@std/assert";
import { scanPathCommands } from "./scanner.ts";

Deno.test("scanPathCommands - finds executables in PATH", async () => {
  // Use /usr/bin which always exists on macOS
  const candidates = await scanPathCommands("/usr/bin");
  assertGreater(candidates.length, 0);
  // All results should be source="command"
  for (const c of candidates) {
    assertEquals(c.source, "command");
  }
});

Deno.test("scanPathCommands - known command is found", async () => {
  // ls and cat are always present in /bin or /usr/bin on macOS
  const candidates = await scanPathCommands("/bin:/usr/bin");
  const names = candidates.map((c) => c.text);
  assertEquals(names.includes("ls") || names.includes("cat"), true);
});

Deno.test("scanPathCommands - non-existent directory is silently skipped", async () => {
  const candidates = await scanPathCommands("/nonexistent_dir_nen_test");
  assertEquals(candidates, []);
});

Deno.test("scanPathCommands - empty PATH returns empty array", async () => {
  const candidates = await scanPathCommands("");
  assertEquals(candidates, []);
});

Deno.test("scanPathCommands - deduplicates commands appearing in multiple dirs", async () => {
  // Pass the same dir twice
  const candidates = await scanPathCommands("/usr/bin:/usr/bin");
  const names = candidates.map((c) => c.text);
  const unique = new Set(names);
  assertEquals(names.length, unique.size);
});

Deno.test("scanPathCommands - all candidates have frequency=0", async () => {
  const candidates = await scanPathCommands("/usr/bin");
  for (const c of candidates) {
    assertEquals(c.frequency, 0);
  }
});
