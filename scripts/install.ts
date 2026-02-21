#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-run
/**
 * install.ts - nen installer script.
 *
 * Steps:
 *   1. Compile nen binary (deno compile)
 *   2. Copy binary to ~/.local/bin/nen + chmod +x
 *   3. Create log directory ~/Library/Logs/nen
 *   4. Instantiate com.nen.daemon.plist template
 *   5. Install LaunchAgent to ~/Library/LaunchAgents/
 *   6. launchctl bootstrap / reload the agent
 *   7. Copy shell/nen.zsh to ~/.nen/nen.zsh
 *   8. Append source line to ~/.zshrc (idempotent)
 *   9. Print success message
 */

// ---------------------------------------------------------------------------
// Pure helper functions (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Replaces all `__KEY__` placeholders in template with values from vars.
 * Unknown placeholders are left untouched.
 */
export function substituteTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/__([A-Z_]+)__/g, (_match, key: string) => vars[key] ?? _match);
}

/**
 * Returns true when `line` is NOT already present in `content`.
 */
export function needsSourceLine(content: string, line: string): boolean {
  return !content.includes(line);
}

// ---------------------------------------------------------------------------
// Installer utilities
// ---------------------------------------------------------------------------

const HOME = Deno.env.get("HOME") ?? "/tmp";
const SOURCE_LINE = 'source "$HOME/.nen/nen.zsh"';

async function run(cmd: string[]): Promise<void> {
  const proc = new Deno.Command(cmd[0], { args: cmd.slice(1) });
  const { code, stderr } = await proc.output();
  if (code !== 0) {
    const errText = new TextDecoder().decode(stderr);
    throw new Error(`Command failed [${cmd.join(" ")}]: ${errText}`);
  }
}

async function runIgnoreError(cmd: string[]): Promise<void> {
  try {
    await run(cmd);
  } catch {
    // ignore — e.g. launchctl bootout when not loaded
  }
}

// ---------------------------------------------------------------------------
// Main installer
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("[nen] Installing...");

  // Step 1: Compile binary
  console.log("[nen] Compiling binary...");
  await run(["deno", "task", "compile"]);

  // Step 2: Copy binary to ~/.local/bin
  const binDir = `${HOME}/.local/bin`;
  await Deno.mkdir(binDir, { recursive: true });
  await Deno.copyFile("./nen", `${binDir}/nen`);
  await run(["chmod", "+x", `${binDir}/nen`]);
  console.log(`[nen] Binary installed → ${binDir}/nen`);

  // Step 3: Create log directory
  const logDir = `${HOME}/Library/Logs/nen`;
  await Deno.mkdir(logDir, { recursive: true });

  // Step 4: Instantiate plist template
  const plistTemplate = await Deno.readTextFile("./launchd/com.nen.daemon.plist");
  const plist = substituteTemplate(plistTemplate, {
    NEN_BINARY_PATH: `${binDir}/nen`,
    NEN_LOG_DIR: logDir,
    HOME,
    PATH: Deno.env.get("PATH") ?? "",
  });

  // Step 5: Install LaunchAgent
  const agentDir = `${HOME}/Library/LaunchAgents`;
  await Deno.mkdir(agentDir, { recursive: true });
  const plistPath = `${agentDir}/com.nen.daemon.plist`;
  await Deno.writeTextFile(plistPath, plist);
  console.log(`[nen] LaunchAgent installed → ${plistPath}`);

  // Step 6: Load LaunchAgent
  const uid = Deno.uid();
  await runIgnoreError(["launchctl", "bootout", `gui/${uid}`, plistPath]);
  await run(["launchctl", "bootstrap", `gui/${uid}`, plistPath]);
  console.log("[nen] LaunchAgent loaded");

  // Step 7: Copy shell integration
  const nenDir = `${HOME}/.nen`;
  await Deno.mkdir(nenDir, { recursive: true });
  await Deno.copyFile("./shell/nen.zsh", `${nenDir}/nen.zsh`);

  // Step 8: Patch ~/.zshrc (idempotent)
  const zshrc = `${HOME}/.zshrc`;
  const zshrcContent = await Deno.readTextFile(zshrc).catch(() => "");
  if (needsSourceLine(zshrcContent, SOURCE_LINE)) {
    await Deno.writeTextFile(
      zshrc,
      `${zshrcContent}\n# nen — inline suggestions\n${SOURCE_LINE}\n`,
    );
    console.log(`[nen] Patched ${zshrc}`);
  } else {
    console.log(`[nen] ${zshrc} already contains source line — skipped`);
  }

  // Step 9: Success
  console.log("\n[nen] Installation complete!");
  console.log("Restart your terminal or run: source ~/.zshrc");
}

if (import.meta.main) {
  await main();
}
