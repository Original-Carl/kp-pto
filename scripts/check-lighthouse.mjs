// Operate stage: Lighthouse budgets for the live site. Reads Lighthouse JSON
// reports (several runs per page; the Operate workflow makes them with the
// `lighthouse` CLI from tools/ci, mobile with simulated slow 4G, its defaults)
// and fails if any page's median score in a category is under BUDGETS.
// The median damps run-to-run noise in the performance score. Node built-ins only.
// Run: node scripts/check-lighthouse.mjs <report.json>...
import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Category id -> minimum score (0–100).
export const BUDGETS = {
  performance: 90,
  accessibility: 95,
  "best-practices": 90,
  seo: 90,
};

export function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// reports: parsed Lighthouse results. Returns { rows, errors }, where rows is
// one { url, scores: { category: median } } per page, in first-seen order.
export function checkReports(reports, budgets = BUDGETS) {
  const errors = [];
  const byUrl = new Map();
  for (const lhr of reports) {
    const url = lhr.requestedUrl;
    if (lhr.runtimeError) {
      errors.push(`${url}: Lighthouse couldn't load the page (${lhr.runtimeError.code})`);
      continue;
    }
    if (!byUrl.has(url)) byUrl.set(url, []);
    byUrl.get(url).push(lhr);
  }
  const rows = [];
  for (const [url, runs] of byUrl) {
    const scores = {};
    for (const [category, min] of Object.entries(budgets)) {
      const values = runs.map((r) => r.categories?.[category]?.score).filter((s) => typeof s === "number");
      if (!values.length) {
        errors.push(`${url}: no ${category} score in any run`);
        continue;
      }
      scores[category] = Math.round(median(values) * 100);
      if (scores[category] < min) errors.push(`${url}: ${category} ${scores[category]} is under the budget of ${min} (median of ${values.length} runs)`);
    }
    rows.push({ url, scores });
  }
  if (!reports.length) errors.push("no Lighthouse reports to check");
  return { rows, errors };
}

export function summaryTable(rows, budgets = BUDGETS) {
  const cats = Object.keys(budgets);
  const head = `| Page | ${cats.map((c) => `${c} (≥ ${budgets[c]})`).join(" | ")} |`;
  const sep = `|---|${cats.map(() => "---:").join("|")}|`;
  const body = rows.map(({ url, scores }) => `| ${url} | ${cats.map((c) => scores[c] ?? "–").join(" | ")} |`);
  return [head, sep, ...body].join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const reports = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, "utf8")));
  const { rows, errors } = checkReports(reports);
  const table = summaryTable(rows);
  process.stdout.write(`${table}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Lighthouse (mobile, median)\n${table}\n`);
  if (errors.length) {
    process.stderr.write(`Lighthouse check failed (${errors.length}):\n${errors.map((e) => `  - ${e}`).join("\n")}\n`);
    process.exit(1);
  }
  process.stdout.write(`Lighthouse check passed: ${rows.length} pages within budget.\n`);
}
