// Copies exactly the files that ship into _site/. Used by the deploy and by
// the browser tests, so the tests run against what visitors get.
// Also writes _site/version.json ({ commit, built_at }) so the deploy's smoke
// test and the Operate checks can tell which commit is live.
// Run: node scripts/stage-site.mjs   (commit: $SITE_COMMIT, else git HEAD)
import { execFileSync } from "node:child_process";
import { cpSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const PUBLIC = ["index.html", "css", "js", "fonts", "assets"];

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const out = join(root, "_site");
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const entry of PUBLIC) cpSync(join(root, entry), join(out, entry), { recursive: true });

let commit = process.env.SITE_COMMIT;
if (!commit) {
  try {
    commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    commit = "unknown";
  }
}
writeFileSync(join(out, "version.json"), `${JSON.stringify({ commit, built_at: new Date().toISOString() })}\n`);
process.stdout.write(`Staged ${PUBLIC.join(", ")} and version.json (${commit.slice(0, 7)}) into _site/\n`);
