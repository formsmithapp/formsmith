# @formsmithapp/db

The Formsmith data layer — Drizzle schema, committed SQL migrations, and **workspace-scoped
repositories** over Postgres.

- `Workspace → Forms → Responses`, scoped from day 1: every repository method takes a
  `workspaceId` and every query is row-scoped to it. Tenant isolation lives here, not in
  callers remembering to filter.
- `form_versions` is **insert-only** — publishing writes an immutable snapshot; responses pin
  the version they were collected under.
- The package is deliberately dumb: persistence only. Publish validation (engine + block
  schemas) and submission re-evaluation (`evaluateSubmission`) belong to the API service layer.
- Better Auth's tables live in `src/schema/auth.ts` and are owned by the library.
- Tests run on **PGlite** (in-process Postgres) applying the same committed migrations
  production uses — no daemon needed for `pnpm test`; use `compose.dev.yml` at the repo root
  for a real dev Postgres.

```ts
import { createDb, formsRepository } from '@formsmithapp/db'

const db = createDb(process.env.DATABASE_URL)
const forms = formsRepository(db)
await forms.publish(workspaceId, formId) // scoped; bumps version + snapshots, one transaction
```

Licensed under **AGPL-3.0-only**.
