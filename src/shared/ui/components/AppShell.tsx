import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from './Icon'
import { pushToast } from './Toast'
import { useAuth } from '../../auth/useAuth'
import { subscribe } from '../../events/bus'
import type { DomainEvent } from '../../events/bus'
import type { Role } from '../../domain/status'

type NavItem = {
  id: string
  label: string
  icon: string
  path: string
  roles: Role[]
}

const NAV_ITEMS: NavItem[] = [
  { id: 'leads',       label: 'Leads',       icon: 'user-plus',  path: '/leads',       roles: ['tenant_admin', 'sales'] },
  { id: 'customers',   label: 'Customers',   icon: 'building-2', path: '/customers',   roles: ['tenant_admin', 'sales', 'support', 'viewer'] },
  { id: 'tickets',     label: 'Tickets',     icon: 'life-buoy',  path: '/tickets',     roles: ['tenant_admin', 'support', 'sales'] },
  { id: 'subsidiaries',label: 'Subsidiaries',icon: 'layers',     path: '/subsidiaries',roles: ['tenant_admin'] },
]

function Wordmark({ collapsed }: { collapsed: boolean }) {
  if (collapsed) return null
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        font: '500 18px/1 var(--iso-font-display)',
        letterSpacing: '-0.02em',
        color: 'var(--iso-fg-strong)',
      }}
    >
      min
      <span
        style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          background: 'var(--iso-accent)',
          margin: '0 2px',
          flexShrink: 0,
        }}
      />
      <span style={{ color: 'var(--iso-brand)' }}>crm</span>
    </span>
  )
}

function UserMenuDropdown({ onClose }: { onClose: () => void }) {
  const { session, signIn, signOut } = useAuth()
  const roles: Role[] = ['tenant_admin', 'sales', 'support', 'viewer']

  const handleSwitchRole = (roleId: string) => {
    const unsub = subscribe((event: DomainEvent) => {
      if (event.type === 'Auth.LoginFailed') {
        pushToast({ tone: 'danger', title: 'Role not found', body: `"${roleId}" is not a valid demo role.` })
        unsub()
      }
    })
    signIn(roleId)
    onClose()
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '44px',
        right: 0,
        width: '240px',
        background: 'var(--iso-bg)',
        border: '1px solid var(--iso-border)',
        borderRadius: 'var(--iso-radius-md)',
        boxShadow: 'var(--iso-shadow-lg)',
        zIndex: 'var(--iso-z-dropdown)',
        overflow: 'hidden',
        animation: 'crm-pop var(--crm-base) var(--crm-ease-decelerate)',
      }}
    >
      <div
        style={{
          padding: 'var(--iso-space-3) var(--iso-space-4)',
          borderBottom: '1px solid var(--iso-border-muted)',
        }}
      >
        <div style={{ font: '500 13px/1.3 var(--iso-font-body)', color: 'var(--iso-fg-strong)' }}>
          {session?.userId ?? 'Demo User'}
        </div>
        <div style={{ font: '400 11px/1.3 var(--iso-font-ui)', color: 'var(--iso-fg-muted)', marginTop: '2px' }}>
          {session?.roles.join(', ') ?? '—'}
        </div>
      </div>

      <div style={{ padding: 'var(--iso-space-1)' }}>
        <div
          style={{
            font: '500 10px/1 var(--iso-font-ui)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--iso-fg-subtle)',
            padding: 'var(--iso-space-2) var(--iso-space-2-5)',
          }}
        >
          Switch role (demo)
        </div>
        {roles.map(roleId => (
          <button
            key={roleId}
            onClick={() => handleSwitchRole(roleId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              height: '32px',
              padding: '0 var(--iso-space-2-5)',
              border: 0,
              background: 'transparent',
              borderRadius: 'var(--iso-radius-xs)',
              cursor: 'pointer',
              font: '400 13px/1 var(--iso-font-body)',
              color: 'var(--iso-fg)',
              textAlign: 'left',
            }}
            onMouseEnter={e => { ;(e.currentTarget).style.background = 'var(--iso-n-100)' }}
            onMouseLeave={e => { ;(e.currentTarget).style.background = 'transparent' }}
          >
            {roleId}
          </button>
        ))}

        <div style={{ height: '1px', background: 'var(--iso-border-muted)', margin: 'var(--iso-space-1) 0' }} />

        <button
          onClick={() => { signOut(); onClose() }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--iso-space-2)',
            width: '100%',
            height: '32px',
            padding: '0 var(--iso-space-2-5)',
            border: 0,
            background: 'transparent',
            borderRadius: 'var(--iso-radius-xs)',
            cursor: 'pointer',
            font: '400 13px/1 var(--iso-font-body)',
            color: 'var(--iso-danger)',
            textAlign: 'left',
          }}
          onMouseEnter={e => { ;(e.currentTarget).style.background = 'var(--iso-danger-soft)' }}
          onMouseLeave={e => { ;(e.currentTarget).style.background = 'transparent' }}
        >
          <Icon name="log-out" size={14} />
          Sign out
        </button>
      </div>
    </div>
  )
}

type AppShellProps = {
  children?: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { session } = useAuth()
  const location = useLocation()
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userMenuOpen) return
    const h = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [userMenuOpen])

  const userRoles = session?.roles ?? []
  const visibleNav = NAV_ITEMS.filter(item =>
    item.roles.some(r => userRoles.includes(r)),
  )

  const navWidth = collapsed ? '64px' : '248px'
  const initials = (session?.userId ?? 'DU')
    .split(/[\s_]/)
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: '64px 1fr',
        gridTemplateColumns: `${navWidth} 1fr`,
        gridTemplateAreas: '"logo topbar" "nav main"',
        minHeight: '100vh',
        background: 'var(--iso-blue-3-50)',
        transition: 'grid-template-columns var(--crm-base) var(--crm-ease-standard)',
      }}
    >
      {/* Logo area */}
      <div
        style={{
          gridArea: 'logo',
          background: 'var(--iso-bg)',
          borderRight: '1px solid var(--iso-border)',
          borderBottom: '1px solid var(--iso-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--iso-space-3)',
          padding: collapsed ? 0 : '0 var(--iso-space-4)',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        <button
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          style={{
            width: '30px',
            height: '30px',
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
          <Icon name="menu" size={18} />
        </button>
        <Wordmark collapsed={collapsed} />
      </div>

      {/* Sidebar nav */}
      <nav
        aria-label="Main navigation"
        style={{
          gridArea: 'nav',
          background: 'var(--iso-bg)',
          borderRight: '1px solid var(--iso-border)',
          padding: 'var(--iso-space-2-5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--iso-space-0-5)',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {!collapsed && (
          <div
            style={{
              font: '500 10px/1 var(--iso-font-ui)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--iso-fg-subtle)',
              padding: 'var(--iso-space-2) var(--iso-space-3) var(--iso-space-1-5)',
            }}
          >
            Workspace
          </div>
        )}

        {visibleNav.map(item => {
          const isActive = location.pathname.startsWith(item.path)
          return (
            <Link
              key={item.id}
              to={item.path}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: collapsed ? 0 : '11px',
                height: '38px',
                padding: collapsed ? 0 : '0 var(--iso-space-3)',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 'var(--iso-radius-sm)',
                textDecoration: 'none',
                background: isActive ? 'var(--iso-brand)' : 'transparent',
                color: isActive ? 'var(--iso-fg-on-brand)' : 'var(--iso-fg-muted)',
                font: `${isActive ? 500 : 400} 13px/1 var(--iso-font-body)`,
                transition: 'color var(--crm-fast) var(--crm-ease-standard)',
              }}
            >
              <Icon name={item.icon} size={17} />
              {!collapsed && item.label}
            </Link>
          )
        })}

        {/* Build section */}
        <div
          style={{
            marginTop: 'auto',
            borderTop: '1px solid var(--iso-border-muted)',
            paddingTop: 'var(--iso-space-2-5)',
          }}
        >
          {!collapsed && (
            <div
              style={{
                font: '500 10px/1 var(--iso-font-ui)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--iso-fg-subtle)',
                padding: 'var(--iso-space-1) var(--iso-space-3) var(--iso-space-2)',
              }}
            >
              Build
            </div>
          )}
          <Link
            to="/components"
            title={collapsed ? 'Components' : undefined}
            aria-current={location.pathname === '/components' ? 'page' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: collapsed ? 0 : '11px',
              height: '38px',
              padding: collapsed ? 0 : '0 var(--iso-space-3)',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: 'var(--iso-radius-sm)',
              textDecoration: 'none',
              background: location.pathname === '/components' ? 'var(--iso-brand-soft)' : 'transparent',
              color: location.pathname === '/components' ? 'var(--iso-brand)' : 'var(--iso-fg-muted)',
              font: '400 13px/1 var(--iso-font-body)',
              transition: 'color var(--crm-fast) var(--crm-ease-standard)',
            }}
          >
            <Icon name="component" size={17} />
            {!collapsed && 'Components'}
          </Link>
        </div>
      </nav>

      {/* Topbar */}
      <header
        style={{
          gridArea: 'topbar',
          background: 'var(--iso-bg)',
          borderBottom: '1px solid var(--iso-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--iso-space-3)',
          padding: '0 var(--iso-space-6)',
        }}
      >
        {/* Scope switcher placeholder — E1-S4 fills this */}
        <div
          aria-label="Scope switcher (coming soon)"
          style={{
            height: '38px',
            padding: '0 var(--iso-space-3)',
            border: '1px solid var(--iso-border)',
            borderRadius: 'var(--iso-radius-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--iso-space-2)',
            font: '400 13px/1 var(--iso-font-body)',
            color: 'var(--iso-fg-muted)',
          }}
        >
          <Icon name="layers" size={15} />
          <span>All scopes</span>
        </div>

        {/* Search (decorative) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--iso-space-2)',
            height: '36px',
            padding: '0 var(--iso-space-3)',
            border: '1px solid var(--iso-border)',
            borderRadius: 'var(--iso-radius-sm)',
            flex: '1 1 320px',
            maxWidth: '480px',
            background: 'var(--iso-bg-subtle)',
          }}
        >
          <Icon name="search" size={15} style={{ color: 'var(--iso-fg-subtle)', flexShrink: 0 }} />
          <span style={{ font: '400 13px/1 var(--iso-font-body)', color: 'var(--iso-fg-subtle)' }}>
            Search records, tickets, people…
          </span>
          <span
            style={{
              marginLeft: 'auto',
              font: '400 11px/1 var(--iso-font-ui)',
              color: 'var(--iso-fg-subtle)',
              border: '1px solid var(--iso-border)',
              borderRadius: 'var(--iso-radius-xs)',
              padding: '2px 5px',
              flexShrink: 0,
            }}
          >
            ⌘K
          </span>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--iso-space-2)' }}>
          {/* Notifications bell placeholder — E0-S12 fills this */}
          <button
            aria-label="Notifications (coming soon)"
            style={{
              width: '38px',
              height: '38px',
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
            <Icon name="bell" size={19} />
          </button>

          {/* User menu */}
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setUserMenuOpen(o => !o)}
              aria-label="User menu"
              aria-expanded={userMenuOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--iso-space-2)',
                height: '38px',
                padding: '0 var(--iso-space-2)',
                border: '1px solid transparent',
                borderRadius: 'var(--iso-radius-sm)',
                background: userMenuOpen ? 'var(--iso-n-100)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'var(--iso-brand)',
                  color: 'var(--iso-fg-on-brand)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  font: `500 11px/1 var(--iso-font-ui)`,
                  flexShrink: 0,
                }}
              >
                {initials}
              </span>
              <Icon name="chevron-down" size={14} style={{ color: 'var(--iso-fg-subtle)' }} />
            </button>

            {userMenuOpen && (
              <UserMenuDropdown onClose={() => setUserMenuOpen(false)} />
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main
        style={{
          gridArea: 'main',
          overflow: 'auto',
          background: 'var(--iso-blue-3-50)',
        }}
      >
        {children}
      </main>
    </div>
  )
}
