// Operate stage: the domain still points where it should. Node built-ins only.
//   1. DNS matches BASELINE: apex A/AAAA are GitHub Pages; www is a CNAME to
//      GitHub; MX, SPF, and DKIM are Google Workspace's (so PTO email isn't
//      broken); DMARC is the published policy; the GitHub Pages
//      domain-verification TXT record is still there.
//   2. http://, http://www., and https://www. all redirect to https://kp-pto.org/.
//   3. The TLS certificate is valid and has more than MIN_CERT_DAYS left
//      (GitHub Pages renews it automatically; this catches renewal failing).
// DNS is asked of public resolvers, not the runner's, so a stale local cache
// can't hide a change. The baseline was recorded 2026-10-20 and re-checked
// 2026-10-28 (DMARC added that day); if Carl changes DNS on purpose, update
// BASELINE in the same PR. See docs/RUNBOOK.md → Monitoring.
// Run: node scripts/check-domain.mjs
import { Resolver } from "node:dns/promises";
import { connect } from "node:tls";
import { fileURLToPath } from "node:url";

export const DOMAIN = "kp-pto.org";
export const MIN_CERT_DAYS = 14;

export const BASELINE = {
  A: ["185.199.108.153", "185.199.109.153", "185.199.110.153", "185.199.111.153"],
  AAAA: ["2606:50c0:8000::153", "2606:50c0:8001::153", "2606:50c0:8002::153", "2606:50c0:8003::153"],
  wwwCname: "original-carl.github.io",
  MX: ["1 smtp.google.com"],
  SPF: "v=spf1 include:_spf.google.com ~all",
  // Only checks that a DKIM key is published; Google can rotate the key itself.
  dkimPrefix: "v=DKIM1;",
  // At _dmarc. Moving to p=quarantine is planned once p=none has run clean
  // for a month; change this in the same PR as the DNS change.
  DMARC: "v=DMARC1; p=none",
  pagesChallenge: "2e31216c0053eaec4710667307bb7d",
};

const sameSet = (a, b) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);
const show = (list) => (list.length ? list.join(", ") : "(none)");

// observed: { A, AAAA, wwwCname, MX, apexTxt, dkimTxt, dmarcTxt, challengeTxt }, each a
// list of strings (TXT records already joined from their chunks).
export function compareDns(observed, baseline = BASELINE) {
  const errors = [];
  for (const type of ["A", "AAAA", "MX"]) {
    if (!sameSet(observed[type], baseline[type])) {
      errors.push(`${type} for ${DOMAIN} is ${show(observed[type])}; expected ${baseline[type].join(", ")}`);
    }
  }
  if (!sameSet(observed.wwwCname, [baseline.wwwCname])) {
    errors.push(`www.${DOMAIN} CNAME is ${show(observed.wwwCname)}; expected ${baseline.wwwCname}`);
  }
  const spf = observed.apexTxt.filter((t) => t.startsWith("v=spf1"));
  if (!sameSet(spf, [baseline.SPF])) errors.push(`SPF for ${DOMAIN} is ${show(spf)}; expected "${baseline.SPF}"`);
  if (!observed.dkimTxt.some((t) => t.replace(/\s/g, "").startsWith(baseline.dkimPrefix))) {
    errors.push(`no DKIM key at google._domainkey.${DOMAIN}`);
  }
  const dmarc = observed.dmarcTxt.filter((t) => t.startsWith("v=DMARC1"));
  if (!sameSet(dmarc, [baseline.DMARC])) errors.push(`DMARC at _dmarc.${DOMAIN} is ${show(dmarc)}; expected "${baseline.DMARC}"`);
  if (!observed.challengeTxt.includes(baseline.pagesChallenge)) {
    errors.push(`GitHub Pages verification TXT record (_github-pages-challenge-Original-Carl.${DOMAIN}) is ${show(observed.challengeTxt)}; expected ${baseline.pagesChallenge}`);
  }
  return errors;
}

export function checkRedirect(from, status, location, expected = `https://${DOMAIN}/`) {
  if (status === 301 || status === 308) {
    if (location === expected) return [];
    return [`${from} redirects to ${location}; expected ${expected}`];
  }
  return [`${from} answered ${status}; expected a permanent redirect to ${expected}`];
}

export function checkCert({ authorized, authorizationError, validTo }, now = new Date(), minDays = MIN_CERT_DAYS) {
  if (!authorized) return [`TLS certificate for ${DOMAIN} isn't trusted: ${authorizationError}`];
  const days = (new Date(validTo) - now) / 86_400_000;
  if (!(days > minDays)) return [`TLS certificate for ${DOMAIN} expires ${validTo} (${Math.floor(days)} days left; minimum ${minDays})`];
  return [];
}

// ---------- CLI ----------

async function lookupDns() {
  const resolver = new Resolver({ timeout: 5000, tries: 3 });
  resolver.setServers(["1.1.1.1", "8.8.8.8"]);
  // A missing record (ENODATA/ENOTFOUND) is an empty list; anything else is a real failure.
  const ask = (fn) => fn().catch((e) => (["ENODATA", "ENOTFOUND"].includes(e.code) ? [] : Promise.reject(e)));
  const txt = async (name) => (await ask(() => resolver.resolveTxt(name))).map((chunks) => chunks.join(""));
  return {
    A: await ask(() => resolver.resolve4(DOMAIN)),
    AAAA: await ask(() => resolver.resolve6(DOMAIN)),
    wwwCname: await ask(() => resolver.resolveCname(`www.${DOMAIN}`)),
    MX: (await ask(() => resolver.resolveMx(DOMAIN))).map((r) => `${r.priority} ${r.exchange}`),
    apexTxt: await txt(DOMAIN),
    dkimTxt: await txt(`google._domainkey.${DOMAIN}`),
    dmarcTxt: await txt(`_dmarc.${DOMAIN}`),
    challengeTxt: await txt(`_github-pages-challenge-Original-Carl.${DOMAIN}`),
  };
}

async function lookupRedirect(from) {
  const res = await fetch(from, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
  return checkRedirect(from, res.status, res.headers.get("location"));
}

// Verifies the certificate as browsers do: an untrusted one (expired, wrong
// name, bad chain) fails the connection, which main() reports as "TLS: …".
function lookupCert() {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: DOMAIN, port: 443, servername: DOMAIN }, () => {
      const { valid_to: validTo } = socket.getPeerCertificate();
      resolve({ authorized: socket.authorized, authorizationError: socket.authorizationError, validTo });
      socket.end();
    });
    socket.setTimeout(15_000, () => socket.destroy(new Error("TLS connection timed out")));
    socket.on("error", reject);
  });
}

async function main() {
  const errors = [];
  const step = async (name, fn) => {
    try {
      errors.push(...await fn());
    } catch (e) {
      errors.push(`${name}: ${e.message}`);
    }
  };
  await step("DNS", async () => compareDns(await lookupDns()));
  for (const from of [`http://${DOMAIN}/`, `http://www.${DOMAIN}/`, `https://www.${DOMAIN}/`]) {
    await step(from, () => lookupRedirect(from));
  }
  let cert;
  await step("TLS", async () => checkCert(cert = await lookupCert()));
  if (errors.length) {
    process.stderr.write(`Domain check failed (${errors.length}):\n${errors.map((e) => `  - ${e}`).join("\n")}\n`);
    process.exit(1);
  }
  process.stdout.write(`Domain check passed: DNS matches the baseline, redirects go to https://${DOMAIN}/, TLS certificate valid until ${cert.validTo}.\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
