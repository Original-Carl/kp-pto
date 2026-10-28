// Which commit is live: reads <site>/version.json (written by stage-site.mjs).
// Deploy's smoke job uses --wait to poll until the commit it just deployed is
// served; Operate prints the live commit so its smoke test runs the matching
// test suite. Node built-ins only.
// GitHub Pages' CDN can serve the old version for a few minutes, so this polls
// the plain URL (no cache-buster), the same one visitors and the browser test get.
// Run: node scripts/live-commit.mjs <site-url>                prints the live commit
//      node scripts/live-commit.mjs <site-url> --wait <sha>   polls for up to 10 minutes
import { appendFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const SHA = /^[0-9a-f]{40}$/;

export function versionUrl(site) {
  return new URL("version.json", site.endsWith("/") ? site : `${site}/`).href;
}

// The commit in a version.json body, or null if there isn't a full SHA.
export function parseCommit(body) {
  try {
    const commit = String(JSON.parse(body).commit).trim().toLowerCase();
    return SHA.test(commit) ? commit : null;
  } catch {
    return null;
  }
}

// The live commit, or null if version.json can't be fetched or read.
export async function fetchLiveCommit(site, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(versionUrl(site), { signal: AbortSignal.timeout(10_000) });
    return res.ok ? parseCommit(await res.text()) : null;
  } catch {
    return null;
  }
}

// Polls until fetchCommit() returns `expected` or timeoutMs passes.
// Returns { ok, elapsedMs, last } where `last` is the last commit seen.
export async function waitForCommit(expected, {
  fetchCommit, timeoutMs = 600_000, intervalMs = 10_000,
  sleep = delay, now = Date.now, log = () => {},
}) {
  const start = now();
  let last = null;
  for (;;) {
    last = await fetchCommit();
    if (last === expected) return { ok: true, elapsedMs: now() - start, last };
    if (now() - start + intervalMs > timeoutMs) return { ok: false, elapsedMs: now() - start, last };
    log(`Live commit is '${(last || "?").slice(0, 7)}', waiting for ${expected.slice(0, 7)}…`);
    await sleep(intervalMs);
  }
}

async function main([site, flag, expected]) {
  if (!site || (flag && (flag !== "--wait" || !SHA.test(expected || "")))) {
    process.stderr.write("Usage: node scripts/live-commit.mjs <site-url> [--wait <40-hex sha>]\n");
    process.exit(2);
  }
  if (!flag) {
    const commit = await fetchLiveCommit(site);
    if (!commit) {
      process.stderr.write(`::error::Couldn't read a commit from ${versionUrl(site)}\n`);
      process.exit(1);
    }
    process.stdout.write(`${commit}\n`);
    return;
  }
  const result = await waitForCommit(expected, {
    fetchCommit: () => fetchLiveCommit(site),
    log: (line) => process.stdout.write(`${line}\n`),
  });
  const seconds = Math.round(result.elapsedMs / 1000);
  if (!result.ok) {
    process.stderr.write(`::error::${site} still isn't serving ${expected.slice(0, 7)} after ${seconds}s\n`);
    process.exit(1);
  }
  const line = `Live after ${seconds}s: \`${expected.slice(0, 7)}\` at ${site}`;
  process.stdout.write(`${line}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
