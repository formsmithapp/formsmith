// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { eq } from 'drizzle-orm'
import type { Database } from '../client'
import { memberships, workspaces } from '../schema'

/**
 * Workspace + membership bootstrap. Personal workspace creation is ONE
 * transaction — a user without a workspace is an invariant violation.
 */

export async function createWorkspaceWithOwner(
  db: Database,
  userId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  return db.transaction(async (tx) => {
    const [workspace] = await tx.insert(workspaces).values({ name }).returning()
    if (workspace === undefined) throw new Error('workspace insert returned nothing')
    await tx.insert(memberships).values({ userId, workspaceId: workspace.id })
    return { id: workspace.id, name: workspace.name }
  })
}

/** The user's first workspace (v1 UI is single-workspace; the model isn't). */
export async function workspaceForUser(
  db: Database,
  userId: string,
): Promise<{ id: string; name: string; role: string } | null> {
  const rows = await db
    .select({ id: workspaces.id, name: workspaces.name, role: memberships.role })
    .from(memberships)
    .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
    .where(eq(memberships.userId, userId))
    .orderBy(workspaces.createdAt)
    .limit(1)
  return rows[0] ?? null
}
