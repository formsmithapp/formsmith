# @formsmithapp/rules

JSONLogic rule layer for Formsmith. Stored rules are **untrusted input**: before anything is
evaluated, the AST is validated — bounded depth and size, an operator allowlist, and a check that
every referenced `var` resolves to a known block ref or variable. Rules that fail validation are
rejected, never executed.

Evaluation is backed by [`json-logic-engine`](https://www.npmjs.com/package/json-logic-engine)
(sync engine). The same compiled rule runs client-side (UX) and server-side (trust), in the
browser, Node, and edge runtimes identically.

```ts
import { compileRule, validateRuleAst } from '@formsmithapp/rules'

const check = validateRuleAst(expr, { knownRefs: ['email', 'score'] })
if (!check.ok) throw new Error(check.issues.join('; '))

const rule = compileRule(expr, { knownRefs: ['email', 'score'] })
rule({ email: 'a@b.co', score: 10 }) // → boolean/number/string per the rule
```

Licensed under **AGPL-3.0-only**.
