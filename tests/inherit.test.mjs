// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkActionPins, checkCsp, checkHtmlLoads, checkCssLoads, checkFonts } from "../scripts/check-inherit.mjs";
import { isAllowed, checkLockfile } from "../scripts/check-licenses.mjs";

const SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1";
const DIGEST = "a".repeat(64);
const csp = (content) => `<meta http-equiv="Content-Security-Policy" content="${content}">`;

test("action pins: full SHA, local, and digest-pinned docker pass", () => {
  const yml = [
    `      - uses: actions/checkout@${SHA} # v7`,
    `        uses: ./.github/actions/local`,
    `      - uses: docker://ghcr.io/x/y@sha256:${DIGEST}`,
    `          IMAGE: ghcr.io/google/osv-scanner-action@sha256:${DIGEST} # v2`,
  ].join("\n");
  assert.deepEqual(checkActionPins({ "w.yml": yml }), []);
});

test("action pins: tags, short SHAs, and tagged images fail", () => {
  const yml = [
    "      - uses: actions/checkout@v4",
    "      - uses: actions/setup-node@3d3c42e",
    "      - uses: 'owner/repo/path@main'",
    "          IMAGE: ghcr.io/google/osv-scanner-action:v2.6.0",
  ].join("\n");
  const errors = checkActionPins({ "w.yml": yml });
  assert.equal(errors.length, 4, errors.join("\n"));
  assert.match(errors[0], /^w\.yml:1:/);
});

test("CSP: the site's policy passes", () => {
  const html = csp("default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; frame-src https://www.zeffy.com; base-uri 'self'; form-action 'self'");
  assert.deepEqual(checkCsp(html), []);
});

test("CSP: missing policy, missing default-src, and new origins fail", () => {
  assert.equal(checkCsp("<html></html>").length, 1);
  assert.match(checkCsp(csp("script-src 'self'"))[0], /default-src/);
  const errors = checkCsp(csp("default-src 'self'; script-src 'self' https://cdn.example.com 'unsafe-inline'; img-src https://www.zeffy.com"));
  assert.equal(errors.length, 3, errors.join("\n"));
});

test("page loads: relative resources and navigation links pass", () => {
  const html = `
    <link rel="canonical" href="https://kp-pto.org/">
    <link rel="stylesheet" href="css/styles.css">
    <link rel="preload" href="fonts/lato-400.woff2" as="font">
    <script src="js/main.js" defer></script>
    <a href="https://kingphilip.whps.org">School</a>
    <!-- <script src="https://commented.example/x.js"></script> -->`;
  assert.deepEqual(checkHtmlLoads(html), []);
});

test("page loads: third-party scripts, styles, images, and protocol-relative URLs fail", () => {
  const html = `
    <script src="https://cdn.example.com/x.js"></script>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2">
    <link rel="preconnect" href="https://fonts.gstatic.com">
    <img src='//tracker.example/p.gif'>
    <iframe src=https://www.zeffy.com/embed/x></iframe>`;
  assert.equal(checkHtmlLoads(html).length, 5);
});

test("CSS loads: only relative and data: URLs pass", () => {
  assert.deepEqual(checkCssLoads("a.css", `src: url("../fonts/a.woff2"); background: url(data:image/png;base64,AA);`), []);
  assert.equal(checkCssLoads("a.css", `@import "https://x.example/a.css"; b { background: url(https://x.example/i.png) }`).length, 2);
});

test("fonts: matching hashes pass; changed, unlisted, and missing fonts fail", () => {
  const manifest = { fonts: { "a.woff2": { sha256: "aaa" }, "gone.woff2": { sha256: "ccc" } } };
  const hashes = { "a.woff2": "aaa", "b.woff2": "bbb" };
  assert.deepEqual(checkFonts({ fonts: { "a.woff2": { sha256: "aaa" } } }, ["a.woff2", "OFL.txt"], (f) => hashes[f]), []);
  const errors = checkFonts(manifest, ["a.woff2", "b.woff2"], (f) => (f === "a.woff2" ? "changed" : hashes[f]));
  assert.equal(errors.length, 3, errors.join("\n"));
});

test("licenses: SPDX AND/OR evaluation", () => {
  assert.equal(isAllowed("MIT"), true);
  assert.equal(isAllowed("(MIT OR GPL-3.0)"), true);
  assert.equal(isAllowed("MIT AND GPL-3.0"), false);
  assert.equal(isAllowed("MIT AND ISC"), true);
  assert.equal(isAllowed("MIT OR ISC AND GPL-3.0"), false);
  assert.equal(isAllowed("GPL-3.0"), false);
});

test("licenses: lockfile check skips the root, honors exact reviews", () => {
  const lock = { packages: {
    "": { name: "root", license: "UNLICENSED" },
    "node_modules/ok": { version: "1.0.0", license: "MIT" },
    "node_modules/@scope/gpl": { version: "2.0.0", license: "GPL-3.0" },
    "node_modules/nolicense": { version: "3.0.0" },
    "node_modules/reviewed": { version: "4.0.0", license: "LGPL-3.0-or-later" },
  } };
  const { count, failures } = checkLockfile(lock, { reviewed: "LGPL-3.0-or-later", nolicense: "something-else" });
  assert.equal(count, 4);
  assert.equal(failures.length, 2, failures.join("\n"));
  assert.match(failures[0], /@scope\/gpl@2\.0\.0/);
  assert.match(failures[1], /license changed from reviewed/);
});

// ---- Regression tests for bypasses found in review ----

test("CSP: anything loading before the CSP meta fails", () => {
  const policy = csp("default-src 'self'");
  assert.equal(checkCsp(`<head>${policy}<script src="js/a.js"></script></head>`).length, 0);
  const errors = checkCsp(`<head><script>new Image().src='https://evil.example'</script>${policy}</head>`);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /before the CSP/);
});

test("page loads: obfuscated and tricky URLs fail", () => {
  const cases = [
    `<img srcset="a.png 1x, https://evil.example/b.png 2x">`,
    `<link rel="preload" as="image" imagesrcset="a.png 1x, //evil.example/b.png 2x">`,
    `<script src=" https://evil.example/x.js"></script>`,
    `<script src="\\\\evil.example/x.js"></script>`,
    `<script src="ht\ttps://evil.example/x.js"></script>`,
    `<script src="https&#58;//evil.example/x.js"></script>`,
    `<img alt="a>b" src="https://evil.example/p.gif">`,
    `<script title=" src=a.js" src="https://evil.example/x.js"></script>`,
    `<base href="https://evil.example/">`,
    `<svg><image href="https://evil.example/i.svg"/></svg>`,
    `<input type="image" src="https://evil.example/i.png">`,
    `<div style="background:url(https://evil.example/i.png)"></div>`,
    `<style>body{background:url(https://evil.example/i.png)}</style>`,
    `<link rel="stylesheet preload" href="https://evil.example/a.css">`,
  ];
  for (const html of cases) assert.ok(checkHtmlLoads(html).length >= 1, `not caught: ${html}`);
});

test("CSS loads: case, spacing, image-set, and escapes fail", () => {
  const cases = [
    `a{background:URL(https://evil.example/i.png)}`,
    `@IMPORT "https://evil.example/a.css";`,
    `@import"https://evil.example/a.css";`,
    `a{background-image:image-set("https://evil.example/i.png" 1x)}`,
    `a{background:url(ht\\74 tps://evil.example/i.png)}`,
  ];
  for (const css of cases) assert.ok(checkCssLoads("a.css", css).length >= 1, `not caught: ${css}`);
  assert.deepEqual(checkCssLoads("a.css", `a{font-family:"Fjalla One", Arial; content:""}`), []);
});

test("action pins: flow mappings, quoted keys, containers, and docker run are checked", () => {
  const cases = [
    `      - { name: x, uses: actions/checkout@v4 }`,
    `      - "uses": actions/checkout@v4`,
    `    container: node:24`,
    `        image: redis:7`,
    `      - run: docker run --rm alpine:latest echo hi`,
  ];
  for (const line of cases) assert.equal(checkActionPins({ "w.yml": line }).length, 1, `not caught: ${line}`);
  assert.deepEqual(checkActionPins({ "w.yml": `    container: node@sha256:${DIGEST}\n      - run: docker run --rm "$OSV_IMAGE" --lockfile=x` }), []);
});

test("fonts: other font formats need a manifest entry and hash", () => {
  assert.equal(checkFonts({ fonts: {} }, ["a.ttf", "b.woff", "c.otf", "OFL.txt", "sources.json"], () => "x").length, 3);
});

test("licenses: link entries are skipped; non-node_modules paths keep their name", () => {
  const lock = { packages: {
    "": {},
    "node_modules/foo": { link: true, resolved: "../foo" },
    "../foo": { version: "1.0.0", license: "MIT" },
    "packages/a": { version: "2.0.0", license: "GPL-3.0" },
  } };
  const { failures } = checkLockfile(lock, {});
  assert.equal(failures.length, 1);
  assert.match(failures[0], /^packages\/a@2\.0\.0/);
});

test("action pins: *_IMAGE env vars must be pinned by digest", () => {
  const bad = ["          SEMGREP_IMAGE: semgrep/semgrep:latest", "          GITLEAKS_IMAGE: zricethezav/gitleaks:latest", "          scan-image: alpine:3"];
  for (const line of bad) assert.equal(checkActionPins({ "w.yml": line }).length, 1, `not caught: ${line}`);
  assert.deepEqual(checkActionPins({ "w.yml": `          SEMGREP_IMAGE: semgrep/semgrep@sha256:${DIGEST} # 1.178.0` }), []);
});

test("multi-page: errors name the page they came from", () => {
  assert.match(checkCsp("<html></html>", "about.html")[0], /^about\.html:/);
  assert.match(checkHtmlLoads(`<script src="https://evil.example/x.js"></script>`, "contact.html")[0], /^contact\.html:/);
});
