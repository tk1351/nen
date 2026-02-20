#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-run
/**
 * install.ts - nen installer script.
 *
 * TODO (Phase 9):
 *   1. Compile nen binary  (deno compile ...)
 *   2. Copy binary to ~/.local/bin/nen (or user-specified prefix)
 *   3. Create log directory ~/Library/Logs/nen
 *   4. Instantiate com.nen.daemon.plist template with real paths
 *   5. Install LaunchAgent to ~/Library/LaunchAgents/com.nen.daemon.plist
 *   6. launchctl bootstrap / load the agent
 *   7. Append `source ~/.nen/nen.zsh` to ~/.zshrc (idempotent)
 *   8. Copy shell/nen.zsh to ~/.nen/nen.zsh
 *   9. Print success message with next steps
 */

const HOME = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? "/tmp";

async function run(cmd: string[]): Promise<void> {
  const proc = new Deno.Command(cmd[0], { args: cmd.slice(1) });
  const { code, stderr } = await proc.output();
  if (code !== 0) {
    const errText = new TextDecoder().decode(stderr);
    throw new Error(`Command failed [${cmd.join(" ")}]: ${errText}`);
  }
}

async function main(): Promise<void> {
  console.log("nen installer — Phase 9 (not yet implemented)");

  // TODO: Step 1 — compile
  // await run(["deno", "task", "compile"]);

  // TODO: Step 2 — copy binary
  // const binDir = `${HOME}/.local/bin`;
  // await Deno.mkdir(binDir, { recursive: true });
  // await Deno.copyFile("./nen", `${binDir}/nen`);

  // TODO: Step 3 — log directory
  // const logDir = `${HOME}/Library/Logs/nen`;
  // await Deno.mkdir(logDir, { recursive: true });

  // TODO: Step 4 — instantiate plist template
  // const plistTemplate = await Deno.readTextFile("./launchd/com.nen.daemon.plist");
  // const plist = plistTemplate
  //   .replace(/__NEN_BINARY_PATH__/g, `${binDir}/nen`)
  //   .replace(/__NEN_LOG_DIR__/g, logDir)
  //   .replace(/__HOME__/g, HOME)
  //   .replace(/__PATH__/g, Deno.env.get("PATH") ?? "");

  // TODO: Step 5 — install LaunchAgent
  // const agentDir = `${HOME}/Library/LaunchAgents`;
  // await Deno.mkdir(agentDir, { recursive: true });
  // await Deno.writeTextFile(`${agentDir}/com.nen.daemon.plist`, plist);

  // TODO: Step 6 — load LaunchAgent
  // await run(["launchctl", "bootstrap", `gui/${Deno.uid()}`, `${agentDir}/com.nen.daemon.plist`]);

  // TODO: Step 7/8 — install shell integration
  // await Deno.mkdir(`${HOME}/.nen`, { recursive: true });
  // await Deno.copyFile("./shell/nen.zsh", `${HOME}/.nen/nen.zsh`);
  // const zshrc = `${HOME}/.zshrc`;
  // const zshrcContent = await Deno.readTextFile(zshrc).catch(() => "");
  // const sourceLine = 'source "$HOME/.nen/nen.zsh"';
  // if (!zshrcContent.includes(sourceLine)) {
  //   await Deno.writeTextFile(zshrc, `${zshrcContent}\n# nen\n${sourceLine}\n`);
  // }

  // TODO: Step 9 — success message
  console.log("Done. Restart your terminal or run: source ~/.zshrc");
}

await main();
