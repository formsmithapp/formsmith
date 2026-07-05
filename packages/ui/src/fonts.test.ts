// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { DEFAULT_FONT_PAIR_ID, FONT_PAIRS, fontFaceCss, getFontPair } from './fonts'

describe('font pair registry', () => {
  it('ships the three v1 pairs in picker order', () => {
    expect(FONT_PAIRS.map((pair) => pair.id)).toEqual(['editorial', 'literary', 'system'])
  })

  it('getFontPair falls back to the default for unknown/missing ids', () => {
    expect(getFontPair('literary').id).toBe('literary')
    expect(getFontPair('comic-sans').id).toBe(DEFAULT_FONT_PAIR_ID)
    expect(getFontPair(undefined).id).toBe(DEFAULT_FONT_PAIR_ID)
  })

  it('system pair downloads nothing; the others declare their faces', () => {
    expect(getFontPair('system').faces).toEqual([])
    expect(getFontPair('editorial').faces).toHaveLength(2)
    expect(getFontPair('literary').faces).toHaveLength(2)
  })

  it('every face family appears in its pair’s stacks', () => {
    for (const pair of FONT_PAIRS) {
      for (const face of pair.faces) {
        expect(`${pair.serif} ${pair.sans}`).toContain(face.family)
      }
    }
  })

  it('fontFaceCss emits same-origin-relative declarations with the latin subset', () => {
    const css = fontFaceCss(getFontPair('literary'), '/fonts/files')
    expect(css).toContain('font-family: "Newsreader Variable"')
    expect(css).toContain('url(/fonts/files/newsreader-latin-opsz-normal.woff2)')
    expect(css).toContain('unicode-range: U+0000-00FF')
    expect(css).toContain('font-display: swap')
    // never an absolute third-party origin
    expect(css).not.toMatch(/https?:\/\//)
    expect(fontFaceCss(getFontPair('system'))).toBe('')
  })
})
