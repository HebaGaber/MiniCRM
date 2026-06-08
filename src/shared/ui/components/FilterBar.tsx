import React from 'react'
import { Icon } from './Icon'

type FilterChipProps = {
  children: React.ReactNode
  selected?: boolean
  onClick?: () => void
  count?: number
  removable?: boolean
}

export function FilterChip({ children, selected, onClick, count, removable }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--iso-space-1-5)',
        height: '30px',
        padding: '0 11px',
        border: `1px solid ${selected ? 'var(--iso-brand)' : 'var(--iso-border)'}`,
        borderRadius: 'var(--iso-radius-sm)',
        background: selected ? 'var(--iso-brand-soft)' : 'var(--iso-bg)',
        color: selected ? 'var(--iso-brand)' : 'var(--iso-fg-muted)',
        font: '500 12px/1 var(--iso-font-body)',
        cursor: 'pointer',
        transition: [
          'border-color var(--crm-fast) var(--crm-ease-standard)',
          'color var(--crm-fast) var(--crm-ease-standard)',
        ].join(', '),
      }}
    >
      {children}
      {count != null && <span style={{ opacity: 0.7 }}>{count}</span>}
      {removable && selected && <Icon name="x" size={12} strokeWidth={2} />}
    </button>
  )
}

type FilterBarProps = {
  groups?: React.ReactNode[]
  sort?: React.ReactNode
}

export function FilterBar({ groups = [], sort }: FilterBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--iso-space-3)',
        flexWrap: 'wrap',
        padding: 'var(--iso-space-3) var(--iso-space-4)',
        borderBottom: '1px solid var(--iso-border-muted)',
        background: 'var(--iso-blue-3-50)',
      }}
    >
      <Icon name="filter" size={14} style={{ color: 'var(--iso-fg-subtle)', flexShrink: 0 }} />
      {groups.map((group, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--iso-space-1-5)' }}>
          {group}
        </div>
      ))}
      {sort && <div style={{ marginLeft: 'auto' }}>{sort}</div>}
    </div>
  )
}
