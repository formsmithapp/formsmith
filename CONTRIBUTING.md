# Contributing to Formsmith

Thanks for considering a contribution: code, a bug report, docs, or design feedback are all
genuinely appreciated.

> 🚧 **Early days.** Formsmith is pre-v1 and the codebase is still being scaffolded. The architecture
> and tooling below describe where the project is headed; expect rapid change. For anything
> non-trivial, please open a **Discussion** before a large pull request.

---

## Ways to contribute

- **Report bugs** and request features via GitHub Issues.
- **Discuss** direction and ideas in GitHub Discussions before large changes.
- **Improve docs**: clarity fixes are always welcome.
- **Contribute code**: see below.

## The Contributor License Agreement (CLA)

Formsmith requires a CLA. A bot will ask you to accept it on your first pull request, and your
acceptance is recorded automatically. Please read [`CLA.md`](CLA.md); the honest summary:

- **You keep your copyright** and can reuse your own code anywhere, anytime.
- **You grant the project broad rights, including relicensing**. This is deliberate: it is what
  legally funds the project through the enterprise modules and the hosted service.
- **Your contribution to open packages always stays open** under that package's license, permanently. This is a promise made publicly in the [Open-Core Covenant](OPEN-CORE-COVENANT.md).

Contributing on behalf of an employer? Email gnana097@gmail.com for the corporate CLA before
submitting.

## Development setup

Requirements:

- **Node.js 22+**
- **pnpm** (via `corepack enable`)

```bash
pnpm install
pnpm dev        # run the app(s)
pnpm test       # Vitest
pnpm lint       # Biome (lint + format)
pnpm build      # Turborepo build
```

*(Exact scripts arrive as the monorepo is scaffolded.)*

## Repository layout

TypeScript monorepo (pnpm workspaces + Turborepo):

```
packages/   engine · blocks · rules · ai · renderer · embed · schemas · db · adapters · ui · sdk
apps/       web (builder / dashboard / API) · api (public data-plane)
modules/    ee (commercially licensed, see modules/ee/LICENSE)
```

## Rules that keep the license model sound (enforced in CI)

Please respect these; they are what make the open-core model work:

1. **MIT packages must never import AGPL packages.** `packages/embed` and the framework wrappers are
   the customer-facing **MIT** surface and must stay free of AGPL code. AGPL packages *may* depend on
   MIT ones (permissive → copyleft is always fine).
2. **Every new source file carries an SPDX header** matching its package's license
   (see [`LICENSING.md`](LICENSING.md) §4):
   - AGPL: `// SPDX-License-Identifier: AGPL-3.0-only`
   - MIT: `// SPDX-License-Identifier: MIT`
   - EE: `// SPDX-License-Identifier: LicenseRef-Formsmith-Enterprise`
3. **No dependency whose license forbids competing commercial products.** Permissive licenses
   (MIT / Apache-2.0 / BSD / ISC) are fine anywhere; copyleft only within AGPL code and only when
   compatible. A license check runs in CI.
4. **Keep the hot path lean.** `engine`, `rules`, `blocks`, and `embed` are on the respondent/edge
   path: keep them dependency-minimal and isomorphic (browser + Node + edge). Heavy dependencies
   belong to `apps/web` / `packages/ui`, never the engine or embed.

## Coding standards

- **TypeScript**, formatted and linted with **Biome** (`pnpm lint`); CI must be green.
- **Tests:** unit with **Vitest** (the engine and rules are tested exhaustively); end-to-end with
  **Playwright**. Add tests alongside behavioral changes.
- Prefer small, focused pull requests. Explain the *why*, not just the *what*.

## Commit & PR conventions

- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, optionally
  scoped (`feat(engine): …`).
- Branch from `main`, open a PR, keep it focused, ensure lint + tests pass, and sign the CLA.
- Link the issue your PR addresses.

## Security

Please **do not** open public issues for security vulnerabilities. See [`SECURITY.md`](SECURITY.md)
for how to report privately (GitHub private advisories or email).

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to
uphold it; report unacceptable behavior to gnana097@gmail.com.

---

Thank you for helping build a form tool people actually own.
