// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient()
export const { useSession } = authClient
