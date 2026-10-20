// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { siteVersion } from "../scripts/stage-site.mjs";

const SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1";
const NOW = new Date("2026-10-20T12:00:00Z");
const noGit = () => { throw new Error("git should not be asked"); };

test("version.json: SITE_COMMIT wins over git", () => {
  assert.deepEqual(siteVersion({ SITE_COMMIT: SHA }, noGit, NOW), { commit: SHA, built_at: "2026-10-20T12:00:00.000Z" });
});

test("version.json: falls back to git HEAD, trimmed", () => {
  assert.equal(siteVersion({}, () => `${SHA}\n`, NOW).commit, SHA);
});

test("version.json: no git, or not a full SHA, means 'unknown'", () => {
  assert.equal(siteVersion({}, () => { throw new Error("not a git repo"); }, NOW).commit, "unknown");
  assert.equal(siteVersion({ SITE_COMMIT: SHA.slice(0, 7) }, noGit, NOW).commit, "unknown");
  assert.equal(siteVersion({ SITE_COMMIT: "main" }, noGit, NOW).commit, "unknown");
});
