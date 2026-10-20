// Copies exactly the files that ship into _site/. Used by the deploy and by
// the browser tests, so the tests run against what visitors get.
// Run: node scripts/stage-site.mjs
import { cpSync, rmSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");

// Every top-level page, plus robots.txt / sitemap.xml once they exist, plus asset folders.
export const PUBLIC = [
  ...readdirSync(root).filter((f) => f.endsWith(".html") || f === "robots.txt" || f === "sitemap.xml").sort(),
  "css", "js", "fonts", "assets",
];
const out = join(root, "_site");
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const entry of PUBLIC) cpSync(join(root, entry), join(out, entry), { recursive: true });
process.stdout.write(`Staged ${PUBLIC.join(", ")} into _site/\n`);
