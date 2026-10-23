# King Philip Middle School PTO: kp-pto.org

A static site in plain HTML, CSS, and JavaScript, with six pages plus a 404 page. There is no build step and there are no dependencies.

It's built mobile-first for phones on slow connections:
- No frameworks and no third-party requests. Payments hand off to Zeffy's own pages; nothing is embedded.
- Two self-hosted web fonts that match the school's site: Fjalla One for headings and Lato 400/700 for body text. They are latin-subset woff2 files in `fonts/`, about 66 KB in total, and use `font-display: swap`. Both are licensed under the SIL Open Font License, and the license texts are in `fonts/`.
- The PTO logos are small WebP files: 3.9 KB in the header, 36 KB on Home. The full-size originals live in `brand/` and are never shipped.

## Files

| Path | What it is |
|------|------------|
| `index.html` | Home: mission banner and links to each page |
| `about.html` | Mission, what the PTO funds, and organization details (legal name, EIN, address, email), plus JSON-LD |
| `programs.html` | A section for each PTO program (staff appreciation, field trips, basketball, scholarship, events, meetings, and so on) |
| `events.html` | Upcoming events (from `js/events.js`) |
| `support.html` | What contributions fund and ways to give (online via event links, check, cash) |
| `volunteer.html` | Volunteer roles and sign-up |
| `contact.html` | Email, mailing address, and board |
| `404.html` | Shown by GitHub Pages for unknown URLs |
| `sitemap.xml`, `robots.txt` | For search engines. When you add a page, add it to `sitemap.xml` too; `tests/pages.test.mjs` checks this. |
| `css/styles.css` | Styles. Colors are CSS variables at the top of the file. |
| `js/events.js` | **The events list.** Edit this file to post events. |
| `js/main.js` | Menu toggle and events rendering |
| `assets/` | Browser-tab icon (`favicon.svg`) and the site's logo images (`logo-header.webp`, `logo-home.webp`) |
| `brand/` | Full-size logos for flyers and social posts (not shipped); see `brand/README.md` |
| `fonts/` | Self-hosted woff2 fonts, their OFL licenses, and `sources.json` (origin and checksum for each font) |
| `tests/` | Unit tests: events logic, the Inherit checks, page consistency (`pages.test.mjs`), and `version.json` (`stage-site.test.mjs`) |
| `docs/RUNBOOK.md` | How deploys work, rollback, redeploying, content updates, and the DNS records to keep |
| `scripts/` | Pipeline scripts: `check-inherit.mjs`, `check-licenses.mjs`, `check-content.mjs` (lists content still to add), and `stage-site.mjs` (copies the shipped files into `_site/` and writes `version.json`) |
| `tools/ci/` | CI-only npm tooling (never shipped): Playwright, html-validate, and the browser tests in `tools/ci/e2e/` |

## Editing content

### Shared header and footer
Every page carries its own copy of the header (logo and nav) and the footer (legal name, EIN, address, and email). If you change one, change them all the same way. `tests/pages.test.mjs` fails if they drift apart, if a tab stops pointing at its own page, or if a `[[TODO` placeholder is visible on any page.

### Organization details
These must match what's registered with Google for Nonprofits exactly. They appear in the footer of every page and on `about.html`, including its JSON-LD block:

- **Legal name:** King Philip Middle School PTO, Inc.
- **EIN (Charity ID):** 41-3002032
- **Email:** kppto678@gmail.com, **temporarily**. Google for Nonprofits wants an @kp-pto.org address, but `info@kp-pto.org` can't be created until Google reactivates the Workspace account, since the trial expired. Once it exists, replace the address on every page and update `EMAIL` in `tests/pages.test.mjs`.
- **Address:** C/O King Philip Middle School, 100 King Philip Drive, West Hartford, CT 06117
  - This is the formal address on both IRS letters, confirmed by the treasurer on 2026-10-23. Always use it on the site, with the "C/O" line, even though the PTO informally uses just "100 King Philip Drive".

`tests/pages.test.mjs` and the browser tests check for these exact values.

### Content still to add
Run `node scripts/check-content.mjs`; CI also prints this list on every run. Sections without content are left out of the page rather than shown as placeholders:

- **Volunteer roles and a sign-up link** on `volunteer.html` (there's a commented template)
- Board changes go in `contact.html` (`.board-grid`); list only people who've agreed

### Zeffy links
The site links out to Zeffy and doesn't embed anything.

- **General donations:** the **Donate** buttons on Home and Support (`data-zeffy-form="donate"`) go straight to the PTO's general Zeffy donation form. To change the form, update both `href`s.
- **Events and campaigns:** each gets its own Zeffy link, which goes on its event in `js/events.js`:

```js
{ date: "2026-10-30", title: "7th & 8th Grade Halloween Mixer", link: "https://www.zeffy.com/en-US/ticketing/…", linkText: "Tickets on Zeffy" },
```

To get the link, open the form in Zeffy and choose **Share → Copy link**. Only `https://` links are shown. The Support page sends people to the Events page for online giving.

### Events
Add entries to `js/events.js`:

```js
{ date: "2026-11-05", title: "PTO Monthly Meeting", time: "7:00 PM", location: "School library" },
```

Events are sorted by date, and past events hide automatically.

## Running locally

```bash
node scripts/stage-site.mjs && node scripts/serve.mjs 8080
```

Then open http://localhost:8080.

## Tests

You need Node 24 (see `.nvmrc`). Unit tests need no install step:

```bash
node --test
```

The HTML validation and browser tests use the CI tooling in `tools/ci`. Install it once:

```bash
cd tools/ci && npm ci && npx playwright install chromium
```

Then, from `tools/ci`, validate the HTML:

```bash
npx html-validate ../../*.html
```

And run the browser tests. They stage `_site/` and serve it with `scripts/serve.mjs`, which uses Node built-ins only:

```bash
npx playwright test
```

To run the browser tests against a deployed site instead, set `BASE_URL`. Before launch, use `BASE_URL=https://original-carl.github.io/kp-pto/ npx playwright test`. After launch, use `https://kp-pto.org/`: the github.io address will redirect there, and the tests would count the redirect as a third-party load.

## Pipeline

This repo uses a DevSecOps pipeline with five stages. Work can't move on until each stage's gate passes. The stages are being rolled out one at a time; a stage marked *planned* isn't live yet.

| Stage | What it covers | Gate |
|-------|----------------|------|
| **Develop** | Feature branches, the local pre-commit hook, the PR template, and self-review | The hook passes. Changes reach `main` only by PR: the ruleset blocks direct pushes and force-pushes and requires linear history, and the repo allows squash-merge only. |
| **Inherit** | Everything the site uses but didn't write: GitHub Actions, CI tooling, fonts, and third-party services | The CI `inherit` job passes. Actions are pinned to commit SHAs and container images by digest. The page loads nothing from third parties beyond the CSP allowlist. Fonts match their recorded checksums. CI tooling has no high or critical vulnerabilities, no OSV findings, and only allowlisted licenses. Install scripts are denied unless reviewed. |
| **Build** | CI (`.github/workflows/ci.yml`) runs `test` (unit tests), `verify` (html-validate, then Playwright on phone and desktop against exactly what ships, including a 150 KB budget for what the site itself serves), `secrets` (gitleaks over the full history), and `sast` (Semgrep CE). Semgrep's rulesets come from semgrep.dev on each run and aren't pinned, so a new rule can flag existing code. | Every required check passes on the PR: `test`, `inherit`, `verify`, `secrets`, and `sast`. Semgrep has no findings at any severity, and gitleaks finds no leaks. |
| **Deploy** | GitHub Pages, deployed automatically on merge after CI passes, with a smoke test afterward. The site publishes `version.json` (`{commit, built_at}`) so anyone can see which commit is live. See [docs/RUNBOOK.md](docs/RUNBOOK.md) for rollback and redeploys. | `deploy.yml` runs only after CI succeeds on a push to `main`, and only if that commit is still `main`'s tip, checked again when the job runs, so re-running an old run can't roll the site back. The `github-pages` environment accepts deployments from `main` only. After deploying, the `smoke` job waits (up to 10 minutes) until the live `version.json` reports the deployed commit, then runs the phone browser tests against `SITE_URL` (`https://kp-pto.org/`). A red smoke job means the site is live but broken: revert the PR. |
| **Operate** | Weekly checks of the live site, the domain, and email DNS | *Planned* |

### Develop

- Work happens on a branch and goes through a PR to `main`. The PR template has a checklist that covers phone width, personal data, and third-party content.
- Turn on the local hook once per clone. It runs the tests and blocks stray `debugger` and `console.log` lines:

  ```bash
  git config core.hooksPath .githooks
  ```

- To report a security issue, see [SECURITY.md](SECURITY.md).

### Supply chain (Inherit)

| Control | Where | Run locally |
|---------|-------|-------------|
| GitHub Actions are pinned to full commit SHAs, and container images by digest | `scripts/check-inherit.mjs` | `node scripts/check-inherit.mjs` |
| The CSP allows only `'self'` and `data:` images, with `frame-src 'none'`. Every resource the page loads (scripts, styles, fonts, images, CSS `url()`) is same-origin. | `scripts/check-inherit.mjs` (`CSP_ALLOWED`) | same |
| Self-hosted fonts must match the sha256 recorded in `fonts/sources.json`. A new font needs an entry there. | `scripts/check-inherit.mjs` | same |
| CI tooling lives in `tools/ci` with its own lockfile and is never shipped. The site itself has no dependencies. | `tools/ci/package.json` | — |
| Vulnerable tooling (high or critical) fails CI | `inherit` job, `npm audit` | `cd tools/ci && npm audit --audit-level=high` |
| Known vulnerabilities anywhere in the `tools/ci` lockfile fail CI | `inherit` job, [OSV-Scanner](https://google.github.io/osv-scanner/) (image pinned by digest) | — |
| Licenses must pass SPDX evaluation, read straight from the lockfile | `scripts/check-licenses.mjs` | `node scripts/check-licenses.mjs` |
| An SBOM (CycloneDX) is produced on every CI run and kept 90 days | `inherit` job artifact `sbom` | `cd tools/ci && npm sbom --sbom-format=cyclonedx` |
| Weekly grouped updates for actions and `tools/ci`, each release at least 7 days old | `.github/dependabot.yml` | — |
| npm won't resolve versions published in the last 7 days. For an urgent fix, add `min-release-age-exclude=<pkg>`. | `tools/ci/.npmrc` | — |
| Dependency install scripts are blocked unless approved | `allowScripts` in `tools/ci/package.json` | `cd tools/ci && npm install-scripts ls` |
| Security updates arrive immediately, one PR per advisory | Repo setting (Dependabot security updates) | — |

**Third-party services:**
- **At runtime:** GitHub Pages (hosting). The page contacts no other origin. Payments link out to Zeffy's site.
- **Behind the scenes:** Squarespace (domain registration and DNS) and Google Workspace (`@kp-pto.org` email).
- **Fonts:** Fjalla One and Lato come from Google Fonts but are downloaded once and self-hosted under the SIL OFL 1.1, so there's no runtime request to Google.

## Deployment
The site is hosted on **GitHub Pages** from `Original-Carl/kp-pto`. The domain is registered at **Squarespace Domains**, which only provides DNS here; Squarespace can't host a hand-built site.

- Every pull request and every push to `main` runs CI (`.github/workflows/ci.yml`).
- When CI passes on a push to `main`, `.github/workflows/deploy.yml` publishes that commit's pages (`*.html`), `robots.txt`, `sitemap.xml`, `css/`, `js/`, `fonts/`, and `assets/` to Pages, staged by `scripts/stage-site.mjs`, plus a `version.json` naming the commit. A smoke job then tests the live site.
- Rollback, redeploys, and the DNS records to keep are in [docs/RUNBOOK.md](docs/RUNBOOK.md).
- `main` is protected, so all changes go through a PR.

### Pointing kp-pto.org at GitHub Pages (one-time setup)
1. Prove you own the domain to GitHub. This stops anyone else from claiming it.
   - Go to GitHub → *Settings* (your account) → *Pages* → *Add a verified domain* → `kp-pto.org`.
   - Add the TXT record GitHub shows to Squarespace DNS, then click *Verify*.
2. In Squarespace → *Domains* → kp-pto.org → *DNS*, remove the **Squarespace Defaults** records. **Keep the email records** (MX, plus any SPF/DKIM TXT or CNAME records).
3. Add these records:

| Type | Host | Value |
|------|------|-------|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| AAAA | @ | 2606:50c0:8000::153 |
| AAAA | @ | 2606:50c0:8001::153 |
| AAAA | @ | 2606:50c0:8002::153 |
| AAAA | @ | 2606:50c0:8003::153 |
| CNAME | www | original-carl.github.io |

4. In the repo, go to *Settings* → *Pages* → *Custom domain*, enter `kp-pto.org`, and save. Once the certificate is issued (from a few minutes up to about an hour), tick **Enforce HTTPS**.

Until the custom domain is set, the site is served at https://original-carl.github.io/kp-pto/.
