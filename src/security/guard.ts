/**
 * guard.ts - Dangerous command detection (pure functions, zero dependencies).
 */

import type { DangerResult, DangerSeverity } from "../types.ts";

interface DangerPattern {
  pattern: RegExp;
  severity: DangerSeverity;
  reason: string;
  description: string;
}

const DANGER_PATTERNS: DangerPattern[] = [
  {
    pattern: /rm\s+-[^\s]*r[^\s]*\s+(\/|~|\$HOME)\b/,
    severity: "critical",
    reason: "Recursively deletes root or home directory",
    description: "rm -rf / or rm -rf ~",
  },
  {
    pattern: /:\(\)\s*\{?\s*:\s*\|\s*:&\s*\}?\s*;?\s*:/,
    severity: "critical",
    reason: "Fork bomb — will exhaust system resources",
    description: ":(){:|:&};:",
  },
  {
    pattern: /dd\s+.*of=\/dev\/(sd|hd|nvme|disk)/,
    severity: "critical",
    reason: "Overwrites a raw disk device",
    description: "dd if=... of=/dev/sd*",
  },
  {
    pattern: /\bsudo\b/,
    severity: "high",
    reason: "Runs command with elevated privileges",
    description: "sudo",
  },
  {
    pattern: /chmod\s+[0-7]*[2367][0-7]{2}/,
    severity: "high",
    reason: "Makes file world-writable",
    description: "chmod world-writable",
  },
  {
    pattern: /\b(DROP\s+TABLE|DROP\s+DATABASE)\b/i,
    severity: "high",
    reason: "Destructive SQL statement",
    description: "DROP TABLE/DATABASE",
  },
  {
    pattern: /rm\s+-[^\s]*r/,
    severity: "medium",
    reason: "Recursively removes files",
    description: "rm -r",
  },
  {
    pattern: /(curl|wget)\s+.*\|\s*(ba)?sh/,
    severity: "low",
    reason: "Pipes remote content directly into a shell",
    description: "curl/wget | sh",
  },
];

/**
 * Checks whether the given command matches any known dangerous pattern.
 * Returns a DangerResult with isDangerous=false if no pattern matches.
 */
export function checkDanger(command: string): DangerResult {
  for (const dp of DANGER_PATTERNS) {
    if (dp.pattern.test(command)) {
      return {
        isDangerous: true,
        severity: dp.severity,
        reason: dp.reason,
        pattern: dp.description,
      };
    }
  }
  return {
    isDangerous: false,
    severity: "low",
    reason: "",
    pattern: "",
  };
}
