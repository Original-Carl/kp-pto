// Run with: node --test
// The pages share a header and footer by copy (no build step), so these tests
// keep them identical and check what Google for Nonprofits requires: separate
// pages, and the EIN, street address, and mission shown on the site.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const PAGES = readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
const read = (f) => readFileSync(join(ROOT, f), "utf8");

// Organization details exactly as registered with Google for Nonprofits.
const ORG = "King Philip Middle School PTO Inc.";
const EIN = "41-3002032";
const STREET = "100 King Philip Drive";
const CITY = "West Hartford, CT 06117";
const MISSION = "Our mission is to fund, organize, support, coordinate, and facilitate programs and opportunities that support the students and teachers of King Philip Middle School.";

const block = (html, tag) => {
  const m = new RegExp(`<${tag} class="site-${tag}">[\\s\\S]*?</${tag}>`).exec(html);
  return m ? m[0] : null;
};
// Every <a> in the nav, whatever its attribute order.
const navLinks = (html) => {
  const nav = /<nav[\s\S]*?<\/nav>/.exec(block(html, "header"))[0];
  return [...nav.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attrs, label]) => ({
    href: /\bhref="([^"]*)"/.exec(attrs)?.[1] ?? "",
    current: /\baria-current="page"/.test(attrs),
    label: label.trim(),
  }));
};
// What a visitor sees in <main>: no comments, scripts (incl. JSON-LD), header, or footer.
const visibleMain = (html) => /<main\b[\s\S]*?<\/main>/.exec(html)[0]
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/<script\b[\s\S]*?<\/script>/g, "");
const fileFor = (href) => (href === "/" ? "index.html" : href.replace(/^\//, ""));

test("there are several pages, not just one", () => {
  for (const page of ["index.html", "about.html", "events.html", "support.html", "volunteer.html", "contact.html", "404.html"]) {
    assert.ok(PAGES.includes(page), `${page} is missing`);
  }
});

test("every page has the same header and footer", () => {
  const header = block(read("index.html"), "header").replace(/ aria-current="page"/g, "");
  const footer = block(read("index.html"), "footer");
  for (const page of PAGES) {
    const html = read(page);
    assert.equal(block(html, "header")?.replace(/ aria-current="page"/g, ""), header, `${page}: header differs from index.html`);
    assert.equal(block(html, "footer"), footer, `${page}: footer differs from index.html`);
  }
});

test("nav tabs link to separate pages that exist", () => {
  const links = navLinks(read("index.html"));
  assert.ok(links.length >= 5, "expected at least 5 tabs");
  const targets = links.map((l) => fileFor(l.href));
  assert.equal(new Set(targets).size, targets.length, "two tabs point at the same page");
  for (const link of links) {
    assert.ok(!link.href.includes("#"), `${link.label} is an in-page anchor, not a separate page`);
    assert.ok(existsSync(join(ROOT, fileFor(link.href))), `${link.label} → ${link.href} doesn't exist`);
  }
});

test("each page marks only its own tab as current", () => {
  for (const page of PAGES) {
    const current = navLinks(read(page)).filter((l) => l.current).map((l) => fileFor(l.href));
    assert.deepEqual(current, page === "404.html" ? [] : [page], page);
  }
});

test("every page has a CSP, a title, and (except 404) a canonical URL", () => {
  for (const page of PAGES) {
    const html = read(page);
    assert.match(html, /<meta http-equiv="Content-Security-Policy"/, page);
    assert.match(html, /<title>[^<]+<\/title>/, page);
    if (page !== "404.html") {
      const href = page === "index.html" ? "https://kp-pto.org/" : `https://kp-pto.org/${page}`;
      assert.ok(html.includes(`<link rel="canonical" href="${href}">`), `${page}: canonical should be ${href}`);
    }
  }
});

test("the footer on every page shows the legal name, EIN, and street address", () => {
  const footer = block(read("index.html"), "footer");
  for (const text of [ORG, EIN, STREET, CITY]) assert.ok(footer.includes(text), `footer is missing "${text}"`);
});

test("the About page shows the mission, EIN, and address, and its JSON-LD matches", () => {
  const html = read("about.html");
  const main = visibleMain(html);
  for (const text of [MISSION, ORG, EIN, STREET, CITY]) assert.ok(main.includes(text), `about.html's visible content is missing "${text}"`);
  const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
  assert.equal(ld.name, ORG);
  assert.equal(ld.taxID, EIN);
  assert.equal(ld.description, MISSION);
  assert.equal(ld.address.streetAddress, STREET);
  assert.equal(`${ld.address.addressLocality}, ${ld.address.addressRegion} ${ld.address.postalCode}`, CITY);
});

test("no visible placeholders on any page", () => {
  for (const page of PAGES) {
    const visible = read(page).replace(/<!--[\s\S]*?-->/g, "");
    assert.ok(!/\[\[TODO|TODO:/.test(visible), `${page} has a visible TODO placeholder`);
  }
});
