// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { candidateScreening } from './templates/candidate-screening'
import { eventRegistration } from './templates/event-registration'
import { customerFeedback } from './templates/feedback'
import { leadCapture } from './templates/lead-capture'
import { patientIntake } from './templates/patient-intake'
import { scoredQuiz } from './templates/quiz'
import type { TemplateDefinition } from './types'

export { instantiateTemplate } from './instantiate'
export type { TemplateDefinition } from './types'

/** The v1 starter templates, in gallery order (featured first). */
export const TEMPLATES: readonly TemplateDefinition[] = [
  patientIntake,
  customerFeedback,
  leadCapture,
  eventRegistration,
  scoredQuiz,
  candidateScreening,
]

export function getTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((template) => template.id === id)
}
