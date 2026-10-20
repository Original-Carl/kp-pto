// Build stage browser tests. They run on both projects (mobile 375×812 and
// desktop) unless a test skips one. Per-page checks run on every page.
import { test, expect } from "@playwright/test";

// Bytes a first visit to one page downloads from the site itself (page, CSS, JS, fonts).
const PAGE_WEIGHT_BUDGET = 150 * 1024;

// Every tab, in nav order, with the heading its page should show.
const PAGES = [
  { path: "./", file: "index.html", tab: "Home", h1: "Parent Teacher Organization", title: "King Philip Middle School PTO" },
  { path: "about.html", file: "about.html", tab: "About", h1: "About Us", title: "About | King Philip Middle School PTO" },
  { path: "events.html", file: "events.html", tab: "Events", h1: "Events", title: "Events | King Philip Middle School PTO" },
  { path: "support.html", file: "support.html", tab: "Support", h1: "Support the PTO", title: "Support | King Philip Middle School PTO" },
  { path: "volunteer.html", file: "volunteer.html", tab: "Volunteer", h1: "Volunteer", title: "Volunteer | King Philip Middle School PTO" },
  { path: "contact.html", file: "contact.html", tab: "Contact", h1: "Contact", title: "Contact | King Philip Middle School PTO" },
];

// Per-page checks also cover the 404 page (loaded directly; it has no tab).
const ALL_PAGES = [
  ...PAGES,
  { path: "404.html", file: "404.html", tab: "404", h1: "Page not found", title: "Page not found | King Philip Middle School PTO" },
];

// Organization details as registered with Google for Nonprofits.
const ORG = "King Philip Middle School PTO Inc.";
const EIN = "41-3002032";
const STREET = "100 King Philip Drive";
const CITY = "West Hartford, CT 06117";
const MISSION = "Our mission is to fund, organize, support, coordinate, and facilitate programs and opportunities that support the students and teachers of King Philip Middle School.";

// Collect console errors, CSP violations, failed requests, and third-party
// requests for every test; each test asserts on whichever it needs.
test.beforeEach(async ({ page, baseURL }, testInfo) => {
  const origin = new URL(baseURL).origin;
  const log = { errors: [], thirdParty: [], failed: [] };
  testInfo.log = log;
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      window.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  page.on("console", (msg) => { if (msg.type() === "error") log.errors.push(msg.text()); });
  page.on("pageerror", (err) => log.errors.push(String(err)));
  page.on("requestfailed", (req) => log.failed.push(`${req.url()} ${req.failure()?.errorText}`));
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.protocol !== "data:" && url.origin !== origin) log.thirdParty.push(req.url());
  });
});

const logOf = () => test.info().log;

async function openMenuIfMobile(page) {
  const toggle = page.locator(".nav-toggle");
  if (await toggle.isVisible()) await toggle.click();
}

function isoDate(daysFromToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------- Every page ----------

for (const p of ALL_PAGES) {
  test.describe(`${p.tab} page`, () => {
    test("loads cleanly: no errors, no CSP violations, nothing from third parties", async ({ page }) => {
      await page.goto(p.path);
      await page.waitForLoadState("networkidle");
      const log = logOf();
      expect(log.errors).toEqual([]);
      expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
      expect(log.failed).toEqual([]);
      expect(log.thirdParty).toEqual([]);
      await expect(page).toHaveTitle(p.title);
      await expect(page.locator("h1")).toHaveText(p.h1);
    });

    test("header logo loads", async ({ page }) => {
      await page.goto(p.path);
      const logo = page.locator(".site-header img.brand-logo");
      await expect(logo).toBeVisible();
      expect(await logo.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
    });

    test("footer shows the legal name, EIN, and street address", async ({ page }) => {
      await page.goto(p.path);
      const footer = page.locator(".site-footer");
      for (const text of [ORG, EIN, STREET, CITY]) await expect(footer).toContainText(text);
    });

    test("no horizontal scrolling", async ({ page }) => {
      await page.goto(p.path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test("first visit stays under the page-weight budget", async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "mobile", "budget is measured on the phone layout");
      await page.goto(p.path);
      await page.waitForLoadState("networkidle");
      const bytes = await page.evaluate(async () => {
        await document.fonts.ready;
        const entries = [...performance.getEntriesByType("navigation"), ...performance.getEntriesByType("resource")];
        return entries.reduce((sum, e) => sum + (e.encodedBodySize || e.decodedBodySize || 0), 0);
      });
      testInfo.annotations.push({ type: "page weight", description: `${p.file}: ${(bytes / 1024).toFixed(1)} KB` });
      expect(bytes).toBeLessThanOrEqual(PAGE_WEIGHT_BUDGET);
    });
  });
}

// ---------- Navigation: separate pages, not anchors ----------

test("each nav tab opens its own page, marked as current", async ({ page }) => {
  await page.goto("./");
  const seen = new Set();
  for (const p of PAGES) {
    await openMenuIfMobile(page);
    await page.locator("#site-nav").getByRole("link", { name: p.tab, exact: true }).click();
    await expect(page.locator("h1")).toHaveText(p.h1);
    const url = new URL(page.url());
    expect(url.hash, `${p.tab} should not be an in-page anchor`).toBe("");
    seen.add(url.pathname);
    const current = page.locator('#site-nav a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText(p.tab);
  }
  expect(seen.size, "every tab should be a different URL").toBe(PAGES.length);
});

test("school fonts load from the site itself", async ({ page }) => {
  await page.goto("./");
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family.replace(/"/g, "")} ${f.weight}`);
  });
  expect(fonts).toEqual(expect.arrayContaining(["Fjalla One 400", "Lato 400", "Lato 700"]));
});

test("tap targets are at least 44px tall on phones", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "phone-only check");
  await page.goto("./");
  for (const selector of [".nav-toggle", ".hero .btn", ".link-card"]) {
    for (const box of await page.locator(selector).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) {
      expect(box, selector).toBeGreaterThanOrEqual(44);
    }
  }
});

test("mobile menu opens, closes, and Escape returns focus", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "the menu toggle only shows on phones");
  await page.goto("./");
  const toggle = page.locator(".nav-toggle");
  const nav = page.locator("#site-nav");
  await expect(nav).toBeHidden();

  await toggle.click();
  await expect(nav).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await toggle.click();
  await expect(nav).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.click();
  await nav.getByRole("link", { name: "About" }).focus();
  await page.keyboard.press("Escape");
  await expect(nav).toBeHidden();
  await expect(toggle).toBeFocused();
});

test("unknown URLs get the site's 404 page", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "one check is enough");
  // GitHub Pages serves 404.html for unknown paths; scripts/serve.mjs does the same.
  const res = await page.goto("this-page-does-not-exist");
  expect(res.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Page not found");
});

// ---------- About: Google for Nonprofits transparency ----------

test("About shows the mission, EIN, and street address", async ({ page }) => {
  await page.goto("about.html");
  await expect(page.locator(".mission")).toHaveText(MISSION);
  const details = page.locator(".org-details");
  for (const text of [ORG, EIN, STREET, CITY]) await expect(details).toContainText(text);
});

// ---------- Events ----------

test("events: upcoming ones sorted by date, past ones hidden", async ({ page }) => {
  await page.route("**/js/events.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `window.PTO_EVENTS = ${JSON.stringify([
      { date: isoDate(60), title: "Later event", time: "7:00 PM", location: "Library" },
      { date: isoDate(-1), title: "Past event" },
      { date: isoDate(0), title: "Today event" },
      { date: isoDate(-2), end: isoDate(1), title: "Ongoing event" },
      { date: "not-a-date", title: "Broken event" },
    ])};`,
  }));
  await page.goto("events.html");
  const titles = page.locator("#event-list .event-title");
  await expect(titles).toHaveText(["Ongoing event", "Today event", "Later event"]);
  await expect(page.locator("#event-list .event-meta").last()).toHaveText("7:00 PM · Library");
  // Multi-day events show their range; each month gets one heading.
  await expect(page.locator("#event-list .event-meta").first()).toHaveText(/^[A-Z][a-z]{2} \d{1,2}(–\d{1,2}| – [A-Z][a-z]{2} \d{1,2})$/);
  const headings = await page.locator("#event-list .event-month-heading").allTextContents();
  expect(new Set(headings).size).toBe(headings.length);
  expect(headings.length).toBeGreaterThanOrEqual(2); // today and +60 days are in different months
  await expect(page.locator("#events-empty")).toBeHidden();
});

test("events: empty list shows the 'no events' note", async ({ page }) => {
  await page.route("**/js/events.js", (route) => route.fulfill({ contentType: "text/javascript", body: "window.PTO_EVENTS = [];" }));
  await page.goto("events.html");
  await expect(page.locator("#event-list li")).toHaveCount(0);
  await expect(page.locator("#events-empty")).toBeVisible();
});

// ---------- Support ----------

test("Support lists what contributions fund and ways to give; nothing is embedded", async ({ page }) => {
  await page.goto("support.html");
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator(".program-list li")).toHaveCount(5);
  await expect(page.locator("#ways-heading")).toHaveText("Ways to Give");
  await expect(page.getByText("payable to “KP PTO”")).toBeVisible();
  // Online giving lives with each campaign or event, so Support points at Events.
  await page.locator("main").getByRole("link", { name: "Events" }).click();
  await expect(page.locator("h1")).toHaveText("Events");
});

test("events: details render as text; an https link renders, other schemes don't", async ({ page }) => {
  await page.route("**/js/events.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `window.PTO_EVENTS = ${JSON.stringify([
      { date: isoDate(1), title: "With link", details: "Entry $5 <b>not bold</b>", link: "https://www.zeffy.com/en-US/ticketing/test", linkText: "Tickets" },
      { date: isoDate(2), title: "Bad link", link: "javascript:alert(1)", linkText: "Nope" },
    ])};`,
  }));
  await page.goto("events.html");
  const links = page.locator("#event-list .event-link");
  await expect(links).toHaveCount(1);
  await expect(links).toHaveText("Tickets");
  await expect(links).toHaveAttribute("href", "https://www.zeffy.com/en-US/ticketing/test");
  // Details render as plain text, never as HTML.
  await expect(page.locator("#event-list .event-details")).toHaveText("Entry $5 <b>not bold</b>");
});

test("Contact lists the PTO board, president first", async ({ page }) => {
  await page.goto("contact.html");
  const members = page.locator(".board-member");
  expect(await members.count()).toBeGreaterThan(0);
  await expect(members.first().locator(".role")).toHaveText("President");
  for (const member of await members.all()) {
    await expect(member.locator(".role")).not.toHaveText("");
    await expect(member.locator(".name")).not.toHaveText("");
  }
});

test("robots.txt and sitemap.xml are served", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "one check is enough");
  const robots = await request.get("robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Sitemap: https://kp-pto.org/sitemap.xml");
  const sitemap = await request.get("sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("<loc>https://kp-pto.org/about.html</loc>");
});

test("version.json says which commit is live", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "one check is enough");
  const res = await request.get("version.json");
  expect(res.status()).toBe(200);
  const { commit, built_at } = await res.json();
  expect(commit).toMatch(/^[0-9a-f]{40}$/);
  expect(Number.isNaN(Date.parse(built_at))).toBe(false);
  // The deploy's smoke job sets this to the commit it just deployed.
  if (process.env.EXPECTED_COMMIT) expect(commit).toBe(process.env.EXPECTED_COMMIT);
});

test("Donate is one click to the Zeffy donation form, from Home and Support", async ({ page }) => {
  for (const path of ["./", "support.html"]) {
    await page.goto(path);
    const donate = page.locator('main a[data-zeffy-form="donate"]');
    await expect(donate).toHaveCount(1);
    await expect(donate).toHaveText("Donate");
    await expect(donate).toHaveAttribute("href", /^https:\/\/www\.zeffy\.com\/[^"]*donation-form\//);
  }
});

test("Home shows the PTO logo", async ({ page }) => {
  await page.goto("./");
  const logo = page.locator(".hero-logo img");
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(logo).toHaveAttribute("alt", /KP PTO logo/);
});
