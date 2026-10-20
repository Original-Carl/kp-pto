// Lists content the site is still missing, so it's visible on every CI run
// without blocking merges. Placeholders in shipped copy are blocked separately
// by tests/pages.test.mjs.
// Run: node scripts/check-content.mjs   (writes to $GITHUB_STEP_SUMMARY in CI)
import { appendFileSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const ZEFFY_FORMS = ["contributions", "vending"];

export function contentGaps(pages) {
  const gaps = [];
  for (const [file, html] of Object.entries(pages)) {
    if (file !== "support.html") continue;
    // Each Zeffy form is a hand-off link: <a data-zeffy-form="…" href="https://www.zeffy.com/…">.
    const links = [...html.replace(/<!--[\s\S]*?-->/g, "").matchAll(/<a\b[^>]*>/g)].map(([tag]) => ({
      form: /(?:^|\s)data-zeffy-form="([^"]*)"/.exec(tag)?.[1],
      href: /(?:^|\s)href="([^"]*)"/.exec(tag)?.[1] ?? "",
    }));
    for (const form of ZEFFY_FORMS) {
      if (!links.some((l) => l.form === form && l.href.startsWith("https://www.zeffy.com/"))) gaps.push(`${file}: no Zeffy link yet for ${form}`);
    }
  }
  const noindex = Object.keys(pages).filter((f) => /<meta name="robots" content="noindex/.test(pages[f]));
  if (noindex.length) gaps.push(`pre-launch noindex tag still on ${noindex.length} page(s); remove at launch`);
  const volunteer = pages["volunteer.html"] || "";
  if (!/<ul class="check-list">/.test(volunteer.replace(/<!--[\s\S]*?-->/g, ""))) gaps.push("volunteer.html: no volunteer roles listed yet");
  const contact = pages["contact.html"] || "";
  if (!/<ul class="board-grid">/.test(contact.replace(/<!--[\s\S]*?-->/g, ""))) gaps.push("contact.html: no board members listed yet");
  return gaps;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
  const pages = Object.fromEntries(readdirSync(root).filter((f) => f.endsWith(".html")).map((f) => [f, readFileSync(join(root, f), "utf8")]));
  const gaps = contentGaps(pages);
  const report = gaps.length
    ? `### Content still to add (${gaps.length})\n${gaps.map((g) => `- ${g}`).join("\n")}\n`
    : "### Content: nothing missing\n";
  process.stdout.write(report);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
}
