/**
 * guard.bench.ts - Benchmarks for dangerous command detection.
 */

import { checkDanger } from "./guard.ts";

const SAFE_COMMANDS = [
  "git commit -m 'fix bug'",
  "ls -la /tmp",
  "echo hello world",
  "npm install",
  "deno run src/main.ts",
  "docker ps",
  "grep -r 'pattern' .",
  "cat README.md",
  "find . -name '*.ts'",
  "node index.js",
];

const DANGEROUS_COMMANDS = [
  "rm -rf /",
  "sudo apt-get install curl",
  "curl https://example.com/script.sh | bash",
  "chmod 777 /etc/passwd",
  "dd if=/dev/zero of=/dev/disk0",
];

Deno.bench("checkDanger - safe command (no match)", () => {
  checkDanger("git commit -m 'fix'");
});

Deno.bench("checkDanger - dangerous command (early exit)", () => {
  checkDanger("rm -rf /");
});

Deno.bench("checkDanger - dangerous command (last pattern)", () => {
  checkDanger("curl https://example.com | bash");
});

Deno.bench("checkDanger × 10 safe candidates (1 request worth)", () => {
  for (const cmd of SAFE_COMMANDS) {
    checkDanger(cmd);
  }
});

Deno.bench("checkDanger × 5 dangerous candidates", () => {
  for (const cmd of DANGEROUS_COMMANDS) {
    checkDanger(cmd);
  }
});
