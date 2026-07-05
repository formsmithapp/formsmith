// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Hand-rolled color math — hex ↔ OKLCH, WCAG contrast, sRGB gamut mapping.
 * OKLab/OKLCH is the working space (perceptually uniform lightness makes
 * "darken by 0.07" mean the same thing for every hue); WCAG relative
 * luminance is computed in sRGB as the spec requires. No color library on
 * any path.
 */

export interface Oklch {
  /** Perceptual lightness, 0–1. */
  l: number
  /** Chroma, 0 (gray) to ~0.37 at the sRGB gamut edge. */
  c: number
  /** Hue angle in degrees, 0–360. */
  h: number
}

type Rgb = [number, number, number]

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/* ---------- hex ↔ sRGB ---------- */

export function hexToRgb(hex: string): Rgb {
  const raw = hex.trim().replace(/^#/, '')
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : raw
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`invalid hex color: ${hex}`)
  return [
    Number.parseInt(full.slice(0, 2), 16) / 255,
    Number.parseInt(full.slice(2, 4), 16) / 255,
    Number.parseInt(full.slice(4, 6), 16) / 255,
  ]
}

export function rgbToHex([r, g, b]: Rgb): string {
  const channel = (value: number) =>
    Math.round(clamp01(value) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

export function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim())
}

/* ---------- sRGB ↔ OKLab (Björn Ottosson's reference transform) ---------- */

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const linearToSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

function rgbToOklab([r, g, b]: Rgb): [number, number, number] {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function oklabToRgb([L, a, b]: [number, number, number]): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

/* ---------- OKLCH ---------- */

export function hexToOklch(hex: string): Oklch {
  const [L, a, b] = rgbToOklab(hexToRgb(hex))
  const c = Math.hypot(a, b)
  let h = (Math.atan2(b, a) * 180) / Math.PI
  if (h < 0) h += 360
  return { l: L, c, h }
}

function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const rad = (h * Math.PI) / 180
  return oklabToRgb([l, c * Math.cos(rad), c * Math.sin(rad)])
}

const inGamut = (rgb: Rgb) => rgb.every((ch) => ch >= -1e-6 && ch <= 1 + 1e-6)

/**
 * OKLCH → hex with gamut mapping: lightness and hue are preserved, chroma is
 * reduced (binary search) until the color fits sRGB. Never throws — the gray
 * axis is always in gamut.
 */
export function oklchToHex(color: Oklch): string {
  const l = clamp01(color.l)
  const target = { ...color, l, c: Math.max(0, color.c) }
  if (inGamut(oklchToRgb(target))) return rgbToHex(oklchToRgb(target))
  let lo = 0
  let hi = target.c
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (inGamut(oklchToRgb({ ...target, c: mid }))) lo = mid
    else hi = mid
  }
  return rgbToHex(oklchToRgb({ ...target, c: lo }))
}

/* ---------- WCAG contrast (computed in sRGB, per the spec) ---------- */

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear) as Rgb
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2.x contrast ratio, 1–21. Order-independent. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [dark, light] = la < lb ? [la, lb] : [lb, la]
  return (light + 0.05) / (dark + 0.05)
}

/** `rgba(r, g, b, a)` from a hex color — for translucent tints (vignettes). */
export function rgbaFromHex(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex).map((ch) => Math.round(ch * 255))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
