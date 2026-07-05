// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The font-pair registry. A form's `theme.fontPair` keys into this list;
 * hosts declare @font-face for the faces of the configured pair only and
 * browsers fetch a file only when its family is actually used — so shipping
 * several pairs costs nothing until one is selected.
 *
 * HARD RULE: font files are always served SAME-ORIGIN with the form
 * (self-hosted instances ship them in their own package; the hosted service
 * serves them from its own edge). Never point respondents at a shared
 * third-party font CDN — that leaks every respondent's IP to someone else's
 * server.
 */

export interface FontFaceSpec {
  /** CSS font-family the face registers. */
  family: string
  /** woff2 filename as vendored under `fonts/files/`. */
  file: string
  /** Variable-font weight range, e.g. `"100 900"`. */
  weight: string
  /** Source package the build vendors the file from (OFL-licensed). */
  module: string
}

export interface FontPair {
  id: string
  label: string
  /** Full serif stack (questions, display type). */
  serif: string
  /** Full sans stack (answers, UI). */
  sans: string
  /** Faces to declare. Empty ⇒ nothing to download (system stacks). */
  faces: FontFaceSpec[]
}

export const FONT_PAIRS: readonly FontPair[] = [
  {
    id: 'editorial',
    label: 'Editorial',
    serif:
      '"Fraunces Variable", Fraunces, "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
    sans: '"Instrument Sans Variable", "Instrument Sans", "Avenir Next", "Segoe UI Variable Display", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", sans-serif',
    faces: [
      {
        family: 'Fraunces Variable',
        file: 'fraunces-latin-opsz-normal.woff2',
        weight: '100 900',
        module: '@fontsource-variable/fraunces',
      },
      {
        family: 'Instrument Sans Variable',
        file: 'instrument-sans-latin-wght-normal.woff2',
        weight: '400 700',
        module: '@fontsource-variable/instrument-sans',
      },
    ],
  },
  {
    id: 'literary',
    label: 'Literary',
    serif: '"Newsreader Variable", Newsreader, "Iowan Old Style", Palatino, Georgia, serif',
    sans: '"Schibsted Grotesk Variable", "Schibsted Grotesk", "Avenir Next", "Segoe UI", system-ui, -apple-system, sans-serif',
    faces: [
      {
        family: 'Newsreader Variable',
        file: 'newsreader-latin-opsz-normal.woff2',
        weight: '200 800',
        module: '@fontsource-variable/newsreader',
      },
      {
        family: 'Schibsted Grotesk Variable',
        file: 'schibsted-grotesk-latin-wght-normal.woff2',
        weight: '400 900',
        module: '@fontsource-variable/schibsted-grotesk',
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    serif: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
    sans: 'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    faces: [],
  },
]

export const DEFAULT_FONT_PAIR_ID = 'editorial'

/** Registry lookup with a safe fallback to the default pair. */
export function getFontPair(id: string | undefined): FontPair {
  const pair = FONT_PAIRS.find((entry) => entry.id === id)
  const fallback = FONT_PAIRS.find((entry) => entry.id === DEFAULT_FONT_PAIR_ID)
  if (fallback === undefined) throw new Error('font registry lost its default pair')
  return pair ?? fallback
}

/** Latin subset — matches the vendored woff2 files. */
export const LATIN_UNICODE_RANGE =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'

/**
 * @font-face declarations for one pair. `filesBase` is a same-origin path or
 * URL prefix the host serves the vendored files from.
 */
export function fontFaceCss(pair: FontPair, filesBase = './files'): string {
  return pair.faces
    .map(
      (face) => `@font-face {
  font-family: "${face.family}";
  font-style: normal;
  font-display: swap;
  font-weight: ${face.weight};
  src: url(${filesBase}/${face.file}) format("woff2-variations");
  unicode-range: ${LATIN_UNICODE_RANGE};
}
`,
    )
    .join('')
}
