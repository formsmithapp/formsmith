// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { createEngine } from './engine'
import { hiddenForm, linearForm, quizForm, validationForm } from './fixtures'
import { escapeHtml, pipeText } from './text'

describe('escapeHtml', () => {
  it('escapes the five HTML-sensitive characters', () => {
    expect(escapeHtml(`<img src=x onerror="alert('&')">`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;&amp;&#39;)&quot;&gt;',
    )
  })

  it('leaves plain text alone', () => {
    expect(escapeHtml('Ada Lovelace 100%')).toBe('Ada Lovelace 100%')
  })
})

describe('engine.pipe()', () => {
  it('resolves answer and variable tokens', () => {
    const engine = createEngine(quizForm())
    engine.setAnswer('q1', 'four')
    expect(engine.pipe('Answer {{q1}}, score {{score}}')).toBe('Answer four, score 10')
  })

  it('escapes interpolated values by default — piping is an injection surface', () => {
    const engine = createEngine(linearForm())
    engine.next()
    engine.setAnswer('name', '<script>alert(1)</script>')
    expect(engine.pipe('Hi {{name}}!')).toBe('Hi &lt;script&gt;alert(1)&lt;/script&gt;!')
  })

  it('can opt out of escaping explicitly', () => {
    const engine = createEngine(linearForm())
    engine.next()
    engine.setAnswer('name', '<b>Ada</b>')
    expect(engine.pipe('{{name}}', { escape: false })).toBe('<b>Ada</b>')
  })

  it('renders unresolved tokens as empty strings, never leaking the raw token', () => {
    const engine = createEngine(linearForm())
    expect(engine.pipe('Hi {{name}}{{nope}}!')).toBe('Hi !')
  })

  it('joins array answers with commas', () => {
    const engine = createEngine(validationForm())
    engine.setAnswer('pets', ['dog', 'cat'])
    expect(engine.pipe('Pets: {{pets}}')).toBe('Pets: dog, cat')
  })

  it('pipes hidden-field values', () => {
    const engine = createEngine(hiddenForm(), { hiddenFields: { visitor: 'Ada' } })
    expect(engine.pipe('Hi {{visitor}}!')).toBe('Hi Ada!')
  })

  it('escapes hostile hidden-field values by default (URL prefill is untrusted)', () => {
    const engine = createEngine(hiddenForm(), {
      hiddenFields: { visitor: '"><svg onload=alert(1)>' },
    })
    expect(engine.pipe('Hi {{visitor}}!')).toBe('Hi &quot;&gt;&lt;svg onload=alert(1)&gt;!')
  })
})

describe('pipeText', () => {
  it('formats numbers, booleans, and nulls', () => {
    expect(pipeText('{{n}}|{{b}}|{{missing}}', { n: 42, b: false })).toBe('42|false|')
  })

  it('resolves dot paths into nested values', () => {
    expect(pipeText('{{a.b.c}}', { a: { b: { c: 'deep' } } })).toBe('deep')
    expect(pipeText('{{list.1}}', { list: ['zero', 'one'] })).toBe('one')
  })

  it('tolerates whitespace inside tokens', () => {
    expect(pipeText('{{ name }}', { name: 'Ada' })).toBe('Ada')
  })
})
