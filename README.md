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
| `tests/events.test.js` | Unit tests for the events logic |

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

You need Node 18 or newer. No install step is required.

```bash
node --test
```

## Deployment
The site is hosted on **GitHub Pages** from `Original-Carl/kp-pto`. The domain is registered at **Squarespace Domains**, which only provides DNS here; Squarespace can't host a hand-built site.

- Every pull request and every push to `main` runs the tests (`.github/workflows/deploy.yml`).
- A push to `main` also publishes `index.html`, `css/`, `js/`, `fonts/`, and `assets/` to Pages.
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
