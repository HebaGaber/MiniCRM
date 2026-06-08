import React from 'react'

type DetailPageProps = {
  pager?: React.ReactNode
  header: React.ReactNode
  aside?: React.ReactNode
  children: React.ReactNode
  viewMode?: 'side' | 'full'
  sideList?: React.ReactNode
}

export function DetailPage({ pager, header, aside, children, viewMode = 'full', sideList }: DetailPageProps) {
  const isSide = viewMode === 'side' && sideList != null

  if (isSide) {
    return (
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        {/* Side list panel */}
        <div
          style={{
            width: '40%',
            flexShrink: 0,
            borderRight: '1px solid var(--iso-border)',
            overflow: 'auto',
            background: 'var(--iso-bg)',
          }}
        >
          {sideList}
        </div>

        {/* Detail panel */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {pager}
          <div
            style={{
              padding: '28px var(--iso-space-8)',
              maxWidth: '1280px',
              margin: '0 auto',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--iso-space-6)',
            }}
          >
            {header}
            <div style={{ display: 'flex', gap: 'var(--iso-space-6)', alignItems: 'flex-start' }}>
              <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
              {aside && (
                <aside
                  style={{
                    width: '280px',
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--iso-space-4)',
                  }}
                >
                  {aside}
                </aside>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {pager}
      <div
        style={{
          padding: '28px var(--iso-space-8)',
          maxWidth: '1280px',
          margin: '0 auto',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--iso-space-6)',
        }}
      >
        {header}
        <div style={{ display: 'flex', gap: 'var(--iso-space-6)', alignItems: 'flex-start' }}>
          <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
          {aside && (
            <aside
              style={{
                width: '320px',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--iso-space-4)',
              }}
            >
              {aside}
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
