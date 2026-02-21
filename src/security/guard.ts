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
    // Matches rm with a recursive flag (-r/-R/-rf/-rfc etc.) with optional
    // preceding flags (e.g. -f -r /) targeting root, home, or $HOME.
    pattern: /rm\s+(?:-\S+\s+)*-\S*[rR]\S*(?:\s+-\S+)*\s+(\/|~|\$HOME)(?:\s|$)/,
    severity: "critical",
    reason: "Recursively deletes root or home directory",
    description: "rm -rf / or rm -rf ~",
  },
  {
    // Flexible spacing: detects :(){ :|:&};: and variants like :(){ :|:&}
    pattern: /:\s*\(\s*\)\s*\{?\s*:\s*\|\s*:\s*&/,
    severity: "critical",
    reason: "Fork bomb — will exhaust system resources",
    description: ":(){:|:&};:",
  },
  {
    // Includes macOS raw disk devices (/dev/rdisk*) in addition to Linux forms
    pattern: /dd\s+.*of=\/dev\/(sd|hd|nvme|disk|rdisk)/,
    severity: "critical",
    reason: "Overwrites a raw disk device",
    description: "dd if=... of=/dev/sd* or /dev/rdisk*",
  },
  {
    pattern: /\bsudo\b/,
    severity: "high",
    reason: "Runs command with elevated privileges",
    description: "sudo",
  },
  {
    // Checks the LAST octal digit (others permissions): 2/3/6/7 = write bit set.
    // Avoids false-positives like chmod 644 or chmod 600.
    pattern: /chmod\s+[0-7]{0,3}[2367](?:\s|$)/,
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
    pattern: /\brm\s+(--recursive|--force\s+.*--recursive|--recursive\s+.*--force)\b/,
    severity: "critical",
    reason: "Recursively deletes files using long-form flags",
    description: "rm --recursive",
  },
  {
    pattern: /rm\s+-[^\s]*r/,
    severity: "medium",
    reason: "Recursively removes files",
    description: "rm -r",
  },
  {
    pattern: /(curl|wget)\s+.*\|\s*(ba|z|da)?sh/,
    severity: "low",
    reason: "Pipes remote content directly into a shell",
    description: "curl/wget | sh/bash/zsh/dash",
  },
  {
    pattern: /chmod\s+[augo]*[+][rwx]*w[rwx]*(?:\s|$)/,
    severity: "high",
    reason: "Adds write permission using symbolic mode",
    description: "chmod symbolic world/group writable",
  },
  {
    pattern: /\beval\b/,
    severity: "high",
    reason: "Evaluates a string as a shell command (code injection risk)",
    description: "eval",
  },
  {
    pattern: /^\.\s+\//,
    severity: "medium",
    reason: "Sources (executes) a script from an absolute path",
    description: ". /path/to/script (dot/source command)",
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
