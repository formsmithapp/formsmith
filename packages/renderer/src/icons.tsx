// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/** The handful of inline glyphs the runtime needs — no icon library. */

const path = {
  arrow: 'M3 8h9M8 3l5 5-5 5',
  check: 'M3 8.5l3.5 3.5L13 5',
  up: 'M4 10l4-4 4 4',
  down: 'M4 6l4 4 4-4',
} as const

function Icon({ d, size = 14 }: { d: keyof typeof path; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <title>{null}</title>
      <path d={path[d]} />
    </svg>
  )
}

export const ArrowIcon = () => <Icon d="arrow" size={11} />
export const CheckIcon = () => <Icon d="check" />
export const UpIcon = () => <Icon d="up" size={16} />
export const DownIcon = () => <Icon d="down" size={16} />
export const Sparkle = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <title>{null}</title>
    <path d="M8 1l1.8 4.4L14 7l-4.2 1.6L8 13 6.2 8.6 2 7l4.2-1.6z" />
  </svg>
)
