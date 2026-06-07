/* global React, Icon, Button, StatusPill, Skeleton, EmptyState, ErrorState, Card, SectionLabel,
   DataTable, Toolbar, FilterBar, FilterChip, Pagination, Avatar, pushToast,
   useStore, recordsFor, STATUS_META, PRIORITY_META, subName, ACTIVE_STATES */
/* min-crm — page templates: PageHeader · StateSwitcher · ListPage · DetailPage · DashboardPage.
   Store-backed and scope-reactive: changing scope re-queries (skeleton → data at base). */
const { useState: useT, useMemo: useMemoT, useEffect: useTE } = React;

/* ---------------- Preview-state segmented control (scaffold affordance) ---------------- */
const STATES = [
  { id: 'loading', label: 'Loading', icon: 'loader' },
  { id: 'empty',   label: 'Empty',   icon: 'inbox' },
  { id: 'error',   label: 'Error',   icon: 'cloud-off' },
  { id: 'ready',   label: 'Ready',   icon: 'check' },
];
function StateSwitcher({ state, onState }) {
  return null; /* preview-state control removed — screens render their real state */
  // eslint-disable-next-line no-unreachable
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ font: '500 10px/1 var(--iso-font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)' }}>Preview state</span>
      <div style={{ display: 'inline-flex', padding: 3, gap: 2, background: 'var(--iso-blue-3-100)', borderRadius: 'var(--iso-radius-md)', border: '1px solid var(--iso-border)' }}>
        {STATES.map(s => {
          const active = s.id === state;
          return (
            <button key={s.id} onClick={() => onState(s.id)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 11px', border: 0, borderRadius: 'var(--iso-radius-sm)',
              background: active ? '#fff' : 'transparent', color: active ? 'var(--iso-brand)' : 'var(--iso-fg-muted)',
              boxShadow: active ? 'var(--iso-shadow-xs)' : 'none', cursor: 'pointer', font: `${active ? 500 : 400} 12px/1 var(--iso-font-body)`,
              transition: 'color var(--crm-fast) var(--crm-ease-standard)' }}>
              <Icon name={s.icon} size={13} />{s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Page header ---------------- */
function PageHeader({ eyebrow, title, subtitle, statusPill, breadcrumbs, primary, secondary, back, right }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {breadcrumbs && (
        <nav style={{ display: 'inline-flex', alignItems: 'center', gap: 7, font: '400 12px/1 var(--iso-font-body)' }}>
          {breadcrumbs.map((b, i) => (
            <React.Fragment key={i}>
              {i > 0 && <Icon name="chevron-right" size={13} style={{ color: 'var(--iso-fg-subtle)' }} />}
              <span style={{ color: i === breadcrumbs.length - 1 ? 'var(--iso-fg)' : 'var(--iso-fg-muted)', fontWeight: i === breadcrumbs.length - 1 ? 500 : 400, cursor: b.onClick ? 'pointer' : 'default' }} onClick={b.onClick}>{b.label}</span>
            </React.Fragment>
          ))}
        </nav>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
          {back && <button onClick={back} aria-label="Back" style={{ width: 36, height: 36, marginTop: 2, borderRadius: 'var(--iso-radius-sm)', border: '1px solid var(--iso-border)', background: '#fff', color: 'var(--iso-fg-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="arrow-left" size={17} /></button>}
          <div style={{ minWidth: 0 }}>
            {eyebrow && <div style={{ font: '500 10px/1 var(--iso-font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)', marginBottom: 7 }}>{eyebrow}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, font: '500 28px/1.15 var(--iso-font-display)', letterSpacing: '-0.02em', color: 'var(--iso-fg-strong)' }}>{title}</h1>
              {statusPill}
            </div>
            {subtitle && <p style={{ margin: '8px 0 0', font: '400 14px/1.5 var(--iso-font-body)', color: 'var(--iso-fg-muted)', maxWidth: '64ch' }}>{subtitle}</p>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--iso-space-2)' }}>
          {right}
          {secondary}
          {primary}
        </div>
      </div>
    </div>
  );
}

function ScaffoldNote({ children }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderRadius: 'var(--iso-radius-full)',
      background: 'var(--iso-blue-3-50)', border: '1px dashed var(--iso-blue-3-300)', font: '400 11px/1 var(--iso-font-ui)', color: 'var(--iso-fg-muted)' }}>
      <Icon name="ruler" size={12} style={{ color: 'var(--iso-accent)' }} />{children}
    </div>
  );
}

const PAGE_PAD = { padding: '28px 32px', maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--iso-space-6)' };
const initialsOf = (n) => n.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
function Pill({ entity, status }) { const m = STATUS_META[entity][status]; return <StatusPill tone={m.tone}>{m.label}</StatusPill>; }

const AUDIT_ROWS = [
  { id: 1, event: 'Permission changed', icon: 'shield', actor: 'Sara Khan', result: 'Applied', tone: 'success', scope: 'EU subsidiary', when: '5 Jun 14:20' },
  { id: 2, event: 'Record deleted', icon: 'trash-2', actor: 'Marco Ruiz', result: 'Denied', tone: 'danger', scope: 'EU subsidiary', when: '5 Jun 13:02' },
  { id: 3, event: 'Lead converted', icon: 'repeat', actor: 'Marco Ruiz', result: 'Applied', tone: 'success', scope: 'EU subsidiary', when: '5 Jun 11:48' },
  { id: 4, event: 'Subsidiary onboarded', icon: 'building-2', actor: 'Sara Khan', result: 'Applied', tone: 'success', scope: 'Whole tenant', when: '5 Jun 09:15' },
  { id: 5, event: 'Scope switched', icon: 'layers', actor: 'Sara Khan', result: 'Logged', tone: 'neutral', scope: 'Whole tenant', when: '4 Jun 17:30' },
];

/* ---------------- entity config (store-backed) ---------------- */
const dayOf = (s) => { const m = /^(\d+)/.exec(String(s || '')); return m ? parseInt(m[1], 10) : 0; };
const statusIdx = (entity, s) => { const o = ENTITY_ORDER[entity] || []; const i = o.indexOf(s); return i < 0 ? 99 : i; };

const ENTITY = {
  leads: {
    entity: 'lead', singular: 'lead', noun: 'Leads', icon: 'user-plus', createLabel: 'New lead',
    select: (st, scope) => recordsFor(st, 'lead', scope),
    columns: [
      { id: 'name', header: 'Name', width: '1.3fr', sortVal: (r) => r.name?.toLowerCase(), render: (r) => <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Avatar initials={initialsOf(r.name)} size={26} color="var(--iso-blue-3-400)" /><span style={{ fontWeight: 500 }}>{r.name}</span></span> },
      { id: 'company', header: 'Company', key: 'company', width: '1fr', sortVal: (r) => r.company?.toLowerCase() },
      { id: 'source', header: 'Source', width: '0.7fr', sortVal: (r) => r.source, render: (r) => <span style={{ color: 'var(--iso-fg-muted)', textTransform: 'capitalize' }}>{r.source}</span> },
      { id: 'status', header: 'Status', width: '130px', sortVal: (r) => statusIdx('lead', r.status), render: (r) => <Pill entity="lead" status={r.status} /> },
      { id: 'owner', header: 'Owner', key: 'owner', width: '0.9fr', sortVal: (r) => r.owner?.toLowerCase() },
      { id: 'updated', header: 'Updated', width: '0.6fr', align: 'right', sortVal: (r) => dayOf(r.updated), render: (r) => <span style={{ color: 'var(--iso-fg-subtle)' }}>{r.updated}</span> },
    ],
    detail: (r) => [['Full name', r.name], ['Company', r.company], ['Email', r.email], ['Phone', r.phone], ['Source', r.source], ['Owner', r.owner]],
    note: (r) => ['BANT note', r.bant],
  },
  customers: {
    entity: 'customer', singular: 'customer', noun: 'Customers', icon: 'building-2', createLabel: 'New customer',
    select: (st, scope) => recordsFor(st, 'customer', scope),
    columns: [
      { id: 'name', header: 'Account', width: '1.3fr', sortVal: (r) => r.name?.toLowerCase(), render: (r) => <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ width: 26, height: 26, borderRadius: 'var(--iso-radius-xs)', background: 'var(--iso-brand-soft)', color: 'var(--iso-brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="building-2" size={14} /></span><span style={{ fontWeight: 500 }}>{r.name}</span></span> },
      { id: 'status', header: 'Status', width: '130px', sortVal: (r) => statusIdx('customer', r.status), render: (r) => <Pill entity="customer" status={r.status} /> },
      { id: 'email', header: 'Primary email', key: 'primaryEmail', width: '1.2fr', sortVal: (r) => r.primaryEmail?.toLowerCase(), render: (r) => <span style={{ color: 'var(--iso-fg-muted)' }}>{r.primaryEmail}</span> },
      { id: 'phone', header: 'Phone', key: 'phone', width: '0.9fr', sortVal: (r) => r.phone, render: (r) => <span style={{ color: 'var(--iso-fg-muted)' }}>{r.phone}</span> },
    ],
    detail: (r) => [['Account', r.name], ['Status', STATUS_META.customer[r.status].label], ['Primary email', r.primaryEmail], ['Phone', r.phone], ['Originating lead', r.originatingLead || '—'], ['Owner', r.owner]],
  },
  tickets: {
    entity: 'ticket', singular: 'ticket', noun: 'Tickets', icon: 'life-buoy', createLabel: 'New ticket',
    select: (st, scope) => recordsFor(st, 'ticket', scope),
    columns: [
      { id: 'subject', header: 'Subject', width: '1.6fr', sortVal: (r) => r.subject?.toLowerCase(), render: (r) => <span style={{ fontWeight: 500 }}>{r.subject}</span> },
      { id: 'customer', header: 'Customer', key: 'customer', width: '1fr', sortVal: (r) => r.customer?.toLowerCase() },
      { id: 'status', header: 'Status', width: '130px', sortVal: (r) => statusIdx('ticket', r.status), render: (r) => <Pill entity="ticket" status={r.status} /> },
      { id: 'priority', header: 'Priority', width: '100px', sortVal: (r) => ['low', 'medium', 'high', 'urgent'].indexOf(r.priority), render: (r) => { const m = PRIORITY_META[r.priority]; return <StatusPill tone={m.tone} size="sm">{m.label}</StatusPill>; } },
      { id: 'assignee', header: 'Assignee', key: 'assignee', width: '0.9fr', sortVal: (r) => r.assignee?.toLowerCase() },
    ],
    detail: (r) => [['Subject', r.subject], ['Customer', r.customer], ['Priority', PRIORITY_META[r.priority].label], ['Status', STATUS_META.ticket[r.status].label], ['Assignee', r.assignee], ['Channel', 'Email']],
    note: (r) => ['Description', r.description],
  },
  audit: {
    entity: 'event', singular: 'event', noun: 'Audit & events', icon: 'scroll-text', createLabel: null,
    select: () => AUDIT_ROWS,
    columns: [
      { header: 'Event', width: '1.5fr', render: (r) => <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ width: 26, height: 26, borderRadius: 'var(--iso-radius-xs)', background: 'var(--iso-n-100)', color: 'var(--iso-fg-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={r.icon} size={14} /></span><span style={{ fontWeight: 500 }}>{r.event}</span></span> },
      { header: 'Actor', key: 'actor', width: '1fr' },
      { header: 'Result', width: '120px', render: (r) => <StatusPill tone={r.tone}>{r.result}</StatusPill> },
      { header: 'Scope', key: 'scope', width: '0.9fr' },
      { header: 'When', width: '0.9fr', align: 'right', render: (r) => <span style={{ color: 'var(--iso-fg-subtle)' }}>{r.when}</span> },
    ],
  },
};

const ME = { tenant_admin: 'Sara Khan', sales_agent: 'Marco Ruiz', support_agent: 'Lena Bauer', viewer: 'Sara Khan' };

/* ---------------- list URL state (q · status · owner · sort · page reflected in the URL) ---------------- */
function useListUrl(navId) {
  const read = () => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('tab') !== navId) return { q: '', status: 'all', owner: 'all', priority: 'all', sortCol: 'updated', sortDir: 'desc', page: 1 };
    return { q: p.get('q') || '', status: p.get('status') || 'all', owner: p.get('owner') || 'all', priority: p.get('priority') || 'all', sortCol: p.get('sortCol') || 'updated', sortDir: p.get('sortDir') || 'desc', page: parseInt(p.get('page') || '1', 10) };
  };
  const [s, setS] = useT(read);
  useTE(() => { setS(read()); /* re-read when nav changes */ }, [navId]);
  const sync = (next) => {
    setS(next);
    const p = new URLSearchParams(window.location.search);
    p.set('tab', navId);
    next.q ? p.set('q', next.q) : p.delete('q');
    next.status !== 'all' ? p.set('status', next.status) : p.delete('status');
    next.owner !== 'all' ? p.set('owner', next.owner) : p.delete('owner');
    next.priority && next.priority !== 'all' ? p.set('priority', next.priority) : p.delete('priority');
    next.sortCol && next.sortCol !== 'updated' ? p.set('sortCol', next.sortCol) : p.delete('sortCol');
    next.sortDir && next.sortDir !== 'desc' ? p.set('sortDir', next.sortDir) : p.delete('sortDir');
    next.page !== 1 ? p.set('page', String(next.page)) : p.delete('page');
    window.history.replaceState(null, '', window.location.pathname + (p.toString() ? '?' + p.toString() : ''));
  };
  return [s, sync];
}

/* ---------------- ListPage ---------------- */
function ListPage({ navId, role, scope, scopeName, scopeLoading, state, onState, onCreate, onOpenRecord, canWrite = true, canCreate = true, activeId, dense = false }) {
  const st = useStore();
  const cfg = ENTITY[navId] || ENTITY.customers;
  const isAudit = cfg.singular === 'event';
  const personKey = cfg.entity === 'ticket' ? 'assignee' : 'owner';
  const [u, setU] = useListUrl(navId);
  useTE(() => { setU({ ...u, page: 1 }); /* reset page on scope change */ }, [scope]);

  const all = useMemoT(() => cfg.select(st, scope), [st, scope, navId]);
  const owners = useMemoT(() => [...new Set(all.map(r => r[personKey]).filter(Boolean))], [all, personKey]);
  const statuses = cfg.entity && STATUS_META[cfg.entity] ? Object.keys(STATUS_META[cfg.entity]) : [];

  const rows = useMemoT(() => {
    let out = all;
    if (u.q) { const q = u.q.toLowerCase(); out = out.filter(r => [r.name, r.company, r.subject, r.customer, r[personKey]].some(x => x && String(x).toLowerCase().includes(q))); }
    if (u.status !== 'all') out = out.filter(r => r.status === u.status);
    if (u.owner !== 'all') out = out.filter(r => r[personKey] === u.owner);
    if (u.priority && u.priority !== 'all') out = out.filter(r => r.priority === u.priority);
    const col = cfg.columns.find(c => c.id === u.sortCol) || cfg.columns[0];
    const sv = col && col.sortVal ? col.sortVal : (r) => r.name || r.subject || '';
    const dir = u.sortDir === 'asc' ? 1 : -1;
    out = [...out].sort((a, b) => { const av = sv(a), bv = sv(b); if (av < bv) return -1 * dir; if (av > bv) return 1 * dir; return 0; });
    return out;
  }, [all, u.q, u.status, u.owner, u.priority, u.sortCol, u.sortDir, personKey]);

  const perPage = 25;
  const pageCount = Math.max(1, Math.ceil(rows.length / perPage));
  const page = Math.min(u.page, pageCount);
  const paged = rows.slice((page - 1) * perPage, page * perPage);

  let eff = scopeLoading ? 'loading' : state;
  if (eff === 'ready' && rows.length === 0 && (u.q || u.status !== 'all' || u.owner !== 'all' || (u.priority && u.priority !== 'all'))) eff = 'filtered-empty';
  else if (eff === 'ready' && rows.length === 0) eff = 'empty';
  const showData = eff === 'ready';

  const showCreate = cfg.createLabel && canCreate;

  return (
    <div style={PAGE_PAD}>
      <PageHeader
        eyebrow={`${role.label} · ${scopeName}`}
        title={cfg.noun}
        primary={showCreate ? <Button variant="primary" leadIcon="plus" onClick={onCreate}>{cfg.createLabel}</Button> : null}
        secondary={<Button variant="secondary" leadIcon="download">Export</Button>}
        right={<StateSwitcher state={state} onState={onState} />}
      />
      <Card style={{ overflow: 'visible' }}>
        <Toolbar onSearch={(q) => setU({ ...u, q, page: 1 })} searchValue={u.q} searchPlaceholder={`Search ${cfg.noun.toLowerCase()}…`} />
        {!isAudit && (
          <FilterBar groups={[
            <FilterSelect key="st" icon="activity" label="Status" value={u.status} onChange={(v) => setU({ ...u, status: v, page: 1 })}
              options={[{ value: 'all', label: 'All statuses' }, ...statuses.map(s => ({ value: s, label: STATUS_META[cfg.entity][s].label }))]} />,
            <FilterSelect key="ow" icon="user" label={personKey === 'assignee' ? 'Assignee' : 'Owner'} value={u.owner} onChange={(v) => setU({ ...u, owner: v, page: 1 })}
              options={[{ value: 'all', label: `All ${personKey === 'assignee' ? 'assignees' : 'owners'}` }, ...owners.map(o => ({ value: o, label: o }))]} />,
            cfg.entity === 'ticket'
              ? <FilterSelect key="pr" icon="flag" label="Priority" value={u.priority} onChange={(v) => setU({ ...u, priority: v, page: 1 })}
                  options={[{ value: 'all', label: 'All priorities' }, ...Object.keys(PRIORITY_META).map(p => ({ value: p, label: PRIORITY_META[p].label }))]} />
              : null,
            (u.status !== 'all' || u.owner !== 'all' || u.q || (u.priority && u.priority !== 'all'))
              ? <button key="clr" onClick={() => setU({ q: '', status: 'all', owner: 'all', priority: 'all', sortCol: u.sortCol, sortDir: u.sortDir, page: 1 })} style={{ background: 'transparent', border: 0, cursor: 'pointer', font: '500 12px/1 var(--iso-font-body)', color: 'var(--iso-link)' }}>Clear</button>
              : null,
          ].filter(Boolean)} sort={<span style={{ font: '400 12px/1 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)' }}>{rows.length} of {all.length} · sorted by {(cfg.columns.find(c => c.id === u.sortCol) || {}).header || 'Updated'} {u.sortDir === 'asc' ? '↑' : '↓'}</span>} />
        )}
        <DataTable
          columns={cfg.columns}
          rows={showData ? paged : []}
          state={eff === 'filtered-empty' ? 'empty' : eff}
          onRetry={() => onState('ready')}
          sortCol={u.sortCol} sortDir={u.sortDir}
          onSort={(c) => setU({ ...u, sortCol: c.id, sortDir: u.sortCol === c.id && u.sortDir === 'desc' ? 'asc' : 'desc', page: 1 })}
          onRowClick={isAudit ? undefined : (row) => onOpenRecord(row, rows)}
          activeId={activeId}
          rowActions={isAudit ? undefined : (row) => canWrite
            ? [{ label: 'Open', icon: 'arrow-up-right', onClick: () => onOpenRecord(row, rows) }, { label: 'Assign to me', icon: 'user-check' }, { label: 'Delete', icon: 'trash-2', tone: 'danger' }]
            : [{ label: 'Open', icon: 'arrow-up-right', onClick: () => onOpenRecord(row, rows) }]}
          empty={eff === 'filtered-empty'
            ? { icon: 'search-x', title: 'No matches', body: 'No records match the current search and filters. Try clearing them.', action: { label: 'Clear filters', icon: 'x', onClick: () => setU({ q: '', status: 'all', owner: 'all', priority: 'all', sortCol: u.sortCol, sortDir: u.sortDir, page: 1 }) } }
            : { icon: cfg.icon, title: `No ${cfg.noun.toLowerCase()} ${isAudit ? '' : 'in this scope '}yet`, scopeLine: scopeName,
                body: showCreate ? `Capture your first ${cfg.singular} to get started.` : 'Records appear here once they exist in this scope.',
                action: showCreate ? { label: cfg.createLabel, icon: 'plus', onClick: onCreate, autoFocus: true } : undefined }}
        />
        {showData && <Pagination page={page} pageCount={pageCount} total={rows.length} perPage={perPage} onPage={(p) => setU({ ...u, page: p })} />}
      </Card>
    </div>
  );
}

function FilterSelect({ icon, label, value, onChange, options }) {
  const active = value !== 'all';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 4px 0 10px', borderRadius: 'var(--iso-radius-sm)',
      border: `1px solid ${active ? 'var(--iso-brand)' : 'var(--iso-border)'}`, background: active ? 'var(--iso-brand-soft)' : '#fff' }}>
      <Icon name={icon} size={13} style={{ color: active ? 'var(--iso-brand)' : 'var(--iso-fg-subtle)' }} />
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}
        style={{ border: 0, outline: 0, background: 'transparent', font: `${active ? 500 : 400} 12px/1 var(--iso-font-body)`, color: active ? 'var(--iso-brand)' : 'var(--iso-fg-muted)', cursor: 'pointer', paddingRight: 4 }}>
        {options.map(o => <option key={o.value} value={o.value} style={{ color: 'var(--iso-fg)' }}>{o.label}</option>)}
      </select>
    </span>
  );
}

/* ---------------- DetailPage (store record) ---------------- */
function DetailPage({ navId, record, role, scopeName, state, onState, onBack, onDelete, onConvert, canWrite = true }) {
  const cfg = ENTITY[navId] || ENTITY.customers;
  const [tab, setTab] = useT('activity');

  if (state === 'loading') {
    return (
      <div style={PAGE_PAD}>
        <Skeleton w={220} h={12} />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><Skeleton w={280} h={28} /><Skeleton w={180} h={36} r={6} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--iso-space-6)' }}>
          <Card pad><div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{[...Array(5)].map((_, i) => <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}><Skeleton w={90} h={10} /><Skeleton w={i % 2 ? '60%' : '80%'} h={14} /></div>)}</div></Card>
          <Card pad><div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{[...Array(4)].map((_, i) => <Skeleton key={i} w="100%" h={14} />)}</div></Card>
        </div>
      </div>
    );
  }
  if (state === 'error') return <div style={PAGE_PAD}><PageHeader back={onBack} title="Record" right={<StateSwitcher state={state} onState={onState} />} /><Card><ErrorState onRetry={() => onState('ready')} /></Card></div>;
  if (state === 'empty' || !record) return <div style={PAGE_PAD}><PageHeader back={onBack} title="Record" right={<StateSwitcher state={state} onState={onState} />} /><Card><EmptyState icon="file-question" title="This record no longer exists" scopeLine={scopeName} body="It may have been deleted or moved out of your scope. Return to the list to continue." action={{ label: `Back to ${cfg.noun}`, icon: 'arrow-left', onClick: onBack }} /></Card></div>;

  const title = record.name || record.subject;
  const fields = cfg.detail(record);
  const note = cfg.note ? cfg.note(record) : null;
  const ownerName = record.owner || record.assignee || 'Sara Khan';
  const canConvert = cfg.entity === 'lead' && record.status === 'qualified';

  return (
    <div style={PAGE_PAD}>
      <PageHeader
        breadcrumbs={[{ label: cfg.noun, onClick: onBack }, { label: title }]}
        back={onBack}
        title={title}
        statusPill={<Pill entity={cfg.entity} status={record.status} />}
        right={<StateSwitcher state={state} onState={onState} />}
        secondary={canWrite && canConvert && <Button variant="secondary" leadIcon="repeat" onClick={onConvert}>Convert</Button>}
        primary={canWrite
          ? <Button variant="ghost" leadIcon="trash-2" onClick={onDelete} style={{ color: 'var(--iso-danger)' }}>Delete</Button>
          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '500 11px/1 var(--iso-font-ui)', color: 'var(--iso-fg-muted)', border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius-full)', padding: '7px 11px' }}><Icon name="eye" size={13} />Read-only</span>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--iso-space-6)', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--iso-space-4)' }}>
          <Card pad>
            <SectionLabel style={{ marginBottom: 16 }}>Details</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 32px' }}>
              {fields.map(([k, v], i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ font: '400 11px/1 var(--iso-font-ui)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)' }}>{k}</span>
                  <span style={{ font: '400 14px/1.4 var(--iso-font-body)', color: 'var(--iso-fg)' }}>{v}</span>
                </div>
              ))}
            </div>
            {note && (
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--iso-border-muted)' }}>
                <span style={{ font: '400 11px/1 var(--iso-font-ui)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)' }}>{note[0]}</span>
                <p style={{ margin: '7px 0 0', font: '400 14px/1.5 var(--iso-font-body)', color: 'var(--iso-fg)', maxWidth: '70ch' }}>{note[1]}</p>
              </div>
            )}
          </Card>
          <Card>
            <div style={{ display: 'flex', gap: 4, padding: '8px 12px 0', borderBottom: '1px solid var(--iso-border-muted)' }}>
              {[['activity', 'Activity'], ['notes', 'Notes'], ['related', 'Related']].map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)} style={{ position: 'relative', padding: '10px 12px', border: 0, background: 'transparent', cursor: 'pointer',
                  font: `${tab === id ? 500 : 400} 13px/1 var(--iso-font-body)`, color: tab === id ? 'var(--iso-brand)' : 'var(--iso-fg-muted)' }}>
                  {label}
                  {tab === id && <span style={{ position: 'absolute', left: 12, right: 12, bottom: -1, height: 2, background: 'var(--iso-brand)', borderRadius: 2 }} />}
                </button>
              ))}
            </div>
            <div style={{ padding: 'var(--iso-space-6)' }}>
              {tab === 'activity'
                ? <ActivityTimeline owner={ownerName} />
                : <EmptyState compact icon={tab === 'notes' ? 'sticky-note' : 'link'} title={tab === 'notes' ? 'No notes yet' : 'No related records'} body={tab === 'notes' ? 'Notes added to this record appear here, newest first.' : 'Linked records and references appear here.'} />}
            </div>
          </Card>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--iso-space-4)' }}>
          <Card pad>
            <SectionLabel style={{ marginBottom: 14 }}>{cfg.entity === 'ticket' ? 'Assignment' : 'Ownership'}</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Avatar initials={initialsOf(ownerName)} size={34} color="var(--iso-blue-3-400)" />
              <div><div style={{ font: '500 13px/1.3 var(--iso-font-body)' }}>{ownerName}</div><div style={{ font: '400 11px/1.3 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)' }}>{cfg.entity === 'ticket' ? 'Assignee' : 'Owner'}</div></div>
            </div>
            <Button variant="secondary" size="sm" leadIcon="user-check" style={{ width: '100%' }}>{cfg.entity === 'ticket' ? 'Reassign' : 'Reassign owner'}</Button>
          </Card>
          <Card pad>
            <SectionLabel style={{ marginBottom: 14 }}>Meta</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[['Scope', scopeName], ['Created', '2 Jun 2026'], ['Last updated', `${record.updated} 2026`], ['Record ID', record.id]].map(([k, v], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, font: '400 12px/1.4 var(--iso-font-ui)' }}>
                  <span style={{ color: 'var(--iso-fg-subtle)' }}>{k}</span><span style={{ color: 'var(--iso-fg)' }}>{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Activity timeline (audit-as-feature) ---------------- */
function ActivityTimeline({ owner = 'Marco Ruiz' }) {
  const events = [
    { icon: 'repeat', tone: 'success', who: owner, what: 'changed status to', val: 'Qualified', when: '5 Jun · 11:48' },
    { icon: 'user-check', tone: 'info', who: owner, what: 'took ownership', val: '', when: '4 Jun · 16:10' },
    { icon: 'message-square', tone: 'neutral', who: 'Sara Khan', what: 'added a note', val: '', when: '4 Jun · 09:02' },
    { icon: 'plus-circle', tone: 'neutral', who: 'System', what: 'created the record', val: '', when: '2 Jun · 14:20' },
  ];
  const tc = { success: 'var(--iso-success)', info: 'var(--iso-accent)', neutral: 'var(--iso-n-600)', warning: 'var(--iso-warning)', danger: 'var(--iso-danger)' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {events.map((e, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: i === events.length - 1 ? 0 : 18, position: 'relative' }}>
          {i !== events.length - 1 && <span style={{ position: 'absolute', left: 14, top: 30, bottom: 0, width: 1, background: 'var(--iso-border)' }} />}
          <span style={{ width: 29, height: 29, flex: 'none', borderRadius: '50%', background: '#fff', border: '1px solid var(--iso-border)', color: tc[e.tone],
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}><Icon name={e.icon} size={14} /></span>
          <div style={{ paddingTop: 5 }}>
            <div style={{ font: '400 13px/1.4 var(--iso-font-body)', color: 'var(--iso-fg)' }}>
              <b style={{ fontWeight: 500 }}>{e.who}</b> {e.what} {e.val && <StatusPill tone="info" size="sm">{e.val}</StatusPill>}
            </div>
            <div style={{ font: '400 11px/1 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)', marginTop: 4 }}>{e.when}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Dashboard (store counts, scope-reactive) ---------------- */
function DashboardPage({ role, scope, scopeName, scopeLoading, state, onState }) {
  const st = useStore();
  const k = useMemoT(() => {
    const leads = recordsFor(st, 'lead', scope), custs = recordsFor(st, 'customer', scope), ticks = recordsFor(st, 'ticket', scope);
    return {
      openLeads: leads.filter(r => ['new', 'contacted', 'qualified'].includes(r.status)).length,
      activeCust: custs.filter(r => r.status === 'active').length,
      openTickets: ticks.filter(r => ['open', 'in_progress', 'pending'].includes(r.status)).length,
      atRisk: custs.filter(r => ['inactive', 'churned'].includes(r.status)).length,
    };
  }, [st, scope]);
  const eff = scopeLoading ? 'loading' : state;
  const kpis = [['Open leads', k.openLeads, 'user-plus'], ['Active customers', k.activeCust, 'building-2'], ['Open tickets', k.openTickets, 'life-buoy'], ['At-risk accounts', k.atRisk, 'alert-triangle']];

  return (
    <div style={PAGE_PAD}>
      <PageHeader eyebrow={`${role.label} · ${scopeName}`} title="Dashboard"
        subtitle="An at-a-glance read of the active scope. Counts re-query when you switch scope."
        right={<StateSwitcher state={state} onState={onState} />}
        secondary={<Button variant="secondary" leadIcon="calendar">Last 30 days</Button>} />
      {eff === 'error'
        ? <Card><ErrorState title="Can't load dashboard data" onRetry={() => onState('ready')} /></Card>
        : eff === 'empty'
        ? <Card><EmptyState icon="layout-dashboard" title="No activity in this scope yet" scopeLine={scopeName} body="Widgets populate once there are records to summarise. Switch scope or create a record to begin." /></Card>
        : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--iso-space-4)' }}>
              {kpis.map(([t, v, ic], i) => (
                <Card key={i} pad style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 'var(--iso-radius-xs)', background: 'var(--iso-blue-3-100)', color: 'var(--iso-brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={ic} size={17} /></span>
                  {eff === 'loading'
                    ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton w={48} h={26} /><Skeleton w={100} h={11} /></div>
                    : <><div style={{ font: '500 32px/1 var(--iso-font-display)', letterSpacing: '-0.02em', color: 'var(--iso-fg-strong)' }}>{v}</div>
                        <div style={{ font: '500 12px/1.3 var(--iso-font-body)', color: 'var(--iso-fg-muted)', marginTop: 6 }}>{t}</div></>}
                </Card>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 'var(--iso-space-4)' }}>
              <Card style={{ minHeight: 280 }}>
                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--iso-border-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <SectionLabel>Pipeline by stage</SectionLabel>
                  {eff === 'ready' && <ScaffoldNote>chart region</ScaffoldNote>}
                </div>
                <div style={{ padding: 18 }}>
                  {eff === 'loading' ? <Skeleton w="100%" h={210} r={8} /> : <WidgetPlaceholder icon="bar-chart-3" label="Chart widget mounts here" />}
                </div>
              </Card>
              <Card style={{ minHeight: 280 }}>
                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--iso-border-muted)' }}><SectionLabel>Recent activity</SectionLabel></div>
                <div style={{ padding: 18 }}>
                  {eff === 'loading'
                    ? <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{[...Array(4)].map((_, i) => <div key={i} style={{ display: 'flex', gap: 10 }}><Skeleton w={28} h={28} r={14} /><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}><Skeleton w="80%" h={12} /><Skeleton w="40%" h={10} /></div></div>)}</div>
                    : <ActivityTimeline />}
                </div>
              </Card>
            </div>
          </>
        )}
    </div>
  );
}
function WidgetPlaceholder({ icon, label }) {
  return (
    <div style={{ height: 210, borderRadius: 'var(--iso-radius-md)', border: '1px dashed var(--iso-border-strong)', background: 'var(--iso-blue-3-50)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--iso-fg-subtle)' }}>
      <Icon name={icon} size={26} strokeWidth={1.5} />
      <span style={{ font: '400 12px/1 var(--iso-font-ui)' }}>{label}</span>
    </div>
  );
}

Object.assign(window, { StateSwitcher, PageHeader, ScaffoldNote, ENTITY, ListPage, DetailPage, DashboardPage, ActivityTimeline, initialsOf, Pill });
