// Build stage browser tests. They run on both projects (mobile 375×812 and
// desktop) unless a test skips one.
import { test, expect } from "@playwright/test";

// Bytes the first visit downloads from the site itself (page, CSS, JS, fonts).
// Zeffy's lazy, cross-origin iframe isn't counted: browsers don't expose its size.
const PAGE_WEIGHT_BUDGET = 150 * 1024;
const ZEFFY_TEST_URL = "https://www.zeffy.com/embed/donation-form/playwright-test";

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

test("loads cleanly: no errors, no CSP violations, nothing from third parties", async ({ page }) => {
  await page.goto("./");
  await page.waitForLoadState("networkidle");
  const log = logOf();
  expect(log.errors).toEqual([]);
  expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
  expect(log.failed).toEqual([]);
  expect(log.thirdParty).toEqual([]);
  await expect(page).toHaveTitle("King Philip Middle School PTO");
});

test("school fonts load from the site itself", async ({ page }) => {
  await page.goto("./");
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family.replace(/"/g, "")} ${f.weight}`);
  });
  expect(fonts).toEqual(expect.arrayContaining(["Fjalla One 400", "Lato 400", "Lato 700"]));
});

test("first visit stays under the page-weight budget", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "budget is measured on the phone layout");
  await page.goto("./");
  await page.waitForLoadState("networkidle");
  const bytes = await page.evaluate(async () => {
    await document.fonts.ready;
    const entries = [...performance.getEntriesByType("navigation"), ...performance.getEntriesByType("resource")];
    return entries.reduce((sum, e) => sum + (e.encodedBodySize || e.decodedBodySize || 0), 0);
  });
  testInfo.annotations.push({ type: "page weight", description: `${(bytes / 1024).toFixed(1)} KB` });
  expect(bytes).toBeLessThanOrEqual(PAGE_WEIGHT_BUDGET);
});

test("no horizontal scrolling", async ({ page }) => {
  await page.goto("./");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("tap targets are at least 44px tall on phones", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "phone-only check");
  await page.goto("./");
  for (const selector of [".nav-toggle", ".hero .btn"]) {
    for (const box of await page.locator(selector).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) {
      expect(box, selector).toBeGreaterThanOrEqual(44);
    }
  }
});

test("mobile menu opens, closes on link tap, and Escape returns focus", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "the menu toggle only shows on phones");
  await page.goto("./");
  const toggle = page.locator(".nav-toggle");
  const nav = page.locator("#site-nav");
  await expect(nav).toBeHidden();

  await toggle.click();
  await expect(nav).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await nav.getByRole("link", { name: "Events" }).click();
  await expect(nav).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.click();
  await nav.getByRole("link", { name: "About" }).focus();
  await page.keyboard.press("Escape");
  await expect(nav).toBeHidden();
  await expect(toggle).toBeFocused();
});

test("section links land just below the sticky header", async ({ page }) => {
  // Reduced motion turns smooth scrolling off (see styles.css), so the jump is
  // instant and we measure where it ends, not a frame mid-animation.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await openMenuIfMobile(page);
  await page.locator("#site-nav").getByRole("link", { name: "Volunteer" }).click();
  await expect(page).toHaveURL(/#volunteer$/);
  const gap = await page.evaluate(() => {
    const headerBottom = document.querySelector(".site-header").getBoundingClientRect().bottom;
    return document.getElementById("volunteer").getBoundingClientRect().top - headerBottom;
  });
  // scroll-padding-top leaves an 8px gap; the section must not hide under the header.
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThanOrEqual(16);
});

test("events: upcoming ones sorted by date, past ones hidden", async ({ page }) => {
  await page.route("**/js/events.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `window.PTO_EVENTS = ${JSON.stringify([
      { date: isoDate(30), title: "Later event", time: "7:00 PM", location: "Library" },
      { date: isoDate(-1), title: "Past event" },
      { date: isoDate(0), title: "Today event" },
      { date: "not-a-date", title: "Broken event" },
    ])};`,
  }));
  await page.goto("./");
  const titles = page.locator("#event-list .event-title");
  await expect(titles).toHaveText(["Today event", "Later event"]);
  await expect(page.locator("#event-list .event-meta").first()).toHaveText("7:00 PM · Library");
  await expect(page.locator("#events-empty")).toBeHidden();
});

test("events: empty list shows the 'no events' note", async ({ page }) => {
  await page.route("**/js/events.js", (route) => route.fulfill({ contentType: "text/javascript", body: "window.PTO_EVENTS = [];" }));
  await page.goto("./");
  await expect(page.locator("#event-list li")).toHaveCount(0);
  await expect(page.locator("#events-empty")).toBeVisible();
});

test("Zeffy: each card shows its form, or 'coming soon' until a URL is set", async ({ page }) => {
  await page.route("https://www.zeffy.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<p>stub</p>" }));
  await page.goto("./");
  const cards = page.locator(".zeffy-embed");
  await expect(cards).toHaveCount(2);
  for (const card of await cards.all()) {
    if (await card.locator("iframe").count()) {
      await expect(card.locator("iframe")).toHaveAttribute("src", /^https:\/\/www\.zeffy\.com\//);
    } else {
      await expect(card.locator(".empty-note")).toHaveText(/coming soon/);
    }
  }
});

test("Zeffy: a real embed URL becomes a lazy, titled iframe", async ({ page }) => {
  await page.route("https://www.zeffy.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<p>stub</p>" }));
  await page.route((url) => url.pathname.endsWith("/") || url.pathname.endsWith("/index.html"), async (route) => {
    const response = await route.fetch();
    const original = await response.text();
    // Point the first card at the test URL, whatever it holds today; clear the second.
    let n = 0;
    const html = original.replace(/data-zeffy-src="[^"]*"/g, () => (n++ === 0 ? `data-zeffy-src="${ZEFFY_TEST_URL}"` : 'data-zeffy-src=""'));
    expect(n, "expected two Zeffy cards in index.html").toBe(2);
    await route.fulfill({ response, body: html });
  });
  await page.goto("./");
  const iframe = page.locator(".zeffy-embed iframe");
  await expect(iframe).toHaveCount(1);
  await expect(iframe).toHaveAttribute("src", ZEFFY_TEST_URL);
  await expect(iframe).toHaveAttribute("title", "Contribution form powered by Zeffy");
  await expect(iframe).toHaveAttribute("loading", "lazy");
});

test("version.json says which commit is live", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "one check is enough");
  const res = await request.get("version.json");
  expect(res.ok()).toBe(true);
  const { commit, built_at } = await res.json();
  expect(commit).toMatch(/^[0-9a-f]{40}$/);
  expect(Number.isNaN(Date.parse(built_at))).toBe(false);
  // The deploy's smoke test sets this to the commit it just deployed.
  if (process.env.EXPECTED_COMMIT) expect(commit).toBe(process.env.EXPECTED_COMMIT);
});
