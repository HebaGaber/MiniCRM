import { useEffect, useRef } from 'react'
import { Button } from './Button'

type ConfirmDialogTone = 'danger' | 'warning' | 'primary'

type ConfirmDialogProps = {
  open: boolean
  title: string
  body?: string
  confirmLabel?: string
  tone?: ConfirmDialogTone
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCancel()
      }

      if (e.key === 'Tab') {
        const dialog = dialogRef.current
        if (!dialog) return
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last?.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first?.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  const confirmVariant = tone === 'danger' ? 'danger' : tone === 'warning' ? 'danger' : 'primary'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--crm-scrim)',
        backdropFilter: 'var(--crm-backdrop-blur)',
        zIndex: 'var(--iso-z-modal)',
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        ref={dialogRef}
        style={{
          background: 'var(--iso-bg)',
          borderRadius: 'var(--iso-radius-xl)',
          boxShadow: 'var(--iso-shadow-modal)',
          padding: 'var(--iso-space-6)',
          width: '100%',
          maxWidth: '440px',
          animation: 'crm-pop var(--crm-base) var(--crm-ease-decelerate)',
        }}
      >
        <h2
          id="confirm-dialog-title"
          style={{
            margin: '0 0 var(--iso-space-2)',
            font: '500 18px/1.3 var(--iso-font-display)',
            color: 'var(--iso-fg-strong)',
          }}
        >
          {title}
        </h2>

        {body && (
          <p
            style={{
              margin: '0 0 var(--iso-space-6)',
              font: '400 14px/1.5 var(--iso-font-body)',
              color: 'var(--iso-fg-muted)',
            }}
          >
            {body}
          </p>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--iso-space-2)',
            marginTop: body ? 0 : 'var(--iso-space-6)',
          }}
        >
          <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
