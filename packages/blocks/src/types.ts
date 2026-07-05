// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { z } from 'zod'

/**
 * Palette groups. These are data slugs — display labels ("Number & date"),
 * ordering, and icons live in the renderer/builder, never here.
 */
export type BlockCategory = 'text' | 'choice' | 'contact' | 'number' | 'rating' | 'screen' | 'ai'

/**
 * The minimal structural view of a block that answer validation needs.
 * Deliberately a supertype of the engine's `Block`, so these validators plug
 * into the engine registry without this package importing the engine
 * (which would create a dependency cycle).
 */
export interface BlockLike {
  type: string
  required?: boolean
  properties?: Record<string, unknown>
}

/**
 * The block-type contract shared by the engine (answer validation,
 * is-answerable), the builder (property editing), and the renderer
 * (presentation metadata). One entry per block type; adding a type is
 * adding one of these — the engine and renderer stay generic.
 */
export interface BlockDefinition {
  /** Stable type slug stored in form documents, e.g. `short_text`. */
  type: string
  category: BlockCategory
  /** Human name for the builder palette, e.g. "Short text". */
  displayName: string
  /** One-line description for the palette/help surfaces. */
  description: string
  /** Icon *key* — the renderer maps it to an actual icon component. */
  iconKey: string
  /** Screens (welcome/statement/thankyou) are false — excluded from numbering/progress. */
  isAnswerable: boolean
  /**
   * Builder-editable config a fresh block starts with. Passes `propertySchema`
   * for every type except `ai_followup`, whose goal/fallback must be authored.
   */
  defaultProperties: Record<string, unknown>
  /**
   * The Zod source of truth for this block's config — used by the builder
   * panel and API validation. `strictObject`: unknown keys are rejected.
   */
  propertySchema: z.ZodType
  /**
   * Intrinsic validation of a non-empty answer value. Returns messages, `[]`
   * means valid. Required/empty handling and the generic constraint layer
   * (custom messages) are the engine's job. Absent on screens.
   */
  validate?: (value: unknown, block: BlockLike) => string[]
}

/** Result of {@link validateBlockProperties} — Zod issues flattened to strings. */
export type PropertyValidationResult =
  | { ok: true; properties: Record<string, unknown> }
  | { ok: false; issues: string[] }
