// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { FormDefinition, Rule } from '@formsmithapp/engine'
import type { TemplateDefinition } from './types'

/**
 * Turns a template into a fresh form document: new form id, fresh block AND
 * rule ids, with every internal pointer remapped — rule `owner.ref` and jump
 * `action.target` (which reference block IDS in our documents) and
 * `block.visibility` (which references rule ids). Refs, logic shapes, and
 * the theme pass through untouched. Sharing ids between two forms created
 * from the same template would be a landmine for the db slice's uniqueness
 * assumptions — so nothing keeps its id.
 */
export function instantiateTemplate(template: TemplateDefinition): FormDefinition {
  const document = structuredClone(template.document)
  const blockIds = new Map<string, string>()
  const ruleIds = new Map<string, string>()

  for (const block of document.blocks) {
    const next = crypto.randomUUID()
    blockIds.set(block.id, next)
    block.id = next
  }
  const logic: Rule[] = document.logic ?? []
  for (const rule of logic) {
    const next = crypto.randomUUID()
    ruleIds.set(rule.id, next)
    rule.id = next
  }
  for (const rule of logic) {
    const owner = rule.owner?.ref
    if (owner !== undefined && blockIds.has(owner) && rule.owner !== undefined) {
      rule.owner = { ...rule.owner, ref: blockIds.get(owner) as string }
    }
    const target = rule.action?.target
    if (target !== undefined && blockIds.has(target) && rule.action !== undefined) {
      rule.action = { ...rule.action, target: blockIds.get(target) as string }
    }
  }
  for (const block of document.blocks) {
    if (block.visibility !== undefined) {
      block.visibility = ruleIds.get(block.visibility) ?? block.visibility
    }
  }

  return { ...document, id: crypto.randomUUID(), version: undefined }
}
