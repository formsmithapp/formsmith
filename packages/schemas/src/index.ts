// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

// Reused, not rewritten: the theme vocabulary has ONE owner (@formsmithapp/ui).
export { type ThemeConfig, themeConfigSchema } from '@formsmithapp/ui'
export { type FormDocumentShape, formDocumentSchema } from './document'
export {
  type CreateApiKeyInput,
  type CreateFormInput,
  type CreateWebhookInput,
  createApiKeyInput,
  createFormInput,
  createWebhookInput,
  type ImportFormEntry,
  type ImportInput,
  importFormEntry,
  importInput,
  type PaginationInput,
  paginationInput,
  type ResponseDto,
  responseDto,
  type SubmissionInput,
  submissionInput,
  type UpdateFormInput,
  updateFormInput,
} from './dto'
