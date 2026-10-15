// Inherit stage: license gate for tools/ci (CI-only tooling; nothing ships).
// Reads licenses straight from tools/ci/package-lock.json, so it needs no
// install and no license-checker dependency of its own.
//   - a single license must be on ALLOWED
//   - "A OR B" passes if any side is allowed; "A AND B" only if every side is
//   - anything else (mixed AND/OR, missing) fails unless the package is in
//     REVIEWED with exactly that license string, so a license change on a
//     reviewed package fails again and forces a fresh look.
// Run: node scripts/check-licenses.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const ALLOWED = new Set([
  "MIT", "ISC", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "0BSD",
  "MPL-2.0", "Zlib", "CC0-1.0", "CC-BY-4.0", "Python-2.0", "BlueOak-1.0.0", "Unlicense",
]);

// package name -> the exact license string that was reviewed (with a reason).
export const REVIEWED = {};

export function isAllowed(expr) {
  const e = String(expr).trim().replace(/^\((.*)\)$/, "$1").trim();
  const hasAnd = / AND /.test(e);
  const hasOr = / OR /.test(e);
  if (hasAnd && hasOr) return false;
  if (hasOr) return e.split(" OR ").some((p) => ALLOWED.has(p.trim()));
  if (hasAnd) return e.split(" AND ").every((p) => ALLOWED.has(p.trim()));
  return ALLOWED.has(e);
}

export function checkLockfile(lock, reviewed = REVIEWED) {
  const failures = [];
  let count = 0;
  for (const [path, info] of Object.entries(lock.packages || {})) {
    if (path === "") continue; // the tools/ci package itself
    if (info.link) continue; // symlink; its target has its own entry
    count++;
    const nm = path.lastIndexOf("node_modules/");
    const name = info.name || (nm === -1 ? path : path.slice(nm + "node_modules/".length));
    const license = info.license ? String(info.license) : "UNKNOWN";
    if (isAllowed(license)) continue;
    if (reviewed[name] === license) continue;
    failures.push(reviewed[name]
      ? `${name}@${info.version}: license changed from reviewed "${reviewed[name]}" to "${license}"`
      : `${name}@${info.version}: "${license}" is not allowed`);
  }
  return { count, failures };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const lock = JSON.parse(readFileSync(new URL("../tools/ci/package-lock.json", import.meta.url), "utf8"));
  const { count, failures } = checkLockfile(lock);
  if (failures.length) {
    process.stderr.write(`License check failed (${failures.length}):\n${failures.map((f) => `  - ${f}`).join("\n")}\n`
      + "Review the package, then add its license to ALLOWED or the package to REVIEWED in scripts/check-licenses.mjs.\n");
    process.exit(1);
  }
  process.stdout.write(`License check passed (${count} packages in tools/ci).\n`);
}
