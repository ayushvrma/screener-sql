// Chrome-native validation of the packaged zip.
// Checks:
//   - manifest.json is valid JSON with manifest_version === 3
//   - every file referenced from the manifest exists inside the zip
//   - every PNG icon starts with the PNG magic bytes
//   - every host_permission is HTTPS
//
// Exits non-zero on any failure — safe for CI.

import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const zipArg = process.argv[2];
if (!zipArg) {
  console.error("usage: node validate-package.mjs <path-to-zip>");
  process.exit(1);
}
const zipPath = resolve(HERE, "..", "..", zipArg);
const workDir = mkdtempSync(join(tmpdir(), "screener-nl-validate-"));

try {
  execFileSync("unzip", ["-q", zipPath, "-d", workDir], { stdio: "inherit" });

  const manifest = JSON.parse(readFileSync(join(workDir, "manifest.json"), "utf8"));
  const errors = [];

  if (manifest.manifest_version !== 3) errors.push(`manifest_version must be 3, got ${manifest.manifest_version}`);
  if (!manifest.name) errors.push("manifest.name missing");
  if (!manifest.version || !/^\d+\.\d+\.\d+$/.test(manifest.version)) errors.push(`invalid version: ${manifest.version}`);

  const referenced = new Set();
  const addRef = (p) => p && referenced.add(p);
  addRef(manifest.background?.service_worker);
  addRef(manifest.action?.default_popup);
  addRef(manifest.options_ui?.page);
  Object.values(manifest.icons || {}).forEach(addRef);
  Object.values(manifest.action?.default_icon || {}).forEach(addRef);
  for (const cs of manifest.content_scripts || []) {
    (cs.js || []).forEach(addRef);
    (cs.css || []).forEach(addRef);
  }
  for (const war of manifest.web_accessible_resources || []) {
    (war.resources || []).forEach(addRef);
  }

  for (const p of referenced) {
    try { readFileSync(join(workDir, p)); }
    catch { errors.push(`referenced file missing from zip: ${p}`); }
  }

  // PNG icons: magic bytes 89 50 4E 47 0D 0A 1A 0A
  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const icons = [
    ...Object.values(manifest.icons || {}),
    ...Object.values(manifest.action?.default_icon || {}),
  ];
  for (const iconPath of new Set(icons)) {
    try {
      const buf = readFileSync(join(workDir, iconPath));
      if (!buf.subarray(0, 8).equals(pngMagic)) errors.push(`not a valid PNG: ${iconPath}`);
    } catch { /* referenced-file check already logged */ }
  }

  for (const host of manifest.host_permissions || []) {
    if (!/^https:\/\//.test(host)) errors.push(`host_permission must be HTTPS: ${host}`);
  }
  for (const cs of manifest.content_scripts || []) {
    for (const match of cs.matches || []) {
      if (!/^https:\/\//.test(match) && !/^\*:/.test(match)) errors.push(`content_script match must be HTTPS: ${match}`);
    }
  }

  if (errors.length) {
    console.error(`\n${errors.length} problem(s) found in ${zipArg}:`);
    for (const e of errors) console.error("  - " + e);
    process.exit(1);
  }
  console.log(`ok: ${zipArg} — MV3, ${referenced.size} referenced files present, ${icons.length} valid PNGs, ${(manifest.host_permissions || []).length} HTTPS host permissions`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
