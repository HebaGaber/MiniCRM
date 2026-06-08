import { Icon } from './Icon'
import { Button } from './Button'

type ErrorStateProps = {
  title?: string
  body?: string
  onRetry?: () => void
}

export function ErrorState({
  title = "Can't load data",
  body = 'Try refreshing — if the problem persists, contact support.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '48px var(--iso-space-6)',
        gap: 'var(--iso-space-1-5)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '56px',
          height: '56px',
          borderRadius: 'var(--iso-radius-lg)',
          background: 'var(--iso-danger-soft)',
          color: 'var(--iso-danger)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--iso-space-2-5)',
          flexShrink: 0,
        }}
      >
        <Icon name="cloud-off" size={26} strokeWidth={1.5} />
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

      <p
        style={{
          margin: '2px 0 0',
          maxWidth: '40ch',
          font: '400 13px/20px var(--iso-font-body)',
          color: 'var(--iso-fg-muted)',
        }}
      >
        {body}
      </p>

      {onRetry && (
        <div style={{ marginTop: 'var(--iso-space-3-5)' }}>
          <Button variant="secondary" leadIcon="refresh-cw" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
    </div>
  )
}
