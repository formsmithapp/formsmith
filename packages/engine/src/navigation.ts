// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { isTruthy, type ParsedForm } from './parse'
import type { Block } from './types'

/**
 * Pure navigation resolution over a parsed form and a rule-data snapshot.
 * The client engine and the server re-evaluation both call exactly these
 * functions — that shared path is what makes server truth match client UX.
 */

export function isBlockVisible(
  parsed: ParsedForm,
  block: Block,
  data: Record<string, unknown>,
): boolean {
  const rule = parsed.visibilityByBlockId.get(block.id)
  return rule === undefined || isTruthy(rule(data))
}

/** First visible block at or after `index` in document order, or `null`. */
export function firstVisibleFrom(
  parsed: ParsedForm,
  index: number,
  data: Record<string, unknown>,
): string | null {
  for (let i = index; i < parsed.blocks.length; i++) {
    const block = parsed.blocks[i]
    if (block !== undefined && isBlockVisible(parsed, block, data)) return block.id
  }
  return null
}

/**
 * The block after `fromId`: the first matching jump rule wins (a hidden jump target
 * falls through to the next visible block after it); otherwise document order.
 * `null` means the form is complete with no ending block.
 */
export function resolveNextId(
  parsed: ParsedForm,
  fromId: string,
  data: Record<string, unknown>,
): string | null {
  const fromIndex = parsed.indexById.get(fromId)
  if (fromIndex === undefined) return null
  for (const jump of parsed.jumpsByBlockId.get(fromId) ?? []) {
    if (isTruthy(jump.when(data))) {
      const targetIndex = parsed.indexById.get(jump.targetId)
      if (targetIndex !== undefined) return firstVisibleFrom(parsed, targetIndex, data)
    }
  }
  return firstVisibleFrom(parsed, fromIndex + 1, data)
}
