/**
 * scanner.bench.ts - Benchmarks for PATH command scanning.
 */

import { scanPathCommands } from "./scanner.ts";

Deno.bench("scanPathCommands - /usr/bin only", async () => {
  await scanPathCommands("/usr/bin");
});

Deno.bench("scanPathCommands - /usr/bin:/usr/sbin:/bin", async () => {
  await scanPathCommands("/usr/bin:/usr/sbin:/bin");
});

Deno.bench("scanPathCommands - full $PATH", async () => {
  await scanPathCommands(Deno.env.get("PATH") ?? "/usr/bin:/usr/sbin:/bin");
});
