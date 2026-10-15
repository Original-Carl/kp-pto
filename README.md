# King Philip Middle School PTO: kp-pto.org

A single-page static site in plain HTML, CSS, and JavaScript. There is no build step and there are no dependencies.

It's built mobile-first for phones on slow connections:
- No frameworks and no third-party requests, except the Zeffy forms.
- Two self-hosted web fonts that match the school's site: Fjalla One for headings and Lato 400/700 for body text. They are latin-subset woff2 files in `fonts/`, about 66 KB in total, and use `font-display: swap`. Both are licensed under the SIL Open Font License, and the license texts are in `fonts/`.
- The logo is inline SVG.
- Zeffy forms load lazily, so they don't load until a visitor scrolls near them.

## Files

| Path | What it is |
|------|------------|
| `index.html` | The page and all its copy |
| `css/styles.css` | Styles. Colors are CSS variables at the top of the file. |
| `js/events.js` | **The events list.** Edit this file to post events. |
| `js/main.js` | Menu toggle, events rendering, and Zeffy embeds |
| `assets/favicon.svg` | Browser-tab icon |
| `fonts/` | Self-hosted woff2 fonts, their OFL licenses, and `sources.json` (origin and checksum for each font) |
| `tests/` | Unit tests: events logic and the Inherit checks |
| `scripts/` | Pipeline scripts: `check-inherit.mjs`, `check-licenses.mjs`, and `stage-site.mjs` (copies the shipped files into `_site/`) |
| `tools/ci/` | CI-only npm tooling (never shipped): Playwright, html-validate, and the browser tests in `tools/ci/e2e/` |

## Editing content

### Placeholders to replace
Search `index.html` for `[[TODO` and `TODO:`. These are the placeholders:

- The hero tagline
- The About section: the mission statement and what the PTO funds
- **The Zeffy contributions embed URL** (`data-zeffy-src` on the first `.zeffy-embed`)
- **The Zeffy vending embed URL** (`data-zeffy-src` on the second `.zeffy-embed`)
- The text describing contributions and vending
- The volunteer intro, the role list, and the sign-up link
- Board member names (President, Vice President, Treasurer, Secretary)
- The public contact email (currently `info@kp-pto.org`; check that the mailbox exists)
- The school website link and the non-profit / tax-ID note in the footer
- The logo: an inline "KP" SVG in the header plus `assets/favicon.svg`
- **At launch:** remove the pre-launch `<meta name="robots" content="noindex, nofollow">` tag from `index.html`

### Zeffy forms
1. In Zeffy, open the form and choose **Share → Embed**.
2. Copy the `src` URL from the embed code. It starts with `https://www.zeffy.com/`.
3. Paste that URL into the matching `data-zeffy-src="..."` in `index.html`.

The script only builds the iframe from `https://www.zeffy.com/` URLs, and the CSP's `frame-src` in `index.html` allows only that host. If Zeffy ever gives you a URL on a different host, update both. Until a real URL is in place, the card shows "form coming soon". If a form gets cut off, raise the height in `.zeffy-embed.is-loaded` in `css/styles.css`.

### Events
Add entries to `js/events.js`:

```js
{ date: "2026-11-05", title: "PTO Monthly Meeting", time: "7:00 PM", location: "School library" },
```

Events are sorted by date, and past events hide automatically.

## Running locally

```bash
python3 -m http.server 8080 --directory .
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
npx html-validate ../../index.html
```

And run the browser tests. They stage `_site/` and serve it with Python:

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
| **Deploy** | GitHub Pages, deployed automatically on merge after CI passes, with a smoke test afterward | *Partly live*: `deploy.yml` runs only after CI succeeds on a push to `main`, and only if that commit is still `main`'s tip, so a re-run can't roll the site back. To redeploy without a new commit, re-run the latest Deploy run. The post-deploy smoke test is still planned. |
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
| The CSP allows only `'self'`, plus `data:` images and `https://www.zeffy.com` frames. Every resource the page loads (scripts, styles, fonts, images, CSS `url()`) is same-origin. | `scripts/check-inherit.mjs` (`CSP_ALLOWED`) | same |
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
- **At runtime:** Zeffy (payment forms, in an iframe; the only third-party origin the page contacts) and GitHub Pages (hosting).
- **Behind the scenes:** Squarespace (domain registration and DNS) and Google Workspace (`@kp-pto.org` email).
- **Fonts:** Fjalla One and Lato come from Google Fonts but are downloaded once and self-hosted under the SIL OFL 1.1, so there's no runtime request to Google.

## Deployment
The site is hosted on **GitHub Pages** from `Original-Carl/kp-pto`. The domain is registered at **Squarespace Domains**, which only provides DNS here; Squarespace can't host a hand-built site.

- Every pull request and every push to `main` runs CI (`.github/workflows/ci.yml`).
- When CI passes on a push to `main`, `.github/workflows/deploy.yml` publishes that commit's `index.html`, `css/`, `js/`, `fonts/`, and `assets/` to Pages, staged by `scripts/stage-site.mjs`.
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
