// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import type { Block } from '@formsmithapp/engine'
import { CornerDownRight, Plus, Sparkles, X } from 'lucide-react'
import { SCREEN_TYPES } from '@/lib/builder-store'
import { InlineEdit } from './inline-edit'
import { useBuilder, useBuilderState } from './store-context'

interface Choice {
  id: string
  label: string
}

const choicesOf = (block: Block): Choice[] =>
  Array.isArray(block.properties?.choices) ? (block.properties.choices as Choice[]) : []

const numberProp = (block: Block, key: string, fallback: number): number => {
  const raw = block.properties?.[key]
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback
}

const stringProp = (block: Block, key: string): string | undefined => {
  const raw = block.properties?.[key]
  return typeof raw === 'string' && raw !== '' ? raw : undefined
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Editable choice rows — brand-tinted, mono letter tiles, add/remove (design §6.3). */
function ChoiceEditor({ block }: { block: Block }) {
  const store = useBuilder()
  const choices = choicesOf(block)

  const commit = (next: Choice[], mergeKey?: string) =>
    store.updateProperties(block.id, { choices: next }, mergeKey)

  return (
    <div className="grid max-w-[460px] gap-2.5">
      {choices.map((choice, index) => (
        <div
          key={choice.id}
          className="group flex items-center gap-3 rounded-[11px] border-[1.5px] border-brand/30 bg-brand-soft/55 px-3.5 py-3"
        >
          <span className="grid h-[22px] min-w-[22px] place-items-center rounded-[6px] border border-brand/35 font-mono text-[11px] font-semibold text-brand">
            {LETTERS[index] ?? '·'}
          </span>
          <input
            value={choice.label}
            aria-label={`Choice ${index + 1} label`}
            onChange={(event) =>
              commit(
                choices.map((c, i) => (i === index ? { ...c, label: event.target.value } : c)),
                `choice:${block.id}:${choice.id}`,
              )
            }
            className="min-w-0 flex-1 bg-transparent text-[16px] font-medium outline-none"
          />
          <button
            type="button"
            aria-label={`Remove choice ${index + 1}`}
            onClick={() => commit(choices.filter((_, i) => i !== index))}
            className="grid size-6 place-items-center rounded-md text-fg-3 opacity-0 transition-opacity group-hover:opacity-100 hover:text-error"
          >
            <X size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          commit([
            ...choices,
            { id: `c_${crypto.randomUUID().slice(0, 8)}`, label: `Choice ${choices.length + 1}` },
          ])
        }
        className="flex w-fit items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] font-medium text-brand hover:bg-brand-soft"
      >
        <Plus size={13} /> Add choice
      </button>
    </div>
  )
}

/** Non-interactive respondent-look mocks for the remaining answer types. */
function AnswerMock({ block }: { block: Block }) {
  switch (block.type) {
    case 'short_text':
    case 'email':
    case 'phone':
    case 'website':
    case 'ai_followup':
      return (
        <p className="max-w-[520px] border-b-2 border-brand/30 pb-2.5 font-serif text-[24px] text-fg-3">
          {stringProp(block, 'placeholder') ?? 'Type your answer here…'}
        </p>
      )
    case 'number':
      return (
        <p className="max-w-[200px] border-b-2 border-brand/30 pb-2.5 font-serif text-[24px] text-fg-3">
          {stringProp(block, 'placeholder') ?? '0'}
        </p>
      )
    case 'long_text':
      return (
        <p className="min-h-[120px] max-w-[560px] rounded-[12px] border border-line bg-surface-2 px-4 py-3.5 font-serif text-[19px] text-fg-3">
          {stringProp(block, 'placeholder') ?? 'Type your answer here…'}
        </p>
      )
    case 'date':
      return (
        <div className="flex items-end gap-3 font-serif text-[24px] text-fg-3">
          {(['Day', 'Month', 'Year'] as const).map((seg, i) => (
            <span key={seg} className="flex items-end gap-3">
              {i > 0 && <span aria-hidden="true">/</span>}
              <span className="grid gap-1.5">
                <span className="font-mono text-[11px] font-semibold tracking-[0.06em] text-fg-3 uppercase">
                  {seg}
                </span>
                <span className="border-b-2 border-brand/30 pb-1.5 text-center">
                  {seg === 'Year' ? 'YYYY' : seg.slice(0, 1).repeat(2)}
                </span>
              </span>
            </span>
          ))}
        </div>
      )
    case 'yes_no':
    case 'legal': {
      const labels = block.type === 'yes_no' ? ['Yes', 'No'] : ['I accept', "I don't accept"]
      return (
        <div className="grid max-w-[460px] gap-2.5">
          {labels.map((label, index) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-[11px] border-[1.5px] border-brand/30 bg-brand-soft/55 px-3.5 py-3 text-[16px] font-medium"
            >
              <span className="grid h-[22px] min-w-[22px] place-items-center rounded-[6px] border border-brand/35 font-mono text-[11px] font-semibold text-brand">
                {LETTERS[index]}
              </span>
              {label}
            </div>
          ))}
        </div>
      )
    }
    case 'opinion_scale':
    case 'nps': {
      const min = block.type === 'nps' ? 0 : numberProp(block, 'min', 1)
      const max = block.type === 'nps' ? 10 : numberProp(block, 'max', 5)
      const minLabel =
        stringProp(block, 'minLabel') ?? (block.type === 'nps' ? 'Not at all likely' : undefined)
      const maxLabel =
        stringProp(block, 'maxLabel') ?? (block.type === 'nps' ? 'Extremely likely' : undefined)
      const tiles = Array.from({ length: max - min + 1 }, (_, i) => min + i)
      return (
        <div>
          <div className="flex max-w-full flex-wrap gap-2">
            {tiles.map((n) => (
              <span
                key={n}
                className="grid size-[46px] place-items-center rounded-[12px] border border-line bg-surface-2 font-mono text-[17px] font-semibold tabular-nums"
              >
                {n}
              </span>
            ))}
          </div>
          {(minLabel !== undefined || maxLabel !== undefined) && (
            <div className="mt-2.5 flex justify-between text-[11.5px] text-fg-2">
              <span>{minLabel !== undefined ? `${min} — ${minLabel}` : ''}</span>
              <span>{maxLabel !== undefined ? `${max} — ${maxLabel}` : ''}</span>
            </div>
          )}
        </div>
      )
    }
    case 'dropdown':
      return null // dropdown edits its choices below
    default:
      return null
  }
}

const BADGE: Record<string, string> = {
  welcome: 'Welcome',
  statement: 'Statement',
  thankyou: 'Thank you',
}

export function Canvas() {
  const store = useBuilder()
  const state = useBuilderState()
  const block =
    state.doc.blocks.find((b) => b.id === state.selectedId) ?? state.doc.blocks[0] ?? null

  const answerable = state.doc.blocks.filter((b) => !SCREEN_TYPES.has(b.type))
  const questionNumber = block !== null ? answerable.findIndex((b) => b.id === block.id) + 1 : 0
  const isScreen = block !== null && SCREEN_TYPES.has(block.type)
  const isAi = block?.type === 'ai_followup'
  const isChoiceEditable = block?.type === 'multiple_choice' || block?.type === 'dropdown'

  return (
    <main className="relative min-h-0 overflow-y-auto bg-canvas">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background:var(--canvas-vignette)]"
      />
      {/* progress track — answerable blocks only (design §5) */}
      {answerable.length > 0 && (
        <div className="absolute top-7 left-1/2 h-[3px] w-[min(560px,60%)] -translate-x-1/2 rounded-full bg-line/70">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-200 ease-smooth"
            style={{
              width: `${questionNumber > 0 ? (questionNumber / answerable.length) * 100 : 0}%`,
            }}
          />
        </div>
      )}

      {block !== null && (
        <div
          key={block.id}
          className="relative mx-auto w-[min(720px,100%)] px-10 py-20 max-[720px]:px-6"
        >
          <div className="motion-safe:animate-[stage-in_420ms_var(--spring)_both]">
            {isScreen && (
              <span className="eyebrow mb-4 inline-block rounded-full border border-line px-3 py-1 text-fg-2">
                {BADGE[block.type]}
              </span>
            )}
            {isAi && (
              <span className="eyebrow mb-3.5 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-soft to-accent-soft px-3 py-1.5 text-brand">
                <Sparkles size={11} /> AI follow-up
              </span>
            )}
            {!isScreen && !isAi && questionNumber > 0 && (
              <p className="eyebrow mb-3.5 flex items-center gap-1.5 text-brand">
                Question {questionNumber} <CornerDownRight size={11} aria-hidden="true" />
              </p>
            )}

            <div className="flex items-start gap-1">
              <InlineEdit
                value={block.title}
                placeholder={isScreen ? 'Screen headline…' : 'Type your question…'}
                label={`${isScreen ? 'Screen' : 'Question'} title`}
                onChange={(title) => store.updateBlock(block.id, { title }, `title:${block.id}`)}
                className={`min-w-0 flex-1 font-serif text-[clamp(26px,3.4vw,40px)] leading-[1.18] font-semibold tracking-[-0.012em] [text-wrap:balance] ${
                  isAi
                    ? 'bg-gradient-to-r from-brand to-accent-strong bg-clip-text text-transparent'
                    : ''
                }`}
              />
              {block.required && (
                <span aria-hidden="true" className="mt-1 font-serif text-[26px] text-accent">
                  *
                </span>
              )}
            </div>

            <InlineEdit
              value={block.description ?? ''}
              placeholder="Add a description (optional)…"
              label="Description"
              onChange={(text) =>
                store.updateBlock(
                  block.id,
                  { description: text === '' ? undefined : text },
                  `desc:${block.id}`,
                )
              }
              className="mt-3 max-w-[56ch] text-[17px] leading-normal text-fg-2 [text-wrap:pretty]"
            />

            <div className="mt-8">
              {isChoiceEditable && <ChoiceEditor block={block} />}
              <AnswerMock block={block} />
              {isAi && (
                <div className="mt-5 max-w-[560px] rounded-[14px] border border-brand/40 border-dashed bg-brand-soft/40 px-4 py-3.5 text-[13.5px] text-fg-2 italic">
                  {stringProp(block, 'goal') ??
                    'Describe the goal in the panel — the AI improvises one focused follow-up.'}
                </div>
              )}
            </div>

            <div className="mt-8 flex items-center gap-3">
              <span className="rounded-[9px] bg-brand px-6 py-2.5 text-[16px] font-semibold text-on-brand shadow-sm">
                {isScreen
                  ? (stringProp(block, 'buttonText') ??
                    (block.type === 'welcome' ? 'Start' : 'Continue'))
                  : 'OK'}
              </span>
              {block.type !== 'thankyou' && (
                <span className="text-[12px] text-fg-2">
                  press{' '}
                  <kbd className="rounded-[5px] border border-line border-b-2 bg-surface-2 px-1.5 font-mono text-[11px]">
                    Enter ↵
                  </kbd>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
