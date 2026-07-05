// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { cssVariables, themeTokensCss, tokens } from './tokens'

describe('canonical tokens', () => {
  it('dark only overrides keys that exist in light', () => {
    for (const key of Object.keys(tokens.dark)) {
      expect(key in tokens.light, `dark token "${key}" has no light base`).toBe(true)
    }
  })

  it('cssVariables emits one --name: value line per token', () => {
    const css = cssVariables({ brand: '#1e5e51', 'brand-soft': '#e4eee9' })
    expect(css).toBe('  --brand: #1e5e51;\n  --brand-soft: #e4eee9;')
  })

  it('themeTokensCss scopes light and dark under the given selectors', () => {
    const css = themeTokensCss('.fsr-root', '.fsr-root[data-theme="dark"]')
    expect(css).toContain('.fsr-root {\n')
    expect(css).toContain('.fsr-root[data-theme="dark"] {\n')
    expect(css).toContain('--brand: #1e5e51;')
    expect(css).toContain('--brand: #4fb89e;')
    // every light token is present
    for (const name of Object.keys(tokens.light)) {
      expect(css).toContain(`--${name}:`)
    }
  })
})
