# Formsmith Licensing

Formsmith is an **open-core** project. This document is the authoritative map of what is
licensed how, and why. If anything elsewhere appears to contradict this file, this file wins.

**TL;DR** — the core is AGPL-3.0-only and stays that way (see
[OPEN-CORE-COVENANT.md](OPEN-CORE-COVENANT.md)). The pieces that live inside *your* codebase
(embed SDK, framework wrappers, API client) are MIT so your legal team never has to think
about copyleft. A small set of enterprise modules is commercially licensed.

---

## 1. The license map

| Path | License | SPDX identifier |
|---|---|---|
| `packages/engine` | AGPL-3.0-only | `AGPL-3.0-only` |
| `packages/blocks` | AGPL-3.0-only | `AGPL-3.0-only` |
| `packages/rules` | AGPL-3.0-only | `AGPL-3.0-only` |
| `packages/ai` | AGPL-3.0-only | `AGPL-3.0-only` |
| `packages/renderer` | AGPL-3.0-only | `AGPL-3.0-only` |
| `packages/schemas` | AGPL-3.0-only | `AGPL-3.0-only` |
| `packages/db` | AGPL-3.0-only | `AGPL-3.0-only` |
| `packages/adapters` | AGPL-3.0-only | `AGPL-3.0-only` |
| `packages/ui` | AGPL-3.0-only | `AGPL-3.0-only` |
| `apps/web` | AGPL-3.0-only | `AGPL-3.0-only` |
| `apps/api` | AGPL-3.0-only | `AGPL-3.0-only` |
| **`packages/embed`** | **MIT** | `MIT` |
| **`packages/react`, `packages/vue`, `packages/svelte`** | **MIT** | `MIT` |
| **`packages/sdk`** | **MIT** | `MIT` |
| **`modules/ee`** | **Formsmith Enterprise License** (commercial) | `LicenseRef-Formsmith-Enterprise` |
| everything else (infra, docs, configs) | AGPL-3.0-only unless marked otherwise | `AGPL-3.0-only` |

- The repository root `LICENSE` file is the full AGPL-3.0 text and governs by default.
- Every **MIT** package carries its own `LICENSE` file (a copy of `LICENSES/MIT.txt`).
- Everything under `modules/ee/` is governed by `modules/ee/LICENSE`, not the AGPL.

## 2. Copyright

Copyright (C) 2026 **Gnana Siva Sai V** \<gnana097@gmail.com\> (GitHub:
[@gnana997](https://github.com/gnana997)) and Formsmith contributors.

The project is currently owned by its founding maintainer as an individual. If a legal
entity is formed for Formsmith, ownership and the agreements referencing the owner
(including the CLA) transfer to that entity as its successor — nothing about the public
licenses changes when that happens.

Contributions are accepted under a Contributor License Agreement — see [CLA.md](CLA.md)
for the terms and an honest summary of what you grant and what you keep.

## 3. Why this mix

- **AGPL-3.0-only for the core.** The engine, renderer, apps, and AI orchestration are the
  product. AGPL keeps every distributed or network-served modification open — anyone may
  self-host or even offer Formsmith as a service, but they cannot take the core closed.
- **MIT for the integration surface.** `packages/embed`, the framework wrappers, and
  `packages/sdk` are installed into *customers'* applications. MIT means embedding a
  Formsmith form never raises copyleft questions for the host codebase.
- **Commercial for `modules/ee`.** Enterprise features (SSO, SCIM, RBAC, audit logs,
  white-label, residency controls) fund the project. They are source-visible but require a
  valid license key for production use.

Version policy: the core is licensed **AGPL-3.0-only** (not "or-later") — the terms cannot
change under us or you by a future FSF revision.

## 4. Per-file headers

New source files should start with an SPDX header:

**AGPL packages/apps**
```ts
// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
```

**MIT packages** (`embed`, `react`, `vue`, `svelte`, `sdk`)
```ts
// Copyright (c) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: MIT
```

**Enterprise modules** (`modules/ee`)
```ts
// Copyright (C) 2026 Gnana Siva Sai V. All rights reserved.
// Licensed under the Formsmith Enterprise License — see modules/ee/LICENSE.
// SPDX-License-Identifier: LicenseRef-Formsmith-Enterprise
```

`package.json` fields: `"license": "AGPL-3.0-only"`, `"license": "MIT"`, or
`"license": "SEE LICENSE IN LICENSE"` (EE), matching the map above.

## 5. The dependency-direction rule

**MIT packages must never import AGPL packages.** `packages/embed` is zero-dependency by
design; the wrappers depend only on `packages/embed`; `packages/sdk` stands alone. The
AGPL engine and renderer execute inside the iframe *served by a Formsmith instance* — they
never become part of a host page's bundle. This rule is enforced in CI.

AGPL packages may freely depend on MIT packages (permissive → copyleft is always fine).

**Native (non-iframe) embedding is a commercial option, not an open-license one.** Rendering the
AGPL engine or renderer *directly inside a host application's bundle* (headless / native, no iframe)
would extend AGPL's obligations to that host application, so the open licenses do not permit it for
closed applications. That capability is offered separately under a **commercial embedding license**
(dual-licensing, in the spirit of MySQL/Qt) — email gnana097@gmail.com. The open, copyleft-free
way to embed is the MIT iframe SDK.

## 6. Third-party dependencies

Dependencies must be compatible with this model: permissive licenses (MIT, Apache-2.0,
BSD, ISC) are fine anywhere; copyleft dependencies are acceptable only in AGPL code and
only when license-compatible; **no dependency whose license forbids competing commercial
products** (e.g. commercial-only SDKs) may enter the tree. A license check runs in CI.

## 7. Trademarks

"Formsmith" and the Formsmith logo are trade names of the copyright holder. As permitted
by AGPL-3.0 section 7(e), the open-source licenses do **not** grant trademark rights — see
[NOTICE](NOTICE) and [TRADEMARK-POLICY.md](TRADEMARK-POLICY.md).

## 8. Questions

Open a discussion on GitHub ([@formsmithapp](https://github.com/formsmithapp)) or email
gnana097@gmail.com.
