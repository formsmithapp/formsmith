// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Results math now lives in `@formsmithapp/engine` so the builder Results view
 * and the server summary/export endpoints share one implementation and can
 * never drift. This module stays as the web-side entry point; StoredResponse is
 * structurally a ResultsResponse, so existing callers pass through unchanged.
 */

export {
  csvHeader,
  csvRow,
  exportRefs,
  formatAnswer,
  isAnswered,
  type QuestionSummary,
  type ResultsResponse,
  type SummaryBlock,
  summarize,
  toCsv,
  toJson,
} from '@formsmithapp/engine'
