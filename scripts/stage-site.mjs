// Copies exactly the files that ship into _site/. Used by the deploy and by
// the browser tests, so the tests run against what visitors get.
// Also writes _site/version.json ({ commit, built_at }) so the deploy's smoke
// test (and later the Operate checks) can tell which commit is live.
// Run: node scripts/stage-site.mjs   (commit: $SITE_COMMIT, else git HEAD)
import { execFileSync } from "node:child_process";
import { cpSync, rmSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");

// Every top-level page, plus robots.txt / sitemap.xml once they exist, plus asset folders.
export const PUBLIC = [
  ...readdirSync(root).filter((f) => f.endsWith(".html") || f === "robots.txt" || f === "sitemap.xml").sort(),
  "css", "js", "fonts", "assets",
];

// The version.json body. SITE_COMMIT wins (the deploy sets it to the commit it
// deploys); otherwise gitHead() is asked. Anything but a full 40-hex SHA
// becomes "unknown", which the browser test rejects.
export function siteVersion(env, gitHead, now = new Date()) {
  let commit = env.SITE_COMMIT;
  if (!commit) {
    try {
      commit = gitHead();
    } catch {
      commit = "";
    }
  }
  commit = String(commit).trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(commit)) commit = "unknown";
  return { commit, built_at: now.toISOString() };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = join(root, "_site");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out);
  for (const entry of PUBLIC) cpSync(join(root, entry), join(out, entry), { recursive: true });
  const version = siteVersion(process.env, () => execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }));
  writeFileSync(join(out, "version.json"), `${JSON.stringify(version)}\n`);
  process.stdout.write(`Staged ${PUBLIC.join(", ")} and version.json (${version.commit.slice(0, 7)}) into _site/\n`);
}
