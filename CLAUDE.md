# CLAUDE.md

The website for King Philip Middle School PTO, Inc. at https://kp-pto.org. It's static HTML,
CSS, and JavaScript on GitHub Pages, with no build step. The README has the details; these are
the rules any agent working here must follow.

## Content
- **Never invent content.** Names, dates, amounts, programs, and claims all come from the PTO
  through Carl. If something is missing, cut off, or ambiguous, ask; don't fill it in.
  Leave a section out rather than show a placeholder (`tests/pages.test.mjs` fails on any
  visible `[[TODO`).
- **Registered organization details must match exactly.** That's the legal name
  "King Philip Middle School PTO, Inc." (with the comma), the EIN, and the formal address with
  the "C/O" line. Google for Nonprofits checks them against the IRS record and the domain's
  WHOIS. They're listed in the README under "Organization details", and the tests enforce them.
- **Zeffy is always linked to, never embedded.** The CSP is `frame-src 'none'`. Donate buttons
  use `data-zeffy-form="donate"`, and event-specific Zeffy links go in `js/events.js`.
- **The contact email is temporarily `kppto678@gmail.com`**, until `info@kp-pto.org` can
  receive mail. The README explains the swap.

## Pages
- The header and footer are copied onto every `*.html` page. Change all of them the same way,
  and add any new page to `sitemap.xml` and the nav. The tests check both.
- The site is mobile-first, for phones on slow connections. The first visit to a page has a
  150 KB budget (site files only), and nothing may load from third parties
  (`scripts/check-inherit.mjs`).

## Checks
Run these before opening a PR:

```bash
node --test
node scripts/check-inherit.mjs
cd tools/ci && npm ci && npx html-validate ../../*.html && npx playwright test
```

## Workflow
- Every change goes through a PR into `main`, which a ruleset protects with 5 required checks.
  **Carl merges every PR himself. Never merge one.** Before acting on "merged", confirm it with
  `gh pr view`.
- Keep related changes in a single PR, so one merge produces one deploy.
- Merging to `main` deploys automatically once CI passes. A smoke job then tests the live site.
- CI-only npm tooling lives in `tools/ci`. Its `.npmrc` rejects releases under 7 days old;
  security-fix exceptions need Carl's OK.
