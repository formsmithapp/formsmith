<!--
Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

# Changelog

All notable changes to Formsmith are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Formsmith aims to follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

See the [roadmap](docs/roadmap.md) for what's planned. v1.1's headline additions are file
upload (via an optional storage profile), a native n8n node, and Slack notifications.

## [0.1.1], 2026-07-06

A round of UI/UX polish and accessibility fixes on top of the first release.

### Added

- Optional call-to-action button on the thank-you screen (author-set label and URL), so an
  ending can point respondents somewhere instead of dead-ending.
- Branded 404 and error pages, plus a proper touch icon, web app manifest, and browser
  theme color.
- Per-page browser tab titles across sign-in, sign-up, the dashboard, and the builder tabs.

### Changed

- The builder canvas no longer shows a phantom continue button on the thank-you screen; it
  now matches the button-free runtime ending.

### Fixed

- Shared-link and per-form preview images now resolve to the instance's public URL instead
  of localhost (missing `metadataBase`).
- Replaced the stock framework favicon with the Formsmith brand mark.
- Failed submissions now stop retrying after a bounded number of attempts and show a clear
  failure with a manual retry, instead of claiming to reconnect forever and risking lost
  data. The ending fallback reflects real delivery status too.
- Publish button text now uses dark ink on the amber accent for a readable contrast ratio.
- Required questions now expose `aria-required` on their controls, so screen-reader users
  learn a field is required before submitting.

## [0.1.0], 2026-07-06

The first public release. The whole product runs on two containers
(`docker compose up` → `web` + `postgres`); no Redis, no object storage, no cloud dependency.

### Added

**Building forms**
- Immersive, one-question-at-a-time respondent runtime and a keyboard-first builder
  (accessibility is a release criterion, every block is completable keyboard-only and with
  a screen reader).
- 17 block types: short/long text, multiple choice (single + multi), dropdown, yes/no,
  legal/consent, email, phone, website, number, date, opinion scale, NPS, welcome,
  statement, thank-you (with multiple endings), and the AI follow-up block.
- Conditional logic authored visually: visibility rules, jump/branching, calculated fields
  and scoring, and answer piping, compiled to a portable rule format that runs identically
  in the browser and on the server.
- Theming: design tokens, perceptual (OKLCH) color derivation, and a Design tab.

**The AI interviewer**
- Adaptive AI follow-up questions powered by your own model and key (Anthropic or any
  OpenAI-compatible endpoint), disclosed to respondents, with signed exchanges verified
  server-side.
- A static fallback question so a form never breaks when a model is slow, rate-limited, or
  down; every AI feature degrades cleanly when no key is configured.
- AI-assisted form generation from a prompt.

**Data, API & integrations**
- Server-side re-evaluation of every submission, client answers are never trusted.
- HMAC-signed webhooks with delivery history, a REST API with a generated OpenAPI spec, API
  keys with usage tracking, and full CSV / JSON export.
- Bring-your-own SMTP for response notifications.
- A results dashboard, form sharing, and a starter template library.

**Self-hosting & security**
- Official multi-arch container image; `docker compose up` with database migrations applied
  on boot; upgrades are `docker compose pull && docker compose up -d`.
- Security defaults: rate limiting, a submission honeypot, an SSRF egress guard on webhook
  delivery, and security headers.
- An in-memory cache layer (a Redis-shaped adapter) and a compiled-engine memo that keep the
  submit path fast under load.
- **No telemetry or analytics of any kind**, a self-hosted instance never phones home.

[Unreleased]: https://github.com/formsmithapp/formsmith/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/formsmithapp/formsmith/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/formsmithapp/formsmith/releases/tag/v0.1.0
