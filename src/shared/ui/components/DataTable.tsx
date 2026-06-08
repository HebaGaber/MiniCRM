import React, { useState, useEffect, useRef } from 'react'
import { Icon } from './Icon'
import { Skeleton } from './Skeleton'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'

export type ColumnDef<R> = {
  id?: string
  header: string
  width?: string
  align?: 'left' | 'right'
  sortVal?: (r: R) => string | number
  render?: (r: R) => React.ReactNode
  key?: keyof R
  skelW?: string
  wrap?: boolean
}

type RowAction = {
  label: string
  icon?: string
  tone?: 'danger'
  onClick: () => void
}

type EmptyConfig = {
  title?: string
  body?: string
  action?: { label: string; icon?: string; onClick: () => void; autoFocus?: boolean }
}

type DataTableProps<R extends { id?: string | number }> = {
  columns: ColumnDef<R>[]
  rows: R[]
  state?: 'loading' | 'empty' | 'error' | 'ready'
  onRetry?: () => void
  empty?: EmptyConfig
  rowActions?: (row: R) => RowAction[]
  onRowClick?: (row: R) => void
  skeletonRows?: number
  activeId?: string | null
  sortCol?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (col: ColumnDef<R>) => void
}

function RowActions({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        aria-label="Row actions"
        style={{
          width: '30px',
          height: '30px',
          borderRadius: 'var(--iso-radius-sm)',
          border: '1px solid transparent',
          background: open ? 'var(--iso-n-100)' : 'transparent',
          color: 'var(--iso-fg-muted)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="more-horizontal" size={16} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '34px',
            right: 0,
            minWidth: '168px',
            background: 'var(--iso-bg)',
            border: '1px solid var(--iso-border)',
            borderRadius: 'var(--iso-radius-md)',
            boxShadow: 'var(--iso-shadow-lg)',
            padding: 'var(--iso-space-1)',
            zIndex: 'var(--iso-z-dropdown)',
          }}
        >
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setOpen(false); a.onClick() }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--iso-space-2)',
                width: '100%',
                height: '34px',
                padding: '0 var(--iso-space-2-5)',
                border: 0,
                background: 'transparent',
                borderRadius: 'var(--iso-radius-xs)',
                cursor: 'pointer',
                textAlign: 'left',
                font: '400 13px/1 var(--iso-font-body)',
                color: a.tone === 'danger' ? 'var(--iso-danger)' : 'var(--iso-fg)',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLElement).style.background =
                  a.tone === 'danger' ? 'var(--iso-danger-soft)' : 'var(--iso-n-100)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              {a.icon && <Icon name={a.icon} size={14} />}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function DataTable<R extends { id?: string | number }>({
  columns,
  rows,
  state = 'ready',
  onRetry,
  empty,
  rowActions,
  onRowClick,
  skeletonRows = 6,
  activeId,
  sortCol,
  sortDir,
  onSort,
}: DataTableProps<R>) {
  const gridCols =
    columns.map(c => c.width ?? '1fr').join(' ') + (rowActions ? ' 44px' : '')

  const headerRow = (
    <div
      role="row"
      style={{
        display: 'grid',
        gridTemplateColumns: gridCols,
        gap: 'var(--iso-space-4)',
        alignItems: 'center',
        padding: '0 var(--iso-space-4)',
        height: '40px',
        borderBottom: '1px solid var(--iso-border)',
        background: 'var(--iso-blue-3-50)',
      }}
    >
      {columns.map((col, i) => {
        const sortable = onSort && col.id
        const active = sortable && sortCol === col.id
        const baseStyle: React.CSSProperties = {
          font: '500 10px/1 var(--iso-font-ui)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: active ? 'var(--iso-brand)' : 'var(--iso-fg-subtle)',
          textAlign: col.align ?? 'left',
        }

        if (!sortable) {
          return (
            <div key={i} role="columnheader" style={baseStyle}>
              {col.header}
            </div>
          )
        }

        return (
          <button
            key={i}
            role="columnheader"
            aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
            onClick={() => onSort(col)}
            style={{
              ...baseStyle,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--iso-space-1)',
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
              justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start',
            }}
          >
            {col.header}
            <Icon
              name={active ? (sortDir === 'asc' ? 'arrow-up' : 'arrow-down') : 'chevrons-up-down'}
              size={12}
              style={{ color: active ? 'var(--iso-brand)' : 'var(--iso-n-300)' }}
            />
          </button>
        )
      })}
      {rowActions && <div />}
    </div>
  )

  let bodyContent: React.ReactNode

  if (state === 'loading') {
    bodyContent = Array.from({ length: skeletonRows }).map((_, r) => (
      <div
        key={r}
        role="row"
        style={{
          display: 'grid',
          gridTemplateColumns: gridCols,
          gap: 'var(--iso-space-4)',
          alignItems: 'center',
          padding: '0 var(--iso-space-4)',
          height: '52px',
          borderBottom: '1px solid var(--iso-border-muted)',
        }}
      >
        {columns.map((col, i) => (
          <Skeleton key={i} w={col.skelW ?? (i === 0 ? '70%' : '45%')} h={12} />
        ))}
        {rowActions && <Skeleton w={18} h={18} r={4} />}
      </div>
    ))
  } else if (state === 'error') {
    bodyContent = <ErrorState onRetry={onRetry} />
  } else if (state === 'empty') {
    bodyContent = (
      <EmptyState
        title={empty?.title ?? 'Nothing here yet'}
        body={empty?.body ?? 'When records exist in this scope, they appear here.'}
        action={empty?.action}
      />
    )
  } else {
    bodyContent = rows.map((row, r) => {
      const rowId = row.id != null ? String(row.id) : String(r)
      const isActive = activeId != null && rowId === String(activeId)

      return (
        <div
          key={rowId}
          role="row"
          tabIndex={0}
          onClick={() => onRowClick?.(row)}
          onKeyDown={e => {
            if ((e.key === 'Enter' || e.key === ' ') && onRowClick) {
              e.preventDefault()
              onRowClick(row)
            }
          }}
          className="crm-trow"
          data-active={isActive ? 'true' : undefined}
          style={{
            display: 'grid',
            gridTemplateColumns: gridCols,
            gap: 'var(--iso-space-4)',
            alignItems: 'center',
            padding: '0 var(--iso-space-4)',
            minHeight: '52px',
            borderBottom: '1px solid var(--iso-border-muted)',
            background: isActive ? 'var(--iso-brand-soft)' : undefined,
            boxShadow: isActive ? 'inset 3px 0 0 var(--iso-brand)' : undefined,
            cursor: onRowClick ? 'pointer' : 'default',
            outline: 'none',
            transition: 'background-color var(--crm-fast) var(--crm-ease-standard)',
          }}
        >
          {columns.map((col, i) => (
            <div
              key={i}
              style={{
                font: '400 13px/1.4 var(--iso-font-body)',
                color: 'var(--iso-fg)',
                textAlign: col.align ?? 'left',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: col.wrap ? 'normal' : 'nowrap',
              }}
            >
              {col.render
                ? col.render(row)
                : col.key != null
                  ? String(row[col.key] ?? '')
                  : null}
            </div>
          ))}
          {rowActions && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <RowActions actions={rowActions(row)} />
            </div>
          )}
        </div>
      )
    })
  }

  return (
    <div role="table" aria-label="table" style={{ width: '100%', overflow: 'auto' }}>
      {headerRow}
      <div>{bodyContent}</div>
    </div>
  )
}
