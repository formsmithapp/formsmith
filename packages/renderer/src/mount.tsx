// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
  createEngine,
  extractHiddenFields,
  type FormDefinition,
  type FormEngine,
} from '@formsmithapp/engine'
import { createRoot } from 'react-dom/client'
import { FormRuntime, type FormRuntimeProps } from './FormRuntime'
import type { SubmissionPayload } from './submission'

export interface MountOptions extends Omit<FormRuntimeProps, 'engine'> {
  form: FormDefinition
  /** Overrides URL-derived hidden fields (default: parsed from location.search). */
  hiddenFields?: Record<string, string>
}

export interface MountedForm {
  engine: FormEngine
  unmount(): void
}

/**
 * The batteries-included bootstrap for the respondent page / embed iframe:
 * creates the engine (hidden-field prefill from the URL), renders the
 * runtime, returns the engine for host-side wiring.
 */
export function mount(container: HTMLElement, options: MountOptions): MountedForm {
  const { form, hiddenFields, ...props } = options
  const engine = createEngine(form, {
    mode: 'runtime',
    hiddenFields:
      hiddenFields ??
      (typeof location !== 'undefined' ? extractHiddenFields(form, location.search) : undefined),
  })
  const root = createRoot(container)
  root.render(<FormRuntime engine={engine} {...props} />)
  return {
    engine,
    unmount: () => root.unmount(),
  }
}

export type { SubmissionPayload }
