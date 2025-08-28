// src/scripts/compile.ts
const DATA_DIR = Deno.env.get("DATA_DIR") ?? "./dist";
await Deno.mkdir(DATA_DIR, { recursive: true });

const args = new Set(Deno.args);
const only = args.has("--sync")
  ? "sync"
  : args.has("--server")
  ? "server"
  : "both";

async function run(cmdArgs: string[]) {
  const cmd = new Deno.Command("deno", {
    args: cmdArgs,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const { code } = await cmd.output();
  if (code !== 0) Deno.exit(code);
}

if (only === "sync" || only === "both") {
  await run([
    "compile",
    "--allow-env",
    "--allow-read",
    "--allow-write",
    "--allow-net",
    "--allow-run",
    "src/sync.ts",
    "-o",
    `${DATA_DIR}/sync`,
  ]);
}

if (only === "server" || only === "both") {
  await run([
    "compile",
    "--allow-env",
    "--allow-read",
    "--allow-net",
    "src/server.ts",
    "-o",
    `${DATA_DIR}/server`,
  ]);
}
