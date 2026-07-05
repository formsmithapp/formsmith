// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

// Post-build assets: generate the .fsr-scoped token block from the canonical
// @formsmithapp/ui values (build-time devDependency ONLY — the runtime never
// depends on ui), concat the stylesheet, vendor the self-hosted webfonts
// (latin-subset variable woff2 from the OFL Fontsource packages, licenses
// included), and emit the @font-face layer.

import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { themeTokensCss } from '@formsmithapp/ui'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = join(here, '..')
const dist = join(pkg, 'dist')
const require = createRequire(import.meta.url)

// styles.css = tokens (generated from ui) + runtime (verbatim)
const tokensCss = `/* Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors */
/* SPDX-License-Identifier: AGPL-3.0-only */
/* Generated from @formsmithapp/ui tokens — do not edit. */

${themeTokensCss('.fsr-root', '.fsr-root[data-theme="dark"]')}`
const css = `${tokensCss}\n${readFileSync(join(pkg, 'src/styles/runtime.css'), 'utf8')}`
writeFileSync(join(dist, 'styles.css'), css)

// fonts
mkdirSync(join(dist, 'fonts'), { recursive: true })
const fonts = [
  {
    module: '@fontsource-variable/fraunces',
    file: 'fraunces-latin-opsz-normal.woff2', // opsz+wght variable, latin subset
    family: 'Fraunces Variable',
    weight: '100 900',
  },
  {
    module: '@fontsource-variable/instrument-sans',
    file: 'instrument-sans-latin-wght-normal.woff2', // wght variable, latin subset
    family: 'Instrument Sans Variable',
    weight: '400 700',
  },
]

let fontFaces = ''
for (const font of fonts) {
  const base = dirname(require.resolve(`${font.module}/package.json`))
  copyFileSync(join(base, 'files', font.file), join(dist, 'fonts', font.file))
  copyFileSync(
    join(base, 'LICENSE'),
    join(dist, 'fonts', `OFL-${font.family.replaceAll(' ', '')}.txt`),
  )
  const kb = (statSync(join(dist, 'fonts', font.file)).size / 1024).toFixed(1)
  console.log(`font: ${font.file} (${kb} KB)`)
  fontFaces += `@font-face {
  font-family: "${font.family}";
  font-style: normal;
  font-display: swap;
  font-weight: ${font.weight};
  src: url(./fonts/${font.file}) format("woff2-variations");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC,
    U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215,
    U+FEFF, U+FFFD;
}
`
}
writeFileSync(join(dist, 'fonts.css'), fontFaces)
console.log('assets: dist/styles.css, dist/fonts.css written')
