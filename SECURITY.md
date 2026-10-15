# Security

## Reporting a vulnerability

Please report security issues with kp-pto.org privately using GitHub's
[private vulnerability reporting](https://github.com/Original-Carl/kp-pto/security/advisories/new),
not in a public issue.

I'll acknowledge within a week and let you know what I'm doing about it.

## Scope

- The site at `kp-pto.org` (and `original-carl.github.io/kp-pto` until launch)
- The code in this repository

Out of scope: third-party services the site uses — Zeffy (payment forms, embedded in an
iframe), GitHub Pages (hosting), Squarespace (domain/DNS). Report those to the vendor.

## Known limits

GitHub Pages can't send custom HTTP headers, so:

- The Content-Security-Policy is a `<meta>` tag in `index.html`. Meta CSP can't set
  `frame-ancestors`, so the page itself can be framed by other sites. It has no forms or
  logged-in state of its own (payments happen inside Zeffy's iframe), which keeps the
  clickjacking risk low.
- HTTPS, HSTS, and other response headers are whatever GitHub Pages sends.
