# Self-hosting Formsmith

The whole product is **two containers: the app and Postgres**. No Redis, no object storage,
no cloud dependency. A fresh VPS should take you from zero to a published form in under ten
minutes.

## Prerequisites

- A machine with [Docker](https://docs.docker.com/engine/install/) and the compose plugin
  (any small VPS or homelab box works; 1 vCPU / 1 GB is enough to start).
- Optional but recommended for real use: a domain pointed at the machine, and any reverse
  proxy for TLS (a [Caddy](https://caddyserver.com) example is below).

## Quickstart

```bash
git clone https://github.com/formsmithapp/formsmith
cd formsmith
cp .env.example .env
# REQUIRED — put the output in .env as BETTER_AUTH_SECRET:
openssl rand -base64 32
docker compose up -d
```

Open `http://localhost:3000`, create your account, and publish your first form. Database
migrations run automatically on boot — there is no separate setup step.

> Building from source instead of the published image? In `compose.yml`, comment the
> `image:` line and uncomment `build: .` — everything else is identical.

## Configuration

Everything is environment-driven via `.env` (see `.env.example` for the full annotated
list). Only one value is required; every optional feature **degrades gracefully — forms
never break** because a dependency is missing.

| Variable | Required | What it does |
|---|---|---|
| `BETTER_AUTH_SECRET` | **yes** | Session/signing secret — `openssl rand -base64 32` |
| `FORMSMITH_URL` | for real deployments | The public URL (e.g. `https://forms.example.com`) |
| `FORMSMITH_PORT` | no | Host port for the app (default `3000`) |
| `POSTGRES_PASSWORD` | recommended | Password for the bundled Postgres |
| `DATABASE_URL` | no | Use an external Postgres instead of the bundled one |
| `ANTHROPIC_API_KEY` *or* `OPENAI_COMPAT_*` | no | Bring your own LLM key — enables the AI interviewer and AI form generation. Unset = AI off, static fallback questions only |
| `FORMSMITH_AI_FALLBACK_*` | no | Optional second model as a hedge: it fires if the primary hasn't answered within `FORMSMITH_AI_HEDGE_MS` (default 3000); first success wins |
| `SMTP_URL` + `EMAIL_FROM` | no | Owner email notifications on new responses |
| `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` | no | Social login buttons appear only when set |
| `FORMSMITH_HIDE_BADGE` | no | `true` hides the "Powered by Formsmith" badge on published forms |
| `FORMSMITH_DISABLE_SIGNUP` | no | `true` closes registration once you have your account |
| `WEBHOOK_ALLOW_PRIVATE` | no | `true` lets webhooks deliver to private/loopback addresses (e.g. n8n on the same box). Keep it off on internet-facing instances |
| `FORMSMITH_SUBMIT_RATE` | no | Submissions per IP per form per minute (default 60). Raise it when many respondents share one network (classrooms, offices) |
| `FORMSMITH_CACHE_MAX_ITEMS` | no | In-memory cache size for published forms and rate-limit windows (default 500) |

## TLS and a domain (reverse proxy)

The container speaks plain HTTP; put any reverse proxy in front for TLS. With Caddy this is
the entire config (`Caddyfile`):

```
forms.example.com {
    reverse_proxy localhost:3000
}
```

Then set `FORMSMITH_URL=https://forms.example.com` in `.env` and restart
(`docker compose up -d`). nginx, Traefik, or your cloud's load balancer work just as well —
the app only needs `X-Forwarded-For` passed through (every proxy does this by default).

## Health and monitoring

`GET /api/health` returns `{"status":"ok","version":"…"}` and checks the database — the
image's Docker `HEALTHCHECK` uses it, and it's the endpoint to point uptime monitors at.

## Upgrading

Migrations run on boot, so upgrading is one step:

```bash
docker compose pull && docker compose up -d
```

Pin a specific version by changing the image tag in `compose.yml`
(e.g. `ghcr.io/formsmithapp/formsmith:v1.0.0` instead of `latest`).

## Backup and restore

All state lives in Postgres. Back up:

```bash
docker compose exec postgres pg_dump -U formsmith formsmith > formsmith-$(date +%F).sql
```

Restore onto a fresh instance:

```bash
docker compose up -d postgres
docker compose exec -T postgres psql -U formsmith formsmith < formsmith-2026-07-06.sql
docker compose up -d
```

Run backups on a schedule (cron + the one-liner above is fine) and test a restore once —
before you need it.

## Security defaults worth knowing

- Sign-in, sign-up, submissions, and the AI endpoints are all rate-limited out of the box.
- Published forms include an invisible honeypot field; bot submissions are silently discarded.
- Webhook deliveries refuse private/loopback targets unless you opt in
  (`WEBHOOK_ALLOW_PRIVATE=true`) — this protects your internal network from
  server-side request forgery.
- Response submissions are re-evaluated server-side against the published snapshot;
  tampered payloads are rejected regardless of what the client claims.
- Set `FORMSMITH_DISABLE_SIGNUP=true` after creating your account if the instance is
  public-facing and only you should own forms.

## FAQ

**Do I need Redis or an object store?** No. The queue (webhook delivery, notifications)
runs inside Postgres. File uploads will arrive later behind an optional storage profile.

**Can respondents use forms if my LLM key is missing/broken/out of credit?** Yes — AI
follow-up blocks fall back to their required static question. Respondents never see an
error.

**Where is my data?** In the `pgdata` Docker volume, and nowhere else. Export any form's
responses as CSV/JSON from the Results tab or the REST API.
