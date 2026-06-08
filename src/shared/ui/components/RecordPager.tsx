import { useEffect, useCallback } from 'react'
import { Icon } from './Icon'

type ViewMode = 'side' | 'full'

const VIEW_MODE_KEY = 'crm-view-mode'

// eslint-disable-next-line react-refresh/only-export-components
export function getStoredViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem(VIEW_MODE_KEY)
    if (stored === 'side' || stored === 'full') return stored
  } catch {
    // localStorage unavailable
  }
  return 'full'
}

function setStoredViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode)
  } catch {
    // localStorage unavailable
  }
}

type RecordPagerProps = {
  index: number
  total: number
  noun: string
  viewMode: ViewMode
  onViewMode: (mode: ViewMode) => void
  onPrev: () => void
  onNext: () => void
  onClose: () => void
}

function inInput(): boolean {
  const el = document.activeElement
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  )
}

function hasOpenModal(): boolean {
  return document.querySelector('[aria-modal="true"]') !== null
}

export function RecordPager({
  index,
  total,
  noun,
  viewMode,
  onViewMode,
  onPrev,
  onNext,
  onClose,
}: RecordPagerProps) {
  const hasPrev = index > 0
  const hasNext = index < total - 1

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (inInput() || hasOpenModal()) return

      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'k') {
        if (hasPrev) { e.preventDefault(); onPrev() }
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'j') {
        if (hasNext) { e.preventDefault(); onNext() }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [hasPrev, hasNext, onPrev, onNext, onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleViewMode = (mode: ViewMode) => {
    setStoredViewMode(mode)
    onViewMode(mode)
  }

  const navBtn = (
    enabled: boolean,
    onClick: () => void,
    icon: string,
    label: string,
  ) => (
    <button
      onClick={enabled ? onClick : undefined}
      disabled={!enabled}
      aria-label={label}
      title={label}
      style={{
        width: '30px',
        height: '30px',
        borderRadius: 'var(--iso-radius-sm)',
        border: '1px solid var(--iso-border)',
        background: 'var(--iso-bg)',
        color: enabled ? 'var(--iso-fg-muted)' : 'var(--iso-fg-disabled)',
        cursor: enabled ? 'pointer' : 'default',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: enabled ? 1 : 0.5,
        transition: 'background-color var(--crm-fast) var(--crm-ease-standard)',
      }}
    >
      <Icon name={icon} size={16} />
    </button>
  )

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--iso-space-2-5)',
        padding: 'var(--iso-space-2-5) var(--iso-space-4)',
        borderBottom: '1px solid var(--iso-border)',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'saturate(140%) blur(6px)',
        position: 'sticky',
        top: 0,
        zIndex: 'var(--iso-z-sticky)',
      }}
    >
      {/* Prev / next nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--iso-space-1-5)' }}>
        {navBtn(hasPrev, onPrev, 'chevron-left', 'Previous record')}
        {navBtn(hasNext, onNext, 'chevron-right', 'Next record')}
      </div>

      {/* Position label */}
      <span
        style={{
          font: '400 13px/1 var(--iso-font-ui)',
          color: 'var(--iso-fg-muted)',
          whiteSpace: 'nowrap',
        }}
      >
        {index + 1} of {total} · {noun}
      </span>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--iso-space-1-5)' }}>
        {/* Side/Full view toggle */}
        <button
          onClick={() => handleViewMode('side')}
          aria-label="Side view"
          title="Side view"
          aria-pressed={viewMode === 'side'}
          style={{
            width: '30px',
            height: '30px',
            borderRadius: 'var(--iso-radius-sm)',
            border: '1px solid var(--iso-border)',
            background: viewMode === 'side' ? 'var(--iso-brand-soft)' : 'var(--iso-bg)',
            color: viewMode === 'side' ? 'var(--iso-brand)' : 'var(--iso-fg-muted)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="layout-panel-left" size={15} />
        </button>

        <button
          onClick={() => handleViewMode('full')}
          aria-label="Full view"
          title="Full view"
          aria-pressed={viewMode === 'full'}
          style={{
            width: '30px',
            height: '30px',
            borderRadius: 'var(--iso-radius-sm)',
            border: '1px solid var(--iso-border)',
            background: viewMode === 'full' ? 'var(--iso-brand-soft)' : 'var(--iso-bg)',
            color: viewMode === 'full' ? 'var(--iso-brand)' : 'var(--iso-fg-muted)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="maximize-2" size={15} />
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close detail"
          title="Close"
          style={{
            width: '30px',
            height: '30px',
            borderRadius: 'var(--iso-radius-sm)',
            border: '1px solid transparent',
            background: 'transparent',
            color: 'var(--iso-fg-muted)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="x" size={16} />
        </button>
      </div>
    </div>
  )
}
