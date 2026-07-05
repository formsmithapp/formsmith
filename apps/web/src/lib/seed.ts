// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { getBlockDefinition } from '@formsmithapp/blocks'
import type { Block, BlockType, FormDefinition } from '@formsmithapp/engine'
import { uniqueRef } from './slug'

export function makeBlock(type: BlockType, taken: ReadonlySet<string>): Block {
  const definition = getBlockDefinition(type)
  return {
    id: crypto.randomUUID(),
    ref: uniqueRef(type, taken),
    type,
    title: '',
    required: false,
    properties: structuredClone(definition?.defaultProperties ?? {}),
  }
}

/** A fresh form starts as the smallest useful skeleton. */
export function starterForm(id: string): FormDefinition {
  const welcome = makeBlock('welcome', new Set())
  const question = makeBlock('short_text', new Set([welcome.ref]))
  const ending = makeBlock('thankyou', new Set([welcome.ref, question.ref]))
  welcome.title = 'Hey there 👋'
  welcome.description = 'Mind answering a few quick questions?'
  question.title = ''
  ending.title = 'Thanks for your time!'
  return {
    id,
    title: 'Untitled form',
    blocks: [welcome, question, ending],
    logic: [],
    variables: [],
    settings: {},
  }
}
