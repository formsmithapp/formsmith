// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { FormDefinition } from '@formsmithapp/engine'
import { starterForm } from '../seed'
import { validateForm } from '../validate-form'
import {
  type FormSummary,
  type FormsRepository,
  PublishValidationError,
  type StoredForm,
} from './types'

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const INDEX_KEY = 'fs.forms'
const formKey = (id: string) => `fs.form.${id}`
const snapshotKey = (id: string, version: number) => `fs.form.${id}.v${version}`

/**
 * M1 persistence: the whole repository on localStorage. Draft docs live at
 * `fs.form.{id}`; published versions are immutable snapshots at
 * `fs.form.{id}.v{n}` — the same semantic the `form_versions` table will
 * have. The api-backed implementation replaces this class wholesale.
 */
export class LocalStorageFormsRepository implements FormsRepository {
  constructor(private readonly storage: StorageLike) {}

  private readJson<T>(key: string): T | null {
    const raw = this.storage.getItem(key)
    if (raw === null) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  private readIndex(): FormSummary[] {
    return this.readJson<FormSummary[]>(INDEX_KEY) ?? []
  }

  private writeIndex(index: FormSummary[]): void {
    this.storage.setItem(INDEX_KEY, JSON.stringify(index))
  }

  private updateIndexEntry(stored: StoredForm & { id: string }): void {
    const summary: FormSummary = {
      id: stored.id,
      title: stored.form.title ?? 'Untitled form',
      status: stored.status,
      publishedVersion: stored.publishedVersion,
      blockCount: stored.form.blocks.length,
      updatedAt: stored.updatedAt,
    }
    const index = this.readIndex().filter((entry) => entry.id !== stored.id)
    this.writeIndex([summary, ...index])
  }

  private write(id: string, stored: StoredForm): void {
    this.storage.setItem(formKey(id), JSON.stringify(stored))
    this.updateIndexEntry({ ...stored, id })
  }

  async list(): Promise<FormSummary[]> {
    return this.readIndex()
  }

  async get(id: string): Promise<StoredForm | null> {
    return this.readJson<StoredForm>(formKey(id))
  }

  async create(seed?: FormDefinition): Promise<StoredForm> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const form = seed ? { ...seed, id } : starterForm(id)
    const stored: StoredForm = { form, status: 'draft', createdAt: now, updatedAt: now }
    this.write(id, stored)
    return stored
  }

  async save(id: string, form: FormDefinition): Promise<void> {
    const existing = await this.get(id)
    if (existing === null) throw new Error(`save: unknown form "${id}"`)
    this.write(id, { ...existing, form, updatedAt: new Date().toISOString() })
  }

  async publish(id: string): Promise<{ version: number }> {
    const existing = await this.get(id)
    if (existing === null) throw new Error(`publish: unknown form "${id}"`)
    const issues = validateForm(existing.form)
    if (issues.length > 0) throw new PublishValidationError(issues)

    const version = (existing.publishedVersion ?? 0) + 1
    const snapshot: FormDefinition = { ...existing.form, version }
    this.storage.setItem(snapshotKey(id, version), JSON.stringify(snapshot))
    this.write(id, {
      ...existing,
      form: { ...existing.form, version },
      status: 'published',
      publishedVersion: version,
      updatedAt: new Date().toISOString(),
    })
    return { version }
  }

  async getSnapshot(id: string, version: number): Promise<FormDefinition | null> {
    return this.readJson<FormDefinition>(snapshotKey(id, version))
  }

  async duplicate(id: string): Promise<StoredForm> {
    const existing = await this.get(id)
    if (existing === null) throw new Error(`duplicate: unknown form "${id}"`)
    const copyId = crypto.randomUUID()
    const now = new Date().toISOString()
    const stored: StoredForm = {
      form: {
        ...existing.form,
        id: copyId,
        title: `${existing.form.title ?? 'Untitled form'} (copy)`,
        version: undefined,
      },
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    }
    this.write(copyId, stored)
    return stored
  }

  async remove(id: string): Promise<void> {
    const existing = await this.get(id)
    const versions = existing?.publishedVersion ?? 0
    for (let v = 1; v <= versions; v++) this.storage.removeItem(snapshotKey(id, v))
    this.storage.removeItem(formKey(id))
    this.writeIndex(this.readIndex().filter((entry) => entry.id !== id))
  }
}
