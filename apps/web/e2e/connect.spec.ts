// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, test } from '@playwright/test'

/**
 * S3 definition of done: mint a key on /settings/api-keys and use the REST
 * API with it; add a webhook and receive a SIGNED delivery on a listener
 * running inside this spec — verified with the exact recipe docs/webhooks.md
 * publishes; delivery history and usage bars show up in the UI.
 */

// the documented verification recipe, verbatim (docs/webhooks.md)
function verify(secret: string, rawBody: string, header: string, toleranceSeconds = 300) {
  const match = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header)
  if (!match) return false
  const [, t, v1] = match
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSeconds) return false
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(v1 ?? '', 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

interface Received {
  body: string
  signature: string
  event: string
}

function startListener(): Promise<{
  server: Server
  url: string
  next: () => Promise<Received>
}> {
  return new Promise((resolveStart) => {
    let pending: ((received: Received) => void) | null = null
    const backlog: Received[] = []
    const server = createServer((req, res) => {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk
      })
      req.on('end', () => {
        const received: Received = {
          body,
          signature: String(req.headers['x-formsmith-signature'] ?? ''),
          event: String(req.headers['x-formsmith-event'] ?? ''),
        }
        if (pending !== null) {
          pending(received)
          pending = null
        } else {
          backlog.push(received)
        }
        res.writeHead(200).end('ok')
      })
    })
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolveStart({
        server,
        url: `http://localhost:${port}/hook`,
        next: () =>
          new Promise<Received>((resolveNext) => {
            const queued = backlog.shift()
            if (queued !== undefined) resolveNext(queued)
            else pending = resolveNext
          }),
      })
    })
  })
}

test('api keys: mint on the settings page → bearer REST works → revoke → 401', async ({ page }) => {
  await page.goto('/settings/api-keys')
  await page.getByLabel('New key name').fill('e2e key')
  await page.getByRole('button', { name: 'Create key' }).click()

  const secret = (await page.locator('[data-secret]').textContent()) ?? ''
  expect(secret).toMatch(/^fsk_/)
  await page.getByRole('button', { name: /I saved it/ }).click()

  // the public REST API, authenticated by the key (no session cookie needed)
  const viaKey = await page.request.get('/api/v1/forms', {
    headers: { authorization: `Bearer ${secret}`, cookie: '' },
  })
  expect(viaKey.status()).toBe(200)

  // usage recorded — the bars show up after a reload
  await page.reload()
  await expect(page.locator('[data-usage-total]').first()).toContainText(/[1-9]\d* request/)

  await page.getByRole('button', { name: 'Revoke e2e key' }).click()
  await expect(page.getByText('No API keys yet')).toBeVisible()
  const revoked = await page.request.get('/api/v1/forms', {
    headers: { authorization: `Bearer ${secret}`, cookie: '' },
  })
  expect(revoked.status()).toBe(401)
})

test('webhooks: signed delivery to a live listener, verified with the documented recipe', async ({
  page,
}) => {
  const listener = await startListener()
  try {
    // a published form to hook into
    await page.goto('/')
    await page.getByRole('button', { name: /Scored quiz/ }).click()
    await page.waitForURL(/\/forms\/([0-9a-f-]+)\/create/)
    const formId = /\/forms\/([0-9a-f-]+)\/create/.exec(page.url())?.[1] ?? ''
    await page.getByRole('button', { name: 'Publish' }).click()
    await expect(page.getByText('Published v1 — snapshot saved')).toBeVisible()

    // add the webhook on the Connect tab; capture the once-shown secret
    await page.goto(`/forms/${formId}/connect`)
    await page.getByLabel('Webhook URL').fill(listener.url)
    await page.getByRole('button', { name: 'Add webhook' }).click()
    const secret = (await page.locator('[data-webhook-secret]').textContent()) ?? ''
    expect(secret).toMatch(/^whsec_/)
    await page.getByRole('button', { name: /I saved it/ }).click()

    // test-fire: a signed ping arrives
    const pingPromise = listener.next()
    await page.getByRole('button', { name: 'Send test' }).click()
    const ping = await pingPromise
    expect(ping.event).toBe('ping')
    expect(verify(secret, ping.body, ping.signature)).toBe(true)

    // real submission → signed response.created with recomputed variables
    const deliveryPromise = listener.next()
    const submit = await page.request.post(`/api/v1/f/${formId}/responses`, {
      data: { answers: { q1: 'four', q2: 'paris', q3: 'mercury' } },
    })
    expect(submit.status()).toBe(201)
    const delivery = await deliveryPromise
    expect(delivery.event).toBe('response.created')
    expect(verify(secret, delivery.body, delivery.signature)).toBe(true)
    expect(verify('whsec_wrong', delivery.body, delivery.signature)).toBe(false)
    const payload = JSON.parse(delivery.body) as {
      response: { variables: Record<string, unknown> }
    }
    expect(payload.response.variables).toEqual({ score: 30 })

    // the delivery history shows up in the UI
    await page.reload()
    await expect(page.locator('.bg-success').first()).toBeVisible({ timeout: 10_000 })
    await page.getByLabel('Delivery history').click()
    await expect(page.getByText('response.created').first()).toBeVisible()
  } finally {
    listener.server.close()
  }
})

test('notifications toggle persists on the form settings', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New form' }).click()
  await page.waitForURL(/\/forms\/([0-9a-f-]+)\/create/)
  const formId = /\/forms\/([0-9a-f-]+)\/create/.exec(page.url())?.[1] ?? ''

  await page.goto(`/forms/${formId}/connect`)
  const toggle = page.getByRole('switch', { name: 'Email me on every response' })
  await expect(toggle).toHaveAttribute('data-state', 'unchecked')
  await toggle.click()
  await expect(toggle).toHaveAttribute('data-state', 'checked')
  await page.reload()
  await expect(page.getByRole('switch', { name: 'Email me on every response' })).toHaveAttribute(
    'data-state',
    'checked',
  )
})
