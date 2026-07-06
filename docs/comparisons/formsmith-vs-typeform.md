<!--
Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

# Formsmith vs Typeform

Typeform defined the beautiful, one-question-at-a-time form, and it's a mature, polished
product. Formsmith exists for the teams Typeform's model doesn't serve: people who need
that same conversational experience **on infrastructure they control**, with an AI
interviewer that runs on **their own key**, and who'd rather not pay per response to a
cloud that holds their data.

This page is honest about both directions. If Typeform fits your team, it's a good product.

## At a glance

| | Formsmith | Typeform |
|---|---|---|
| **Self-host** | ✅ `docker compose up`, web + Postgres | ❌ SaaS only |
| **Where responses live** | Your database, your server | Typeform's cloud |
| **License** | ✅ Open source (AGPL-3.0 core; MIT integration surface) | ❌ Proprietary |
| **Conversational UX** | ✅ One-question-at-a-time, keyboard-first | ✅ The category-definer |
| **AI follow-up interviewer** | ✅ On **your** model + key, disclosed, static fallback | ✅ "Clarify with AI", runs in Typeform's cloud |
| **AI form generation** | ✅ On your key | ✅ |
| **Response limits** | None, it's your server | 10/month on free; paid tiers meter |
| **EU / self-hosted data residency** | ✅ Inherent, you choose where it runs | Enterprise plans only |
| **Price** | Free to self-host (you run it) | Subscription; scales with responses/seats |
| **Block types** | 17 in v0.1.0 (+ more on the [roadmap](../roadmap.md)) | Larger catalog today |
| **File upload** | 🔜 v1.1 (optional storage profile) | ✅ Today |
| **Payments block** | 🔭 Later | ✅ Today |
| **Integrations catalog** | Webhooks + REST/OpenAPI + CSV/JSON now; n8n/Slack next | ✅ Large marketplace |
| **Managed hosting / zero ops** | You run it (a hosted tier is planned) | ✅ Fully managed |

## What Typeform does better today

Being straight about it:

- **Breadth and maturity.** Years of polish, a large block/logic catalog, and a big
  integrations marketplace. Formsmith is at v0.1.0.
- **Zero operations.** Sign up and go, no container to run, no Postgres to back up.
- **Features Formsmith hasn't shipped yet**: file upload, payments, and the long tail of
  block types are on the [roadmap](../roadmap.md), not in this release.

If you want a managed product with the widest feature set today and you're comfortable with
your responses living in Typeform's cloud, Typeform is the safer pick right now.

## Where Formsmith is the better fit

- **You can't or won't send responses to a third-party cloud.** Privacy-bound and
  regulated teams, EU orgs, anyone with a data-residency requirement: Formsmith keeps every
  response on infrastructure you control.
- **You want the AI interviewer without the AI seeing someone else's cloud.** Typeform's
  Clarify AI is real, but answers flow through its servers into a third-party model.
  Formsmith's follow-up loop runs on **your** model and key, is **disclosed** to
  respondents, and **falls back to a static question** when the model is unavailable.
- **Response volume shouldn't be a paywall.** On your own server there is no monthly
  response cap.
- **You want to own and extend the stack.** Open source, a portable engine, an OpenAPI
  data plane, and a public promise that the [core stays open forever](../../OPEN-CORE-COVENANT.md).

---

**The three things Formsmith combines that Typeform can't without cannibalizing itself:**

1. **Self-host it: your forms, your data, your servers.**
2. **A genuinely beautiful conversational experience, open source.**
3. **An AI interviewer that runs on your own key**, disclosed to respondents, with a static
   fallback.

See the [roadmap](../roadmap.md) for what's next, or
[try self-hosting](../self-hosting.md), it's two containers.
