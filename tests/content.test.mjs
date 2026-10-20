// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { contentGaps } from "../scripts/check-content.mjs";

const full = {
  "volunteer.html": `<ul class="check-list"><li>Role</li></ul>`,
  "contact.html": `<ul class="board-grid"><li>President</li></ul>`,
};

test("content gaps: nothing missing when everything is filled in", () => {
  assert.deepEqual(contentGaps(full), []);
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
