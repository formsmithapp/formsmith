// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  hexToOklch,
  hexToRgb,
  isHexColor,
  oklchToHex,
  relativeLuminance,
  rgbaFromHex,
  rgbToHex,
} from './color'

describe('hex parsing', () => {
  it('round-trips six-digit hex', () => {
    for (const hex of ['#1e5e51', '#ffffff', '#000000', '#c0463b', '#4fb89e']) {
      expect(rgbToHex(hexToRgb(hex))).toBe(hex)
    }
  })

  it('expands three-digit hex', () => {
    expect(rgbToHex(hexToRgb('#fff'))).toBe('#ffffff')
    expect(rgbToHex(hexToRgb('#a3c'))).toBe('#aa33cc')
  })

  it('rejects garbage', () => {
    expect(() => hexToRgb('teal')).toThrow()
    expect(() => hexToRgb('#12345')).toThrow()
    expect(isHexColor('#1e5e51')).toBe(true)
    expect(isHexColor('#fff')).toBe(true)
    expect(isHexColor('oklch(0.5 0.1 180)')).toBe(false)
  })
})

describe('oklch round-trip', () => {
  it('hex → oklch → hex is stable within 1/255 per channel', () => {
    for (const hex of ['#1e5e51', '#c0463b', '#e4eee9', '#0e1512', '#c1841f', '#7f7f7f']) {
      const back = oklchToHex(hexToOklch(hex))
      const [r1, g1, b1] = hexToRgb(hex)
      const [r2, g2, b2] = hexToRgb(back)
      expect(Math.abs(r1 - r2)).toBeLessThanOrEqual(1 / 255 + 1e-9)
      expect(Math.abs(g1 - g2)).toBeLessThanOrEqual(1 / 255 + 1e-9)
      expect(Math.abs(b1 - b2)).toBeLessThanOrEqual(1 / 255 + 1e-9)
    }
  })

  it('white and black hit the lightness poles', () => {
    expect(hexToOklch('#ffffff').l).toBeCloseTo(1, 2)
    expect(hexToOklch('#000000').l).toBeCloseTo(0, 2)
  })

  it('gamut-maps out-of-range chroma to a valid hex instead of throwing', () => {
    const screaming = oklchToHex({ l: 0.6, c: 0.4, h: 150 }) // beyond sRGB
    expect(isHexColor(screaming)).toBe(true)
    // lightness survives the mapping; only chroma gives way
    expect(hexToOklch(screaming).l).toBeCloseTo(0.6, 1)
  })
})

describe('wcag contrast', () => {
  it('black on white is 21:1, self-contrast is 1:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#1e5e51', '#1e5e51')).toBe(1)
  })

  it('is order-independent and matches the known default pairing', () => {
    expect(contrastRatio('#1e5e51', '#f4f3ec')).toBeCloseTo(contrastRatio('#f4f3ec', '#1e5e51'), 10)
    // the stock brand button passes AA against its on-brand text
    expect(contrastRatio('#1e5e51', '#f4f3ec')).toBeGreaterThanOrEqual(4.5)
  })

  it('relative luminance anchors', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5)
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5)
  })
})

describe('rgba tint', () => {
  it('emits rgba() from hex + alpha', () => {
    expect(rgbaFromHex('#1e5e51', 0.05)).toBe('rgba(30, 94, 81, 0.05)')
  })
})
