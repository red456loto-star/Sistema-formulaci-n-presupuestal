import { build } from "esbuild";

await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/main.cjs",
  platform: "node",
  target: "node22",
  format: "cjs",
  bundle: true,
  sourcemap: true,
  external: ["electron", "better-sqlite3"],
  logLevel: "info",
});

await build({
  entryPoints: ["src/preload.ts"],
  outfile: "dist/preload.cjs",
  platform: "node",
  target: "node22",
  format: "cjs",
  bundle: true,
  sourcemap: true,
  external: ["electron"],
  logLevel: "info",
});
