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

// tokens are generated from @formsmithapp/ui at build, inject the same
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
  await userEvent.keyboard('b') // "4" is correct, +10
  await settled(host, 'Great, 10 points!')
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

it('AI EXCHANGE LOOP: base answer → generated questions → exchanges ride the payload', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  const handler = vi.fn(
    async ({ index }: { index: number }) =>
      index <= 2
        ? { question: `Mock follow-up ${index}?`, meta: { fallback: false }, sig: `sig-${index}` }
        : null, // done after two follow-ups
  )
  const form: FormDefinition = {
    id: 'f_ai',
    blocks: [
      {
        id: 'b_ai',
        ref: 'experience',
        type: 'ai_followup',
        title: 'How was setup?',
        required: true,
        properties: { goal: 'g', maxFollowups: 2, fallbackQuestion: 'Hardest part?' },
      },
      { id: 'b_end', ref: 'end', type: 'thankyou', title: 'Done!', required: false },
    ],
  }
  const { engine, host } = mountForm(form, {
    onSubmit,
    onAiFollowup: handler as never,
  })
  await settled(host, 'How was setup?')
  await userEvent.keyboard('It kept failing on SMTP{Enter}')

  // exchange 1
  await vi.waitFor(() => expect(host.querySelector('h1')?.textContent).toBe('Mock follow-up 1?'))
  expect(host.querySelector('.fsr-ai-tag')?.textContent).toContain('AI-generated')
  await userEvent.keyboard('The TLS port{Enter}')

  // exchange 2
  await vi.waitFor(() => expect(host.querySelector('h1')?.textContent).toBe('Mock follow-up 2?'))
  await userEvent.keyboard('Yes, fixed now{Enter}')

  // handler returns null on index 3 → session ends → ending reached
  await settled(host, 'Done!')
  expect(engine.getState().answers.experience).toBe('It kept failing on SMTP') // base answer intact

  await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  const payload = onSubmit.mock.calls[0]?.[0] as {
    aiExchanges: { index: number; question: string; answer: string; sig: string }[]
  }
  expect(payload.aiExchanges).toHaveLength(2)
  expect(payload.aiExchanges[0]).toMatchObject({
    index: 1,
    question: 'Mock follow-up 1?',
    answer: 'The TLS port',
    sig: 'sig-1',
  })
})

it('AI EXCHANGE: handler failure/absence degrades to plain advancement', async () => {
  const failing = vi.fn(async () => {
    throw new Error('endpoint down')
  })
  const form: FormDefinition = {
    id: 'f_ai2',
    blocks: [
      {
        id: 'b_ai',
        ref: 'exp',
        type: 'ai_followup',
        title: 'Thoughts?',
        required: false,
        properties: { goal: 'g', maxFollowups: 1, fallbackQuestion: 'FB?' },
      },
      { id: 'b_end', ref: 'end', type: 'thankyou', title: 'Bye!', required: false },
    ],
  }
  const { host } = mountForm(form, { onAiFollowup: failing as never })
  await settled(host, 'Thoughts?')
  await userEvent.keyboard('Something thoughtful{Enter}')
  await settled(host, 'Bye!') // dead handler → no exchange, no error, just onward

  // and empty answers skip the loop entirely
  const plain = mountForm(form)
  await settled(plain.host, 'Thoughts?')
  await userEvent.keyboard('{Enter}') // optional + empty + no handler involvement
  await settled(plain.host, 'Bye!')
})

it('renders a block description as fsr-desc and links the control via aria-describedby', async () => {
  const form: FormDefinition = {
    id: 'r_desc',
    version: 1,
    blocks: [
      { id: 'b_welcome', ref: 'intro', type: 'welcome', title: 'Hello' },
      {
        id: 'b_desc',
        ref: 'full_name',
        type: 'short_text',
        title: 'What is your name?',
        description: 'Your full legal name, please.',
      },
      { id: 'b_end', ref: 'ending', type: 'thankyou', title: 'Thanks!' },
    ],
  }
  const { host } = mountForm(form)
  await settled(host, 'Hello')
  await userEvent.keyboard('{Enter}')
  await settled(host, 'What is your name?')

  // the description renders as the fsr-desc line with a stable id
  const desc = host.querySelector('#fsr-d-b_desc')
  expect(desc?.classList.contains('fsr-desc')).toBe(true)
  expect(desc?.textContent).toContain('Your full legal name')

  // and the focused control points at it via aria-describedby (the a11y wiring)
  const control = host.querySelector('[data-fsr-autofocus]')
  const describedBy = control?.getAttribute('aria-describedby')?.split(' ') ?? []
  expect(describedBy).toContain('fsr-d-b_desc')
})

it('does NOT auto-advance when arrow keys browse a single-select (WCAG 3.2.2)', async () => {
  const form: FormDefinition = {
    id: 'r_arrow',
    version: 1,
    blocks: [
      { id: 'b_welcome', ref: 'intro', type: 'welcome', title: 'Hi' },
      {
        id: 'b_pick',
        ref: 'pick',
        type: 'multiple_choice',
        title: 'Pick one',
        required: true,
        properties: {
          choices: [
            { id: 'a', label: 'Apple' },
            { id: 'b', label: 'Banana' },
            { id: 'c', label: 'Cherry' },
          ],
        },
      },
      { id: 'b_end', ref: 'end', type: 'thankyou', title: 'Done' },
    ],
  }
  const { engine, host } = mountForm(form)
  await settled(host, 'Hi')
  await userEvent.keyboard('{Enter}')
  await settled(host, 'Pick one')

  // Arrow navigation records a selection but must NOT navigate onward, even
  // after the auto-advance debounce window would have elapsed.
  await userEvent.keyboard('{ArrowDown}')
  await vi.waitFor(() => expect(engine.getState().answers.pick).not.toBeUndefined())
  await new Promise((resolve) => setTimeout(resolve, 320))
  expect(engine.getState().currentId).toBe('b_pick')

  // An explicit commit (Enter) still advances.
  await userEvent.keyboard('{Enter}')
  await settled(host, 'Done')
})

it('moves focus to the ending heading on completion (not lost to body)', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  const { host } = mountForm(linearForm(), { onSubmit })
  await settled(host, 'Hi there!')
  await userEvent.keyboard('{Enter}')
  await settled(host, 'What is your name?')
  await userEvent.keyboard('Ada{Enter}')
  await settled(host, 'And your email')
  await userEvent.keyboard('ada@lovelace.dev{Enter}')
  await settled(host, 'Thanks, Ada!')

  await vi.waitFor(() => {
    const active = document.activeElement
    expect(active?.tagName).toBe('H1')
    expect(active?.classList.contains('fsr-title')).toBe(true)
    expect(active?.textContent).toContain('Thanks, Ada!')
  })
})

it('advertises input purpose on contact fields via autocomplete (WCAG 1.3.5)', async () => {
  const form: FormDefinition = {
    id: 'r_ac',
    version: 1,
    blocks: [
      { id: 'b_w', ref: 'w', type: 'welcome', title: 'Hi' },
      { id: 'b_e', ref: 'e', type: 'email', title: 'Email?' },
      { id: 'b_p', ref: 'p', type: 'phone', title: 'Phone?' },
      { id: 'b_u', ref: 'u', type: 'website', title: 'Site?' },
      { id: 'b_end', ref: 'end', type: 'thankyou', title: 'Done' },
    ],
  }
  const { host } = mountForm(form)
  await settled(host, 'Hi')
  const autocompleteNow = () => host.querySelector('.fsr-input')?.getAttribute('autocomplete')

  await userEvent.keyboard('{Enter}')
  await settled(host, 'Email?')
  expect(autocompleteNow()).toBe('email')
  await userEvent.keyboard('{Enter}') // optional + empty advances
  await settled(host, 'Phone?')
  expect(autocompleteNow()).toBe('tel')
  await userEvent.keyboard('{Enter}')
  await settled(host, 'Site?')
  expect(autocompleteNow()).toBe('url')
})
