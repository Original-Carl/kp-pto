// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { BASELINE, compareDns, checkRedirect, checkCert } from "../scripts/check-domain.mjs";

// What the live DNS looked like on 2026-10-28 (record order shuffled, as resolvers do).
const LIVE = {
  A: ["185.199.110.153", "185.199.111.153", "185.199.108.153", "185.199.109.153"],
  AAAA: ["2606:50c0:8001::153", "2606:50c0:8000::153", "2606:50c0:8003::153", "2606:50c0:8002::153"],
  wwwCname: ["original-carl.github.io"],
  MX: ["1 smtp.google.com"],
  apexTxt: ["v=spf1 include:_spf.google.com ~all", "google-site-verification=abc"],
  dkimTxt: ["v=DKIM1; k=rsa; p=MIIBIjANBgkq"],
  challengeTxt: [BASELINE.pagesChallenge],
};
const live = (changes) => ({ ...LIVE, ...changes });

test("compareDns: the live records match the baseline", () => {
  assert.deepEqual(compareDns(LIVE), []);
});

test("compareDns: a changed, missing, or extra A/AAAA record fails", () => {
  assert.equal(compareDns(live({ A: ["198.49.23.144"] })).length, 1);
  assert.equal(compareDns(live({ AAAA: LIVE.AAAA.slice(1) })).length, 1);
  assert.equal(compareDns(live({ A: [...LIVE.A, "198.49.23.144"] })).length, 1);
});

test("compareDns: email records — MX, SPF, DKIM — must stay Google's", () => {
  assert.match(compareDns(live({ MX: [] }))[0], /^MX .* \(none\)/);
  assert.match(compareDns(live({ MX: ["10 mx.squarespace.com"] }))[0], /^MX/);
  assert.match(compareDns(live({ apexTxt: ["v=spf1 -all"] }))[0], /^SPF/);
  assert.match(compareDns(live({ apexTxt: [...LIVE.apexTxt, "v=spf1 -all"] }))[0], /^SPF/, "two SPF records is a failure");
  assert.match(compareDns(live({ dkimTxt: [] }))[0], /DKIM/);
});

test("compareDns: www CNAME and the Pages verification record", () => {
  assert.match(compareDns(live({ wwwCname: ["ext-cust.squarespace.com"] }))[0], /^www/);
  assert.match(compareDns(live({ challengeTxt: [] }))[0], /verification/);
});

test("checkRedirect: a 301 or 308 to the apex passes; anything else fails", () => {
  assert.deepEqual(checkRedirect("http://kp-pto.org/", 301, "https://kp-pto.org/"), []);
  assert.deepEqual(checkRedirect("https://www.kp-pto.org/", 308, "https://kp-pto.org/"), []);
  assert.match(checkRedirect("https://www.kp-pto.org/", 301, "https://example.com/")[0], /example\.com/);
  assert.match(checkRedirect("https://www.kp-pto.org/", 200, null)[0], /answered 200/);
  assert.match(checkRedirect("http://kp-pto.org/", 302, "https://kp-pto.org/")[0], /answered 302/);
});

test("checkCert: needs a trusted certificate with more than 14 days left", () => {
  const now = new Date("2026-10-28T00:00:00Z");
  assert.deepEqual(checkCert({ authorized: true, validTo: "Jan 13 18:39:28 2027 GMT" }, now), []);
  assert.match(checkCert({ authorized: true, validTo: "Nov  5 00:00:00 2026 GMT" }, now)[0], /8 days left/);
  assert.match(checkCert({ authorized: false, authorizationError: "CERT_HAS_EXPIRED", validTo: "Jan 13 18:39:28 2027 GMT" }, now)[0], /CERT_HAS_EXPIRED/);
  assert.equal(checkCert({ authorized: true, validTo: "garbage" }, now).length, 1, "an unparseable date fails");
});
