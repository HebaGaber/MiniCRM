/* global React, Icon, Button, StatusPill, Skeleton, EmptyState, ErrorState, Card, SectionLabel,
   PageHeader, StateSwitcher, Store, useStore, subName */
/* min-crm — Audit & events log (E4-S4). A RAW, before/after, matrix-gated compliance table —
   deliberately distinct from the per-record Activity timeline (which is a product feature). */
const { useState: useAu, useMemo: useAuM } = React;

const AU_PAD = { padding: '28px 32px', maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--iso-space-6)' };
const ACTION_META = {
  'permission.change':   { label: 'Permission change', icon: 'shield', tone: 'warning' },
  'lead.create':         { label: 'Lead create', icon: 'user-plus', tone: 'neutral' },
  'lead.transition':     { label: 'Lead transition', icon: 'repeat', tone: 'info' },
  'customer.transition': { label: 'Customer transition', icon: 'repeat', tone: 'info' },
  'ticket.create':       { label: 'Ticket create', icon: 'life-buoy', tone: 'neutral' },
  'ticket.transition':   { label: 'Ticket transition', icon: 'repeat', tone: 'info' },
  'ticket.assign':       { label: 'Ticket assign', icon: 'user-check', tone: 'info' },
  'subsidiary.offboard': { label: 'Subsidiary offboard', icon: 'log-out', tone: 'danger' },
  'conversion':          { label: 'Conversion', icon: 'git-merge', tone: 'success' },
};
const USER_OF_AUDIT = { tenant_admin: 'Sara Khan', sales_agent: 'Marco Ruiz', support_agent: 'Lena Bauer', viewer: 'Ivo Petrov' };

function kvPairs(obj) {
  if (!obj) return '—';
  return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(', ');
}

function AuditLog({ role, scope, scopeName, scopeLoading, state, onState }) {
  const st = useStore();
  const user = USER_OF_AUDIT[role.id];
  const [actionF, setActionF] = useAu('all');
  const [entityF, setEntityF] = useAu('all');

  const all = useAuM(() => Store.auditFor(role.id, user), [st, role.id, user]);
  const rows = useAuM(() => all.filter(a => (actionF === 'all' || a.action === actionF) && (entityF === 'all' || a.entity === entityF))
    .slice().sort((x, y) => y.at - x.at), [all, actionF, entityF]);

  const actions = [...new Set(all.map(a => a.action))];
  const entities = [...new Set(all.map(a => a.entity))];

  let eff = scopeLoading ? 'loading' : state;
  if (eff === 'ready' && rows.length === 0) eff = 'empty';

  const gateLabel = role.id === 'tenant_admin' ? 'All records across the tenant' : 'Only records you acted on';
  const th = { font: '500 10px/1 var(--iso-font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)' };
  const cols = '128px 116px 150px minmax(0,1fr) 92px';

  return (
    <div style={AU_PAD}>
      <PageHeader
        eyebrow={`${role.label} · ${scopeName}`}
        title="Audit & events"
        subtitle="The raw, immutable compliance record — every mutation with its before and after values. This is not the per-record Activity timeline; it is the underlying log."
        right={<StateSwitcher state={state} onState={onState} />}
        secondary={<Button variant="secondary" leadIcon="download">Export log</Button>}
      />

      {/* matrix-gate banner — makes the raw-log identity explicit */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 'var(--iso-radius-md)', background: 'var(--iso-n-900)', color: '#fff' }}>
        <Icon name="scroll-text" size={18} style={{ color: 'var(--iso-blue-2-200)', flex: 'none' }} />
        <span style={{ flex: 1, font: '400 12.5px/1.5 var(--iso-font-body)', color: 'var(--iso-n-300)' }}>
          Raw audit log · <b style={{ color: '#fff', fontWeight: 500 }}>{gateLabel}</b>. Records are append-only and show field-level before/after. For a readable, per-record story, open a record’s Activity timeline.
        </span>
        <span style={{ font: '500 10px/1 var(--iso-font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--iso-blue-2-200)', border: '1px solid var(--iso-blue-2-700)', borderRadius: 'var(--iso-radius-xs)', padding: '4px 8px' }}>Compliance</span>
      </div>

      <Card style={{ overflow: 'hidden' }}>
        {/* filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--iso-space-3)', flexWrap: 'wrap', padding: 'var(--iso-space-3) var(--iso-space-4)', borderBottom: '1px solid var(--iso-border-muted)', background: 'var(--iso-blue-3-50)' }}>
          <Icon name="filter" size={14} style={{ color: 'var(--iso-fg-subtle)' }} />
          <RawSelect label="Action" value={actionF} onChange={setActionF} options={[{ value: 'all', label: 'All actions' }, ...actions.map(a => ({ value: a, label: ACTION_META[a]?.label || a }))]} />
          <RawSelect label="Entity" value={entityF} onChange={setEntityF} options={[{ value: 'all', label: 'All entities' }, ...entities.map(e => ({ value: e, label: e }))]} />
          <span style={{ marginLeft: 'auto', font: '400 12px/1 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)' }}>{rows.length} record{rows.length === 1 ? '' : 's'}</span>
        </div>

        {/* header */}
        <div role="row" style={{ display: 'grid', gridTemplateColumns: cols, gap: 'var(--iso-space-4)', alignItems: 'center', height: 38, padding: '0 var(--iso-space-4)', borderBottom: '1px solid var(--iso-border)', background: '#fff' }}>
          <div style={th}>Timestamp</div><div style={th}>Actor</div><div style={th}>Action</div><div style={th}>Record &amp; change</div><div style={th}>Scope</div>
        </div>

        {eff === 'loading'
          ? [...Array(6)].map((_, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, gap: 'var(--iso-space-4)', alignItems: 'center', minHeight: 56, padding: '0 var(--iso-space-4)', borderBottom: '1px solid var(--iso-border-muted)' }}>{[...Array(5)].map((_, j) => <Skeleton key={j} w={j === 3 ? '80%' : '60%'} h={12} />)}</div>)
          : eff === 'error' ? <ErrorState onRetry={() => onState('ready')} />
          : eff === 'empty' ? <EmptyState icon="scroll-text" title={role.id === 'tenant_admin' ? 'No audit records yet' : 'No records you acted on'} scopeLine={scopeName} body={role.id === 'tenant_admin' ? 'Mutations across the tenant will appear here as they happen.' : 'Actions you take across leads, customers and tickets will be logged here.'} />
          : rows.map(a => {
            const m = ACTION_META[a.action] || { label: a.action, icon: 'dot', tone: 'neutral' };
            return (
              <div key={a.id} role="row" style={{ display: 'grid', gridTemplateColumns: cols, gap: 'var(--iso-space-4)', alignItems: 'center', minHeight: 56, padding: '10px var(--iso-space-4)', borderBottom: '1px solid var(--iso-border-muted)' }}>
                <span style={{ font: '400 12px/1.4 var(--iso-font-ui)', color: 'var(--iso-fg-muted)', fontVariantNumeric: 'tabular-nums' }}>{a.abs}</span>
                <span style={{ font: '400 13px/1.3 var(--iso-font-body)', color: 'var(--iso-fg)' }}>{a.actor}</span>
                <span><StatusPill tone={m.tone} icon={m.icon} size="sm">{m.label}</StatusPill></span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', font: '500 13px/1.3 var(--iso-font-body)', color: 'var(--iso-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.recordLabel}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, font: '400 11.5px/1.4 var(--iso-font-ui)', flexWrap: 'wrap' }}>
                    <code style={{ background: 'var(--iso-n-100)', color: 'var(--iso-fg-muted)', borderRadius: 3, padding: '1px 6px', fontFamily: 'Inter, monospace' }}>{kvPairs(a.before)}</code>
                    <Icon name="arrow-right" size={12} style={{ color: 'var(--iso-fg-subtle)', flex: 'none' }} />
                    <code style={{ background: 'var(--iso-success-soft)', color: 'var(--iso-green-800)', borderRadius: 3, padding: '1px 6px', fontFamily: 'Inter, monospace' }}>{kvPairs(a.after)}</code>
                  </span>
                </span>
                <span style={{ font: '400 12px/1.3 var(--iso-font-ui)', color: 'var(--iso-fg-muted)' }}>{a.scope === 'tenant' ? 'Tenant' : subName(st, a.scope)}</span>
              </div>
            );
          })}
      </Card>
    </div>
  );
}

function RawSelect({ label, value, onChange, options }) {
  const active = value !== 'all';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 4px 0 10px', borderRadius: 'var(--iso-radius-sm)', border: `1px solid ${active ? 'var(--iso-brand)' : 'var(--iso-border)'}`, background: active ? 'var(--iso-brand-soft)' : '#fff' }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}
        style={{ border: 0, outline: 0, background: 'transparent', font: `${active ? 500 : 400} 12px/1 var(--iso-font-body)`, color: active ? 'var(--iso-brand)' : 'var(--iso-fg-muted)', cursor: 'pointer' }}>
        {options.map(o => <option key={o.value} value={o.value} style={{ color: 'var(--iso-fg)' }}>{o.label}</option>)}
      </select>
    </span>
  );
}

window.AuditLog = AuditLog;
