# Security Policy

We take the security of Formsmith and its users seriously. Thank you for helping keep it safe.

## Supported versions

Formsmith is **pre-release** (building toward v1). Until the first stable release, security fixes
land on the default branch (`main`). After v1, the latest released version is supported, and this
section will list the supported version line(s).

## Reporting a vulnerability

**Please do not open a public issue, pull request, or discussion for a security vulnerability.**

Report it privately, one of two ways:

- **Preferred, via GitHub private vulnerability reporting:** use the **"Report a vulnerability"** button
  under this repository's **Security** tab (GitHub Security Advisories).
- **Email:** `gnana097@gmail.com` with `SECURITY` in the subject line.

Please include, as far as you can:

- a description of the issue and its impact,
- steps to reproduce (a proof of concept if possible),
- the affected version / commit / component,
- any suggested remediation.

If the details are sensitive, ask for a public key before sending them.

## What to expect

Formsmith is currently maintained by a single founder, so responses are best-effort, but taken
seriously and handled promptly:

- **Acknowledgement:** within 3 business days.
- **Triage:** within 7 business days, with an initial severity assessment and a rough timeline.
- **Fix & disclosure:** coordinated. We aim to ship a fix and publish a GitHub Security Advisory as
  quickly as severity warrants. Please give us a reasonable window to remediate before any public
  disclosure.

We're glad to credit you in the advisory, or to keep you anonymous. Your choice.

## Scope

**In scope**

- The Formsmith code in this repository (the AGPL core, the MIT integration surface, and the
  enterprise modules).
- Self-hosted deployments running unmodified Formsmith with default configuration.

When the hosted service (`formsmith.app`) launches, its infrastructure (and any bug-bounty terms)
will be added here.

**Out of scope (examples)**

- Vulnerabilities in third-party dependencies with no exploit path through Formsmith (report those
  upstream, but do tell us so we can patch or bump).
- Findings that require a compromised host, physical access, or a self-inflicted misconfiguration not
  caused by our defaults.
- Missing hardening with no demonstrated impact (e.g. "header X is absent") absent a concrete exploit.

## Good-faith research

We will not pursue or support legal action against researchers who:

- act in good faith and avoid privacy violations, data destruction, and service disruption,
- only interact with accounts and data they own or have explicit permission to test, and
- give us a reasonable chance to remediate before disclosing publicly.

Thank you for practicing responsible disclosure.
