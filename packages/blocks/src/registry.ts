// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { aiFollowup } from './ai'
import { dropdown, legal, multipleChoice, yesNo } from './choice'
import { email, phone, website } from './contact'
import { dateBlock, numberBlock } from './number-date'
import { nps, opinionScale } from './rating'
import { statement, thankyou, welcome } from './screens'
import { longText, shortText } from './text'
import type { BlockDefinition, PropertyValidationResult } from './types'

/**
 * The 17 v1 block types, in palette order (mirrors the v1 category table).
 * This array is the single registry every consumer derives from: the engine
 * seeds its default registry with it, the builder renders the palette from
 * it, and the API validates properties against its schemas.
 */
export const v1BlockDefinitions: readonly BlockDefinition[] = Object.freeze([
  shortText,
  longText,
  multipleChoice,
  dropdown,
  yesNo,
  legal,
  email,
  phone,
  website,
  numberBlock,
  dateBlock,
  opinionScale,
  nps,
  welcome,
  statement,
  thankyou,
  aiFollowup,
])

/** A fresh type → definition map (callers may extend their copy freely). */
export function createBlockRegistry(): Map<string, BlockDefinition> {
  return new Map(v1BlockDefinitions.map((definition) => [definition.type, definition]))
}

const byType = createBlockRegistry()

export function getBlockDefinition(type: string): BlockDefinition | undefined {
  return byType.get(type)
}

/**
 * Validates a block's `properties` against its type's Zod schema — the gate
 * the builder and API use before persisting a block. Returns the parsed
 * properties (with schema defaults filled in) or flattened issue strings.
 */
export function validateBlockProperties(
  type: string,
  properties: unknown,
): PropertyValidationResult {
  const definition = byType.get(type)
  if (definition === undefined) {
    return { ok: false, issues: [`unknown block type "${type}"`] }
  }
  const result = definition.propertySchema.safeParse(properties ?? {})
  if (!result.success) {
    return {
      ok: false,
      issues: result.error.issues.map((issue) =>
        issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
      ),
    }
  }
  return { ok: true, properties: result.data as Record<string, unknown> }
}
