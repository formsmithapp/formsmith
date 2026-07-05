// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { v1BlockDefinitions } from '@formsmithapp/blocks'
import type { Block } from './types'

/**
 * The runtime subset of the block-type contract the engine consumes: whether
 * a block collects an answer, and its intrinsic value validation. The full
 * contract (Zod property schemas, builder defaults, presentation metadata)
 * lives in `@formsmithapp/blocks`, whose definitions satisfy this interface
 * structurally; `createEngine({ registry })` remains the seam for overrides
 * and custom types — the engine itself stays generic.
 */
export interface BlockTypeDef {
  type: string
  isAnswerable: boolean
  /** Intrinsic type/shape check for a non-empty value. Returns messages; `[]` means valid. */
  validate?: (value: unknown, block: Block) => string[]
}

export type BlockRegistry = ReadonlyMap<string, BlockTypeDef>

/** Empty means unanswered: `undefined`, `null`, `''`, or `[]`. (`false` is a real answer.) */
export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (value === '') return true
  return Array.isArray(value) && value.length === 0
}

/** The 17 v1 block types from `@formsmithapp/blocks`, plus any overrides/extensions. */
export function createDefaultRegistry(extra?: Iterable<BlockTypeDef>): Map<string, BlockTypeDef> {
  const registry = new Map<string, BlockTypeDef>()
  for (const def of v1BlockDefinitions) registry.set(def.type, def)
  if (extra) for (const def of extra) registry.set(def.type, def)
  return registry
}
