// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import { getBlockDefinition, validateBlockProperties } from '@formsmithapp/blocks'
import type { Block } from '@formsmithapp/engine'
import * as Switch from '@radix-ui/react-switch'
import { Copy, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SCREEN_TYPES } from '@/lib/builder-store'
import { isValidRef } from '@/lib/slug'
import { BlockIconTile } from './block-icons'
import { DesignPanel } from './design-panel'
import { JumpsSection, ScoringSection, VisibilitySection } from './logic-sections'
import { useBuilder, useBuilderState } from './store-context'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line-soft px-4 py-4">
      <h3 className="eyebrow pb-3 text-fg-3">{title}</h3>
      <div className="space-y-3.5">{children}</div>
    </section>
  )
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is wrapped as {children}, the wrapped-label pattern
    <label className="block">
      <span className="mb-1.5 block font-mono text-[11px] font-semibold tracking-[0.06em] text-fg-2 uppercase">
        {label}
      </span>
      {children}
      {hint !== undefined && (
        <span className="mt-1 block text-[11.5px] leading-snug text-fg-3">{hint}</span>
      )}
      {error !== undefined && <span className="mt-1 block text-[11.5px] text-error">{error}</span>}
    </label>
  )
}

const inputClass =
  'w-full rounded-[8px] border border-line bg-surface-2 px-2.5 py-1.5 text-[13px] outline-none transition-shadow focus:border-brand-ring focus:shadow-[0_0_0_3px_var(--brand-soft)]'

function TextField({
  label,
  value,
  placeholder,
  error,
  hint,
  multiline = false,
  onCommit,
}: {
  label: string
  value: string
  placeholder?: string
  error?: string
  hint?: string
  multiline?: boolean
  onCommit: (next: string) => void
}) {
  return (
    <Field label={label} error={error} hint={hint}>
      {multiline ? (
        <textarea
          value={value}
          rows={3}
          placeholder={placeholder}
          onChange={(event) => onCommit(event.target.value)}
          className={`${inputClass} resize-none`}
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          onChange={(event) => onCommit(event.target.value)}
          className={inputClass}
        />
      )}
    </Field>
  )
}

function NumberField({
  label,
  value,
  error,
  hint,
  onCommit,
}: {
  label: string
  value: number | undefined
  error?: string
  hint?: string
  onCommit: (next: number | undefined) => void
}) {
  return (
    <Field label={label} error={error} hint={hint}>
      <input
        value={value ?? ''}
        inputMode="decimal"
        onChange={(event) => {
          const raw = event.target.value.trim()
          onCommit(raw === '' ? undefined : Number(raw))
        }}
        className={inputClass}
      />
    </Field>
  )
}

function ToggleRow({
  label,
  sub,
  checked,
  onChange,
}: {
  label: string
  sub?: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>
        <span className="block text-[13px] font-medium">{label}</span>
        {sub !== undefined && <span className="block text-[11.5px] text-fg-3">{sub}</span>}
      </span>
      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        aria-label={label}
        className="relative h-[20px] w-[34px] shrink-0 rounded-full bg-line transition-colors data-[state=checked]:bg-brand"
      >
        <Switch.Thumb className="block size-[16px] translate-x-[2px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-spring data-[state=checked]:translate-x-[16px]" />
      </Switch.Root>
    </div>
  )
}

/** Per-type property controls (plan D5), validated by the blocks schemas. */
function TypeSettings({ block, issues }: { block: Block; issues: Map<string, string> }) {
  const store = useBuilder()
  const text = (key: string): string => {
    const raw = block.properties?.[key]
    return typeof raw === 'string' ? raw : ''
  }
  const num = (key: string): number | undefined => {
    const raw = block.properties?.[key]
    return typeof raw === 'number' ? raw : undefined
  }
  const set = (key: string, value: unknown, merge = true) =>
    store.updateProperties(
      block.id,
      { [key]: value === '' ? undefined : value },
      merge ? `prop:${block.id}:${key}` : undefined,
    )

  switch (block.type) {
    case 'short_text':
    case 'long_text':
      return (
        <>
          <TextField
            label="Placeholder"
            value={text('placeholder')}
            error={issues.get('placeholder')}
            onCommit={(v) => set('placeholder', v)}
          />
          <NumberField
            label="Max length"
            value={num('maxLength')}
            error={issues.get('maxLength')}
            onCommit={(v) => set('maxLength', v)}
          />
        </>
      )
    case 'email':
    case 'phone':
    case 'website':
      return (
        <TextField
          label="Placeholder"
          value={text('placeholder')}
          error={issues.get('placeholder')}
          onCommit={(v) => set('placeholder', v)}
        />
      )
    case 'multiple_choice':
      return (
        <ToggleRow
          label="Multiple selection"
          sub="Respondents can pick more than one"
          checked={block.properties?.multiple === true}
          onChange={(v) => set('multiple', v, false)}
        />
      )
    case 'dropdown':
      return (
        <TextField
          label="Placeholder"
          value={text('placeholder')}
          error={issues.get('placeholder')}
          onCommit={(v) => set('placeholder', v)}
        />
      )
    case 'number':
      return (
        <>
          <NumberField
            label="Min value"
            value={num('min')}
            error={issues.get('min')}
            onCommit={(v) => set('min', v)}
          />
          <NumberField
            label="Max value"
            value={num('max')}
            error={issues.get('max')}
            onCommit={(v) => set('max', v)}
          />
          <NumberField
            label="Step"
            value={num('step')}
            hint="The amount each arrow press or entry snaps to, e.g. 0.5. Leave blank for whole numbers."
            error={issues.get('step')}
            onCommit={(v) => set('step', v)}
          />
        </>
      )
    case 'date':
      return (
        <>
          <TextField
            label="Earliest date"
            value={text('min')}
            placeholder="YYYY-MM-DD"
            error={issues.get('min')}
            onCommit={(v) => set('min', v)}
          />
          <TextField
            label="Latest date"
            value={text('max')}
            placeholder="YYYY-MM-DD"
            error={issues.get('max')}
            onCommit={(v) => set('max', v)}
          />
        </>
      )
    case 'opinion_scale':
      return (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <NumberField
              label="From"
              value={num('min') ?? 1}
              error={issues.get('min')}
              onCommit={(v) => set('min', v)}
            />
            <NumberField
              label="To"
              value={num('max') ?? 5}
              error={issues.get('max')}
              onCommit={(v) => set('max', v)}
            />
          </div>
          <TextField
            label="Left label"
            value={text('minLabel')}
            error={issues.get('minLabel')}
            onCommit={(v) => set('minLabel', v)}
          />
          <TextField
            label="Right label"
            value={text('maxLabel')}
            error={issues.get('maxLabel')}
            onCommit={(v) => set('maxLabel', v)}
          />
        </>
      )
    case 'nps':
      return (
        <>
          <TextField
            label="Left label"
            value={text('minLabel')}
            placeholder="Not at all likely"
            error={issues.get('minLabel')}
            onCommit={(v) => set('minLabel', v)}
          />
          <TextField
            label="Right label"
            value={text('maxLabel')}
            placeholder="Extremely likely"
            error={issues.get('maxLabel')}
            onCommit={(v) => set('maxLabel', v)}
          />
        </>
      )
    case 'welcome':
    case 'statement':
      return (
        <TextField
          label="Button text"
          value={text('buttonText')}
          placeholder={block.type === 'welcome' ? 'Start' : 'Continue'}
          error={issues.get('buttonText')}
          onCommit={(v) => set('buttonText', v)}
        />
      )
    case 'thankyou':
      return (
        <>
          <TextField
            label="Redirect URL"
            value={text('redirectUrl')}
            placeholder="https://…"
            hint="Sends respondents here automatically when they finish, in the same tab. Leave blank to keep them on the ending screen."
            error={issues.get('redirectUrl')}
            onCommit={(v) => set('redirectUrl', v)}
          />
          <TextField
            label="Button label"
            value={text('ctaLabel')}
            placeholder="Visit our site"
            hint="Text for an optional button on the ending screen. It only shows when a Button URL is set too."
            error={issues.get('ctaLabel')}
            onCommit={(v) => set('ctaLabel', v)}
          />
          <TextField
            label="Button URL"
            value={text('ctaUrl')}
            placeholder="https://…"
            hint="Where the button goes. Opens in a new tab on click. If a Redirect URL is set, the automatic redirect takes over instead."
            error={issues.get('ctaUrl')}
            onCommit={(v) => set('ctaUrl', v)}
          />
        </>
      )
    case 'ai_followup':
      return (
        <>
          <TextField
            label="Goal / instruction"
            value={text('goal')}
            placeholder="What should the follow-up probe for?"
            error={issues.get('goal')}
            multiline
            onCommit={(v) => set('goal', v)}
          />
          <NumberField
            label="Max follow-ups"
            value={num('maxFollowups') ?? 1}
            hint="The most adaptive questions to ask before moving on. Higher digs deeper but takes respondents longer."
            error={issues.get('maxFollowups')}
            onCommit={(v) => set('maxFollowups', v)}
          />
          <TextField
            label="Fallback question (required)"
            value={text('fallbackQuestion')}
            placeholder="Shown whenever AI is unavailable"
            error={issues.get('fallbackQuestion')}
            multiline
            onCommit={(v) => set('fallbackQuestion', v)}
          />
        </>
      )
    default:
      return null
  }
}

function RefField({ block }: { block: Block }) {
  const store = useBuilder()
  const state = useBuilderState()
  const [draft, setDraft] = useState(block.ref)
  const [error, setError] = useState<string | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies(block.id): reset the draft when a different block is selected
  useEffect(() => {
    setDraft(block.ref)
    setError(null)
  }, [block.id, block.ref])

  const taken = new Set(state.doc.blocks.filter((b) => b.id !== block.id).map((b) => b.ref))
  return (
    <Field
      label="Reference (piping)"
      error={error ?? undefined}
      hint="A unique, dot-free slug (a-z, 0-9, _). Pipe this answer into later questions with @ref, and target this block from logic and scoring."
    >
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft === block.ref) return
          if (isValidRef(draft, taken)) {
            store.setRef(block.id, draft)
            setError(null)
          } else {
            setError('Must be a unique, dot-free slug (a-z, 0-9, _)')
          }
        }}
        className={`${inputClass} font-mono text-[12px]`}
      />
    </Field>
  )
}

export function Panel({
  onToast,
}: {
  onToast: (message: string, tone?: 'default' | 'error') => void
}) {
  const [tab, setTab] = useState<'content' | 'design'>('content')
  const state = useBuilderState()
  const block = state.doc.blocks.find((b) => b.id === state.selectedId) ?? null

  return (
    <aside
      aria-label="Block settings"
      className="flex h-full min-h-0 flex-col overflow-y-auto border-l border-line bg-surface"
    >
      <div
        role="tablist"
        aria-label="Panel view"
        className="grid grid-cols-2 gap-1 border-b border-line p-2"
      >
        {(['content', 'design'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`panel-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={tab === id ? 'panel-tabpanel' : undefined}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault()
                const next = id === 'content' ? 'design' : 'content'
                setTab(next)
                document.getElementById(`panel-tab-${next}`)?.focus()
              }
            }}
            className={`rounded-[7px] px-2 py-1.5 text-[12px] font-semibold capitalize transition-colors ${
              tab === id ? 'bg-surface-2 shadow-sm' : 'text-fg-3 hover:text-fg'
            }`}
          >
            {id}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="panel-tabpanel" aria-labelledby={`panel-tab-${tab}`}>
        {tab === 'design' ? <DesignPanel /> : <BlockPanel block={block} onToast={onToast} />}
      </div>
    </aside>
  )
}

function BlockPanel({
  block,
  onToast,
}: {
  block: Block | null
  onToast: (message: string, tone?: 'default' | 'error') => void
}) {
  const store = useBuilder()
  if (block === null) return null

  const definition = getBlockDefinition(block.type)
  const answerable = !SCREEN_TYPES.has(block.type)
  const ai = block.type === 'ai_followup'

  // Render-time schema validation, the same gate publish uses (field → first issue).
  const propertyIssues = new Map<string, string>()
  const result = validateBlockProperties(block.type, block.properties ?? {})
  if (!result.ok) {
    for (const issue of result.issues) {
      const [path, ...rest] = issue.split(': ')
      const key = path?.split('.')[0] ?? ''
      if (!propertyIssues.has(key)) propertyIssues.set(key, rest.join(': ') || (path ?? issue))
    }
  }

  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3.5">
        <BlockIconTile iconKey={definition?.iconKey ?? ''} ai={ai} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold">
            {definition?.displayName ?? block.type}
          </span>
          <span className="block font-mono text-[9.5px] tracking-[0.08em] text-fg-3 uppercase">
            {block.type}
          </span>
        </span>
        {block.type !== 'welcome' && (
          <button
            type="button"
            aria-label="Duplicate block"
            onClick={() => store.duplicateBlock(block.id)}
            className="grid size-7 place-items-center rounded-md text-fg-3 hover:bg-surface-hover hover:text-fg"
          >
            <Copy size={13} />
          </button>
        )}
        <button
          type="button"
          aria-label="Delete block"
          onClick={() => {
            store.removeBlock(block.id)
            onToast('Block deleted')
          }}
          className="grid size-7 place-items-center rounded-md text-fg-3 hover:bg-surface-hover hover:text-error"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {answerable && (
        <Section title="Settings">
          <ToggleRow
            label="Required"
            sub="Respondents must answer to continue"
            checked={block.required === true}
            onChange={(v) => store.updateBlock(block.id, { required: v })}
          />
          {block.required === true && (
            <TextField
              label="Required message"
              value={block.validations?.find((v) => v.type === 'required')?.message ?? ''}
              placeholder="This field is required."
              onCommit={(message) => {
                const rest = (block.validations ?? []).filter((v) => v.type !== 'required')
                store.updateBlock(
                  block.id,
                  {
                    validations: message === '' ? rest : [...rest, { type: 'required', message }],
                  },
                  `reqmsg:${block.id}`,
                )
              }}
            />
          )}
        </Section>
      )}

      <Section title={ai ? '✦ AI behavior' : 'Content'}>
        <TextField
          label="Description"
          value={block.description ?? ''}
          placeholder="Optional text shown under the title"
          hint="Also editable inline under the title on the canvas. Same field, two places."
          multiline
          onCommit={(text) =>
            store.updateBlock(
              block.id,
              { description: text === '' ? undefined : text },
              `desc:${block.id}`,
            )
          }
        />
        <TypeSettings block={block} issues={propertyIssues} />
        {(block.type === 'multiple_choice' || block.type === 'dropdown') && (
          <p className="text-[11.5px] text-fg-3">
            Choices are edited on the canvas.
            {propertyIssues.has('choices') && (
              <span className="block text-error">{propertyIssues.get('choices')}</span>
            )}
          </p>
        )}
      </Section>

      {answerable && (
        <Section title="Logic">
          <VisibilitySection block={block} />
          <div className="border-t border-line-soft pt-3.5">
            <JumpsSection block={block} />
          </div>
        </Section>
      )}
      {answerable && (
        <Section title="Scoring">
          <ScoringSection block={block} />
        </Section>
      )}
      <Section title="Advanced">
        <RefField block={block} />
      </Section>
    </>
  )
}
