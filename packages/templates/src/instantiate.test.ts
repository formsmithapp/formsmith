// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { createEngine } from '@formsmithapp/engine'
import { describe, expect, it } from 'vitest'
import { TEMPLATES } from './index'
import { instantiateTemplate } from './instantiate'

describe('instantiateTemplate', () => {
  it.each(
    TEMPLATES.map((template) => [template.id, template] as const),
  )('%s: fresh ids everywhere, no dangling pointers, still engine-valid', (_id, template) => {
    const doc = instantiateTemplate(template)
    const originalBlockIds = new Set(template.document.blocks.map((b) => b.id))
    const originalRuleIds = new Set((template.document.logic ?? []).map((r) => r.id))
    const blockIds = new Set(doc.blocks.map((b) => b.id))
    const ruleIds = new Set((doc.logic ?? []).map((r) => r.id))

    expect(doc.id).not.toBe(template.document.id)
    expect(doc.version).toBeUndefined()
    for (const id of blockIds) expect(originalBlockIds.has(id)).toBe(false)
    for (const id of ruleIds) expect(originalRuleIds.has(id)).toBe(false)
    // refs are the stable public names — they must survive
    expect(doc.blocks.map((b) => b.ref)).toEqual(template.document.blocks.map((b) => b.ref))

    for (const rule of doc.logic ?? []) {
      if (rule.owner?.ref !== undefined) expect(blockIds.has(rule.owner.ref)).toBe(true)
      if (rule.action?.target !== undefined) expect(blockIds.has(rule.action.target)).toBe(true)
    }
    for (const block of doc.blocks) {
      if (block.visibility !== undefined) expect(ruleIds.has(block.visibility)).toBe(true)
    }
    expect(() => createEngine(doc, { mode: 'edit' })).not.toThrow()
  })

  it('two instantiations of the same template share no ids', () => {
    const template = TEMPLATES[0]
    if (template === undefined) throw new Error('fixture')
    const a = instantiateTemplate(template)
    const b = instantiateTemplate(template)
    const aIds = new Set([...a.blocks.map((x) => x.id), ...(a.logic ?? []).map((x) => x.id), a.id])
    for (const id of [...b.blocks.map((x) => x.id), ...(b.logic ?? []).map((x) => x.id), b.id]) {
      expect(aIds.has(id)).toBe(false)
    }
  })

  it('never mutates the template document', () => {
    const template = TEMPLATES[0]
    if (template === undefined) throw new Error('fixture')
    const before = JSON.stringify(template.document)
    instantiateTemplate(template)
    expect(JSON.stringify(template.document)).toBe(before)
  })
})
