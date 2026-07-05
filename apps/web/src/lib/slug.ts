// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Ref hygiene is builder-owned: refs are dot-free slugs, unique per form,
 * and never one of the engine's reserved words. Refs are generated ONCE at
 * insert (from the block type) and stay stable across title edits — piping
 * tokens reference them, so renaming on title change would break recall.
 */

const RESERVED = new Set(['var', 'block', 'field', 'hidden'])

export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, '_$1')
    .slice(0, 40)
  return slug === '' || RESERVED.has(slug) ? `${slug === '' ? 'field' : slug}_1` : slug
}

export function uniqueRef(base: string, taken: ReadonlySet<string>): string {
  const root = slugify(base)
  if (!taken.has(root)) return root
  for (let n = 2; ; n++) {
    const candidate = `${root}_${n}`
    if (!taken.has(candidate)) return candidate
  }
}

export function isValidRef(ref: string, taken: ReadonlySet<string>): boolean {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(ref) && !RESERVED.has(ref) && !taken.has(ref)
}
