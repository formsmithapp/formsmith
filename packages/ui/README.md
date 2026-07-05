# @formsmithapp/ui

The Formsmith design foundation — **tokens and theme math, not components** (yet).

- **Canonical design tokens** (light + dark), exported as data and as CSS:
  `@formsmithapp/ui/tokens.css` scopes them on `:root` / `[data-theme="dark"]`, and
  `themeTokensCss(lightSelector, darkSelector)` re-scopes them for any consumer — the respondent
  runtime generates its `.fsr-root`-scoped copy from the same values at build time.
- **A Tailwind v4 preset** (`@formsmithapp/ui/tailwind.css`) mapping the tokens onto the utility
  vocabulary via `@theme inline`.
- **`deriveTheme(config)`** — hand-rolled OKLCH color math that turns a form's theme config
  (brand color, appearance, background, font pair) into flat CSS-variable maps for both light and
  dark grounds, with the on-brand text contrast floor (WCAG ≥ 4.5:1) enforced in code.
- **The font-pair registry** (`FONT_PAIRS`) with self-hosted, OFL-licensed variable fonts
  (latin subsets) vendored under `@formsmithapp/ui/fonts/*`. Font files are always served
  same-origin with the form — never from a shared font CDN, so respondents' browsers only ever
  talk to the instance hosting the form.

```ts
import { deriveTheme, resolveAppearance } from '@formsmithapp/ui'

const derived = deriveTheme(form.theme)
const ground = resolveAppearance(form.theme?.appearance ?? 'auto', systemPrefersDark)
mount(el, { form, themeVars: derived[ground] })
```

Pure data + math: no React, no DOM at runtime. The respondent runtime never depends on this
package at runtime — hosts derive, the runtime just applies variables.

Licensed under **AGPL-3.0-only**.
