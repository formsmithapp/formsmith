// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The canonical design tokens — the single source of truth every surface
 * derives its CSS from. Light is the base; dark is a re-derived retune (not
 * an inversion) and overrides only the keys it lists. Names are semantic and
 * prefix-free; consumers scope them (`:root` in the app, `.fsr-root` in the
 * respondent runtime) via {@link themeTokensCss}.
 */

export const lightTokens = {
  /* brand, accent, semantic */
  brand: '#1e5e51',
  'brand-strong': '#164a40',
  'brand-soft': '#e4eee9',
  'brand-ring': '#2e7a6b',
  accent: '#c1841f',
  'accent-strong': '#a66e14',
  'accent-soft': '#f6ead2',
  success: '#2f8f63',
  warn: '#b4671f',
  error: '#c0463b',

  /* warm, faintly green neutrals */
  ink: '#17211d',
  paper: '#edede4',
  canvas: '#f4f3ec',
  surface: '#fafaf5',
  'surface-2': '#ffffff',
  'surface-hover': '#f1f0e8',
  border: '#deddd1',
  'border-soft': '#e8e7dd',
  text: '#17211d',
  'text-2': '#4e564e',
  // Darkened from #838b80 to meet WCAG 1.4.3 (4.5:1) as small muted text: the
  // old value was 3.4:1 on the surface and 3.0:1 on brand-soft. This clears
  // both (5.3:1 / 4.7:1) while staying the lightest tier of the text scale.
  'text-3': '#646a61',
  'on-brand': '#f4f3ec',

  /* elevation & atmosphere */
  'shadow-sm': '0 1px 2px rgba(23, 33, 29, 0.06), 0 1px 1px rgba(23, 33, 29, 0.04)',
  'shadow-md': '0 6px 20px -6px rgba(23, 33, 29, 0.16), 0 2px 6px rgba(23, 33, 29, 0.06)',
  'shadow-lg': '0 24px 60px -12px rgba(23, 33, 29, 0.3), 0 8px 24px rgba(23, 33, 29, 0.14)',
  'canvas-vignette': 'radial-gradient(120% 90% at 50% 0%, rgba(30, 94, 81, 0.05), transparent 60%)',

  /* type */
  'font-sans':
    '"Instrument Sans Variable", "Instrument Sans", "Avenir Next", "Segoe UI Variable Display", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", sans-serif',
  'font-serif':
    '"Fraunces Variable", Fraunces, "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
  'font-mono': 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace',

  /* motion */
  spring: 'cubic-bezier(0.34, 1.4, 0.5, 1)',
  ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
  fast: '130ms',
  med: '220ms',
  slow: '420ms',
} as const

export const darkTokens = {
  brand: '#4fb89e',
  'brand-strong': '#6ecbb2',
  'brand-soft': '#193029',
  'brand-ring': '#4fb89e',
  accent: '#e0a64b',
  'accent-strong': '#eeb965',
  'accent-soft': '#3a2e17',
  success: '#4fb380',
  warn: '#d08b3c',
  error: '#e0685c',

  ink: '#0e1512',
  paper: '#0f1613',
  canvas: '#141c18',
  surface: '#17211d',
  'surface-2': '#1d2823',
  'surface-hover': '#212d27',
  border: '#2b3630',
  'border-soft': '#232e28',
  text: '#ebeee7',
  'text-2': '#aeb6ac',
  // Lightened from #79817a to meet WCAG 1.4.3 (4.5:1) as small muted text in
  // dark theme: the old value was 4.1:1 on the dark surface and 3.5:1 on dark
  // brand-soft. This clears both (5.6:1 / 4.7:1).
  'text-3': '#8f9890',
  'on-brand': '#0e1512',

  'shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.4), 0 1px 1px rgba(0, 0, 0, 0.3)',
  'shadow-md': '0 6px 20px -6px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.35)',
  'shadow-lg': '0 24px 60px -12px rgba(0, 0, 0, 0.66), 0 8px 24px rgba(0, 0, 0, 0.4)',
  'canvas-vignette':
    'radial-gradient(120% 90% at 50% 0%, rgba(79, 184, 158, 0.07), transparent 60%)',
} as const satisfies Partial<Record<keyof typeof lightTokens, string>>

export type TokenName = keyof typeof lightTokens

export const tokens: {
  light: Record<TokenName, string>
  dark: Partial<Record<TokenName, string>>
} = { light: lightTokens, dark: darkTokens }

/** `--name: value;` lines for a token map (or any CSS-var map), indented. */
export function cssVariables(map: Record<string, string>, indent = '  '): string {
  return Object.entries(map)
    .map(([name, value]) => `${indent}--${name.replace(/^--/, '')}: ${value};`)
    .join('\n')
}

/**
 * The full token stylesheet, scoped by the consumer: the app passes
 * `:root` / `[data-theme="dark"]`, the respondent runtime passes
 * `.fsr-root` / `.fsr-root[data-theme="dark"]`.
 */
export function themeTokensCss(lightSelector: string, darkSelector: string): string {
  return `${lightSelector} {\n${cssVariables(tokens.light)}\n}\n\n${darkSelector} {\n${cssVariables(tokens.dark)}\n}\n`
}
