// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import { FONT_PAIRS, hexToOklch, isHexColor, oklchToHex, parseThemeConfig } from '@formsmithapp/ui'
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useBuilder, useBuilderState } from './store-context'

/**
 * The Design tab — form-level theming (design §6.4). One brand color, an
 * appearance, a ground, a font pair; everything else is derived (with the
 * contrast floor enforced in @formsmithapp/ui, not here). Every edit goes
 * through store.setTheme → merge-keyed, undoable, autosaved, pinned by
 * publish.
 */

const SWATCHES: { name: string; value: string }[] = [
  { name: 'Forest', value: '#1e5e51' },
  { name: 'Violet', value: '#7048e8' },
  { name: 'Cobalt', value: '#1d63d8' },
  { name: 'Brick', value: '#c0463b' },
  { name: 'Ochre', value: '#c1841f' },
  { name: 'Ink', value: '#17211d' },
]

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line-soft px-4 py-4">
      <h3 className="eyebrow pb-3 text-fg-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function BrandColor({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {SWATCHES.map((swatch) => (
          <button
            key={swatch.value}
            type="button"
            aria-label={`Brand swatch ${swatch.name}`}
            aria-pressed={value.toLowerCase() === swatch.value}
            onClick={() => onChange(swatch.value)}
            className="grid size-7 place-items-center rounded-full border border-line transition-transform hover:scale-110"
            style={{ background: swatch.value }}
          >
            {value.toLowerCase() === swatch.value && (
              <Check size={13} strokeWidth={3} className="text-white mix-blend-difference" />
            )}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label="Brand color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-10 cursor-pointer rounded-[7px] border border-line bg-surface-2 p-0.5"
        />
        <input
          aria-label="Brand color hex"
          value={draft}
          onChange={(event) => {
            const next = event.target.value
            setDraft(next)
            if (isHexColor(next)) onChange(next)
          }}
          onBlur={() => setDraft(value)}
          className="w-24 rounded-[8px] border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-[12px] outline-none focus:border-brand-ring"
        />
      </div>
    </>
  )
}

export function DesignPanel() {
  const store = useBuilder()
  const state = useBuilderState()
  const theme = parseThemeConfig(state.doc.theme)
  const hue = hexToOklch(theme.brandColor).h

  // Ground presets are computed from the brand hue at click time and stored
  // as literal values — a later brand change re-tints new picks, not old ones.
  const tint = (l: number, c: number) => oklchToHex({ l, c, h: hue })
  const grounds: { name: string; background?: { type: 'color' | 'gradient'; value: string } }[] = [
    { name: 'Paper' },
    { name: 'Tinted', background: { type: 'color', value: tint(0.955, 0.02) } },
    {
      name: 'Dawn',
      background: {
        type: 'gradient',
        value: `linear-gradient(165deg, ${tint(0.975, 0.012)} 0%, ${tint(0.92, 0.03)} 100%)`,
      },
    },
    {
      name: 'Dusk',
      background: {
        type: 'gradient',
        value: `linear-gradient(165deg, ${tint(0.26, 0.045)} 0%, ${tint(0.15, 0.03)} 100%)`,
      },
    },
  ]
  const groundSelected = (preset: (typeof grounds)[number]) =>
    preset.background === undefined
      ? theme.background === undefined
      : theme.background?.value === preset.background.value

  return (
    <div data-design-panel>
      <Group title="Brand">
        <BrandColor
          value={theme.brandColor}
          onChange={(hex) => store.setTheme({ brandColor: hex })}
        />
        <p className="text-[11.5px] text-fg-3">
          Buttons, accents and highlights derive from this color — text contrast is kept accessible
          automatically.
        </p>
        <label className="block">
          <span className="mb-1.5 block font-mono text-[11px] font-semibold tracking-[0.06em] text-fg-2 uppercase">
            Logo URL
          </span>
          <input
            value={theme.logoUrl ?? ''}
            onChange={(event) =>
              store.setTheme({
                logoUrl: event.target.value.trim() === '' ? undefined : event.target.value.trim(),
              })
            }
            placeholder="https://yoursite.com/logo.svg"
            className="w-full rounded-[8px] border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-[12px] outline-none focus:border-brand-ring"
          />
          <span className="mt-1 block text-[11px] text-fg-3">
            https only, hosted by you — uploads arrive with storage in v1.1.
          </span>
        </label>
      </Group>

      <Group title="Appearance">
        <fieldset
          aria-label="Appearance"
          className="grid grid-cols-3 gap-1 rounded-[9px] border border-line bg-surface-2 p-1"
        >
          {(['light', 'dark', 'auto'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={theme.appearance === mode}
              onClick={() => store.setTheme({ appearance: mode })}
              className={`rounded-[6px] px-2 py-1.5 text-[12px] font-medium capitalize transition-colors ${
                theme.appearance === mode
                  ? 'bg-brand text-on-brand'
                  : 'text-fg-2 hover:bg-surface-hover'
              }`}
            >
              {mode}
            </button>
          ))}
        </fieldset>
      </Group>

      <Group title="Background">
        <div className="grid grid-cols-4 gap-2">
          {grounds.map((preset) => (
            <button
              key={preset.name}
              type="button"
              aria-label={`Background ${preset.name}`}
              aria-pressed={groundSelected(preset)}
              onClick={() => store.setTheme({ background: preset.background })}
              className={`grid gap-1 rounded-[9px] border p-1 text-center ${
                groundSelected(preset) ? 'border-brand-ring' : 'border-line hover:border-fg-3'
              }`}
            >
              <span
                aria-hidden="true"
                className="h-9 rounded-[6px] border border-line-soft"
                style={{ background: preset.background?.value ?? 'var(--canvas)' }}
              />
              <span className="text-[10.5px] text-fg-2">{preset.name}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Custom background color"
            value={theme.background?.type === 'color' ? theme.background.value : '#f4f3ec'}
            onChange={(event) =>
              store.setTheme({ background: { type: 'color', value: event.target.value } })
            }
            className="h-8 w-10 cursor-pointer rounded-[7px] border border-line bg-surface-2 p-0.5"
          />
          <span className="text-[11.5px] text-fg-3">Custom color</span>
        </div>
      </Group>

      <Group title="Typography">
        <fieldset className="grid gap-1.5" aria-label="Font pair">
          {FONT_PAIRS.map((pair) => (
            <button
              key={pair.id}
              type="button"
              aria-pressed={theme.fontPair === pair.id}
              onClick={() => store.setTheme({ fontPair: pair.id })}
              className={`flex items-baseline justify-between gap-3 rounded-[9px] border px-3 py-2.5 text-left ${
                theme.fontPair === pair.id ? 'border-brand-ring' : 'border-line hover:border-fg-3'
              }`}
            >
              <span className="text-[17px]" style={{ fontFamily: pair.serif }}>
                {pair.label}
              </span>
              <span className="text-[11px] text-fg-3" style={{ fontFamily: pair.sans }}>
                Aa Bb 0123
              </span>
            </button>
          ))}
        </fieldset>
        <p className="text-[11.5px] text-fg-3">
          Fonts are self-hosted and load with the form — respondents never touch a font CDN.
        </p>
      </Group>
    </div>
  )
}
