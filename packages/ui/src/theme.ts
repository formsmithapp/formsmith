// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod'
import { contrastRatio, hexToOklch, isHexColor, type Oklch, oklchToHex, rgbaFromHex } from './color'
import { getFontPair } from './fonts'
import { tokens } from './tokens'

/**
 * Theme derivation — one author input (a brand color) becomes a coherent
 * palette for BOTH light and dark grounds, with the on-brand text contrast
 * floor (WCAG ≥ 4.5:1) enforced in code, not by author diligence. Derivation
 * runs in hosts (builder, respondent page); the runtime itself only receives
 * the flat CSS-var map.
 */

// Deliberately NOT strict: unknown keys are stripped, so a document written
// by a newer Formsmith keeps its theme on an older instance.
export const themeConfigSchema = z.object({
  /** The one input most authors touch. Hex only. */
  brandColor: z
    .string()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'brandColor must be a hex color')
    .default(tokens.light.brand),
  appearance: z.enum(['light', 'dark', 'auto']).default('auto'),
  /** Page ground override. `gradient` values are full CSS gradient images. */
  background: z
    .object({
      type: z.enum(['color', 'gradient']),
      value: z.string().min(1).max(400),
    })
    .optional(),
  /** Keys into the FONT_PAIRS registry; unknown ids fall back to the default pair. */
  fontPair: z.string().default('editorial'),
})

export type ThemeConfig = z.infer<typeof themeConfigSchema>
export type ThemeAppearance = ThemeConfig['appearance']

export const defaultThemeConfig: ThemeConfig = themeConfigSchema.parse({})

/**
 * Fail-soft parse for theme data coming off a stored form document: a valid
 * config passes through, anything else (missing, partial, corrupt, or
 * API-authored with wrong shapes) degrades to the defaults rather than
 * breaking a respondent page.
 */
export function parseThemeConfig(value: unknown): ThemeConfig {
  const result = themeConfigSchema.safeParse(value ?? {})
  return result.success ? result.data : defaultThemeConfig
}

export function resolveAppearance(
  appearance: ThemeAppearance,
  systemDark: boolean,
): 'light' | 'dark' {
  return appearance === 'auto' ? (systemDark ? 'dark' : 'light') : appearance
}

/** Flat CSS custom-property maps (`--name` keys), one per ground. */
export interface DerivedTheme {
  light: Record<string, string>
  dark: Record<string, string>
}

const CONTRAST_FLOOR = 4.5
/** On-brand text candidates — the token grounds, not pure white/black. */
const LIGHT_TEXT = tokens.light.canvas
const DARK_TEXT = tokens.dark.ink ?? tokens.light.ink

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Picks on-brand text and, when neither candidate reaches the floor
 * (mid-lightness brands), walks the brand's OKLCH lightness to the nearest
 * value that passes — design §2.4's "verify contrast" rule as code.
 */
function ensureOnBrand(brand: Oklch): { brand: Oklch; hex: string; onBrand: string } {
  const pick = (hex: string) => {
    const light = contrastRatio(hex, LIGHT_TEXT)
    const dark = contrastRatio(hex, DARK_TEXT)
    return light >= dark
      ? { onBrand: LIGHT_TEXT, ratio: light }
      : { onBrand: DARK_TEXT, ratio: dark }
  }
  let hex = oklchToHex(brand)
  let best = pick(hex)
  if (best.ratio >= CONTRAST_FLOOR) return { brand, hex, onBrand: best.onBrand }

  // Light text wants a darker brand; dark text wants a lighter one. The
  // extreme of either direction always passes, so binary-search the nearest
  // passing lightness.
  const darken = best.onBrand === LIGHT_TEXT
  let passing = darken ? 0 : 1
  let failing = brand.l
  for (let i = 0; i < 24; i++) {
    const mid = (passing + failing) / 2
    const candidate = oklchToHex({ ...brand, l: mid })
    if (contrastRatio(candidate, best.onBrand) >= CONTRAST_FLOOR) passing = mid
    else failing = mid
  }
  const adjusted = { ...brand, l: passing }
  hex = oklchToHex(adjusted)
  best = pick(hex)
  return { brand: adjusted, hex, onBrand: best.onBrand }
}

function brandVars(ground: 'light' | 'dark', authored: Oklch): Record<string, string> {
  // Dark grounds need the brand to read as a bright accent: lift lightness,
  // keep the hue. Light grounds take the authored color as-is.
  const base =
    ground === 'light'
      ? authored
      : { ...authored, l: Math.max(authored.l, 0.68), c: Math.min(authored.c, 0.14) }
  const { brand, hex, onBrand } = ensureOnBrand(base)
  const strong = oklchToHex({
    ...brand,
    l: clamp(brand.l + (ground === 'light' ? -0.07 : 0.07), 0.02, 0.98),
  })
  const soft =
    ground === 'light'
      ? oklchToHex({ l: 0.93, c: Math.min(brand.c * 0.25, 0.035), h: brand.h })
      : oklchToHex({ l: 0.26, c: Math.min(brand.c * 0.35, 0.05), h: brand.h })
  const ring =
    ground === 'light'
      ? oklchToHex({ ...brand, l: clamp(brand.l + 0.08, 0.02, 0.98), c: brand.c * 0.9 })
      : hex
  const vignetteAlpha = ground === 'light' ? 0.05 : 0.07
  return {
    '--brand': hex,
    '--brand-strong': strong,
    '--brand-soft': soft,
    '--brand-ring': ring,
    '--on-brand': onBrand,
    '--canvas-vignette': `radial-gradient(120% 90% at 50% 0%, ${rgbaFromHex(hex, vignetteAlpha)}, transparent 60%)`,
  }
}

/**
 * ThemeConfig → flat CSS-var maps for both grounds. Hosts resolve
 * `appearance` (via {@link resolveAppearance}) and hand the matching map to
 * the runtime as `themeVars` / apply it to the builder canvas.
 */
export function deriveTheme(config?: Partial<ThemeConfig> | null): DerivedTheme {
  const theme = parseThemeConfig({ ...defaultThemeConfig, ...config })
  const authored = hexToOklch(isHexColor(theme.brandColor) ? theme.brandColor : tokens.light.brand)
  const pair = getFontPair(theme.fontPair)
  const fontVars = { '--font-serif': pair.serif, '--font-sans': pair.sans }

  const light: Record<string, string> = { ...brandVars('light', authored), ...fontVars }
  const dark: Record<string, string> = { ...brandVars('dark', authored), ...fontVars }

  // The ground override is author-owned and applies to both appearances;
  // `--canvas` paints the page (the `background` shorthand, so gradients
  // work), `--paper` follows for surfaces derived from it.
  if (theme.background !== undefined) {
    light['--canvas'] = theme.background.value
    dark['--canvas'] = theme.background.value
    if (theme.background.type === 'color') {
      light['--paper'] = theme.background.value
      dark['--paper'] = theme.background.value
    }
  }
  return { light, dark }
}
