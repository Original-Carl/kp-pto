// Run with: node --test
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseLocalDate, upcomingEvents, isZeffyUrl } = require("../js/main.js");

test("parseLocalDate reads YYYY-MM-DD as a local date", () => {
  const d = parseLocalDate("2026-11-05");
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 10);
  assert.equal(d.getDate(), 5);
});

test("parseLocalDate rejects bad input", () => {
  for (const bad of ["", null, undefined, "11/05/2026", "2026-13-01", "2026-02-30", "2026-1-5"]) {
    assert.equal(parseLocalDate(bad), null, String(bad));
  }
});

test("upcomingEvents sorts soonest first and hides past events", () => {
  const today = new Date(2026, 9, 15, 18, 30); // Oct 15 2026, evening
  const events = [
    { date: "2026-12-01", title: "December" },
    { date: "2026-10-14", title: "Yesterday" },
    { date: "2026-10-15", title: "Today" },
    { date: "2026-11-05", title: "November" },
  ];
  assert.deepEqual(upcomingEvents(events, today).map((e) => e.title), ["Today", "November", "December"]);
});

test("upcomingEvents drops entries missing a valid date or title", () => {
  const today = new Date(2026, 0, 1);
  const events = [
    { date: "bad", title: "Bad date" },
    { date: "2026-02-01" },
    null,
    { date: "2026-03-01", title: "Good" },
  ];
  assert.deepEqual(upcomingEvents(events, today).map((e) => e.title), ["Good"]);
});

test("upcomingEvents tolerates a missing list", () => {
  assert.deepEqual(upcomingEvents(undefined, new Date()), []);
});

test("isZeffyUrl only accepts https://www.zeffy.com/ URLs", () => {
  assert.equal(isZeffyUrl("https://www.zeffy.com/embed/donation-form/abc"), true);
  assert.equal(isZeffyUrl("[[TODO: Zeffy contributions embed URL]]"), false);
  assert.equal(isZeffyUrl("https://www.zeffy.com.evil.example/x"), false);
  assert.equal(isZeffyUrl("http://www.zeffy.com/embed/x"), false);
  assert.equal(isZeffyUrl(undefined), false);
  assert.equal(isZeffyUrl("  https://www.zeffy.com/embed/x  "), true);
});
