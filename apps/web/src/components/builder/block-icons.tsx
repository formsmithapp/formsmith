// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
  AlignLeft,
  Calendar,
  ChevronsUpDown,
  FileCheck2,
  Gauge,
  Globe,
  Hand,
  Hash,
  ListChecks,
  type LucideIcon,
  Mail,
  PartyPopper,
  Phone,
  Quote,
  SlidersHorizontal,
  Sparkles,
  ToggleLeft,
  Type,
} from 'lucide-react'

/** blocks' iconKey (plain data) → actual icon component — the renderer-side map. */
const ICONS: Record<string, LucideIcon> = {
  'text-short': Type,
  'text-long': AlignLeft,
  'choice-multiple': ListChecks,
  'choice-dropdown': ChevronsUpDown,
  'choice-yes-no': ToggleLeft,
  'choice-legal': FileCheck2,
  'contact-email': Mail,
  'contact-phone': Phone,
  'contact-website': Globe,
  number: Hash,
  date: Calendar,
  'rating-scale': SlidersHorizontal,
  'rating-nps': Gauge,
  'screen-welcome': Hand,
  'screen-statement': Quote,
  'screen-thankyou': PartyPopper,
  'ai-followup': Sparkles,
}

export function BlockIcon({ iconKey, size = 13 }: { iconKey: string; size?: number }) {
  const Icon = ICONS[iconKey] ?? Type
  return <Icon size={size} aria-hidden="true" />
}

/** 26px type tile; the AI block gets its §8 gradient treatment. */
export function BlockIconTile({
  iconKey,
  selected = false,
  ai = false,
}: {
  iconKey: string
  selected?: boolean
  ai?: boolean
}) {
  return (
    <span
      className={`grid size-[26px] shrink-0 place-items-center rounded-[8px] border ${
        ai
          ? 'border-transparent bg-gradient-to-br from-brand to-brand-strong text-on-brand'
          : selected
            ? 'border-brand/30 bg-brand-soft text-brand'
            : 'border-line bg-surface-2 text-fg-2'
      }`}
    >
      <BlockIcon iconKey={iconKey} />
    </span>
  )
}
