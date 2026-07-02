import { build } from "esbuild";

await build({
  entryPoints: ["src/server.ts"],
  outfile: "dist/server.cjs",
  platform: "node",
  target: "node22",
  format: "cjs",
  bundle: true,
  sourcemap: true,
  external: ["better-sqlite3"],
  logLevel: "info",
});
