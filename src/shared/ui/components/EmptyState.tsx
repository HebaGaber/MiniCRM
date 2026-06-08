import { useEffect, useRef } from 'react'
import { Icon } from './Icon'
import { Button } from './Button'

type EmptyAction = {
  label: string
  icon?: string
  onClick: () => void
  autoFocus?: boolean
}

type EmptyStateProps = {
  icon?: string
  title: string
  body?: string
  scopeLine?: string
  action?: EmptyAction
  compact?: boolean
}

export function EmptyState({ icon = 'inbox', title, body, scopeLine, action, compact }: EmptyStateProps) {
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (action?.autoFocus) {
      btnRef.current?.focus()
    }
  }, [action?.autoFocus])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: compact ? 'var(--iso-space-8) var(--iso-space-6)' : '56px var(--iso-space-6)',
        gap: 'var(--iso-space-1-5)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '56px',
          height: '56px',
          borderRadius: 'var(--iso-radius-lg)',
          background: 'var(--iso-brand-soft)',
          color: 'var(--iso-brand)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--iso-space-2-5)',
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={26} strokeWidth={1.5} />
      </span>

      <h3
        style={{
          margin: 0,
          font: '500 17px/1.3 var(--iso-font-display)',
          color: 'var(--iso-fg-strong)',
        }}
      >
        {title}
      </h3>

      {scopeLine && (
        <div
          style={{
            font: '500 11px/1 var(--iso-font-ui)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--iso-fg-subtle)',
          }}
        >
          {scopeLine}
        </div>
      )}

      {body && (
        <p
          style={{
            margin: '2px 0 0',
            maxWidth: '42ch',
            font: '400 13px/20px var(--iso-font-body)',
            color: 'var(--iso-fg-muted)',
          }}
        >
          {body}
        </p>
      )}

      {action && (
        <div style={{ marginTop: 'var(--iso-space-3-5)' }}>
          <Button ref={btnRef} variant="primary" leadIcon={action.icon} onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  )
}
