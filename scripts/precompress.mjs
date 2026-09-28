// Writes .br and .gz next to every compressible file in dist/client, so the server can send them as-is.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const root = "dist/client";
const compressible = /\.(js|mjs|css|html|json|svg|webmanifest|map)$/;
let count = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (compressible.test(name) && statSync(path).size > 1024) {
      const data = readFileSync(path);
      writeFileSync(`${path}.br`, brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }));
      writeFileSync(`${path}.gz`, gzipSync(data, { level: 9 }));
      count++;
    }
  }
}
walk(root);
console.log(`precompressed ${count} files`);
