// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { versionUrl, parseCommit, fetchLiveCommit, waitForCommit } from "../scripts/live-commit.mjs";

const SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1";
const OLD = "851727f0000000000000000000000000000000aa";

test("versionUrl: works with or without a trailing slash", () => {
  assert.equal(versionUrl("https://kp-pto.org/"), "https://kp-pto.org/version.json");
  assert.equal(versionUrl("https://kp-pto.org"), "https://kp-pto.org/version.json");
});

test("parseCommit: a full SHA, trimmed and lowercased", () => {
  assert.equal(parseCommit(JSON.stringify({ commit: ` ${SHA.toUpperCase()} ` })), SHA);
});

test("parseCommit: 'unknown', short SHAs, missing fields, and bad JSON are null", () => {
  for (const body of [`{"commit":"unknown"}`, `{"commit":"${SHA.slice(0, 7)}"}`, "{}", "<html>", ""]) {
    assert.equal(parseCommit(body), null, body);
  }
});

test("fetchLiveCommit: reads version.json; HTTP errors and network failures are null", async () => {
  const ok = async (url) => {
    assert.equal(url, "https://kp-pto.org/version.json");
    return { ok: true, text: async () => JSON.stringify({ commit: SHA }) };
  };
  assert.equal(await fetchLiveCommit("https://kp-pto.org/", ok), SHA);
  assert.equal(await fetchLiveCommit("https://kp-pto.org/", async () => ({ ok: false, text: async () => "" })), null);
  assert.equal(await fetchLiveCommit("https://kp-pto.org/", async () => { throw new Error("offline"); }), null);
});

// A fake clock: sleep() advances it instead of waiting.
function clock() {
  let t = 0;
  return { now: () => t, sleep: async (ms) => { t += ms; } };
}

test("waitForCommit: returns as soon as the expected commit is live", async () => {
  const seen = [OLD, null, SHA];
  const { now, sleep } = clock();
  const result = await waitForCommit(SHA, { fetchCommit: async () => seen.shift(), now, sleep, intervalMs: 10_000 });
  assert.deepEqual(result, { ok: true, elapsedMs: 20_000, last: SHA });
});

test("waitForCommit: gives up after the timeout and reports the last commit seen", async () => {
  const { now, sleep } = clock();
  const lines = [];
  const result = await waitForCommit(SHA, {
    fetchCommit: async () => OLD, now, sleep, intervalMs: 10_000, timeoutMs: 30_000, log: (l) => lines.push(l),
  });
  assert.equal(result.ok, false);
  assert.equal(result.last, OLD);
  assert.ok(result.elapsedMs <= 30_000);
  assert.match(lines[0], /'851727f', waiting for 3d3c42e/);
});
