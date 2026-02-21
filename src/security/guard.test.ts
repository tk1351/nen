import { assertEquals } from "@std/assert";
import { checkDanger } from "./guard.ts";

Deno.test("checkDanger - safe command returns isDangerous=false", () => {
  const result = checkDanger("ls -la");
  assertEquals(result.isDangerous, false);
});

Deno.test("checkDanger - rm -rf / is critical", () => {
  const result = checkDanger("rm -rf /");
  assertEquals(result.isDangerous, true);
  assertEquals(result.severity, "critical");
});

Deno.test("checkDanger - rm -rf ~ is critical", () => {
  const result = checkDanger("rm -rf ~");
  assertEquals(result.isDangerous, true);
  assertEquals(result.severity, "critical");
});

Deno.test("checkDanger - fork bomb is critical", () => {
  const result = checkDanger(":(){:|:&};:");
  assertEquals(result.isDangerous, true);
  assertEquals(result.severity, "critical");
});

Deno.test("checkDanger - dd to disk is critical", () => {
  const result = checkDanger("dd if=/dev/zero of=/dev/sda");
  assertEquals(result.isDangerous, true);
  assertEquals(result.severity, "critical");
});

Deno.test("checkDanger - sudo is high", () => {
  const result = checkDanger("sudo apt install something");
  assertEquals(result.isDangerous, true);
  assertEquals(result.severity, "high");
});

Deno.test("checkDanger - chmod world-writable is high", () => {
  const result = checkDanger("chmod 777 myfile");
  assertEquals(result.isDangerous, true);
  assertEquals(result.severity, "high");
});

Deno.test("checkDanger - DROP TABLE is high", () => {
  const result = checkDanger("DROP TABLE users");
  assertEquals(result.isDangerous, true);
  assertEquals(result.severity, "high");
});

Deno.test("checkDanger - DROP DATABASE is high", () => {
  const result = checkDanger("DROP DATABASE mydb");
  assertEquals(result.isDangerous, true);
  assertEquals(result.severity, "high");
});

Deno.test("checkDanger - rm -r is medium", () => {
  const result = checkDanger("rm -r somedir");
  assertEquals(result.isDangerous, true);
  assertEquals(result.severity, "medium");
});

Deno.test("checkDanger - curl | sh is low", () => {
  const result = checkDanger("curl https://example.com/install.sh | sh");
  assertEquals(result.isDangerous, true);
  assertEquals(result.severity, "low");
});

Deno.test("checkDanger - wget | bash is low", () => {
  const result = checkDanger("wget -O - https://example.com | bash");
  assertEquals(result.isDangerous, true);
  assertEquals(result.severity, "low");
});

Deno.test("checkDanger - echo is safe", () => {
  const result = checkDanger("echo hello world");
  assertEquals(result.isDangerous, false);
});

Deno.test("checkDanger - git commit is safe", () => {
  const result = checkDanger("git commit -m 'fix bug'");
  assertEquals(result.isDangerous, false);
});

Deno.test("checkDanger - curl | zsh is low", () => {
  const result = checkDanger("curl https://example.com/install.sh | zsh");
  assertEquals(result.isDangerous, true);
  assertEquals(result.severity, "low");
});

Deno.test("checkDanger - rm --recursive is critical", () => {
  const result = checkDanger("rm --recursive /tmp/foo");
  assertEquals(result.isDangerous, true);
  assertEquals(result.severity, "critical");
});

Deno.test("checkDanger - chmod a+w is high", () => {
  const result = checkDanger("chmod a+w /tmp/script.sh");
  assertEquals(result.isDangerous, true);
  assertEquals(result.severity, "high");
});

Deno.test("checkDanger - chmod o+w is high", () => {
  const result = checkDanger("chmod o+w myfile");
  assertEquals(result.isDangerous, true);
  assertEquals(result.severity, "high");
});

Deno.test("checkDanger - eval is high", () => {
  const result = checkDanger('eval "$var"');
  assertEquals(result.isDangerous, true);
  assertEquals(result.severity, "high");
});

Deno.test("checkDanger - dot source absolute path is medium", () => {
  const result = checkDanger(". /tmp/untrusted.sh");
  assertEquals(result.isDangerous, true);
  assertEquals(result.severity, "medium");
});
