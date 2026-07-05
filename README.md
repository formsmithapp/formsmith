# Formsmith

**Beautiful conversational forms you actually own.**

Formsmith is an open-source, self-hostable, AI-native form builder — immersive,
one-question-at-a-time forms with an AI interviewer that asks adaptive follow-up questions,
running entirely on infrastructure you control.

> 🚧 **Pre-release.** Formsmith is being built in the open toward its first release (v1). The
> licensing foundation is in place; the application is under active development. Watch this repo
> and [formsmith.app](https://formsmith.app) for the launch.

---

## Why Formsmith

Three things, combined for the first time:

- **Your forms. Your data. Your servers.** Self-host the whole thing with `docker compose up` —
  Postgres and nothing else required. No third party ever sees a response.
- **Typeform-beautiful, open-source.** A keyboard-first, editorial respondent experience built with
  genuine design care — not "another open-source form builder."
- **Forms that interview — on your infrastructure.** Adaptive AI follow-ups powered by *your own
  model and key*, disclosed to respondents, with a static fallback so a form never breaks when a
  model does. It is the only AI interviewer that runs on infrastructure you control.

Built for the teams the incumbents lock out: privacy-bound and regulated organizations, EU teams,
and developers who want to own their stack.

## Highlights

- Immersive, one-question-at-a-time respondent runtime and a premium, accessible builder (WCAG 2.1 AA
  as a release criterion).
- Conditional logic, jump/branching, calculated fields & scoring, answer piping.
- A portable, framework-agnostic core engine that runs identically in the browser, Node, and at the
  edge — client-side for instant UX, server-side for trust.
- A tiny, zero-dependency embed SDK (iframe) that drops into any site — React, Vue, Svelte, or plain
  HTML.
- HMAC-signed webhooks, a REST API with a generated OpenAPI spec, and full CSV/JSON export. Your data
  is never locked in.
- Bring-your-own SMTP and LLM key; every integration is optional — features degrade, forms never break.

## Self-hosting

At first release, running a real instance will be:

```bash
git clone https://github.com/formsmithapp/formsmith
cd formsmith
cp .env.example .env      # set a few secrets
docker compose up         # web + postgres — that's it
```

No Redis, no object storage, and no cloud dependency required to run Formsmith. Optional capabilities
(such as file uploads) light up via an optional storage profile or by pointing an S3-compatible bucket
at the same adapter.

## Architecture at a glance

Formsmith is a TypeScript monorepo. The core is deliberately portable — plain Postgres, a
framework-agnostic engine, and cloud-neutral adapters — so it self-hosts anywhere.

```
packages/
  engine     framework-agnostic form state machine · navigation · validation · piping
  blocks     block-type registry
  rules      logic engine (visibility · jump · calculation)
  ai         adaptive AI follow-up orchestration (bring-your-own model)
  renderer   the respondent + builder-preview view
  embed      zero-dependency embed SDK
  db · adapters · schemas · ui · sdk
apps/
  web        builder · dashboard · results · control-plane API
  api        public data-plane API
modules/
  ee         enterprise features (commercially licensed)
```

## Licensing

Formsmith is **open-core**. [`LICENSING.md`](LICENSING.md) is the authoritative map:

- **Core** (engine, renderer, apps, AI orchestration, …) — **AGPL-3.0-only**. Self-host it, or even
  offer it as a service; you simply cannot take the core closed.
- **Integration surface** (embed SDK, framework wrappers, API client) — **MIT**, so embedding a
  Formsmith form never raises copyleft questions for your own codebase.
- **Enterprise modules** (`modules/ee`) — commercially licensed.

And a public promise: the [Open-Core Covenant](OPEN-CORE-COVENANT.md) commits, in writing and in git
history, that **the core stays AGPL — forever.**

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Formsmith uses a Contributor
License Agreement ([CLA.md](CLA.md)); a bot will ask you to accept it on your first pull request. The
honest summary: you keep your copyright, and every contribution merged into an open package stays open
under that package's license, permanently.

## Trademark

"Formsmith" and the Formsmith logo are trademarks — see [TRADEMARK-POLICY.md](TRADEMARK-POLICY.md).
You may self-host, describe, teach, and build on Formsmith freely; public forks must be renamed.

## Links

- Website: [formsmith.app](https://formsmith.app)
- Issues & discussions: this repository
- Contact: gnana097@gmail.com

---

*Independent and bootstrapped — built for the teams the incumbents lock out.*
