# @formsmithapp/adapters

Infrastructure adapters behind portable interfaces — the reason Formsmith self-hosts as
**two containers and nothing else**.

- **`QueueAdapter`** → `PgBossQueue` (pg-boss: the job queue lives *inside* your existing
  Postgres — retries with backoff, cron schedules, no Redis) and `InMemoryQueue` (test double).
- **`MailAdapter`** → `SmtpMail` (BYO SMTP via `SMTP_URL` + `EMAIL_FROM`, nodemailer) and
  `NoopMail` (SMTP unset → notifications degrade gracefully; forms never break).

Storage, cache, and model-provider adapters join this package as their features land
(file uploads, edge caching, the AI loop).

Licensed under **AGPL-3.0-only**.
