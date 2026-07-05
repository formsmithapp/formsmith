// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { contrastRatio, isHexColor, oklchToHex } from './color'
import { defaultThemeConfig, deriveTheme, parseThemeConfig, resolveAppearance } from './theme'
import { tokens } from './tokens'

describe('theme config parsing', () => {
  it('defaults are the stock look', () => {
    expect(defaultThemeConfig).toEqual({
      brandColor: tokens.light.brand,
      appearance: 'auto',
      fontPair: 'editorial',
    })
  })

  it('fail-soft: garbage degrades to defaults instead of throwing', () => {
    expect(parseThemeConfig(undefined)).toEqual(defaultThemeConfig)
    expect(parseThemeConfig(null)).toEqual(defaultThemeConfig)
    expect(parseThemeConfig({ brandColor: 'not-a-color' })).toEqual(defaultThemeConfig)
    expect(parseThemeConfig({ appearance: 'sepia' })).toEqual(defaultThemeConfig)
    expect(parseThemeConfig(42)).toEqual(defaultThemeConfig)
  })

  it('forward-compat: unknown keys are stripped, known ones survive', () => {
    const parsed = parseThemeConfig({ brandColor: '#7048e8', futureKnob: true })
    expect(parsed.brandColor).toBe('#7048e8')
    expect('futureKnob' in parsed).toBe(false)
  })

  it('resolveAppearance honors explicit values and follows the system on auto', () => {
    expect(resolveAppearance('light', true)).toBe('light')
    expect(resolveAppearance('dark', false)).toBe('dark')
    expect(resolveAppearance('auto', true)).toBe('dark')
    expect(resolveAppearance('auto', false)).toBe('light')
  })
})

describe('deriveTheme', () => {
  it('produces the full brand family for both grounds', () => {
    const { light, dark } = deriveTheme({ brandColor: '#7048e8' })
    for (const map of [light, dark]) {
      for (const key of ['--brand', '--brand-strong', '--brand-soft', '--brand-ring']) {
        expect(isHexColor(map[key] ?? '')).toBe(true)
      }
      expect(map['--on-brand']).toBeDefined()
      expect(map['--canvas-vignette']).toContain('radial-gradient')
      expect(map['--font-serif']).toContain('Fraunces')
      expect(map['--font-sans']).toContain('Instrument Sans')
    }
    // dark ground lifts the brand into accent territory
    expect(dark['--brand']).not.toBe(light['--brand'])
  })

  it('CONTRAST FLOOR: on-brand text ≥ 4.5:1 across a full hue × lightness sweep', () => {
    for (let h = 0; h < 360; h += 15) {
      for (const l of [0.15, 0.35, 0.5, 0.62, 0.75, 0.92]) {
        const brandColor = oklchToHex({ l, c: 0.13, h })
        const { light, dark } = deriveTheme({ brandColor })
        for (const [ground, map] of [
          ['light', light],
          ['dark', dark],
        ] as const) {
          const brand = map['--brand'] ?? ''
          const onBrand = map['--on-brand'] ?? ''
          const ratio = contrastRatio(brand, onBrand)
          expect(
            ratio,
            `${brandColor} on ${ground} ground: ${brand} vs ${onBrand} = ${ratio.toFixed(2)}`,
          ).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  })

  it('the gray axis and the poles survive derivation', () => {
    for (const brandColor of ['#000000', '#ffffff', '#808080']) {
      const { light, dark } = deriveTheme({ brandColor })
      expect(
        contrastRatio(light['--brand'] ?? '', light['--on-brand'] ?? ''),
      ).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(dark['--brand'] ?? '', dark['--on-brand'] ?? '')).toBeGreaterThanOrEqual(
        4.5,
      )
    }
  })

  it('background overrides land on both grounds; gradients skip --paper', () => {
    const color = deriveTheme({ background: { type: 'color', value: '#fdf6ec' } })
    expect(color.light['--canvas']).toBe('#fdf6ec')
    expect(color.dark['--canvas']).toBe('#fdf6ec')
    expect(color.light['--paper']).toBe('#fdf6ec')

    const gradient = deriveTheme({
      background: { type: 'gradient', value: 'linear-gradient(180deg, #fdf6ec, #f4e8d8)' },
    })
    expect(gradient.light['--canvas']).toContain('linear-gradient')
    expect(gradient.light['--paper']).toBeUndefined()

    expect(deriveTheme({}).light['--canvas']).toBeUndefined()
  })

  it('font pair drives the font vars; unknown pairs fall back to editorial', () => {
    const literary = deriveTheme({ fontPair: 'literary' })
    expect(literary.light['--font-serif']).toContain('Newsreader')
    expect(literary.light['--font-sans']).toContain('Schibsted Grotesk')

    const system = deriveTheme({ fontPair: 'system' })
    expect(system.light['--font-serif']).not.toContain('Variable')

    const unknown = deriveTheme({ fontPair: 'does-not-exist' })
    expect(unknown.light['--font-serif']).toContain('Fraunces')
  })

  it('is deterministic', () => {
    expect(deriveTheme({ brandColor: '#7048e8' })).toEqual(deriveTheme({ brandColor: '#7048e8' }))
  })
})
