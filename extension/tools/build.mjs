// Build a release zip of the extension.
// Uses macOS/Linux `zip` shell command via child_process — no npm deps.
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const EXT = resolve(HERE, "..");
const DIST = resolve(EXT, "dist");
mkdirSync(DIST, { recursive: true });

const manifest = JSON.parse(readFileSync(resolve(EXT, "manifest.json"), "utf8"));
const name = `screener-nl-${manifest.version}.zip`;
const out = resolve(DIST, name);
if (existsSync(out)) rmSync(out);

execFileSync(
  "zip",
  ["-r", out, "manifest.json", "src"],
  { cwd: EXT, stdio: "inherit" },
);
console.log(`\nbuilt: ${out}`);
