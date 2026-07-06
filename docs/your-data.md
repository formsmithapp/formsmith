<!--
Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

# Your data

Formsmith exists so that beautiful conversational forms don't require handing your
respondents' answers to someone else's cloud. When you self-host, **your data never leaves
infrastructure you control**, and there's no asterisk on that.

## When you self-host, nothing phones home

- **No telemetry. No analytics. No "anonymous usage stats." None.** A self-hosted Formsmith
  instance makes no background calls to us or anyone else. There is nothing to opt out of
  because there is nothing to send.
- Responses live in **your Postgres**, on **your server**. We never see them, because there
  is no "we" in the data path.
- The only outbound network calls Formsmith makes are the ones *you* configure: delivering
  your webhooks, sending mail through *your* SMTP, and calling *your* AI provider.

## The AI interviewer runs on your key

The adaptive follow-up feature is the one place a form talks to a model, and it does so on
**your** terms:

- It uses **your own model and API key** (Anthropic, or any OpenAI-compatible endpoint).
  Answers go from your server to the provider *you* chose, never through us.
- **Your respondents' answers are never used to train anything.** Formsmith doesn't collect
  them; whether the model provider does is governed by *your* agreement with that provider,
  which you can pick accordingly.
- The AI is **disclosed to respondents**, no one is secretly talking to a model.
- If the model is slow, rate-limited, or down, the form **falls back to a static question**
  and keeps working. AI never becomes a single point of failure for your data collection.
- No AI key configured? The feature degrades cleanly and the form still works.

## What's stored, and staying portable

- Submissions are **re-evaluated server-side**, the stored answer is what your form's rules
  actually produce, never a value the client claimed. Trust is computed, not assumed.
- You can **export everything** as CSV or JSON through the API at any time, and **delete**
  anything. Your data is never held hostage by a proprietary format or an export paywall.

## Secure by construction

Trust isn't a badge here; it's in how the thing is built. Out of the box, a Formsmith
instance ships with:

- **Server-side re-evaluation** of every submission (tampered payloads are rejected).
- **HMAC-signed webhooks** so receivers can verify authenticity, with an **egress guard**
  that blocks webhook delivery from being pointed at internal/loopback addresses (SSRF
  protection).
- A **submission honeypot** and **configurable rate limits** on the public submit endpoint.
- **Security headers** by default, and database **migrations applied automatically on boot**
  so an upgrade can't leave you on a half-migrated schema.

Found a vulnerability? Please report it privately, see [`SECURITY.md`](../SECURITY.md).

## Compliance posture (self-hosted)

Because you run Formsmith, **you are the data controller.** Self-host it in whatever region
and under whatever policies your obligations require, Formsmith doesn't move your data
somewhere you didn't choose. We make **no certification claims** (SOC 2, ISO, etc.) for the
open-source project itself; certifications describe a hosting operation, and when you
self-host, that operation is *yours*.

If and when the managed **hosted tier** launches, it will publish its own data-processing
terms and DPA covering that specific service. This page describes the self-hosted product,
which is the whole product today.

---

See also: [Why open source](why-open-source.md) · [Self-hosting guide](self-hosting.md) ·
[Security policy](../SECURITY.md)
