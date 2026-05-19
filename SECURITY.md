# Security policy

The Joy Matrix is a client-only single-page app. It runs entirely in the
browser, has no backend, no accounts, no telemetry, and no network calls
to a server we control. Your project data lives in your browser's
`localStorage` and never leaves your device.

## Reporting a vulnerability

If you find a security issue — whether in the app itself, the build
pipeline, or a dependency — please report it privately rather than
opening a public GitHub issue.

Open a [GitHub security advisory](https://github.com/benzwick/joy-matrix/security/advisories/new),
or reach out via one of the contact links in the site footer.

I aim to respond within a few days. There is no bounty — this is a
public-domain side project — but credit will be given in the fix
commit and release notes if you'd like.

## Scope

In scope:

- The Joy Matrix web app itself (this repository).
- The published build at https://joy-matrix.com/.

Out of scope:

- Vulnerabilities in third-party services linked from the footer
  (LinkedIn, GitHub, Instagram, Talk2View). Please report those to
  the relevant vendors.
- Issues that require physical access to a victim's unlocked device
  to exploit `localStorage` (this is by design — your data stays on
  your device).

## Supported versions

Only the latest commit on `main` is supported. There are no LTS
branches; everyone is always on the current version.
