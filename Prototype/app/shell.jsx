/* global React, Icon, Avatar, ROLES, SUBSIDIARIES, TENANT, NAV_GROUPS, navFor, StatusPill, useStore, activeSubs */
/* min-crm — app shell: logo, role-gated nav, topbar (scope switcher · search · bell · user). */
const { useState: useS, useEffect: useE, useRef: useR } = React;

/* ---------------- min-crm wordmark ---------------- */
function Wordmark({ size = 18, dim = false }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', font: `500 ${size}px/1 var(--iso-font-display)`, letterSpacing: '-0.02em',
      color: dim ? 'var(--iso-fg-on-brand)' : 'var(--iso-fg-strong)' }}>
      min<span style={{ width: size * 0.28, height: size * 0.28, borderRadius: '50%', background: 'var(--iso-accent)', margin: '0 2px' }} />
      <span style={{ color: dim ? 'var(--iso-fg-on-brand)' : 'var(--iso-brand)' }}>crm</span>
    </span>
  );
}

/* ---------------- Avatar ---------------- */
function Avatar({ initials = 'SK', size = 28, color = 'var(--iso-brand)' }) {
  return <span style={{ width: size, height: size, flex: 'none', borderRadius: '50%', background: color, color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: `500 ${Math.round(size * 0.38)}px/1 var(--iso-font-ui)` }}>{initials}</span>;
}

/* ---------------- Sidebar (role-gated, grouped) ---------------- */
function Sidebar({ role, current, onNavigate, onCollapse, collapsed, onOpenGallery, galleryOpen }) {
  const items = navFor(role.id);
  const NavItem = (item) => {
    const active = item.id === current && !galleryOpen;
    return (
      <button key={item.id} onClick={() => onNavigate(item.id)} title={item.label} className="crm-navbtn" data-active={active ? 'true' : 'false'} style={{
        display: 'flex', alignItems: 'center', gap: 11, height: 38, padding: collapsed ? 0 : '0 12px', justifyContent: collapsed ? 'center' : 'flex-start',
        border: 0, borderRadius: 'var(--iso-radius-sm)', cursor: 'pointer', textAlign: 'left',
        background: 0, backgroundColor: active ? 'var(--iso-brand)' : 'transparent', color: active ? '#fff' : 'var(--iso-fg-muted)',
        font: `${active ? 500 : 400} 13px/1 var(--iso-font-body)`,
        transition: 'color var(--crm-fast) var(--crm-ease-standard)' }}>
        <Icon name={item.icon} size={17} />
        {!collapsed && item.label}
      </button>
    );
  };
  return (
    <>
      <div style={{ gridArea: 'logo', background: '#fff', borderRight: '1px solid var(--iso-border)', borderBottom: '1px solid var(--iso-border)',
        display: 'flex', alignItems: 'center', gap: 12, padding: collapsed ? '0' : '0 16px', justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <button onClick={onCollapse} aria-label="Toggle navigation" style={{ width: 30, height: 30, borderRadius: 'var(--iso-radius-sm)', border: 0, background: 'transparent',
          color: 'var(--iso-fg-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <Icon name="menu" size={18} />
        </button>
        {!collapsed && <Wordmark size={18} />}
      </div>

      <nav style={{ gridArea: 'nav', background: '#fff', borderRight: '1px solid var(--iso-border)', padding: 10,
        display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto' }}>
        {NAV_GROUPS.map(g => {
          const groupItems = items.filter(it => it.group === g.id);
          if (!groupItems.length) return null;
          return (
            <React.Fragment key={g.id}>
              {!collapsed && <div style={{ font: '500 10px/1 var(--iso-font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)', padding: g.id === 'workspace' ? '8px 12px 6px' : '14px 12px 6px' }}>{g.label}</div>}
              {collapsed && g.id !== 'workspace' && <div style={{ height: 1, background: 'var(--iso-border-muted)', margin: '8px 6px' }} />}
              {groupItems.map(NavItem)}
            </React.Fragment>
          );
        })}

        {/* Build / inventory section (meta) */}
        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--iso-border-muted)', paddingTop: 10, marginInline: -2 }}>
          {!collapsed && <div style={{ font: '500 10px/1 var(--iso-font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)', padding: '4px 12px 8px' }}>Build</div>}
          <button onClick={onOpenGallery} title="Component inventory" className="crm-navbtn crm-navbtn-soft" data-active={galleryOpen ? 'true' : 'false'} style={{
            display: 'flex', alignItems: 'center', gap: 11, height: 38, padding: collapsed ? 0 : '0 12px', justifyContent: collapsed ? 'center' : 'flex-start',
            border: 0, borderRadius: 'var(--iso-radius-sm)', cursor: 'pointer', textAlign: 'left', width: '100%',
            background: galleryOpen ? 'var(--iso-brand-soft)' : 'transparent', color: galleryOpen ? 'var(--iso-brand)' : 'var(--iso-fg-muted)',
            font: `${galleryOpen ? 500 : 400} 13px/1 var(--iso-font-body)`,
            transition: 'color var(--crm-fast) var(--crm-ease-standard)' }}>
            <Icon name="component" size={17} />
            {!collapsed && 'Components'}
          </button>
        </div>
      </nav>
    </>
  );
}

/* ---------------- Scope switcher (store-backed) ---------------- */
function ScopeSwitcher({ role, scope, onScope }) {
  const [open, setOpen] = useS(false);
  const ref = useR(null);
  const st = useStore();
  const subs = activeSubs(st);
  useE(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const isTenant = scope === 'tenant';
  const currentName = isTenant ? 'Whole tenant (roll-up)' : (subs.find(s => s.id === scope)?.name || '—');
  const locked = role.scopeFixed;

  const Chip = (
    <button disabled={locked} onClick={() => !locked && setOpen(o => !o)} title={locked ? 'Scope is fixed for your role' : 'Switch scope'} style={{
      display: 'flex', alignItems: 'center', gap: 10, height: 38, padding: '0 12px', cursor: locked ? 'default' : 'pointer',
      border: `1px solid ${open ? 'var(--iso-brand)' : 'var(--iso-border)'}`, borderRadius: 'var(--iso-radius-sm)', background: '#fff',
      boxShadow: open ? 'var(--iso-shadow-focus)' : 'none', transition: 'border-color var(--crm-fast) var(--crm-ease-standard), box-shadow var(--crm-fast) var(--crm-ease-standard)' }}>
      <span style={{ width: 26, height: 26, borderRadius: 'var(--iso-radius-xs)', background: isTenant ? 'var(--iso-brand)' : 'var(--iso-brand-soft)',
        color: isTenant ? '#fff' : 'var(--iso-brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <Icon name={isTenant ? 'layers' : 'building-2'} size={15} />
      </span>
      <span style={{ textAlign: 'left', minWidth: 0 }}>
        <span style={{ display: 'block', font: '500 12px/1.2 var(--iso-font-body)', color: 'var(--iso-fg-strong)', whiteSpace: 'nowrap' }}>{TENANT.name}</span>
        <span style={{ display: 'block', font: '400 11px/1.2 var(--iso-font-ui)', color: 'var(--iso-fg-muted)', whiteSpace: 'nowrap' }}>{currentName}</span>
      </span>
      {locked
        ? <Icon name="lock" size={13} style={{ color: 'var(--iso-fg-subtle)', marginLeft: 2 }} />
        : <Icon name="chevrons-up-down" size={15} style={{ color: 'var(--iso-fg-subtle)', marginLeft: 2 }} />}
    </button>
  );

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {Chip}
      {open && !locked && (
        <div style={{ position: 'absolute', top: 44, left: 0, width: 288, background: '#fff', border: '1px solid var(--iso-border)',
          borderRadius: 'var(--iso-radius-md)', boxShadow: 'var(--iso-shadow-lg)', padding: 6, zIndex: 'var(--iso-z-dropdown)',
          animation: 'crm-pop var(--crm-base) var(--crm-ease-decelerate)' }}>
          <div style={{ font: '500 10px/1 var(--iso-font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)', padding: '8px 10px 6px' }}>{TENANT.name} · scope</div>
          <ScopeOption active={isTenant} icon="layers" name="Whole tenant (roll-up)" sub="Aggregate across the tenant" onClick={() => { onScope('tenant'); setOpen(false); }} />
          <div style={{ height: 1, background: 'var(--iso-border-muted)', margin: '4px 8px' }} />
          {subs.map(s => (
            <ScopeOption key={s.id} active={scope === s.id} icon="building-2" name={s.name} sub={s.region} onClick={() => { onScope(s.id); setOpen(false); }} />
          ))}
        </div>
      )}
    </div>
  );
}
function ScopeOption({ active, icon, name, sub, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', border: 0, borderRadius: 'var(--iso-radius-sm)',
      background: active ? 'var(--iso-brand-soft)' : 'transparent', cursor: 'pointer', textAlign: 'left',
      transition: 'color var(--crm-fast) var(--crm-ease-standard)' }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--iso-n-100)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
      <span style={{ width: 28, height: 28, borderRadius: 'var(--iso-radius-xs)', background: active ? 'var(--iso-brand)' : 'var(--iso-blue-3-100)',
        color: active ? '#fff' : 'var(--iso-brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={icon} size={15} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', font: '500 13px/1.3 var(--iso-font-body)', color: 'var(--iso-fg)' }}>{name}</span>
        <span style={{ display: 'block', font: '400 11px/1.3 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)' }}>{sub}</span>
      </span>
      {active && <Icon name="check" size={15} style={{ color: 'var(--iso-brand)' }} />}
    </button>
  );
}

/* ---------------- Notifications bell ---------------- */
function NotificationsBell({ user, onViewAll }) {
  const [open, setOpen] = useS(false);
  const st = useStore();
  const ref = useR(null);
  useE(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const items = Store.notificationsFor(user).slice().sort((a, b) => b.at - a.at);
  const unread = items.filter(i => i.unread).length;
  const tc = { info: 'var(--iso-accent)', warning: 'var(--iso-warning)', success: 'var(--iso-success)', danger: 'var(--iso-danger)', neutral: 'var(--iso-n-600)' };
  const ago = (at) => { const m = Math.round((Date.now() - at) / 60000); if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`; const h = Math.round(m / 60); if (h < 24) return `${h} h ago`; return `${Math.round(h / 24)} days ago`; };
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} aria-label={`Notifications, ${unread} unread`} style={{ position: 'relative', width: 38, height: 38, borderRadius: 'var(--iso-radius-sm)',
        border: '1px solid transparent', background: open ? 'var(--iso-n-100)' : 'transparent', color: 'var(--iso-fg-muted)', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="bell" size={19} />
        {unread > 0 && <span style={{ position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 'var(--iso-radius-full)',
          background: 'var(--iso-danger)', color: '#fff', border: '2px solid #fff', font: '600 9px/12px var(--iso-font-ui)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{unread}</span>}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 46, right: 0, width: 340, background: '#fff', border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius-md)',
          boxShadow: 'var(--iso-shadow-lg)', zIndex: 'var(--iso-z-dropdown)', overflow: 'hidden', animation: 'crm-pop var(--crm-base) var(--crm-ease-decelerate)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--iso-border-muted)' }}>
            <span style={{ font: '500 13px/1 var(--iso-font-body)', color: 'var(--iso-fg-strong)' }}>Notifications</span>
            {unread > 0 && <button onClick={() => Store.markNotificationsRead(user)} style={{ background: 'transparent', border: 0, cursor: 'pointer', font: '500 12px/1 var(--iso-font-body)', color: 'var(--iso-link)' }}>Mark all as read</button>}
          </div>
          <div style={{ maxHeight: 320, overflow: 'auto' }}>
            {items.length === 0
              ? <div style={{ padding: '28px 14px', textAlign: 'center', font: '400 12px/1.5 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)' }}>You’re all caught up</div>
              : items.map(i => (
              <div key={i.id} style={{ display: 'flex', gap: 10, padding: '11px 14px', borderBottom: '1px solid var(--iso-border-muted)', background: i.unread ? 'var(--iso-blue-3-50)' : '#fff' }}>
                <span style={{ width: 30, height: 30, borderRadius: 'var(--iso-radius-xs)', flex: 'none', background: 'var(--iso-blue-3-100)', color: tc[i.tone],
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={i.icon} size={15} /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '400 13px/1.4 var(--iso-font-body)', color: 'var(--iso-fg)' }}>{i.text}</div>
                  <div style={{ font: '400 11px/1 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)', marginTop: 3 }}>{ago(i.at)}</div>
                </div>
                {i.unread && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--iso-brand)', marginTop: 5, flex: 'none' }} />}
              </div>
            ))}
          </div>
          <button onClick={() => { setOpen(false); onViewAll?.(); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', padding: '11px 14px', border: 0, borderTop: '1px solid var(--iso-border-muted)', background: '#fff', cursor: 'pointer', font: '500 12px/1 var(--iso-font-body)', color: 'var(--iso-link)' }}>
            View all notifications<Icon name="arrow-right" size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- User menu ---------------- */
function UserMenu({ role, onSignOut, onSwitchRole, onViewAllNotifications }) {
  const [open, setOpen] = useS(false);
  const ref = useR(null);
  useE(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const name = { tenant_admin: 'Sara Khan', sales_agent: 'Marco Ruiz', support_agent: 'Lena Bauer', viewer: 'Ivo Petrov' }[role.id];
  const initials = name.split(' ').map(w => w[0]).join('');
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 9, height: 38, padding: '0 8px 0 6px', borderRadius: 'var(--iso-radius-sm)',
        border: '1px solid transparent', background: open ? 'var(--iso-n-100)' : 'transparent', cursor: 'pointer' }}>
        <Avatar initials={initials} size={28} color={role.color} />
        <span style={{ textAlign: 'left' }}>
          <span style={{ display: 'block', font: '500 12px/1.2 var(--iso-font-body)', color: 'var(--iso-fg-strong)', whiteSpace: 'nowrap' }}>{name}</span>
          <span style={{ display: 'block', font: '400 11px/1.2 var(--iso-font-ui)', color: 'var(--iso-fg-muted)' }}>{role.label}</span>
        </span>
        <Icon name="chevron-down" size={14} style={{ color: 'var(--iso-fg-subtle)' }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 46, right: 0, width: 240, background: '#fff', border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius-md)',
          boxShadow: 'var(--iso-shadow-lg)', padding: 6, zIndex: 'var(--iso-z-dropdown)', animation: 'crm-pop var(--crm-base) var(--crm-ease-decelerate)' }}>
          <div style={{ padding: '8px 10px 10px' }}>
            <div style={{ font: '500 13px/1.3 var(--iso-font-body)', color: 'var(--iso-fg-strong)' }}>{name}</div>
            <div style={{ font: '400 11px/1.3 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)' }}>{name.toLowerCase().replace(' ', '.')}@northwind.com</div>
          </div>
          <div style={{ height: 1, background: 'var(--iso-border-muted)', margin: '2px 6px 6px' }} />
          <div style={{ font: '500 10px/1 var(--iso-font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)', padding: '4px 10px 6px' }}>Switch role (demo)</div>
          {Object.values(ROLES).map(r => (
            <button key={r.id} onClick={() => { onSwitchRole(r.id); setOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 10px', border: 0,
              borderRadius: 'var(--iso-radius-xs)', background: r.id === role.id ? 'var(--iso-brand-soft)' : 'transparent', cursor: 'pointer', textAlign: 'left',
              font: '400 13px/1 var(--iso-font-body)', color: 'var(--iso-fg)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }} />{r.label}
              {r.id === role.id && <Icon name="check" size={14} style={{ marginLeft: 'auto', color: 'var(--iso-brand)' }} />}
            </button>
          ))}
          <div style={{ height: 1, background: 'var(--iso-border-muted)', margin: '6px 6px' }} />
          <button onClick={() => { setOpen(false); onViewAllNotifications?.(); }} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', border: 0, borderRadius: 'var(--iso-radius-xs)',
            background: 'transparent', cursor: 'pointer', textAlign: 'left', font: '400 13px/1 var(--iso-font-body)', color: 'var(--iso-fg)' }}>
            <Icon name="bell" size={15} style={{ color: 'var(--iso-fg-muted)' }} />View all notifications
          </button>
          <button onClick={onSignOut} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', border: 0, borderRadius: 'var(--iso-radius-xs)',
            background: 'transparent', cursor: 'pointer', textAlign: 'left', font: '400 13px/1 var(--iso-font-body)', color: 'var(--iso-fg)' }}>
            <Icon name="log-out" size={15} style={{ color: 'var(--iso-fg-muted)' }} />Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Topbar ---------------- */
const USER_OF = { tenant_admin: 'Sara Khan', sales_agent: 'Marco Ruiz', support_agent: 'Lena Bauer', viewer: 'Ivo Petrov' };
function Topbar({ role, scope, onScope, onSignOut, onSwitchRole, onViewNotifications }) {
  const [sf, setSf] = useS(false);
  return (
    <div style={{ gridArea: 'top', background: '#fff', borderBottom: '1px solid var(--iso-border)',
      display: 'flex', alignItems: 'center', gap: 'var(--iso-space-3)', padding: '0 16px' }}>
      <ScopeSwitcher role={role} scope={scope} onScope={onScope} />
      <div style={{ flex: '0 1 420px', display: 'flex', alignItems: 'center', gap: 9, height: 38, padding: '0 12px', marginLeft: 8,
        border: `1px solid ${sf ? 'var(--iso-brand)' : 'var(--iso-border)'}`, borderRadius: 'var(--iso-radius-sm)', background: '#fff',
        boxShadow: sf ? 'var(--iso-shadow-focus)' : 'none', transition: 'border-color var(--crm-fast) var(--crm-ease-standard), box-shadow var(--crm-fast) var(--crm-ease-standard)' }}>
        <Icon name="search" size={15} style={{ color: 'var(--iso-fg-subtle)' }} />
        <input placeholder="Search records, tickets, people…" onFocus={() => setSf(true)} onBlur={() => setSf(false)}
          style={{ flex: 1, border: 0, outline: 0, background: 'transparent', font: '400 13px/1 var(--iso-font-body)', color: 'var(--iso-fg)', minWidth: 0 }} />
        <span style={{ font: '500 10px/1 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)', padding: '3px 6px', border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius-xs)' }}>⌘K</span>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--iso-space-2)' }}>
        <NotificationsBell user={USER_OF[role.id]} onViewAll={onViewNotifications} />
        <span style={{ width: 1, height: 26, background: 'var(--iso-border)', margin: '0 4px' }} />
        <UserMenu role={role} onSignOut={onSignOut} onSwitchRole={onSwitchRole} onViewAllNotifications={onViewNotifications} />
      </div>
    </div>
  );
}

Object.assign(window, { Wordmark, Avatar, Sidebar, ScopeSwitcher, NotificationsBell, UserMenu, Topbar });
