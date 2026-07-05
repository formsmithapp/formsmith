# @formsmithapp/blocks

The Formsmith block-type registry — the 17 v1 block types as typed data. Each
`BlockDefinition` declares its category, presentation metadata (display name, description, and an
icon *key* — actual icons live in the renderer), whether it collects an answer, default
properties, a **Zod property schema** (the single source of truth for the block's
builder-editable config, reused by the builder panel and API validation), and intrinsic answer
validation (consumed by the engine on both client and server).

Adding a block type is adding one registry entry — the engine and renderer stay generic.

```ts
import {
  v1BlockDefinitions,
  getBlockDefinition,
  validateBlockProperties,
} from '@formsmithapp/blocks'

validateBlockProperties('opinion_scale', { min: 0, max: 10 })
// → { ok: true, properties: { min: 0, max: 10 } }

getBlockDefinition('email')?.validate?.('ada@lovelace.dev', block) // → []
```

Data + Zod only: no React, no DOM, no Node-only APIs — isomorphic by construction, and the only
runtime dependency is `zod`.

Licensed under **AGPL-3.0-only**.
