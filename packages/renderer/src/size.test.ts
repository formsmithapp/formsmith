// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'
import { describe, expect, it } from 'vitest'

/**
 * The bundle-budget gate (v1: runtime ≤ 45 KB gz excluding fonts). Builds
 * the real respondent entry — mount() aliased onto preact/compat, exactly
 * like the shipped iframe bundle — plus the stylesheet, and fails the suite
 * if the budget is exceeded. Also proves Zod stayed off the hot path.
 */

const BUDGET_BYTES = 45 * 1024

const gz = (data: string | Uint8Array): number => gzipSync(data, { level: 9 }).byteLength

describe('runtime bundle budget', () => {
  it('mount() + styles land under 45 KB gz, with no Zod on the hot path', async () => {
    const result = await build({
      entryPoints: [new URL('./mount.tsx', import.meta.url).pathname],
      bundle: true,
      minify: true,
      format: 'esm',
      write: false,
      outdir: 'dist-size', // virtual — write:false keeps it in memory
      metafile: true,
      target: 'es2022',
      jsx: 'automatic',
      jsxImportSource: 'preact',
      alias: {
        react: 'preact/compat',
        'react-dom/client': 'preact/compat/client',
        'react-dom': 'preact/compat',
        'react/jsx-runtime': 'preact/compat/jsx-runtime',
      },
      loader: { '.css': 'css' },
    })

    const jsOut = result.outputFiles.find((f) => f.path.endsWith('.js'))
    expect(jsOut).toBeDefined()
    if (jsOut === undefined) return

    const inputs = Object.keys(result.metafile?.inputs ?? {})
    expect(
      inputs.filter((file) => file.includes('/zod/') || file.includes('zod@')),
      'zod must never reach the respondent bundle',
    ).toEqual([])

    const { readFileSync } = await import('node:fs')
    // tokens are generated from @formsmithapp/ui at build — compose the same
    const { themeTokensCss } = await import('@formsmithapp/ui')
    const css =
      themeTokensCss('.fsr-root', '.fsr-root[data-theme="dark"]') +
      readFileSync(new URL('./styles/runtime.css', import.meta.url), 'utf8')

    const jsGz = gz(jsOut.contents)
    const cssGz = gz(css)
    const total = jsGz + cssGz
    // Surfaced in the test output so the real number is always visible.
    console.info(
      `runtime bundle: js ${(jsGz / 1024).toFixed(1)} KB gz + css ${(cssGz / 1024).toFixed(1)} KB gz = ${(total / 1024).toFixed(1)} KB gz (budget 45 KB)`,
    )
    expect(total).toBeLessThanOrEqual(BUDGET_BYTES)
  })
})
