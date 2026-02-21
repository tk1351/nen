import { assertEquals } from "@std/assert";
import { needsSourceLine, substituteTemplate } from "./install.ts";

Deno.test("substituteTemplate - replaces all placeholders", () => {
  const template = "__HOME__/.local/bin/__NAME__";
  const result = substituteTemplate(template, { HOME: "/home/user", NAME: "nen" });
  assertEquals(result, "/home/user/.local/bin/nen");
});

Deno.test("substituteTemplate - unknown placeholders left untouched", () => {
  const template = "__KNOWN__ and __UNKNOWN__";
  const result = substituteTemplate(template, { KNOWN: "replaced" });
  assertEquals(result, "replaced and __UNKNOWN__");
});

Deno.test("substituteTemplate - empty vars leaves template unchanged", () => {
  const template = "__FOO__/__BAR__";
  assertEquals(substituteTemplate(template, {}), "__FOO__/__BAR__");
});

Deno.test("needsSourceLine - returns false when line present", () => {
  const content = 'some stuff\nsource "$HOME/.nen/nen.zsh"\nmore stuff';
  assertEquals(needsSourceLine(content, 'source "$HOME/.nen/nen.zsh"'), false);
});

Deno.test("needsSourceLine - returns true when line absent", () => {
  const content = "some stuff\nmore stuff";
  assertEquals(needsSourceLine(content, 'source "$HOME/.nen/nen.zsh"'), true);
});

Deno.test("needsSourceLine - handles empty content", () => {
  assertEquals(needsSourceLine("", 'source "$HOME/.nen/nen.zsh"'), true);
});

Deno.test("plist substitution - all 4 placeholders replaced in real template", async () => {
  const templatePath = new URL("../launchd/com.nen.daemon.plist", import.meta.url);
  const template = await Deno.readTextFile(templatePath);
  const vars: Record<string, string> = {
    NEN_BINARY_PATH: "/home/user/.local/bin/nen",
    NEN_LOG_DIR: "/home/user/Library/Logs/nen",
    HOME: "/home/user",
    PATH: "/usr/bin:/bin",
  };
  const result = substituteTemplate(template, vars);
  // No remaining placeholders
  assertEquals(result.includes("__"), false);
  // Substituted values appear in output
  assertEquals(result.includes("/home/user/.local/bin/nen"), true);
  assertEquals(result.includes("/home/user/Library/Logs/nen"), true);
  assertEquals(result.includes("/home/user"), true);
});
