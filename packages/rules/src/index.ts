// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * `@formsmithapp/rules` — JSONLogic rule validation and evaluation.
 *
 * Rules are untrusted input: every AST is validated (bounded depth/size,
 * operator allowlist, resolvable refs) before it can be evaluated.
 */

export * from './evaluate'
export * from './validate'
