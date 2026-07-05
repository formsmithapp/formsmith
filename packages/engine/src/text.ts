// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { PipeOptions } from './types'

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ENTITIES[char] ?? char)
}

/** `{{ref}}` / `{{var}}` recall tokens; dot segments address nested values. */
const TOKEN_RE = /\{\{\s*([A-Za-z_][A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+)*)\s*\}\}/g

export function resolvePath(data: Record<string, unknown>, path: string): unknown {
  let current: unknown = data
  for (const segment of path.split('.')) {
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      current = current[Number(segment)]
    } else if (current !== null && typeof current === 'object') {
      current = (current as Record<string, unknown>)[segment]
    } else {
      return undefined
    }
  }
  return current
}

export function formatPipeValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map(formatPipeValue).join(', ')
  if (typeof value === 'object') return JSON.stringify(value) ?? ''
  return String(value)
}

/**
 * Resolves `{{token}}` occurrences against `data`. Values are HTML-escaped by default —
 * piped answers are an injection surface. Unresolved tokens render as the empty string.
 */
export function pipeText(
  text: string,
  data: Record<string, unknown>,
  options?: PipeOptions,
): string {
  const shouldEscape = options?.escape !== false
  return text.replace(TOKEN_RE, (_match, path: string) => {
    const formatted = formatPipeValue(resolvePath(data, path))
    return shouldEscape ? escapeHtml(formatted) : formatted
  })
}
