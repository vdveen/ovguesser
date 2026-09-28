// Bundles the server (and the shared game code it imports) into one ESM file.
import { build } from "esbuild";

await build({
  entryPoints: ["server/main.ts"],
  outfile: "dist/server/main.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  sourcemap: true,
  logLevel: "info",
});
