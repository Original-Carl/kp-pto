// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { contentGaps } from "../scripts/check-content.mjs";

const full = {
  "support.html": `
    <a class="btn" data-zeffy-form="contributions" href="https://www.zeffy.com/en-US/donation-form/a">Donate</a>
    <a href="https://www.zeffy.com/en-US/ticketing/b" data-zeffy-form="vending">Buy</a>`,
  "volunteer.html": `<ul class="check-list"><li>Role</li></ul>`,
  "contact.html": `<ul class="board-grid"><li>President</li></ul>`,
};

test("content gaps: nothing missing when everything is filled in", () => {
  assert.deepEqual(contentGaps(full), []);
});

test("content gaps: Zeffy links must exist, point at Zeffy, and not be commented out", () => {
  const pages = { ...full, "support.html": `
    <a data-zeffy-form="contributions" data-href="https://www.zeffy.com/x" href="https://example.com/donate">Donate</a>
    <!-- <a data-zeffy-form="vending" href="https://www.zeffy.com/x">Buy</a> -->` };
  assert.deepEqual(contentGaps(pages), [
    "support.html: no Zeffy link yet for contributions",
    "support.html: no Zeffy link yet for vending",
  ]);
});

test("content gaps: commented-out templates don't count as content; noindex is reported once", () => {
  const pages = {
    ...full,
    "volunteer.html": `<!-- <ul class="check-list"><li>Role</li></ul> -->`,
    "contact.html": `<!-- <ul class="board-grid"></ul> -->`,
    "index.html": `<meta name="robots" content="noindex, nofollow">`,
    "about.html": `<meta name="robots" content="noindex, nofollow">`,
  };
  assert.deepEqual(contentGaps(pages), [
    "pre-launch noindex tag still on 2 page(s); remove at launch",
    "volunteer.html: no volunteer roles listed yet",
    "contact.html: no board members listed yet",
  ]);
});
