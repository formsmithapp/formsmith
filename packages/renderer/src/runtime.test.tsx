// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { createEngine, type FormDefinition } from '@formsmithapp/engine'
import { themeTokensCss } from '@formsmithapp/ui'
import { userEvent } from '@vitest/browser/context'
import axe from 'axe-core'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { FormRuntime, type FormRuntimeProps } from './FormRuntime'
import { kitchenSink, linearForm, quizForm } from './fixtures'
import './styles/runtime.css'

// tokens are generated from @formsmithapp/ui at build — inject the same
const tokenStyle = document.createElement('style')
tokenStyle.textContent = themeTokensCss('.fsr-root', '.fsr-root[data-theme="dark"]')
document.head.appendChild(tokenStyle)

type Cleanup = () => void
const cleanups: Cleanup[] = []
afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()?.()
})

function mountForm(
  form: FormDefinition,
  props: Partial<Omit<FormRuntimeProps, 'engine'>> = {},
  hiddenFields?: Record<string, string>,
) {
  const engine = createEngine(form, { mode: 'runtime', hiddenFields })
  const host = document.createElement('div')
  host.style.height = '100vh'
  document.body.appendChild(host)
  const root = createRoot(host)
  root.render(<FormRuntime engine={engine} {...props} />)
  cleanups.push(() => {
    root.unmount()
    host.remove()
  })
  return { engine, host }
}

/** Waits until the stage shows the block AND its primary control owns focus. */
async function settled(host: HTMLElement, titleFragment: string) {
  await vi.waitFor(
    () => {
      const title = host.querySelector('h1')
      expect(title?.textContent ?? '').toContain(titleFragment)
    },
    { timeout: 4000 },
  )
  await vi.waitFor(
    () => {
      const autofocus = host.querySelector('[data-fsr-autofocus]')
      if (autofocus !== null) expect(document.activeElement).toBe(autofocus)
    },
    { timeout: 4000 },
  )
}

async function focusInStage(host: HTMLElement) {
  await vi.waitFor(
    () => {
      const active = document.activeElement
      expect(active instanceof HTMLElement && host.contains(active)).toBe(true)
    },
    { timeout: 4000 },
  )
}

it('walks the linear flow with piping, validation, and completion', async () => {
  const { engine, host } = mountForm(linearForm())
  await settled(host, 'Hi there!')

  await userEvent.keyboard('{Enter}') // Start
  await settled(host, 'What is your name?')
  await focusInStage(host)

  // required-empty is blocked gently
  await userEvent.keyboard('{Enter}')
  await vi.waitFor(() => {
    expect(host.querySelector('.fsr-error')?.textContent).toBe('This field is required.')
    expect(host.querySelector('.fsr-input')?.getAttribute('aria-invalid')).toBe('true')
  })

  await userEvent.keyboard('Ada{Enter}')
  await settled(host, 'And your email, Ada?') // piped recall

  await userEvent.keyboard('not-an-email{Enter}')
  await vi.waitFor(() => {
    expect(host.querySelector('.fsr-error')?.textContent).toBe(
      'Please enter a valid email address.',
    )
  })

  await userEvent.keyboard('{Control>}a{/Control}ada@lovelace.dev{Enter}')
  await settled(host, 'Thanks, Ada!')
  expect(engine.getState().status).toBe('complete')
})

it('completes the kitchen-sink fixture KEYBOARD-ONLY across every block type', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  const { engine, host } = mountForm(kitchenSink(), { onSubmit }, { visitor: 'Ada' })
  await settled(host, 'Welcome Ada') // hidden-field piping

  await userEvent.keyboard('{Enter}')
  await settled(host, 'Name?')
  await focusInStage(host)
  await userEvent.keyboard('Ada{Enter}')

  await settled(host, 'Email?')
  await userEvent.keyboard('ada@lovelace.dev{Enter}')

  await settled(host, 'Tell us more')
  await userEvent.keyboard('line one{Shift>}{Enter}{/Shift}line two')
  expect(engine.getState().answers.bio).toBe('line one\nline two') // Shift+Enter = newline
  await userEvent.keyboard('{Enter}')

  await settled(host, 'Age?')
  await userEvent.keyboard('36{Enter}')

  await settled(host, 'Birthday?')
  await focusInStage(host)
  await userEvent.keyboard('28021990') // segments auto-advance D → M → Y
  await vi.waitFor(() => expect(engine.getState().answers.birthday).toBe('1990-02-28'))
  await userEvent.keyboard('{Enter}')

  await settled(host, 'Favorite color?')
  await focusInStage(host)
  await userEvent.keyboard('gre') // type-to-filter
  await vi.waitFor(() => {
    expect(host.querySelector('[role="listbox"]')?.textContent).toBe('Green')
  })
  await userEvent.keyboard('{Enter}') // commit the active option, auto-advances
  await vi.waitFor(() => expect(engine.getState().answers.color).toBe('green'))

  await settled(host, 'Pick a plan')
  await userEvent.keyboard('b') // letter key, single-select auto-advance

  await settled(host, 'Any pets?')
  await userEvent.keyboard('a')
  await userEvent.keyboard('c') // multi-select letters toggle, no auto-advance
  await vi.waitFor(() => expect(engine.getState().answers.pets).toEqual(['dog', 'fish']))
  await userEvent.keyboard('{Enter}')

  await settled(host, 'Sure?')
  await userEvent.keyboard('y')

  await settled(host, 'Accept our terms?')
  await userEvent.keyboard('a')

  await settled(host, 'How satisfied are you?')
  await userEvent.keyboard('4')

  await settled(host, 'Would you recommend us?')
  await userEvent.keyboard('10') // "1" then "0" within the buffer window → 10
  await vi.waitFor(() => expect(engine.getState().answers.recommend).toBe(10))

  await settled(host, 'Why that rating?')
  await focusInStage(host)
  await userEvent.keyboard('because it works{Enter}')

  await settled(host, 'Almost done, Ada.')
  await userEvent.keyboard('{Enter}')

  await settled(host, 'Done, Ada!')
  expect(engine.getState().status).toBe('complete')
  expect(engine.getState().answers).toEqual({
    name: 'Ada',
    email: 'ada@lovelace.dev',
    bio: 'line one\nline two',
    age: 36,
    birthday: '1990-02-28',
    color: 'green',
    plan: 'pro',
    pets: ['dog', 'fish'],
    confirm: true,
    terms: true,
    satisfaction: 4,
    recommend: 10,
    followup: 'because it works',
  })

  // Optimistic delivery: the queue fired with the full payload.
  await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      formId: 'r_sink',
      variables: {},
      hiddenFields: { visitor: 'Ada' },
    }),
  )
  await vi.waitFor(() => {
    expect(host.querySelector('.fsr-submit-status')?.textContent).toBe('Response recorded.')
  })
})

it('pipes the computed score into the branched ending (scored quiz)', async () => {
  const { engine, host } = mountForm(quizForm())
  await settled(host, 'What is 2 + 2?')
  await userEvent.keyboard('b') // "4" — correct, +10
  await settled(host, 'Great — 10 points!')
  expect(engine.getState().variables.score).toBe(10)
})

it('progress counts answerable blocks only and the chevrons navigate', async () => {
  const { engine, host } = mountForm(kitchenSink(), {}, { visitor: 'Ada' })
  expect(host.querySelector('[role="progressbar"]')).toBeNull() // hidden on welcome

  await userEvent.keyboard('{Enter}')
  await settled(host, 'Name?')
  const bar = host.querySelector('[role="progressbar"]')
  expect(bar?.getAttribute('aria-valuemax')).toBe('13') // 16 blocks, 13 answerable
  expect(bar?.getAttribute('aria-valuenow')).toBe('0')

  await userEvent.keyboard('Ada{Enter}')
  await settled(host, 'Email?')
  await vi.waitFor(() => {
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('1')
  })

  const prev = host.querySelector<HTMLButtonElement>('[aria-label="Previous question"]')
  prev?.click()
  await settled(host, 'Name?')
  expect(engine.getCurrentBlock()?.ref).toBe('name')
})

it('shows the AI disclosure by default and honors opting out', async () => {
  const first = mountForm(kitchenSink())
  first.engine.goTo('followup')
  await settled(first.host, 'Why that rating?')
  await vi.waitFor(() => {
    expect(first.host.querySelector('.fsr-ai-tag')?.textContent).toContain('AI-generated question')
    expect(first.host.querySelector('h1')?.className).toContain('fsr-title-ai')
  })

  const second = mountForm(kitchenSink(), { aiDisclosure: false })
  second.engine.goTo('followup')
  await settled(second.host, 'Why that rating?')
  expect(second.host.querySelector('.fsr-ai-tag')).toBeNull()
})

it('fires the per-ending redirect through onRedirect', async () => {
  const onRedirect = vi.fn()
  const form: FormDefinition = {
    id: 'r_redirect',
    blocks: [
      { id: 'b1', ref: 'q1', type: 'short_text', title: 'Optional?' },
      {
        id: 'b2',
        ref: 'ending',
        type: 'thankyou',
        title: 'Bye',
        properties: { redirectUrl: 'https://example.com/next' },
      },
    ],
  }
  const { host } = mountForm(form, { onRedirect })
  await settled(host, 'Optional?')
  await userEvent.keyboard('{Enter}')
  await settled(host, 'Bye')
  await vi.waitFor(() => expect(onRedirect).toHaveBeenCalledWith('https://example.com/next'), {
    timeout: 3000,
  })
})

it('applies the theme prop and shows branding by default', async () => {
  const dark = mountForm(linearForm(), { theme: 'dark' })
  expect(dark.host.querySelector('.fsr-root')?.getAttribute('data-theme')).toBe('dark')
  expect(dark.host.querySelector('.fsr-branding')?.textContent).toContain('Formsmith')

  const unbranded = mountForm(linearForm(), { branding: false })
  expect(unbranded.host.querySelector('.fsr-branding')).toBeNull()
})

it('themeVars land as inline custom properties and WIN over the stylesheet', async () => {
  const { host } = mountForm(linearForm(), {
    theme: 'light',
    themeVars: { '--brand': '#7048e8', '--canvas': '#fdf6ec' },
  })
  const root = host.querySelector('.fsr-root')
  expect(root).not.toBeNull()
  if (!(root instanceof HTMLElement)) return
  expect(root.style.getPropertyValue('--brand')).toBe('#7048e8')
  // inline beats the injected token stylesheet: the page ground repaints
  expect(getComputedStyle(root).backgroundColor).toBe('rgb(253, 246, 236)')
})

it('has no serious or critical axe violations on screens and questions', async () => {
  const { engine, host } = mountForm(kitchenSink(), {}, { visitor: 'Ada' })
  await settled(host, 'Welcome Ada')

  const atWelcome = await axe.run(host)
  const seriousAtWelcome = atWelcome.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(seriousAtWelcome, JSON.stringify(seriousAtWelcome, null, 2)).toEqual([])

  await userEvent.keyboard('{Enter}')
  await settled(host, 'Name?')
  engine.setAnswer('name', 'Ada')
  engine.next()
  await settled(host, 'Email?')

  const atQuestion = await axe.run(host)
  const seriousAtQuestion = atQuestion.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(seriousAtQuestion, JSON.stringify(seriousAtQuestion, null, 2)).toEqual([])
})
