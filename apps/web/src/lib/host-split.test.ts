// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { hostRedirect } from './host-split'

const FORMS = 'forms.example'
const APP = 'app.example'
const decide = (host: string, pathname: string, formsHost: string | undefined = FORMS) =>
  hostRedirect({ host, pathname, formsHost, appHost: APP })

describe('hostRedirect', () => {
  it('the forms host serves respondent pages + APIs, redirects everything else to the app host', () => {
    expect(decide(FORMS, '/f/abc')).toBeNull()
    expect(decide(FORMS, '/f')).toBeNull()
    expect(decide(FORMS, '/f/-/opengraph-image')).toBeNull()
    expect(decide(FORMS, '/api/v1/f/abc/responses')).toBeNull() // same-origin submit
    // authed/app surfaces are not this host's job
    expect(decide(FORMS, '/')).toBe(APP)
    expect(decide(FORMS, '/signin')).toBe(APP)
    expect(decide(FORMS, '/forms/abc/create')).toBe(APP)
  })

  it('the app host redirects respondent pages to the forms host, keeps the rest', () => {
    expect(decide(APP, '/f/abc')).toBe(FORMS)
    expect(decide(APP, '/f')).toBe(FORMS)
    expect(decide(APP, '/')).toBeNull()
    expect(decide(APP, '/forms/abc/create')).toBeNull()
    expect(decide(APP, '/api/v1/forms')).toBeNull() // dashboard API, host-agnostic
  })

  it('an unrelated host (a separate marketing site, previews) is never touched', () => {
    expect(decide('marketing.example', '/f/abc')).toBeNull()
    expect(decide('marketing.example', '/')).toBeNull()
    expect(decide('localhost:3000', '/forms/abc/create')).toBeNull()
  })

  it('is a no-op when the split is off or misconfigured', () => {
    const off = (formsHost: string | undefined) =>
      hostRedirect({ host: APP, pathname: '/f/abc', formsHost, appHost: APP })
    expect(off(undefined)).toBeNull() // unset = single-host default
    expect(off('')).toBeNull() // empty
    expect(off(APP)).toBeNull() // collapsed to one host
  })
})
