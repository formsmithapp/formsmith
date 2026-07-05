// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

// Post-build assets: emit the canonical token stylesheet + Tailwind preset,
// and vendor the font-pair woff2 files (latin-subset variable fonts from the
// OFL Fontsource packages, licenses included) with per-pair @font-face CSS.
// Everything here is served same-origin by consumers — no font CDN, ever.

import { copyFileSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FONT_PAIRS, fontFaceCss, themeTokensCss } from '../dist/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = join(here, '..')
const dist = join(pkg, 'dist')
const require = createRequire(import.meta.url)

const header = `/* Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors */
/* SPDX-License-Identifier: AGPL-3.0-only */
/* Generated from @formsmithapp/ui tokens — do not edit. */

`

// `[data-theme="light"]` is declared explicitly so a subtree (the builder
// canvas showing a light form inside dark chrome) can re-token itself.
writeFileSync(
  join(dist, 'tokens.css'),
  header + themeTokensCss(':root, [data-theme="light"]', '[data-theme="dark"]'),
)
copyFileSync(join(pkg, 'src/styles/tailwind.css'), join(dist, 'tailwind.css'))

mkdirSync(join(dist, 'fonts', 'files'), { recursive: true })
let indexCss = header
for (const pair of FONT_PAIRS) {
  for (const face of pair.faces) {
    const base = dirname(require.resolve(`${face.module}/package.json`))
    copyFileSync(join(base, 'files', face.file), join(dist, 'fonts', 'files', face.file))
    copyFileSync(
      join(base, 'LICENSE'),
      join(dist, 'fonts', 'files', `OFL-${face.family.replaceAll(' ', '')}.txt`),
    )
    const kb = (statSync(join(dist, 'fonts', 'files', face.file)).size / 1024).toFixed(1)
    console.log(`font: ${face.file} (${kb} KB)`)
  }
  writeFileSync(join(dist, 'fonts', `${pair.id}.css`), header + fontFaceCss(pair, './files'))
  indexCss += fontFaceCss(pair, './files')
}
writeFileSync(join(dist, 'fonts', 'index.css'), indexCss)
console.log('assets: dist/tokens.css, dist/tailwind.css, dist/fonts/* written')
