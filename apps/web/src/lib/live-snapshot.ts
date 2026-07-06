// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { formsRepository } from '@formsmithapp/db'
import type { FormDefinition } from '@formsmithapp/engine'
import { getDb } from './db'

/** The `/f/:id` data rule, shared by the page and its og:image — always the
 * LATEST PUBLISHED SNAPSHOT, never the draft. */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function loadPublicSnapshot(id: string): Promise<FormDefinition | null> {
  if (!UUID_RE.test(id)) return null
  return formsRepository(getDb()).getPublicSnapshot(id)
}
