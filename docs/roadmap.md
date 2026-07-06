<!--
Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

# Roadmap

This is an honest map of what Formsmith does today, what's coming next, and what's
deliberately not here yet. The cuts are intentional, we'd rather ship a small,
correct, self-hostable core and grow it in the open than ship a wide, shallow one.

Dates aren't promised; **order** is. Have a strong opinion on what should move up?
[Open an issue](https://github.com/formsmithapp/formsmith/issues) or start a
[discussion](https://github.com/formsmithapp/formsmith/discussions), this release is
quiet precisely so real usage decides the priorities.

---

## ✅ Shipped, v0.1.0 (the first public release)

The whole product runs on two containers (`web` + `postgres`), self-hosted with
`docker compose up`. No Redis, no object storage, no cloud dependency required.

**Building**
- Immersive, one-question-at-a-time respondent runtime and a keyboard-first builder
  (WCAG 2.1 AA is a release criterion, not an afterthought).
- **17 block types**: short/long text · multiple choice (single + multi) · dropdown ·
  yes/no · legal/consent · email · phone · website · number · date · opinion scale ·
  NPS · welcome · statement · thank-you (multiple endings) · **AI follow-up**.
- Conditional logic: visibility rules, jump/branching, calculated fields & scoring,
  answer piping, authored visually, compiled to a portable rule format.
- Theming: design tokens, perceptual (OKLCH) color derivation, a Design tab.

**The AI interviewer**
- Adaptive AI follow-up questions powered by **your own model and key** (Anthropic or
  any OpenAI-compatible endpoint), the conversation never leaves your infrastructure.
- **Disclosed** to respondents, with a **static fallback** so a form never breaks when a
  model is slow, rate-limited, or down.
- AI-assisted form generation from a prompt.
- No AI key? Every AI feature degrades cleanly; the form still works.

**Data & integrations**
- Server-side re-evaluation of every submission, client answers are never trusted.
- HMAC-signed webhooks with delivery history, a REST API with a generated OpenAPI spec,
  and full CSV / JSON export. Your data is never locked in.
- Bring-your-own SMTP for notifications; every integration is optional.

**Running it**
- Migrations run on boot; upgrades are `docker compose pull && docker compose up -d`.
- Sensible security defaults out of the box: rate limiting, submission honeypot,
  egress guard on webhook delivery, security headers.

## 🔜 Next, v1.1

The features that unlock the loudest use cases, plus the fast-follow blocks. The design
principle holds: anything that would force a heavier default stack ships **optional**.

**Headliners**
- **File upload**, via a `StorageAdapter`, with an **optional** MinIO/S3 compose profile.
  The default stays two containers; you opt into storage only if you need uploads. (This
  is why upload isn't in v0.1.0, see [below](#why-some-things-are-cut-on-purpose).)
- **Native n8n node**, Formsmith submissions as a first-class automation trigger.
- **Slack** notifications.

**Fast-follow**
- Picture choice · star rating · ranking blocks.
- Image covers and richer layouts.
- Partial responses + save & resume + drop-off analytics, shipped **together with
  consent tooling** (per-form opt-in, respondent disclosure, retention controls).
- An AI moderation pass for follow-up content.
- Reusable brand presets.

## 🔭 Later, coarse, and honestly so

Priorities here will be set by what real self-hosters actually ask for.

- **v1.2 direction**: matrix / address / group / signature / date-time blocks · quotas ·
  randomization · Google Sheets & Notion integrations.
- **Pro** (hosted or licensed add-ons): payments block · Zapier/Make · CRM & email-tool
  connectors · advanced analytics · scheduled + PDF export · password / scheduled forms ·
  custom fonts · multi-language + RTL · a native, self-hostable MCP server generated from
  the OpenAPI spec.
- **Enterprise** (commercially licensed modules): SSO/SAML · SCIM · RBAC · audit logs ·
  white-label · data-residency controls · retention / anonymization · field-level
  encryption · BYO-model routing.

---

## Why some things are cut on purpose

**Keeping the default install honest.** The promise is "the whole product is two
containers." File upload is the clearest example of a feature that quietly breaks that
promise: it wants object storage, presigned URLs, and scan hooks. Rather than bolt that
onto every install, it arrives as an **optional storage profile** you turn on only when
you need it. The default stays `web` + `postgres`.

**Small and correct beats wide and shallow.** Every block in v0.1.0 is completable
keyboard-only and with a screen reader, and every submission is re-validated server-side.
We'd rather earn the next block type than ship seventeen half-working ones.

**The AI stance is a feature, not a limitation.** The interviewer runs on your key, is
disclosed to respondents, and always has a static fallback. We won't add AI that phones a
cloud we don't control, that would defeat the reason Formsmith exists.

For how this stacks up against other tools, see
**[Formsmith vs Typeform](comparisons/formsmith-vs-typeform.md)** and
**[Formsmith vs HeyForm](comparisons/formsmith-vs-heyform.md)**.
