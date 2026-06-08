import { useState, useEffect, useCallback } from 'react'
import { Icon } from './Icon'

export type ToastTone = 'success' | 'danger' | 'warning' | 'info'

export type ToastItem = {
  id: string
  tone: ToastTone
  title: string
  body?: string
  action?: { label: string; onClick: () => void }
}

type Listener = (toasts: ToastItem[]) => void

let _toasts: ToastItem[] = []
const _listeners = new Set<Listener>()

function notify() {
  _listeners.forEach(l => l([..._toasts]))
}

// eslint-disable-next-line react-refresh/only-export-components
export function pushToast(opts: Omit<ToastItem, 'id'>): void {
  const id = String(Date.now()) + Math.random().toString(36).slice(2)
  const item: ToastItem = { ...opts, id }
  _toasts = [item, ..._toasts].slice(0, 3)
  notify()

  if (opts.tone === 'success') {
    setTimeout(() => dismissToast(id), 4000)
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function dismissToast(id: string): void {
  _toasts = _toasts.filter(t => t.id !== id)
  notify()
}

function useToasts(): ToastItem[] {
  const [toasts, setToasts] = useState<ToastItem[]>([..._toasts])

  useEffect(() => {
    const cb: Listener = ts => setToasts(ts)
    _listeners.add(cb)
    return () => { _listeners.delete(cb) }
  }, [])

  return toasts
}

const TONE_ICON: Record<ToastTone, string> = {
  success: 'check-circle',
  danger:  'rotate-ccw',
  warning: 'alert-triangle',
  info:    'info',
}

const TONE_COLORS: Record<ToastTone, { bg: string; fg: string; iconColor: string }> = {
  success: { bg: 'var(--iso-success-soft)', fg: 'var(--iso-green-800)',  iconColor: 'var(--iso-success)' },
  danger:  { bg: 'var(--iso-danger-soft)',  fg: 'var(--iso-red-700)',    iconColor: 'var(--iso-danger)' },
  warning: { bg: 'var(--iso-warning-soft)', fg: 'var(--iso-yellow-800)', iconColor: 'var(--iso-warning)' },
  info:    { bg: 'var(--iso-info-soft)',    fg: 'var(--iso-brand)',       iconColor: 'var(--iso-accent)' },
}

type ToastCardProps = {
  item: ToastItem
  onDismiss: (id: string) => void
}

function ToastCard({ item, onDismiss }: ToastCardProps) {
  const colors = TONE_COLORS[item.tone]

  return (
    <div
      role="alert"
      aria-live={item.tone === 'danger' ? 'assertive' : 'polite'}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--iso-space-3)',
        padding: 'var(--iso-space-3) var(--iso-space-4)',
        background: 'var(--iso-bg)',
        border: '1px solid var(--iso-border)',
        borderRadius: 'var(--iso-radius-md)',
        boxShadow: 'var(--iso-shadow-lg)',
        minWidth: '300px',
        maxWidth: '400px',
        animation: `crm-pop var(--crm-fast) var(--crm-ease-decelerate)`,
      }}
    >
      <span
        style={{
          width: '32px',
          height: '32px',
          borderRadius: 'var(--iso-radius-sm)',
          background: colors.bg,
          color: colors.iconColor,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={TONE_ICON[item.tone]} size={16} />
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: '500 13px/1.4 var(--iso-font-body)',
            color: 'var(--iso-fg-strong)',
          }}
        >
          {item.title}
        </div>
        {item.body && (
          <div
            style={{
              font: '400 12px/1.4 var(--iso-font-body)',
              color: 'var(--iso-fg-muted)',
              marginTop: '2px',
            }}
          >
            {item.body}
          </div>
        )}
        {item.action && (
          <button
            onClick={item.action.onClick}
            style={{
              marginTop: 'var(--iso-space-1)',
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              font: '500 12px/1 var(--iso-font-body)',
              color: 'var(--iso-link)',
              padding: 0,
            }}
          >
            {item.action.label}
          </button>
        )}
      </div>

      <button
        aria-label="Dismiss notification"
        onClick={() => onDismiss(item.id)}
        style={{
          width: '28px',
          height: '28px',
          borderRadius: 'var(--iso-radius-sm)',
          border: 0,
          background: 'transparent',
          color: 'var(--iso-fg-muted)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  )
}

export function ToastHost() {
  const toasts = useToasts()
  const dismiss = useCallback((id: string) => dismissToast(id), [])

  if (toasts.length === 0) return null

  return (
    <div
      aria-label="Notifications"
      style={{
        position: 'fixed',
        bottom: 'var(--iso-space-6)',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--iso-space-2)',
        zIndex: 'var(--iso-z-toast)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <ToastCard item={t} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  )
}
