/* global React, Icon, Button, StatusPill, Skeleton, EmptyState, ErrorState, Card, SectionLabel,
   PageHeader, StateSwitcher, Store, useStore, recordsFor, pushToast */
/* min-crm — Dashboard (E5-S1 shell, E5-S2 ONE read-model widget) + notifications surface (E5-S3). */
const { useState: useDb, useMemo: useDbM } = React;

const DB_PAD = { padding: '28px 32px', maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--iso-space-6)' };
const DB_USER = { tenant_admin: 'Sara Khan', sales_agent: 'Marco Ruiz', support_agent: 'Lena Bauer', viewer: 'Ivo Petrov' };

/* ---------------- ONE read-model widget: conversion funnel (derived, read-only) ---------------- */
function ConversionFunnel({ st, scope }) {
  const stages = useDbM(() => {
    const leads = recordsFor(st, 'lead', scope);
    const custs = recordsFor(st, 'customer', scope);
    return [
      { key: 'new', label: 'New', count: leads.filter(l => l.status === 'new').length, tone: 'neutral', color: 'var(--iso-n-500)' },
      { key: 'contacted', label: 'Contacted', count: leads.filter(l => l.status === 'contacted').length, tone: 'info', color: 'var(--iso-blue-3-400)' },
      { key: 'qualified', label: 'Qualified', count: leads.filter(l => l.status === 'qualified').length, tone: 'info', color: 'var(--iso-blue-2-500)' },
      { key: 'converted', label: 'Converted', count: leads.filter(l => l.status === 'converted').length, tone: 'success', color: 'var(--iso-brand)' },
      { key: 'active', label: 'Active customers', count: custs.filter(c => c.status === 'active').length, tone: 'success', color: 'var(--iso-success)' },
    ];
  }, [st, scope]);
  const max = Math.max(1, ...stages.map(s => s.count));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {stages.map((s, i) => (
        <div key={s.key} style={{ display: 'grid', gridTemplateColumns: '128px 1fr 44px', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 22, height: 22, flex: 'none', borderRadius: '50%', background: 'var(--iso-blue-3-50)', color: 'var(--iso-fg-subtle)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: '500 10px/1 var(--iso-font-ui)' }}>{i + 1}</span>
            <span style={{ font: '400 13px/1.2 var(--iso-font-body)', color: 'var(--iso-fg)' }}>{s.label}</span>
          </div>
          <div style={{ height: 28, borderRadius: 'var(--iso-radius-sm)', background: 'var(--iso-blue-3-50)', overflow: 'hidden', position: 'relative' }}>
            <div style={{ height: '100%', width: `${(s.count / max) * 100}%`, minWidth: s.count > 0 ? 6 : 0, background: s.color, borderRadius: 'var(--iso-radius-sm)',
              transition: 'width var(--crm-base) var(--crm-ease-decelerate)' }} />
          </div>
          <span style={{ textAlign: 'right', font: '500 16px/1 var(--iso-font-ui)', color: 'var(--iso-fg-strong)', fontVariantNumeric: 'tabular-nums' }}>{s.count}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- notifications surface (mirrors the bell, on the dashboard) ---------------- */
function DashboardNotifications({ user, state }) {
  const st = useStore();
  const items = Store.notificationsFor(user).slice().sort((a, b) => b.at - a.at);
  const unread = items.filter(i => i.unread).length;
  const tc = { info: 'var(--iso-accent)', warning: 'var(--iso-warning)', success: 'var(--iso-success)', danger: 'var(--iso-danger)', neutral: 'var(--iso-n-600)' };
  const ago = (at) => { const m = Math.round((Date.now() - at) / 60000); if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`; const h = Math.round(m / 60); if (h < 24) return `${h} h ago`; return `${Math.round(h / 24)} days ago`; };

  return (
    <Card style={{ overflow: 'hidden', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: '1px solid var(--iso-border-muted)' }}>
        <Icon name="bell" size={15} style={{ color: 'var(--iso-brand)' }} />
        <span style={{ font: '500 13px/1 var(--iso-font-body)', color: 'var(--iso-fg-strong)' }}>Notifications</span>
        {unread > 0 && <span style={{ font: '600 10px/1 var(--iso-font-ui)', color: '#fff', background: 'var(--iso-danger)', borderRadius: 'var(--iso-radius-full)', padding: '3px 7px' }}>{unread}</span>}
        {unread > 0 && <button onClick={() => Store.markNotificationsRead(user)} style={{ marginLeft: 'auto', background: 'transparent', border: 0, cursor: 'pointer', font: '500 12px/1 var(--iso-font-body)', color: 'var(--iso-link)' }}>Mark all as read</button>}
      </div>
      {state === 'loading'
        ? <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>{[...Array(3)].map((_, i) => <div key={i} style={{ display: 'flex', gap: 10 }}><Skeleton w={30} h={30} r={6} /><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}><Skeleton w="85%" h={12} /><Skeleton w="35%" h={10} /></div></div>)}</div>
        : items.length === 0
        ? <EmptyState compact icon="bell-off" title="You’re all caught up" body="New notifications — tickets assigned to you, leads you own converting — will appear here." />
        : <div style={{ maxHeight: 360, overflow: 'auto' }}>
            {items.map(i => (
              <div key={i.id} style={{ display: 'flex', gap: 11, padding: '13px 18px', borderBottom: '1px solid var(--iso-border-muted)', background: i.unread ? 'var(--iso-blue-3-50)' : '#fff' }}>
                <span style={{ width: 32, height: 32, flex: 'none', borderRadius: 'var(--iso-radius-xs)', background: 'var(--iso-blue-3-100)', color: tc[i.tone], display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={i.icon} size={16} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '400 13px/1.4 var(--iso-font-body)', color: 'var(--iso-fg)' }}>{i.text}</div>
                  <div style={{ font: '400 11px/1 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)', marginTop: 3 }}>{ago(i.at)}</div>
                </div>
                {i.unread
                  ? <button onClick={() => Store.markOneRead(i.id)} title="Mark as read" style={{ flex: 'none', alignSelf: 'flex-start', width: 22, height: 22, borderRadius: 'var(--iso-radius-xs)', border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--iso-brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--iso-brand)' }} /></button>
                  : <Icon name="check" size={14} style={{ color: 'var(--iso-fg-subtle)', marginTop: 2, flex: 'none' }} />}
              </div>
            ))}
          </div>}
    </Card>
  );
}

/* ---------------- Dashboard page ---------------- */
function DashboardPage({ role, scope, scopeName, scopeLoading, state, onState }) {
  const st = useStore();
  const user = DB_USER[role.id];
  const sourceCount = useDbM(() => recordsFor(st, 'lead', scope).length + recordsFor(st, 'customer', scope).length, [st, scope]);

  let eff = scopeLoading ? 'loading' : state;
  if (eff === 'ready' && sourceCount === 0) eff = 'empty';

  return (
    <div style={DB_PAD}>
      <PageHeader eyebrow={`${role.label} · ${scopeName}`} title="Dashboard"
        subtitle={scope === 'tenant' ? 'A cross-subsidiary read of the tenant. Widgets are derived and read-only.' : 'A read of your scope. Widgets are derived and read-only — no cross-boundary writes.'}
        right={<StateSwitcher state={state} onState={onState} />} />

      {eff === 'error'
        ? <Card><ErrorState title="Can’t load dashboard data" onRetry={() => onState('ready')} /></Card>
        : eff === 'empty'
        ? <Card><EmptyState icon="layout-dashboard" title="No activity in this scope yet" scopeLine={scopeName} body="Once there are leads and customers in this scope, the conversion funnel populates here." /></Card>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 'var(--iso-space-4)', alignItems: 'start' }}>
            {/* widget slot */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--iso-space-4)' }}>
              <Card style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: '1px solid var(--iso-border-muted)' }}>
                  <Icon name="filter" size={15} style={{ color: 'var(--iso-brand)' }} />
                  <SectionLabel>Conversion funnel</SectionLabel>
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, font: '500 10px/1 var(--iso-font-ui)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--iso-fg-muted)', border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius-full)', padding: '5px 9px' }}>
                    <Icon name="lock" size={11} />Derived · read-only
                  </span>
                </div>
                <div style={{ padding: 18 }}>
                  {eff === 'loading'
                    ? <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{[...Array(5)].map((_, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '128px 1fr 44px', gap: 14, alignItems: 'center' }}><Skeleton w="70%" h={12} /><Skeleton w={`${90 - i * 14}%`} h={28} r={4} /><Skeleton w={24} h={14} style={{ justifySelf: 'end' }} /></div>)}</div>
                    : <ConversionFunnel st={st} scope={scope} />}
                </div>
                <div style={{ padding: '12px 18px', borderTop: '1px solid var(--iso-border-muted)', background: 'var(--iso-blue-3-50)', font: '400 11.5px/1.5 var(--iso-font-ui)', color: 'var(--iso-fg-muted)' }}>
                  {scope === 'tenant' ? 'Aggregated across every subsidiary in the tenant.' : `Scoped to ${scopeName} — sibling subsidiaries are not counted.`}
                </div>
              </Card>

              {/* clearly-labelled placeholder slot — only one widget ships now */}
              <div style={{ border: '1px dashed var(--iso-border-strong)', borderRadius: 'var(--iso-radius-lg)', background: 'var(--iso-blue-3-50)',
                padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
                <span style={{ width: 40, height: 40, borderRadius: 'var(--iso-radius-md)', background: '#fff', border: '1px solid var(--iso-border)', color: 'var(--iso-fg-subtle)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={18} /></span>
                <span style={{ font: '500 13px/1.3 var(--iso-font-body)', color: 'var(--iso-fg-muted)' }}>More widgets — later stories</span>
                <span style={{ font: '400 12px/1.5 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)', maxWidth: '38ch' }}>Only the conversion funnel ships now. Additional read-model widgets land in later stories.</span>
              </div>
            </div>

            {/* notifications surface */}
            <DashboardNotifications user={user} state={eff} />
          </div>
        )}
    </div>
  );
}

window.DashboardPage = DashboardPage;
window.ConversionFunnel = ConversionFunnel;

/* ---------------- Full "View all notifications" page ---------------- */
function NotificationsPage({ role, scopeName, onBack }) {
  const st = useStore();
  const user = DB_USER[role.id];
  const items = Store.notificationsFor(user).slice().sort((a, b) => b.at - a.at);
  const unread = items.filter(i => i.unread).length;
  const tc = { info: 'var(--iso-accent)', warning: 'var(--iso-warning)', success: 'var(--iso-success)', danger: 'var(--iso-danger)', neutral: 'var(--iso-n-600)' };
  const ago = (at) => { const m = Math.round((Date.now() - at) / 60000); if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`; const h = Math.round(m / 60); if (h < 24) return `${h} h ago`; return `${Math.round(h / 24)} days ago`; };
  const abs = (at) => { const d = new Date(at); const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]; return `${d.getUTCDate()} ${mon} 2026 · ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`; };

  return (
    <div style={DB_PAD}>
      <PageHeader
        eyebrow={`${role.label} · ${scopeName}`}
        title="Notifications"
        subtitle="Everything addressed to you in this scope — tickets assigned to you and leads you own converting. Notifications persist until you read them."
        secondary={unread > 0 ? <Button variant="secondary" leadIcon="check-check" onClick={() => Store.markNotificationsRead(user)}>Mark all as read</Button> : null}
      />
      <Card style={{ overflow: 'hidden' }}>
        {items.length === 0
          ? <EmptyState icon="bell-off" title="You’re all caught up" body="New notifications will appear here as events happen — a ticket assigned to you, or a lead you own converting." />
          : items.map(i => (
            <div key={i.id} style={{ display: 'flex', gap: 13, padding: '15px 18px', borderBottom: '1px solid var(--iso-border-muted)', background: i.unread ? 'var(--iso-blue-3-50)' : '#fff' }}>
              <span style={{ width: 36, height: 36, flex: 'none', borderRadius: 'var(--iso-radius-sm)', background: 'var(--iso-blue-3-100)', color: tc[i.tone], display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={i.icon} size={17} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '400 14px/1.4 var(--iso-font-body)', color: 'var(--iso-fg)' }}>{i.text}</div>
                <div title={abs(i.at)} style={{ font: '400 11px/1 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)', marginTop: 4, width: 'fit-content' }}>{ago(i.at)}</div>
              </div>
              {i.unread
                ? <button onClick={() => Store.markOneRead(i.id)} style={{ flex: 'none', alignSelf: 'center', height: 30, padding: '0 11px', borderRadius: 'var(--iso-radius-sm)', border: '1px solid var(--iso-border)', background: '#fff', cursor: 'pointer', font: '500 12px/1 var(--iso-font-body)', color: 'var(--iso-brand)' }}>Mark as read</button>
                : <span style={{ flex: 'none', alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 5, font: '400 11px/1 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)' }}><Icon name="check" size={13} />Read</span>}
            </div>
          ))}
      </Card>
    </div>
  );
}
window.NotificationsPage = NotificationsPage;
