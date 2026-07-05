// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Block } from '@formsmithapp/engine'

/** Props every answer control receives from the question shell. */
export interface ControlProps {
  block: Block
  /** Id of the question title element — controls label themselves with it. */
  labelId: string
  /** Id of the description element, when one exists. */
  descId?: string
  /** Id of the visible error message, when one is showing. */
  errorId?: string
  invalid: boolean
}

export function describedBy(props: ControlProps): string | undefined {
  const ids = [props.descId, props.errorId].filter(Boolean)
  return ids.length > 0 ? ids.join(' ') : undefined
}

export function placeholderOf(block: Block, fallback = 'Type your answer here…'): string {
  const raw = block.properties?.placeholder
  return typeof raw === 'string' && raw !== '' ? raw : fallback
}
