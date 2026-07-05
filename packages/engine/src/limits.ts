// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { SubmissionLimits } from './types'

export const DEFAULT_SUBMISSION_LIMITS: Readonly<Required<SubmissionLimits>> = {
  maxStringLength: 10_000,
  maxArrayLength: 100,
  maxHiddenLength: 1_000,
  maxTotalBytes: 262_144,
}
