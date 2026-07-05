// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { computeVariables } from './compute'
import { EngineError } from './errors'
import { DEFAULT_SUBMISSION_LIMITS } from './limits'
import { firstVisibleFrom, isBlockVisible, resolveNextId } from './navigation'
import {
  buildRuleData,
  isAnswerable,
  isEnding,
  type ParsedForm,
  parseForm,
  resolveBlock,
} from './parse'
import { type BlockTypeDef, isEmptyValue } from './registry'
import { createStore, type EngineStore } from './store'
import { pipeText } from './text'
import type {
  Block,
  EngineEvents,
  EngineState,
  FormDefinition,
  Mode,
  NavResult,
  PipeOptions,
  Progress,
  SerializedEngineState,
} from './types'
import { validateBlockValue } from './validation'

export interface EngineOptions {
  /** Defaults to `'runtime'`. */
  mode?: Mode
  /** Extra or overriding block-type definitions. */
  registry?: Iterable<BlockTypeDef>
  /** Hidden-field prefill (e.g. from the URL). Only names declared on the form are kept. */
  hiddenFields?: Record<string, string>
}

/** The engine surface. Also satisfies `EngineStore<EngineState>` — the framework bridge. */
export interface FormEngine extends EngineStore<EngineState> {
  readonly mode: Mode
  getCurrentBlock(): Block | null
  getVisibleBlocks(): Block[]
  setAnswer(ref: string, value: unknown): void
  next(): NavResult
  prev(): NavResult
  goTo(target: string): NavResult
  reset(): void
  validate(ref: string): string[]
  validateAll(): { ok: boolean; errors: Record<string, string[]> }
  computeVariables(): Record<string, unknown>
  pipe(text: string, options?: PipeOptions): string
  progress(): Progress
  serialize(): SerializedEngineState
  hydrate(snapshot: SerializedEngineState): void
  on<E extends keyof EngineEvents>(
    event: E,
    handler: (payload: EngineEvents[E]) => void,
  ): () => void
}

function sanitizeHidden(
  declared: readonly string[],
  input: Record<string, string> | undefined,
): Record<string, string> {
  const hidden: Record<string, string> = {}
  if (input === null || typeof input !== 'object') return hidden
  const cap = DEFAULT_SUBMISSION_LIMITS.maxHiddenLength
  for (const name of declared) {
    const value = input[name]
    if (value !== undefined) hidden[name] = String(value).slice(0, cap)
  }
  return hidden
}

/**
 * Hidden-field/URL prefill helper: picks the form's declared hidden fields out of a
 * query string (`URLSearchParams` is a web standard — isomorphic by construction).
 */
export function extractHiddenFields(form: FormDefinition, search: string): Record<string, string> {
  const params = new URLSearchParams(search)
  const hidden: Record<string, string> = {}
  const cap = DEFAULT_SUBMISSION_LIMITS.maxHiddenLength
  for (const name of form.settings?.hiddenFields ?? []) {
    const value = params.get(name)
    if (value !== null) hidden[name] = value.slice(0, cap)
  }
  return hidden
}

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  return keysA.every((key) => Object.is(a[key], b[key]))
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function createEngine(form: FormDefinition, options: EngineOptions = {}): FormEngine {
  const mode = options.mode ?? 'runtime'
  const parsed: ParsedForm = parseForm(form, options.registry)
  const prefillHidden = sanitizeHidden(parsed.hiddenFieldNames, options.hiddenFields)

  const handlers = {
    answer: new Set<(payload: EngineEvents['answer']) => void>(),
    navigate: new Set<(payload: EngineEvents['navigate']) => void>(),
    complete: new Set<(payload: EngineEvents['complete']) => void>(),
  }

  function emit<E extends keyof EngineEvents>(event: E, payload: EngineEvents[E]): void {
    const listeners = handlers[event] as Set<(payload: EngineEvents[E]) => void>
    for (const handler of [...listeners]) handler(payload)
  }

  function initialState(): EngineState {
    const answers: Record<string, unknown> = {}
    const variables = computeVariables(parsed, answers, prefillHidden)
    const data = buildRuleData(answers, variables, prefillHidden)
    const firstId = firstVisibleFrom(parsed, 0, data)
    const first = firstId !== null ? parsed.byId.get(firstId) : undefined
    const completed =
      firstId === null || (first !== undefined && isEnding(first) && mode !== 'edit')
    return {
      status: completed ? 'complete' : 'in_progress',
      currentId: firstId,
      answers,
      variables,
      hidden: { ...prefillHidden },
      errors: {},
      history: [],
    }
  }

  const store = createStore<EngineState>(initialState())

  const stateData = (state: EngineState): Record<string, unknown> =>
    buildRuleData(state.answers, state.variables, state.hidden)

  function currentBlock(state: EngineState): Block | null {
    return state.currentId !== null ? (parsed.byId.get(state.currentId) ?? null) : null
  }

  function visibleBlocks(state: EngineState): Block[] {
    const data = stateData(state)
    return parsed.blocks.filter((block) => isBlockVisible(parsed, block, data))
  }

  function advance(
    state: EngineState,
    variables: Record<string, unknown>,
    nextId: string | null,
  ): NavResult {
    const from = state.currentId
    const nextBlock = nextId !== null ? (parsed.byId.get(nextId) ?? null) : null
    const completed = nextId === null || (nextBlock !== null && isEnding(nextBlock))
    const next: EngineState = {
      ...state,
      status: completed ? 'complete' : 'in_progress',
      currentId: nextId,
      variables,
      errors: {},
      history: from !== null ? [...state.history, from] : state.history,
    }
    store.setState(next)
    emit('navigate', { from, to: nextId })
    if (completed) emit('complete', { answers: next.answers, variables: next.variables })
    return { ok: true, block: nextBlock }
  }

  const engine: FormEngine = {
    mode,
    getState: () => store.getState(),
    subscribe: (listener) => store.subscribe(listener),

    getCurrentBlock: () => currentBlock(store.getState()),
    getVisibleBlocks: () => visibleBlocks(store.getState()),

    setAnswer(ref, value) {
      const block = resolveBlock(parsed, ref)
      if (block === undefined)
        throw new EngineError('unknown_ref', `setAnswer: unknown block "${ref}"`)
      if (!isAnswerable(parsed.registry, block)) {
        throw new EngineError('not_answerable', `setAnswer: block "${ref}" does not take answers`)
      }
      const state = store.getState()
      if (state.status === 'complete' && mode !== 'edit') {
        throw new EngineError('complete', 'setAnswer: the form is already complete')
      }
      const answers = { ...state.answers }
      if (value === undefined) delete answers[block.ref]
      else answers[block.ref] = value
      const variables = computeVariables(parsed, answers, state.hidden)
      const errors = { ...state.errors }
      delete errors[block.ref]
      store.setState({ ...state, answers, variables, errors })
      emit('answer', { ref: block.ref, value })
    },

    next() {
      const state = store.getState()
      if (state.status === 'complete') return { ok: true, block: currentBlock(state) }
      const from = currentBlock(state)
      if (from === null) return advance(state, state.variables, null)
      const variables = computeVariables(parsed, state.answers, state.hidden)
      const data = buildRuleData(state.answers, variables, state.hidden)
      if (
        mode !== 'edit' &&
        isAnswerable(parsed.registry, from) &&
        isBlockVisible(parsed, from, data)
      ) {
        const errors = validateBlockValue(from, state.answers[from.ref], parsed.registry)
        if (errors.length > 0) {
          store.setState({ ...state, variables, errors: { ...state.errors, [from.ref]: errors } })
          return { ok: false, block: from, errors }
        }
      }
      return advance({ ...state, variables }, variables, resolveNextId(parsed, from.id, data))
    },

    prev() {
      const state = store.getState()
      if (state.status === 'complete' && mode !== 'edit') {
        return { ok: false, block: currentBlock(state) }
      }
      const prevId = state.history[state.history.length - 1]
      if (prevId === undefined) return { ok: false, block: currentBlock(state) }
      const next: EngineState = {
        ...state,
        status: 'in_progress',
        currentId: prevId,
        history: state.history.slice(0, -1),
      }
      store.setState(next)
      emit('navigate', { from: state.currentId, to: prevId })
      return { ok: true, block: currentBlock(next) }
    },

    goTo(target) {
      const block = resolveBlock(parsed, target)
      if (block === undefined)
        throw new EngineError('unknown_block', `goTo: unknown block "${target}"`)
      const state = store.getState()
      if (state.status === 'complete' && mode !== 'edit') {
        return { ok: false, block: currentBlock(state) }
      }
      const variables = computeVariables(parsed, state.answers, state.hidden)
      const data = buildRuleData(state.answers, variables, state.hidden)
      if (mode !== 'edit' && !isBlockVisible(parsed, block, data)) {
        return {
          ok: false,
          block: currentBlock(state),
          errors: [`Block "${target}" is not visible`],
        }
      }
      const completed = mode !== 'edit' && isEnding(block)
      const next: EngineState = {
        ...state,
        status: completed ? 'complete' : 'in_progress',
        currentId: block.id,
        variables,
        history:
          state.currentId !== null && state.currentId !== block.id
            ? [...state.history, state.currentId]
            : state.history,
      }
      store.setState(next)
      emit('navigate', { from: state.currentId, to: block.id })
      if (completed) emit('complete', { answers: next.answers, variables: next.variables })
      return { ok: true, block }
    },

    reset() {
      store.setState(initialState())
    },

    validate(ref) {
      const block = resolveBlock(parsed, ref)
      if (block === undefined)
        throw new EngineError('unknown_ref', `validate: unknown block "${ref}"`)
      return validateBlockValue(block, store.getState().answers[block.ref], parsed.registry)
    },

    validateAll() {
      const state = store.getState()
      const errors: Record<string, string[]> = {}
      for (const block of visibleBlocks(state)) {
        if (!isAnswerable(parsed.registry, block)) continue
        const messages = validateBlockValue(block, state.answers[block.ref], parsed.registry)
        if (messages.length > 0) errors[block.ref] = messages
      }
      return { ok: Object.keys(errors).length === 0, errors }
    },

    computeVariables() {
      const state = store.getState()
      const variables = computeVariables(parsed, state.answers, state.hidden)
      if (!shallowEqual(variables, state.variables)) store.setState({ ...state, variables })
      return { ...variables }
    },

    pipe(text, options) {
      return pipeText(text, stateData(store.getState()), options)
    },

    progress() {
      const state = store.getState()
      const answerable = visibleBlocks(state).filter((block) =>
        isAnswerable(parsed.registry, block),
      )
      const total = answerable.length
      const answered = answerable.filter((block) => !isEmptyValue(state.answers[block.ref])).length
      const ratio = total === 0 ? (state.status === 'complete' ? 1 : 0) : answered / total
      return { answered, total, ratio }
    },

    serialize() {
      const state = store.getState()
      return structuredClone({
        v: 1 as const,
        formId: parsed.form.id,
        formVersion: parsed.form.version,
        status: state.status,
        currentId: state.currentId,
        answers: state.answers,
        variables: state.variables,
        hidden: state.hidden,
        history: state.history,
      })
    },

    hydrate(snapshot) {
      if (!isPlainObject(snapshot) || snapshot.v !== 1) {
        throw new EngineError('bad_snapshot', 'hydrate: unrecognized snapshot shape')
      }
      if (snapshot.formId !== parsed.form.id) {
        throw new EngineError('form_mismatch', 'hydrate: snapshot belongs to a different form')
      }
      const answers: Record<string, unknown> = {}
      if (isPlainObject(snapshot.answers)) {
        for (const [ref, value] of Object.entries(snapshot.answers)) {
          const block = parsed.byRef.get(ref)
          if (block !== undefined && isAnswerable(parsed.registry, block)) answers[ref] = value
        }
      }
      const hidden = sanitizeHidden(
        parsed.hiddenFieldNames,
        isPlainObject(snapshot.hidden) ? (snapshot.hidden as Record<string, string>) : undefined,
      )
      // Variables are always recomputed — a snapshot's variables are client state, not truth.
      const variables = computeVariables(parsed, answers, hidden)
      const history = Array.isArray(snapshot.history)
        ? snapshot.history.filter(
            (id): id is string => typeof id === 'string' && parsed.byId.has(id),
          )
        : []
      let currentId =
        typeof snapshot.currentId === 'string' && parsed.byId.has(snapshot.currentId)
          ? snapshot.currentId
          : null
      let status: EngineState['status'] =
        snapshot.status === 'complete' ? 'complete' : 'in_progress'
      if (status === 'in_progress' && currentId === null) {
        const data = buildRuleData(answers, variables, hidden)
        currentId = firstVisibleFrom(parsed, 0, data)
        if (currentId === null) status = 'complete'
      }
      store.setState(
        structuredClone({ status, currentId, answers, variables, hidden, errors: {}, history }),
      )
    },

    on(event, handler) {
      handlers[event].add(handler as never)
      return () => {
        handlers[event].delete(handler as never)
      }
    },
  }

  return engine
}
