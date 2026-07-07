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

## [0.1.6], 2026-07-08

### Added

- Vercel AI Gateway as a provider option (`AI_GATEWAY_API_KEY`): one key reaches many models. Set
  the model in `FORMSMITH_AI_MODEL` as a `creator/model` slug (for example
  `google/gemini-2.5-flash-lite`, `openai/gpt-4o-mini`, or `anthropic/claude-haiku-4-5`). It takes
  precedence when set and sits alongside the existing direct Anthropic key and OpenAI-compatible
  endpoint options. Unset changes nothing.

## [0.1.5], 2026-07-07

Optional metering, signup hardening, and abuse controls. Everything here is off by default and
env-configured, so a self-hosted instance behaves exactly as before unless you opt in. Upgrading
applies two new database migrations automatically on boot (back up first, as always).

### Added

- AI credits and usage quotas, all env-configured and unlimited by default:
  - AI credits per workspace (`FORMSMITH_AI_CREDITS_DEFAULT`), metered against AI follow-ups and
    form generation. When credits run out, AI follow-ups degrade to the static fallback question
    and generation returns a friendly message. No form ever breaks.
  - Caps on forms per workspace, responses per form per month, webhooks per form, and API keys per
    workspace (`FORMSMITH_LIMIT_*`). Over a cap, the action returns a clear error; a form at its
    monthly response cap tells respondents it is no longer accepting responses.
- Optional email verification (`FORMSMITH_REQUIRE_EMAIL_VERIFICATION`, off by default). When on,
  publishing a form and using AI require a verified email, while building and previewing stay open.
  It uses your SMTP; if mail is not configured it is not enforced and logs a warning, so you can
  never be locked out of your own instance.
- Optional Cloudflare Turnstile on sign-up and sign-in (`TURNSTILE_SECRET_KEY` +
  `TURNSTILE_SITE_KEY`, both required, off by default).
- Option to serve public respondent forms on a separate host (`FORMSMITH_FORMS_HOST`); unset keeps
  everything on one host.
- Abuse kill switch: suspend a single form or a whole workspace to stop it serving and accepting
  responses immediately (flip via SQL; no admin UI yet). Plus an optional "Report abuse" link on
  public forms (`FORMSMITH_ABUSE_CONTACT`).

### Changed

- Cross-tenant hardening: requesting another workspace's response list now returns 404 instead of
  an empty list, so every responses endpoint behaves consistently. A focused test suite proves each
  authenticated endpoint rejects cross-workspace access.

### Fixed

- The workspace header no longer shifts sideways when a page grows tall enough to add a scrollbar
  (the scrollbar gutter is now reserved).

## [0.1.4], 2026-07-07

Results and the responses API now scale to forms with tens of thousands of submissions,
instead of loading every response into the browser at once.

### Added

- Response summary endpoint (`GET /forms/{id}/responses/summary`): the total response count
  plus per-question aggregates (choice distributions, yes/no and NPS breakdowns, scale
  averages), computed on the server rather than in the browser.
- Streaming CSV and JSON export: the export endpoint walks the table and streams the file, so
  a download succeeds at any response volume instead of buffering everything first.
- Keyset pagination on the response list. `GET /forms/{id}/responses` accepts `limit` (default
  50, max 200) and an opaque `cursor`, and the Results tab now loads responses a page at a time
  with a "Load more" control.

### Changed

- **Breaking (REST API):** `GET /forms/{id}/responses` now returns
  `{ "responses": [...], "nextCursor": <string|null> }` instead of a bare
  `{ "responses": [...] }`, and takes the new `limit` and `cursor` query parameters. The
  generated OpenAPI spec reflects the new shape. This change was made now, while there are no
  known API consumers.

## [0.1.3], 2026-07-07

### Fixed

- On a form's ending screen that has a call-to-action button, completing the form now moves keyboard
  focus to that button, so pressing Enter follows it. Previously focus landed on the thank-you
  heading and the button was reachable only by Tab.

## [0.1.2], 2026-07-07

An accessibility pass with an automated axe regression net, plus small builder polish.

### Added

- Builder field-hints: inline helper text on the settings people ask about (the ending block's
  Redirect URL vs Button URL, the reference key, number step, AI max follow-ups).
- A "Description" field in the builder panel, editable alongside the existing canvas editor.
- Accessibility test harness: axe scans at the component layer (every control type, plus error and
  ending states) and full-page (the builder and a published form), in both light and dark themes,
  gated on zero serious or critical violations, and wired into CI.

### Changed

- Accessibility (targeting WCAG 2.1 AA): keyboard focus is visible on every control; focus moves
  sensibly on completion, insert, and delete instead of falling to the page; single-select and
  scale questions no longer auto-advance while arrow-browsing (they advance on click or Enter);
  contact fields advertise their input purpose for autofill; the block palette is a proper
  combobox and the preview is a modal dialog; and landmarks, a skip link, forced-colors support,
  and screen-reader labels were added throughout both surfaces.
- Darkened the tertiary muted-text token in both themes so small captions meet 4.5:1 contrast.

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

[Unreleased]: https://github.com/formsmithapp/formsmith/compare/v0.1.6...HEAD
[0.1.6]: https://github.com/formsmithapp/formsmith/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/formsmithapp/formsmith/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/formsmithapp/formsmith/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/formsmithapp/formsmith/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/formsmithapp/formsmith/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/formsmithapp/formsmith/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/formsmithapp/formsmith/releases/tag/v0.1.0
