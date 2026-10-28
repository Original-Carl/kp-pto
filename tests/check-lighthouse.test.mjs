// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { median, checkReports, summaryTable } from "../scripts/check-lighthouse.mjs";

const HOME = "https://kp-pto.org/";
const ABOUT = "https://kp-pto.org/about.html";
const run = (url, performance, rest = {}) => ({
  requestedUrl: url,
  categories: {
    performance: { score: performance },
    accessibility: { score: 1 },
    "best-practices": { score: 1 },
    seo: { score: 1 },
    ...rest,
  },
});

test("median: odd and even counts", () => {
  assert.equal(median([0.9, 0.5, 0.7]), 0.7);
  assert.equal(median([1, 0.5]), 0.75);
});

test("checkReports: passes when every page's median is within budget", () => {
  const { rows, errors } = checkReports([run(HOME, 0.95), run(HOME, 0.97), run(HOME, 0.8), run(ABOUT, 0.99)]);
  assert.deepEqual(errors, []);
  assert.deepEqual(rows.map((r) => [r.url, r.scores.performance]), [[HOME, 95], [ABOUT, 99]]);
});

test("checkReports: one slow run doesn't fail a page, but a slow median does", () => {
  assert.deepEqual(checkReports([run(HOME, 0.6), run(HOME, 0.95), run(HOME, 0.96)]).errors, []);
  const { errors } = checkReports([run(HOME, 0.6), run(HOME, 0.85), run(HOME, 0.96)]);
  assert.deepEqual(errors, [`${HOME}: performance 85 is under the budget of 90 (median of 3 runs)`]);
});

test("checkReports: each category has its own budget", () => {
  const { errors } = checkReports([run(HOME, 1, { accessibility: { score: 0.94 }, seo: { score: 0.89 } })]);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /accessibility 94 is under the budget of 95/);
  assert.match(errors[1], /seo 89 is under the budget of 90/);
});

test("checkReports: one run that didn't load is ignored; most runs failing is an error", () => {
  const failedRun = { requestedUrl: HOME, runtimeError: { code: "NO_FCP" } };
  assert.deepEqual(checkReports([failedRun, run(HOME, 0.95), run(HOME, 0.97)]).errors, []);
  assert.deepEqual(checkReports([failedRun, failedRun, run(HOME, 0.95)]).errors, [`${HOME}: Lighthouse couldn't load the page in 2 of 3 runs (NO_FCP)`]);
});

test("checkReports: a page that didn't load, a missing score, or no reports at all fails", () => {
  assert.match(checkReports([{ requestedUrl: HOME, runtimeError: { code: "NO_FCP" } }]).errors[0], /couldn't load the page in 1 of 1 runs \(NO_FCP\)/);
  assert.match(checkReports([run(HOME, null)]).errors[0], /no performance score/);
  assert.deepEqual(checkReports([]).errors, ["no Lighthouse reports to check"]);
});

test("summaryTable: one row per page with the budgets in the header", () => {
  const table = summaryTable([{ url: HOME, scores: { performance: 98, accessibility: 100, "best-practices": 100, seo: 100 } }]);
  assert.match(table, /^\| Page \| performance \(≥ 90\) \| accessibility \(≥ 95\)/);
  assert.match(table, /\| https:\/\/kp-pto\.org\/ \| 98 \| 100 \| 100 \| 100 \|$/);
});
