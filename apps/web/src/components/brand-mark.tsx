// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/** 26px rounded-square brand tile + serif wordmark (design §6.1). */
export function BrandMark({ wordmark = true }: { wordmark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="grid size-[26px] place-items-center rounded-[8px] bg-brand shadow-sm ring-1 ring-white/25 ring-inset"
      >
        <span className="font-serif text-[15px] font-bold text-on-brand">F</span>
      </span>
      {wordmark && (
        <span className="font-serif text-[14.5px] font-bold tracking-[0.01em]">Formsmith</span>
      )}
    </span>
  )
}
