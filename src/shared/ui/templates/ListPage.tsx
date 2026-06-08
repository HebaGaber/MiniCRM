import React from 'react'
import { Button } from '../components/Button'

type PageHeaderProps = {
  eyebrow?: string
  title: string
  subtitle?: string
  statusPill?: React.ReactNode
  breadcrumbs?: Array<{ label: string; onClick?: () => void }>
  primary?: React.ReactNode
  secondary?: React.ReactNode
  back?: () => void
  right?: React.ReactNode
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  statusPill,
  breadcrumbs,
  primary,
  secondary,
  back,
  right,
}: PageHeaderProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--iso-space-3-5)' }}>
      {breadcrumbs && (
        <nav
          aria-label="Breadcrumb"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--iso-space-1-5)', font: '400 12px/1 var(--iso-font-body)' }}
        >
          {breadcrumbs.map((b, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ color: 'var(--iso-fg-subtle)' }}>›</span>}
              <span
                onClick={b.onClick}
                style={{
                  color: i === breadcrumbs.length - 1 ? 'var(--iso-fg)' : 'var(--iso-fg-muted)',
                  fontWeight: i === breadcrumbs.length - 1 ? 500 : 400,
                  cursor: b.onClick ? 'pointer' : 'default',
                }}
              >
                {b.label}
              </span>
            </React.Fragment>
          ))}
        </nav>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--iso-space-5)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--iso-space-3)', minWidth: 0 }}>
          {back && (
            <button
              onClick={back}
              aria-label="Back"
              style={{
                width: '36px',
                height: '36px',
                marginTop: '2px',
                borderRadius: 'var(--iso-radius-sm)',
                border: '1px solid var(--iso-border)',
                background: 'var(--iso-bg)',
                color: 'var(--iso-fg-muted)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              ‹
            </button>
          )}

          <div style={{ minWidth: 0 }}>
            {eyebrow && (
              <div
                style={{
                  font: '500 10px/1 var(--iso-font-ui)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--iso-fg-subtle)',
                  marginBottom: 'var(--iso-space-1-5)',
                }}
              >
                {eyebrow}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--iso-space-3)', flexWrap: 'wrap' }}>
              <h1
                style={{
                  margin: 0,
                  font: '500 28px/1.15 var(--iso-font-display)',
                  letterSpacing: '-0.02em',
                  color: 'var(--iso-fg-strong)',
                }}
              >
                {title}
              </h1>
              {statusPill}
            </div>
            {subtitle && (
              <p
                style={{
                  margin: 'var(--iso-space-2) 0 0',
                  font: '400 14px/1.5 var(--iso-font-body)',
                  color: 'var(--iso-fg-muted)',
                  maxWidth: '64ch',
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--iso-space-2)' }}>
          {right}
          {secondary}
          {primary}
        </div>
      </div>
    </div>
  )
}

type ListPageProps = {
  title: string
  noun: string
  icon?: string
  createLabel?: string | null
  onCreate?: () => void
  toolbar?: React.ReactNode
  filterBar?: React.ReactNode
  table: React.ReactNode
  pagination?: React.ReactNode
}

export function ListPage({
  title,
  createLabel,
  onCreate,
  toolbar,
  filterBar,
  table,
  pagination,
}: ListPageProps) {
  return (
    <div
      style={{
        padding: '28px var(--iso-space-8)',
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--iso-space-6)',
      }}
    >
      <PageHeader
        title={title}
        primary={
          createLabel && onCreate ? (
            <Button variant="primary" leadIcon="plus" onClick={onCreate}>
              {createLabel}
            </Button>
          ) : undefined
        }
      />

      <div
        style={{
          background: 'var(--iso-bg)',
          borderRadius: 'var(--iso-radius-lg)',
          border: '1px solid var(--iso-border)',
          overflow: 'hidden',
          boxShadow: 'var(--iso-shadow-xs)',
        }}
      >
        {toolbar}
        {filterBar}
        {table}
        {pagination && (
          <div
            style={{
              padding: 'var(--iso-space-3) var(--iso-space-4)',
              borderTop: '1px solid var(--iso-border-muted)',
            }}
          >
            {pagination}
          </div>
        )}
      </div>
    </div>
  )
}
