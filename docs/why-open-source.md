<!--
Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

# Why Formsmith is open source (and how it's funded)

The short version: **the whole product is open source and free to self-host, forever.**
Formsmith makes money from a managed hosted tier (for people who'd rather not run it
themselves) and commercially-licensed modules for organizations. Neither of those takes
anything away from what you can self-host.

If you've been burned by an "open source" project that quietly moved its useful features
behind a paywall, this page is the commitment that Formsmith won't.

## How the licensing works

Formsmith is **open-core**. [`LICENSING.md`](../LICENSING.md) is the authoritative map; the
plain-language version:

- **The core is [AGPL-3.0-only](../LICENSE).** The engine, the builder, the respondent
  runtime, the AI orchestration, the API, everything you need to build and run beautiful
  conversational forms. You can self-host it, modify it, and even offer it as a service. You
  simply can't take the core closed.
- **The integration surface is [MIT](../LICENSING.md).** Published forms are embeddable via
  `<iframe>` today; the dedicated embed SDK, framework wrappers, and API client are on the
  [roadmap](roadmap.md) and permissively (MIT) licensed, so dropping a Formsmith form into your
  own app never raises copyleft questions about *your* codebase.
- **Enterprise modules ([`modules/ee`](../modules)) are commercially licensed.** These are
  add-ons that regulated and larger organizations need, not gates on the core.

And a promise in writing and in git history: the
[**Open-Core Covenant**](../OPEN-CORE-COVENANT.md) commits that the core stays AGPL, 
**forever.** Features don't get relicensed out from under you.

## What you get for free, self-hosting

Not a crippled "community edition." The AGPL core is the real product:

- The full builder, 17 block types, conditional logic, jump/branching, scoring, piping.
- The AI interviewer, adaptive follow-ups on your own model and key, disclosed to
  respondents, with a static fallback.
- The respondent runtime, theming, HMAC-signed webhooks, a REST API with an OpenAPI spec,
  and CSV/JSON export.
- No response limits, no seat limits, no feature flags waiting for a license key.

See the [roadmap](roadmap.md) for what's shipped and what's next.

## How it's funded

Open source that isn't funded doesn't get maintained. Formsmith's plan is deliberately
simple, and it's the same model that keeps projects like Ghost and Plausible independent:

- **A managed hosted tier** *(planned, not yet live; [join the waitlist](https://formsmith.app))*.
  For people who want Formsmith without running a container: backups, updates, and operations
  handled for you. Paying for hosting is paying to keep the open core developed, you're
  supporting the project *and* getting a service.
- **Commercial enterprise modules** for organizations that need SSO/SAML, SCIM, RBAC, audit
  logs, white-labeling, and data-residency controls.

That's it. No investors to answer to, no plan to sell, and **no telemetry or analytics of any
kind** phoning home from your instance, the trust stance is the whole point (see
[Your data](your-data.md)).

## Who Formsmith is for, and when it isn't

Being honest about fit saves everyone time.

**Formsmith is a great fit if you:**
- can't or won't send form responses to a third-party cloud (privacy-bound, regulated, or
  EU teams);
- want a genuinely beautiful, conversational form experience, not a utilitarian survey tool;
- want an AI interviewer that runs on infrastructure and a model *you* control.

**Formsmith is probably *not* the right choice yet if you:**
- need zero operations today and are comfortable with a hosted SaaS holding your data, a
  managed Formsmith tier is still on the way, so Typeform or Tally will serve you sooner;
- depend on a feature that isn't here yet, file upload, payments, or a specific block type
  on the [roadmap](roadmap.md) but not in this release;
- want a large third-party integrations marketplace on day one. Formsmith ships webhooks, a
  REST/OpenAPI data plane, and CSV/JSON export now; native n8n and Slack are next.

If that changed your mind either way, good, that's the page doing its job.

---

See also: [Your data](your-data.md) · [Roadmap](roadmap.md) ·
[vs Typeform](comparisons/formsmith-vs-typeform.md) ·
[vs HeyForm](comparisons/formsmith-vs-heyform.md)
