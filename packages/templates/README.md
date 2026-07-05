# @formsmithapp/templates

The Formsmith starter templates — seed `FormDefinition` documents as **data**: blocks, working
logic (visibility, jumps, scoring), and a theme per template. Six ship in v1, from a
consent-first patient intake (the featured one) to a scored quiz.

```ts
import { TEMPLATES, getTemplate, instantiateTemplate } from '@formsmithapp/templates'

const form = instantiateTemplate(getTemplate('scored-quiz')!)
// → a fresh FormDefinition: new form/block/rule ids, all internal pointers remapped
```

Templates are never used directly — `instantiateTemplate` re-ids everything so two forms created
from the same template share nothing. Logic uses the canonical rule shapes the builder edits
natively, and every template is tested to pass the same validation gate publishing uses.

Pure data + one function: no React, no DOM, no Node-only APIs. Consumers: the builder's
template picker today; self-host seed content and any gallery surface tomorrow.

Licensed under **AGPL-3.0-only**.
