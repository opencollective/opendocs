// src/scripts/build_css.ts
const DATA_DIR = Deno.env.get("DATA_DIR") ?? "./dist";
await Deno.mkdir(DATA_DIR, { recursive: true });

const args = new Set(Deno.args);
const isProd = args.has("--prod");
const isWatch = args.has("--watch");

const out = `${DATA_DIR}/output.css`;

const deno = new Deno.Command("deno", {
  args: [
    "run",
    "--allow-env",
    "--allow-read",
    "--allow-write",
    "--allow-run",
    // keep ffi/sys since original prod task used them
    ...(isProd ? ["--allow-ffi", "--allow-sys"] : []),
    "npm:tailwindcss@^3.4.0",
    "-i",
    "./src/input.css",
    "-o",
    out,
    ...(isProd ? ["--minify"] : []),
    ...(isWatch ? ["--watch"] : []),
  ],
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

const proc = deno.spawn();
const status = await proc.status;
console.log(">>> build.ts: css written in", out);
Deno.exit(status.code);
