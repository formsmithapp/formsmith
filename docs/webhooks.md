# Webhooks

Every accepted response POSTs a JSON payload to your endpoint(s). Deliveries are signed,
retried with exponential backoff on failure, and recorded. The Connect tab shows each
attempt's status, error, and duration.

## The payload

```json
{
  "event": "response.created",
  "form": { "id": "…", "title": "Customer feedback" },
  "response": {
    "id": "…",
    "formVersion": 2,
    "submittedAt": "2026-07-06T12:34:56.000Z",
    "answers": { "nps": 9, "highlight": "fast and private" },
    "variables": { "score": 10 },
    "hidden": { "visitor": "ada" },
    "ending": "thanks"
  }
}
```

`variables` are always server-recomputed, never client-supplied values. The **Send test**
button fires the same delivery with `"event": "ping"` and no `response`.

## Headers

| Header | Value |
|---|---|
| `X-Formsmith-Event` | `response.created` or `ping` |
| `X-Formsmith-Webhook-Id` | The webhook's id |
| `X-Formsmith-Signature` | `t=<unix-seconds>,v1=<hex hmac>` (see below) |

## Verifying the signature

The signature is an HMAC-SHA256 over `"<t>.<raw-body>"` using your webhook's signing secret
(shown once when the webhook is created). The embedded timestamp makes captured requests
replay-resistant: reject anything older than a few minutes.

1. Read `t` and `v1` from the `X-Formsmith-Signature` header.
2. Reject if `|now − t|` exceeds your tolerance (we recommend 300 seconds).
3. Compute `HMAC-SHA256(secret, t + "." + rawBody)` as lowercase hex.
4. Compare against `v1` with a constant-time comparison.

**Node:**

```js
import { createHmac, timingSafeEqual } from 'node:crypto'

function verify(secret, rawBody, header, toleranceSeconds = 300) {
  const match = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header)
  if (!match) return false
  const [, t, v1] = match
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSeconds) return false
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(v1, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}
```

**Python:**

```python
import hashlib, hmac, re, time

def verify(secret: str, raw_body: bytes, header: str, tolerance: int = 300) -> bool:
    match = re.fullmatch(r"t=(\d+),v1=([0-9a-f]{64})", header)
    if not match:
        return False
    t, v1 = match.groups()
    if abs(time.time() - int(t)) > tolerance:
        return False
    expected = hmac.new(secret.encode(), f"{t}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, v1)
```

Use the **raw request body bytes**; re-serializing the JSON will change the bytes and fail
verification.

## Delivery & retries

- Success is any `2xx` within 10 seconds.
- Failures retry up to 5 times with exponential backoff; every attempt is visible in the
  Connect tab's delivery history.
- Endpoint URLs must be `https` (`http` is allowed for `localhost` during development).

## Rotating a secret

Delete the webhook and create it again; a fresh secret is generated. (Seamless rotation with
overlapping secrets is part of the enterprise offering.)
