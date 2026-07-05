# @formsmithapp/renderer

The Formsmith respondent runtime — a thin view over `@formsmithapp/engine`. The immersive
one-question-at-a-time stage: serif question hero with vignette, spring transitions (CSS +
Web Animations API only), letter-key choices, Enter-to-advance, touch/swipe and scroll
navigation, gentle validation states, an answerable-only progress track, light/dark themes, and
the "AI-generated question" disclosure (on by default). All navigation, visibility, validation,
and piping decisions come from the engine — this package holds no business logic.

```ts
import { mount } from '@formsmithapp/renderer'
import '@formsmithapp/renderer/styles.css'
import '@formsmithapp/renderer/fonts.css'

const { engine, unmount } = mount(document.getElementById('root'), {
  form,                       // the published form definition
  submit: (payload) => fetch(…), // delivered optimistically with retry-on-reconnect
  theme: 'auto',
})
```

- Components are authored against the React API; the respondent bundle aliases
  `react → preact/compat` (~34 KB gz total including the engine — budget ≤ 45 KB, CI-enforced).
  The builder consumes the same components with real React.
- WCAG 2.1 AA: real form controls, full keyboard operability, focus management between
  questions, `prefers-reduced-motion` honored. Lighthouse accessibility 100.
- Webfonts (Fraunces + Instrument Sans, OFL, latin subsets) ship in `dist/fonts` with their
  licenses; `fonts.css` wires them up.

Licensed under **AGPL-3.0-only**.
