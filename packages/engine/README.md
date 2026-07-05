# @formsmithapp/engine

Framework-agnostic core engine for Formsmith — the block-tree state machine behind every form:
navigation (including jump-to-target and jump-to-ending), visibility rules, calculated fields /
variables / scoring, validation orchestration, answer piping (HTML-escaped by default),
hidden-field / URL prefill, serialize/hydrate, and server-side re-evaluation of untrusted
submissions. Runs identically in the browser, Node, and edge runtimes — the test suite executes
in both real Chromium and Node to prove it.

The only runtime dependency is `@formsmithapp/rules`, which validates every stored rule AST
(bounded depth/size, operator allowlist, resolvable refs) before anything is evaluated.

## Usage

```ts
import { createEngine, evaluateSubmission, extractHiddenFields } from '@formsmithapp/engine'

// Client (respondent runtime)
const engine = createEngine(form, {
  mode: 'runtime',
  hiddenFields: extractHiddenFields(form, location.search),
})

engine.subscribe(() => render(engine.getState())) // works with useSyncExternalStore, Svelte, …
engine.setAnswer('first_name', 'Ada')
engine.next() // validates, applies jump logic, advances
engine.pipe('Hi {{first_name}}, you scored {{score}}!') // values escaped by default

// Server (trust boundary) — recomputes variables, re-derives the navigation path,
// and rejects tampered payloads (required-skip, rule-bypass, oversize, unknown refs,
// client-computed variables that don't match).
const result = evaluateSubmission(form, submission)
if (!result.ok) reject(result.issues)
```

The engine instance is also a minimal reactive store (`getState()` / `subscribe()`), which is the
universal bridge to React, Vue, Svelte, and Solid without framework code in this package.

Licensed under **AGPL-3.0-only**.
