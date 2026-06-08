import React from 'react'
import { Icon } from './Icon'

export type StatusPillTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

type ToneConfig = {
  bg: string
  fg: string
  border: string
  dot: string
}

const TONES: Record<StatusPillTone, ToneConfig> = {
  neutral: { bg: 'var(--iso-n-100)',       fg: 'var(--iso-fg-muted)',   border: 'var(--iso-n-300)',      dot: 'var(--iso-n-600)' },
  info:    { bg: 'var(--iso-info-soft)',    fg: 'var(--iso-brand)',      border: 'var(--iso-blue-3-300)', dot: 'var(--iso-accent)' },
  success: { bg: 'var(--iso-success-soft)', fg: 'var(--iso-green-800)', border: 'var(--iso-green-300)',  dot: 'var(--iso-success)' },
  warning: { bg: 'var(--iso-warning-soft)', fg: 'var(--iso-yellow-800)',border: 'var(--iso-yellow-300)', dot: 'var(--iso-warning)' },
  danger:  { bg: 'var(--iso-danger-soft)',  fg: 'var(--iso-red-700)',   border: 'var(--iso-red-300)',    dot: 'var(--iso-danger)' },
}

type StatusPillProps = {
  tone?: StatusPillTone
  children: React.ReactNode
  icon?: string
  size?: 'sm' | 'md'
}

export function StatusPill({ tone = 'neutral', children, icon, size = 'md' }: StatusPillProps) {
  const t = TONES[tone] ?? TONES.neutral
  const pad = size === 'sm' ? '2px 7px' : '3px 9px'
  const fs = size === 'sm' ? '9px' : '10px'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        whiteSpace: 'nowrap',
        padding: pad,
        borderRadius: 'var(--iso-radius-xs)',
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.border}`,
        font: `500 ${fs}/14px var(--iso-font-ui)`,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        transition: [
          'background-color var(--crm-fast) var(--crm-ease-standard)',
          'color var(--crm-fast) var(--crm-ease-standard)',
          'border-color var(--crm-fast) var(--crm-ease-standard)',
        ].join(', '),
      }}
    >
      {icon ? (
        <Icon name={icon} size={11} strokeWidth={2} style={{ color: t.dot }} />
      ) : (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: t.dot,
            flexShrink: 0,
            transition: 'background-color var(--crm-fast) var(--crm-ease-standard)',
          }}
        />
      )}
      {children}
    </span>
  )
}
