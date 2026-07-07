// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq, gte, sql } from 'drizzle-orm'
import type { Database } from '../client'
import { workspaceAiCredits } from '../schema'

/**
 * AI credit ledger (v0.1.5). Billing state must fail CLOSED, so this lives in
 * Postgres (never the fail-open cache): the decrement is a single atomic
 * `UPDATE ... WHERE remaining >= cost RETURNING`, and zero rows updated means
 * exhausted. The row is granted lazily at the first charge (idempotent
 * insert), so pre-existing workspaces and fresh signups behave identically and
 * no one is ever locked out by a missing row.
 *
 * The whole feature is gated by `FORMSMITH_AI_CREDITS_DEFAULT` at the API
 * layer: unset = unlimited, `charge` is never called, no row exists.
 */

export interface CreditState {
  remaining: number
  granted: number
}

export function creditsRepository(db: Database) {
  return {
    /**
     * Ensure the ledger row exists at `grant`, then atomically spend `cost`.
     * Returns the new remaining balance, or null when exhausted (the balance
     * was below `cost`, so zero rows were updated and nothing was spent).
     */
    async charge(workspaceId: string, cost: number, grant: number): Promise<number | null> {
      await db
        .insert(workspaceAiCredits)
        .values({ workspaceId, remaining: grant, granted: grant })
        .onConflictDoNothing()
      const [row] = await db
        .update(workspaceAiCredits)
        .set({
          remaining: sql`${workspaceAiCredits.remaining} - ${cost}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(workspaceAiCredits.workspaceId, workspaceId),
            gte(workspaceAiCredits.remaining, cost),
          ),
        )
        .returning({ remaining: workspaceAiCredits.remaining })
      return row?.remaining ?? null
    },

    /** Current ledger state, or null when the workspace has no row yet. */
    async get(workspaceId: string): Promise<CreditState | null> {
      const [row] = await db
        .select({
          remaining: workspaceAiCredits.remaining,
          granted: workspaceAiCredits.granted,
        })
        .from(workspaceAiCredits)
        .where(eq(workspaceAiCredits.workspaceId, workspaceId))
        .limit(1)
      return row ?? null
    },
  }
}

export type CreditsDbRepository = ReturnType<typeof creditsRepository>
