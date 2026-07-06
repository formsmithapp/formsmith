<!--
Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

# Formsmith vs HeyForm

HeyForm is the closest thing to Formsmith that already exists: open source (AGPL),
self-hostable, and genuinely conversational. It's a solid project with a real community,
and if it fits your needs it's a fair choice. So this page answers the honest question
directly — **why Formsmith and not HeyForm?**

Two reasons: Formsmith is **design-led**, and its AI is a **runtime interviewer**, not a
build-time helper.

## At a glance

| | Formsmith | HeyForm |
|---|---|---|
| **Open source + self-host** | ✅ AGPL-3.0 core | ✅ AGPL |
| **Database** | Postgres | MongoDB |
| **Conversational UX** | ✅ Design-led, keyboard-first, WCAG 2.1 AA target | ✅ Conversational (less design-led) |
| **AI: adaptive follow-ups at response time** | ✅ The interviewer asks follow-ups *as people answer* | ❌ AI is creation-time only |
| **AI runs on your own model + key** | ✅ Anthropic or any OpenAI-compatible endpoint | Creation-time assistance |
| **AI disclosure + static fallback** | ✅ Disclosed to respondents; never breaks when a model is down | — |
| **Server-side re-evaluation of submissions** | ✅ Client answers never trusted | — |
| **Data plane** | REST + generated OpenAPI, HMAC-signed webhooks, CSV/JSON export | Webhooks + integrations |
| **License split** | AGPL core + **MIT** integration surface *(planned — keeps embedding copyleft-clean)* | AGPL |
| **Open-core promise** | ✅ Written [covenant](../../OPEN-CORE-COVENANT.md): core stays open forever | — |
| **Maturity / block breadth today** | v0.1.0 — newer, fewer blocks | More established, broader today |
| **Hosted free tier** | Planned | Paid hosted entry (~$15/mo) |

## What HeyForm does better today

- **Maturity.** It's been shipping longer — more block types, more integrations, a larger
  existing community. Formsmith is at v0.1.0.
- **Established hosted option.** If you want managed hosting today, HeyForm has one.

If you want the most mature self-hostable conversational form builder *right now* and don't
need an adaptive AI interviewer, HeyForm is a reasonable pick.

## Where Formsmith is the better fit

- **You want forms that actually interview.** This is the core difference. HeyForm's AI
  helps you *build* a form; Formsmith's AI helps you *run* one — it reads each answer and
  asks an adaptive follow-up in the moment, on your own model and key, disclosed to the
  respondent, with a static fallback when the model is unavailable.
- **Design quality is a requirement, not a nice-to-have.** Formsmith treats the respondent
  experience and accessibility (WCAG 2.1 AA) as release criteria.
- **You're standardizing on Postgres.** Formsmith runs on the database most teams already
  operate and back up — no MongoDB to introduce.
- **You want trust built into the data path.** Every submission is re-evaluated
  server-side, the API ships a generated OpenAPI spec, and webhooks are HMAC-signed.
- **You care about the licensing promise.** The planned MIT integration surface will keep
  embedding copyleft-clean, and the written [Open-Core Covenant](../../OPEN-CORE-COVENANT.md)
  commits the core to staying open — permanently.

---

**The three things Formsmith combines:**

1. **Self-host it — your forms, your data, your servers.**
2. **A genuinely beautiful conversational experience, open source.**
3. **An AI interviewer that runs on your own key**, disclosed to respondents, with a static
   fallback — the adaptive response-time loop HeyForm doesn't have.

See the [roadmap](../roadmap.md) for what's next, or
[try self-hosting](../self-hosting.md) — it's two containers.
