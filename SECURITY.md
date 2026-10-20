# Security

## Reporting a vulnerability

Please report security issues with kp-pto.org privately using GitHub's
[private vulnerability reporting](https://github.com/Original-Carl/kp-pto/security/advisories/new),
not in a public issue.

I'll acknowledge within a week and let you know what I'm doing about it.

## Scope

- The site at `kp-pto.org` (and `original-carl.github.io/kp-pto` until launch)
- The code in this repository

Out of scope: third-party services the site uses — Zeffy (payment forms, linked to on
zeffy.com), GitHub Pages (hosting), Squarespace (domain/DNS). Report those to the vendor.

## Known limits

GitHub Pages can't send custom HTTP headers, so:

- The Content-Security-Policy is a `<meta>` tag in every page's `<head>`. Meta CSP can't set
  `frame-ancestors`, so the pages themselves can be framed by other sites. They have no forms
  or logged-in state of their own (payments happen on zeffy.com), which keeps the
  clickjacking risk low.
- HTTPS, HSTS, and other response headers are whatever GitHub Pages sends.
