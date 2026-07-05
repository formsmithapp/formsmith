// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { FormDefinition } from '@formsmithapp/engine'

/** A starter template: metadata for the picker + the seed document. */
export interface TemplateDefinition {
  id: string
  name: string
  description: string
  /** Hex accent for the picker card (matches the template's own theme). */
  accent: string
  /** Featured templates lead the gallery. */
  featured?: boolean
  /**
   * The seed `FormDefinition` — blocks, logic (canonical shapes the builder
   * can decompile), and a theme. Never used directly: `instantiateTemplate`
   * re-ids it first.
   */
  document: FormDefinition
}
