import React from 'react'

type DashboardProps = {
  title?: string
  children: React.ReactNode
}

export function Dashboard({ title = 'Dashboard', children }: DashboardProps) {
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 'var(--iso-space-5)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
