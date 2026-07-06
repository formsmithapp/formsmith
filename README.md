# Formsmith

**Beautiful conversational forms you actually own.**

[![CI](https://github.com/formsmithapp/formsmith/actions/workflows/ci.yml/badge.svg)](https://github.com/formsmithapp/formsmith/actions/workflows/ci.yml)
[![License: AGPL-3.0-only](https://img.shields.io/badge/license-AGPL--3.0--only-blue.svg)](LICENSING.md)
[![Container: ghcr.io](https://img.shields.io/badge/ghcr.io-formsmithapp%2Fformsmith-2496ED?logo=docker&logoColor=white)](https://github.com/formsmithapp/formsmith/pkgs/container/formsmith)

Formsmith is an open-source, self-hostable, AI-native form builder: immersive,
one-question-at-a-time forms with an AI interviewer that asks adaptive follow-up questions,
running entirely on infrastructure you control.

> **v0.1.0, the first public release.** Formsmith is live and self-hostable today: `docker compose up`
> gives you the builder, the AI interviewer, and every response on your own Postgres. This is a
> deliberately quiet first release. Real-world use, [issues](https://github.com/formsmithapp/formsmith/issues),
> and [discussions](https://github.com/formsmithapp/formsmith/discussions) are exactly what it needs.
> See the **[roadmap](docs/roadmap.md)** for what's next and why the cuts are deliberate.

---

## Why Formsmith

Three things, combined for the first time:

- **Your forms. Your data. Your servers.** Self-host the whole thing with `docker compose up`, 
  Postgres and nothing else required. No third party ever sees a response.
- **Typeform-beautiful, open-source.** A keyboard-first, editorial respondent experience built with
  genuine design care, not "another open-source form builder."
- **Forms that interview, on your infrastructure.** Adaptive AI follow-ups powered by *your own
  model and key*, disclosed to respondents, with a static fallback so a form never breaks when a
  model does. It is the only AI interviewer that runs on infrastructure you control.

Built for the teams the incumbents lock out: privacy-bound and regulated organizations, EU teams,
and developers who want to own their stack.

## Highlights

- Immersive, one-question-at-a-time respondent runtime and a premium, accessible builder (WCAG 2.1 AA
  as a release criterion).
- Conditional logic, jump/branching, calculated fields & scoring, answer piping.
- A portable, framework-agnostic core engine that runs identically in the browser, Node, and at the
  edge: client-side for instant UX, server-side for trust.
- Every published form is a standalone, embeddable page. Drop it into any site with an `<iframe>`
  today. A tiny, zero-dependency embed SDK and React/Vue/Svelte wrappers are on the [roadmap](docs/roadmap.md).
- HMAC-signed webhooks, a REST API with a generated OpenAPI spec, and full CSV/JSON export. Your data
  is never locked in.
- Bring-your-own SMTP and LLM key; every integration is optional, features degrade, forms never break.

## Self-hosting

```bash
git clone https://github.com/formsmithapp/formsmith
cd formsmith
cp .env.example .env      # set BETTER_AUTH_SECRET (openssl rand -base64 32)
docker compose up -d      # web + postgres, that's it
```

Open `http://localhost:3000`, sign up, publish your first form. Migrations run on boot;
upgrades are `docker compose pull && docker compose up -d`. The full walkthrough (TLS,
configuration reference, backups, security defaults) is in
**[docs/self-hosting.md](docs/self-hosting.md)**.

No Redis, no object storage, and no cloud dependency required to run Formsmith. Optional capabilities
(such as file uploads) light up via an optional storage profile or by pointing an S3-compatible bucket
at the same adapter.

## Architecture at a glance

Formsmith is a TypeScript monorepo. The core is deliberately portable (plain Postgres, a
framework-agnostic engine, and cloud-neutral adapters), so it self-hosts anywhere.

```
packages/
  engine     framework-agnostic form state machine · navigation · validation · piping
  blocks     block-type registry
  rules      logic engine (visibility · jump · calculation)
  ai         adaptive AI follow-up orchestration (bring-your-own model)
  renderer   the respondent + builder-preview view
  templates  starter form templates
  db · adapters · schemas · ui
apps/
  web        builder · dashboard · results · control-plane API
  api        public data-plane API
modules/
  ee         enterprise features (commercially licensed)
```

Planned (the MIT integration surface): a zero-dependency `embed` SDK, framework wrappers
(React/Vue/Svelte), and an `sdk` client. Published forms are already frameable via `<iframe>`
today. The wrappers are convenience on top.

## Licensing

Formsmith is **open-core**. [`LICENSING.md`](LICENSING.md) is the authoritative map:

- **Core** (engine, renderer, apps, AI orchestration, …): **AGPL-3.0-only**. Self-host it, or even
  offer it as a service; you simply cannot take the core closed.
- **Integration surface** (embed SDK, framework wrappers, API client): **MIT** as it ships, so
  embedding a Formsmith form never raises copyleft questions for your own codebase. (Published forms
  are already embeddable via `<iframe>` today; the dedicated SDK and wrappers are forthcoming.)
- **Enterprise modules** (`modules/ee`): commercially licensed.

And a public promise: the [Open-Core Covenant](OPEN-CORE-COVENANT.md) commits, in writing and in git
history, that **the core stays AGPL, forever.**

## Contributing

Contributions are welcome, see [CONTRIBUTING.md](CONTRIBUTING.md). Formsmith uses a Contributor
License Agreement ([CLA.md](CLA.md)); a bot will ask you to accept it on your first pull request. The
honest summary: you keep your copyright, and every contribution merged into an open package stays open
under that package's license, permanently.

## Trademark

"Formsmith" and the Formsmith logo are trademarks, see [TRADEMARK-POLICY.md](TRADEMARK-POLICY.md).
You may self-host, describe, teach, and build on Formsmith freely; public forks must be renamed.

## Links

- Website: [formsmith.app](https://formsmith.app)
- Roadmap: [docs/roadmap.md](docs/roadmap.md) · Changelog: [CHANGELOG.md](CHANGELOG.md)
- Why open source & how it's funded: [docs/why-open-source.md](docs/why-open-source.md)
- Your data (privacy & security stance): [docs/your-data.md](docs/your-data.md)
- Pricing: [docs/pricing.md](docs/pricing.md)
- How it compares: [vs Typeform](docs/comparisons/formsmith-vs-typeform.md) · [vs HeyForm](docs/comparisons/formsmith-vs-heyform.md)
- Self-hosting guide: [docs/self-hosting.md](docs/self-hosting.md)
- Issues & discussions: this repository
- Contact: gnana097@gmail.com

---

*Independent and bootstrapped, built for the teams the incumbents lock out.*
