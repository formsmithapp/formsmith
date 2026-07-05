# @formsmithapp/schemas

Shared **transport schemas** (Zod): the API I/O DTOs and the storage-boundary shape guard for
form documents.

The rule this package lives by: it validates **shape at the boundary**, never semantics.
Whether a rule AST is valid, a ref resolves, or a block's properties match its type is answered
by the engine and the block registry — the same code that answers it everywhere else. So
`properties`, `expr`, and `theme` deliberately pass through as `unknown` here, and a
structurally-sound-but-semantically-broken document parses on purpose.

```ts
import { formDocumentSchema, submissionInput } from '@formsmithapp/schemas'

formDocumentSchema.parse(untrustedDoc) // plausible form document + size bounds
submissionInput.parse(body) // the submit envelope (answers/variables/hiddenFields)
```

Row-level schemas are derived from the database tables (drizzle-zod, in `@formsmithapp/db`);
the theme vocabulary is re-exported from its one owner, `@formsmithapp/ui`.

Licensed under **AGPL-3.0-only**.
