// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * `@formsmithapp/renderer` — the thin view over the Formsmith form engine:
 * the immersive one-question stage, spring transitions, keyboard-first
 * interaction, and optimistic submission. All navigation, visibility,
 * validation, and piping decisions come from the engine; this package only
 * renders them. Import `@formsmithapp/renderer/styles.css` (tokens +
 * components) and `@formsmithapp/renderer/fonts.css` (self-hosted webfonts).
 */

export { FormRuntime, type FormRuntimeProps } from './FormRuntime'
export { type MountedForm, type MountOptions, mount } from './mount'
export {
  createRetryQueue,
  type QueueStatus,
  type RetryQueue,
  type SubmissionPayload,
  type SubmitFn,
} from './submission'
