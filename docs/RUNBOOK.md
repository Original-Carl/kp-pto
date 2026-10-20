# kp-pto.org runbook

How the live site gets updated, how to undo a bad update, and the DNS facts that
keep the site and the `@kp-pto.org` email working.

## How deploys work

1. A change goes through a PR to `main`. CI (`.github/workflows/ci.yml`) has to pass
   `test`, `inherit`, `verify`, `secrets`, and `sast` before the PR can merge.
2. Merging (squash) pushes to `main`, and CI runs again on that commit.
3. When that CI run succeeds, `.github/workflows/deploy.yml` starts (a `workflow_run`
   trigger). Its `deploy` job runs only if all of these hold:
   - CI succeeded, for a **push** (never a PR) to `main`;
   - the commit CI tested is **still `main`'s tip**. If another PR merged in the
     meantime, this run skips and the newer commit's own CI run deploys it.

   A re-run keeps the commit its run started with, so `deploy`'s first step checks
   `main`'s tip again at run time and fails ("main is now …") if `main` has moved on.
   Re-running an old CI or Deploy run therefore can't roll the site back.
4. `deploy` stages exactly the public files into `_site/` (`scripts/stage-site.mjs`),
   writes `_site/version.json` (`{"commit": "<sha>", "built_at": "<time>"}`), and
   publishes it to GitHub Pages.
5. `smoke (live site)` polls `${SITE_URL}version.json` (the plain URL visitors get)
   every 10 seconds until it reports the commit just deployed, for up to 10 minutes,
   because the Pages CDN can lag. Then it runs the phone browser tests against the live
   site. If a newer commit deploys while it runs, the older smoke run is cancelled, not
   failed.

The `github-pages` environment (Settings → Environments → github-pages) also allows
deployments from the `main` branch only (a custom deployment branch policy), so no other
branch can publish even if the workflow changed. Nothing there needs changing.

The repository variable `SITE_URL` (Settings → Secrets and variables → Actions →
Variables) is `https://kp-pto.org/`. The smoke job tests that address. Keep the
trailing slash.

**Which commit is live?** Open https://kp-pto.org/version.json, or run:

```bash
curl -s https://kp-pto.org/version.json
```

## When the smoke job is red

A red `smoke (live site)` means the new version **is already live** and something on
it failed.

1. Check that this run is for the commit that's live now (`version.json`). If a newer
   commit has deployed since, this result is out of date; look at the newer run instead.
2. If the "Wait for the live site" step timed out, GitHub Pages was slow or down, and
   the browser tests never ran (so there's no report). Check
   https://www.githubstatus.com, then use **Re-run failed jobs** on that run.
3. If the browser tests failed, download the run's `smoke-report` artifact (the
   Playwright HTML report) to see what failed. If the site really is broken, roll back
   (below). If it was a one-off glitch (a timeout, a network error), use **Re-run failed
   jobs**.

## Rollback

Roll back by reverting the PR that broke things. There's no "deploy an older commit"
button, by design.

1. On GitHub, open the merged PR and click **Revert**. GitHub opens a new PR that undoes
   it.
2. Wait for CI to pass on the revert PR, then merge it.
3. The merge deploys like any other change. Check that the Deploy run's `smoke` job is
   green and that `version.json` shows the revert's merge commit.

If several PRs need undoing, revert them newest first, or revert them together in one PR.

## Redeploying without a new commit

To publish `main`'s tip again (for example after a GitHub Pages outage, or after a
settings change), open **Actions → Deploy**, pick the **latest** run, and choose
**Re-run all jobs**. Only the run for `main`'s tip deploys; on an older run, `deploy`
fails at its first step instead of publishing an old commit. There's no manual "Run
workflow" button.

## Content updates

Content changes go through a PR like any other change; merging publishes them.

### Events
Edit `js/events.js` and add an entry to `window.PTO_EVENTS`:

```js
{ date: "2026-11-12", title: "PTO General Meeting", time: "7:00 PM", location: "School library" },
```

- `date` is `YYYY-MM-DD` and required. `end` is the last day of a multi-day event.
- `time`, `location`, `details`, `link`, and `linkText` are optional.
- Order doesn't matter: the site sorts by date and hides past events.

### Zeffy links
Zeffy links go on the event they belong to, in `js/events.js`. The site links out to Zeffy
and never embeds it.

1. In Zeffy, open the form and choose **Share → Copy link**.
2. Add it to the event:

   ```js
   { date: "2026-10-30", title: "7th & 8th Grade Halloween Mixer", link: "https://www.zeffy.com/en-US/ticketing/…", linkText: "Tickets on Zeffy" },
   ```

Only `https://` links are shown. The Support page points people to the Events page for
online giving, so it doesn't need editing.

## DNS and HTTPS

The domain is registered at **Squarespace Domains**, and Squarespace hosts its DNS
(Squarespace → Domains → kp-pto.org → DNS). The site is hosted on GitHub Pages; Squarespace
serves no web content.

These records serve the site:

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

**Never delete these.** They aren't part of the site, but removing them breaks things:

- **Google Workspace email:** the MX record (`smtp.google.com`), the SPF TXT record
  (`v=spf1 include:_spf.google.com ~all`), and the DKIM TXT record at
  `google._domainkey`. Without them, `@kp-pto.org` mail stops arriving or lands in spam.
- **`_github-pages-challenge-Original-Carl`** TXT: proves to GitHub that the
  Original-Carl account owns kp-pto.org, so no one else can point it at their own Pages
  site.

In repo Settings → Pages, the custom domain is `kp-pto.org` and **Enforce HTTPS** is
on. GitHub issues and renews the certificate itself. If the custom domain is ever
removed and re-added, Enforce HTTPS can turn off; tick it again once the certificate
shows as issued.

To check the records from a terminal:

```bash
dig +short kp-pto.org A
```

```bash
dig +short kp-pto.org MX
```

```bash
dig +short _github-pages-challenge-Original-Carl.kp-pto.org TXT
```
