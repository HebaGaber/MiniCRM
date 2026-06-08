import React, { useState } from 'react'
import { Icon } from './Icon'

type ToolbarProps = {
  children?: React.ReactNode
  onSearch?: (value: string) => void
  searchValue?: string
  searchPlaceholder?: string
  right?: React.ReactNode
}

export function Toolbar({
  children,
  onSearch,
  searchValue,
  searchPlaceholder = 'Search…',
  right,
}: ToolbarProps) {
  const [focused, setFocused] = useState(false)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--iso-space-3)',
        flexWrap: 'wrap',
        padding: 'var(--iso-space-3) var(--iso-space-4)',
        borderBottom: '1px solid var(--iso-border-muted)',
      }}
    >
      {onSearch && (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--iso-space-2)',
            height: '34px',
            padding: '0 var(--iso-space-3)',
            flex: '0 1 280px',
            border: `1px solid ${focused ? 'var(--iso-brand)' : 'var(--iso-border)'}`,
            borderRadius: 'var(--iso-radius-sm)',
            background: 'var(--iso-bg)',
            boxShadow: focused ? 'var(--iso-shadow-focus)' : 'none',
            transition: [
              'border-color var(--crm-fast) var(--crm-ease-standard)',
              'box-shadow var(--crm-fast) var(--crm-ease-standard)',
            ].join(', '),
          }}
        >
          <Icon name="search" size={15} style={{ color: 'var(--iso-fg-subtle)', flexShrink: 0 }} />
          <input
            type="search"
            value={searchValue ?? ''}
            placeholder={searchPlaceholder}
            aria-label="Search"
            onChange={e => onSearch(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              flex: 1,
              border: 0,
              outline: 0,
              background: 'transparent',
              font: '400 13px/1 var(--iso-font-body)',
              color: 'var(--iso-fg)',
              minWidth: 0,
            }}
          />
        </span>
      )}

      {children}

      {right && (
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--iso-space-2)',
          }}
        >
          {right}
        </div>
      )}
    </div>
  )
}
