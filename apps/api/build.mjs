// Bundles the API for production. npm dependencies stay external; workspace packages are inlined from source.
import { build } from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const external = Object.keys(pkg.dependencies).filter((d) => !d.startsWith("@coinfidant/"));

await build({
  entryPoints: { main: "src/main.ts", release: "src/db/release.ts" },
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  sourcemap: true,
  external: [...external, "@nestjs/microservices", "@nestjs/websockets", "class-transformer", "class-validator"],
  tsconfig: "tsconfig.json",
  logLevel: "info",
});
