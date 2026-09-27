// Bundles the API for production. npm dependencies stay external; workspace packages are inlined from source.
import { build, context } from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const external = Object.keys(pkg.dependencies).filter((d) => !d.startsWith("@coinfidant/"));

const options = {
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
};

// Dev runs this bundle too: tsx's require hook would load the ESM-only @nestjs/core a second time for CJS
// packages like @nestjs/throttler, and Nest's DI then can't match their Reflector.
if (process.argv.includes("--watch")) await (await context(options)).watch();
else await build(options);
