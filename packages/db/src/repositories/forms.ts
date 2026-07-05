// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { FormDefinition } from '@formsmithapp/engine'
import { and, desc, eq } from 'drizzle-orm'
import type { Database } from '../client'
import { forms, formVersions } from '../schema'

/**
 * Forms persistence — the server-side twin of the web app's FormsRepository
 * seam, with one addition: EVERY method takes a workspaceId and every query
 * is row-scoped to it (architecture §7.3 — tenant isolation lives in the
 * data layer, not in callers remembering to filter).
 *
 * Deliberately dumb: no publish validation, no submission evaluation — those
 * are the API service layer's job (S2), exactly where the localStorage
 * repositories rehearse them today.
 */

export interface FormRow {
  id: string
  workspaceId: string
  title: string
  doc: FormDefinition
  status: 'draft' | 'published'
  publishedVersion: number | null
  createdAt: Date
  updatedAt: Date
}

const scoped = (workspaceId: string, formId: string) =>
  and(eq(forms.workspaceId, workspaceId), eq(forms.id, formId))

export function formsRepository(db: Database) {
  return {
    async list(workspaceId: string): Promise<FormRow[]> {
      return db
        .select()
        .from(forms)
        .where(eq(forms.workspaceId, workspaceId))
        .orderBy(desc(forms.updatedAt))
    },

    async get(workspaceId: string, formId: string): Promise<FormRow | null> {
      const rows = await db.select().from(forms).where(scoped(workspaceId, formId)).limit(1)
      return rows[0] ?? null
    },

    /** The row id is server-authoritative — the doc's id is rewritten to it. */
    async create(workspaceId: string, doc: FormDefinition, title?: string): Promise<FormRow> {
      const [row] = await db
        .insert(forms)
        .values({ workspaceId, title: title ?? doc.title ?? 'Untitled form', doc })
        .returning()
      if (row === undefined) throw new Error('form insert returned nothing')
      const withId = { ...doc, id: row.id }
      const [updated] = await db
        .update(forms)
        .set({ doc: withId })
        .where(eq(forms.id, row.id))
        .returning()
      return updated ?? { ...row, doc: withId }
    },

    async save(workspaceId: string, formId: string, doc: FormDefinition): Promise<boolean> {
      const rows = await db
        .update(forms)
        .set({ doc, title: doc.title ?? 'Untitled form', updatedAt: new Date() })
        .where(scoped(workspaceId, formId))
        .returning({ id: forms.id })
      return rows.length > 0
    },

    /** Version bump + immutable snapshot, one transaction. Validation is the caller's job. */
    async publish(workspaceId: string, formId: string): Promise<{ version: number } | null> {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(forms).where(scoped(workspaceId, formId)).limit(1)
        const form = rows[0]
        if (form === undefined) return null
        const version = (form.publishedVersion ?? 0) + 1
        const snapshot: FormDefinition = { ...form.doc, version }
        await tx.insert(formVersions).values({ formId, version, doc: snapshot })
        await tx
          .update(forms)
          .set({
            doc: snapshot,
            status: 'published',
            publishedVersion: version,
            updatedAt: new Date(),
          })
          .where(eq(forms.id, formId))
        return { version }
      })
    },

    async getSnapshot(
      workspaceId: string,
      formId: string,
      version: number,
    ): Promise<FormDefinition | null> {
      const rows = await db
        .select({ doc: formVersions.doc })
        .from(formVersions)
        .innerJoin(forms, eq(formVersions.formId, forms.id))
        .where(and(scoped(workspaceId, formId), eq(formVersions.version, version)))
        .limit(1)
      return rows[0]?.doc ?? null
    },

    /** Unscoped snapshot read — the PUBLIC serve path (S2's GET /f/:id). */
    async getPublicSnapshot(formId: string): Promise<FormDefinition | null> {
      const rows = await db
        .select({ doc: formVersions.doc, publishedVersion: forms.publishedVersion })
        .from(forms)
        .innerJoin(
          formVersions,
          and(eq(formVersions.formId, forms.id), eq(formVersions.version, forms.publishedVersion)),
        )
        .where(eq(forms.id, formId))
        .limit(1)
      return rows[0]?.doc ?? null
    },

    async duplicate(workspaceId: string, formId: string): Promise<FormRow | null> {
      const source = await this.get(workspaceId, formId)
      if (source === null) return null
      const title = `${source.title} (copy)`
      return this.create(workspaceId, { ...source.doc, version: undefined, title }, title)
    },

    async remove(workspaceId: string, formId: string): Promise<boolean> {
      const rows = await db
        .delete(forms)
        .where(scoped(workspaceId, formId))
        .returning({ id: forms.id })
      return rows.length > 0 // versions + responses cascade via FK
    },
  }
}

export type FormsDbRepository = ReturnType<typeof formsRepository>
