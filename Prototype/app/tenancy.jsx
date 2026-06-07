/* global React, Icon, Button, StatusPill, Skeleton, EmptyState, ErrorState, Card, SectionLabel,
   DataTable, Toolbar, Pagination, PageHeader, StateSwitcher, TextField, SelectField, pushToast,
   Store, useStore, activeSubs, subName, rollup, recordsFor, todayStr */
/* min-crm — Tenancy module (tenant_admin). Subsidiaries list · Onboard · Offboard (batch reassign) ·
   Roll-up · Not-found 404. */
const { useState: useTn, useMemo: useMemoTn, useEffect: useTnE, useRef: useTnR } = React;

const TN_PAD = { padding: '28px 32px', maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--iso-space-6)' };

/* ============================================================ SCREEN A — Subsidiaries list */
function SubsidiariesPage({ role, scope, scopeName, scopeLoading, state, onState }) {
  const st = useStore();
  const [includeOff, setIncludeOff] = useTn(false);
  const [onboard, setOnboard] = useTn(false);
  const [offboard, setOffboard] = useTn(null); // subsidiary being offboarded

  const rows = useMemoTn(() => st.subsidiaries.filter(s => includeOff || s.active), [st, includeOff]);
  let eff = scopeLoading ? 'loading' : state;
  if (eff === 'ready' && st.subsidiaries.filter(s => s.active).length === 0 && !includeOff) eff = 'empty';
  const showData = eff === 'ready';

  const columns = [
    { header: 'Name', width: '1.4fr', render: (r) => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: r.active ? 1 : 0.55 }}>
        <span style={{ width: 28, height: 28, borderRadius: 'var(--iso-radius-xs)', background: r.active ? 'var(--iso-brand-soft)' : 'var(--iso-n-100)', color: r.active ? 'var(--iso-brand)' : 'var(--iso-fg-subtle)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="building-2" size={15} /></span>
        <span style={{ fontWeight: 500 }}>{r.name}</span>
        {!r.active && <StatusPill tone="neutral" size="sm">Offboarded</StatusPill>}
      </span>) },
    { header: 'Parent', width: '1fr', render: (r) => r.parentId ? subName(st, r.parentId) : <span style={{ color: 'var(--iso-fg-subtle)' }}>Top-level</span> },
    { header: 'Region', key: 'region', width: '0.9fr', render: (r) => <span style={{ color: 'var(--iso-fg-muted)' }}>{r.region}</span> },
    { header: 'Created', width: '0.8fr', align: 'right', render: (r) => <span style={{ color: 'var(--iso-fg-subtle)' }}>{r.created}</span> },
  ];

  return (
    <div style={TN_PAD}>
      <PageHeader
        eyebrow={`${role.label} · tenancy`}
        title="Subsidiaries"
        subtitle="Onboard, offboard and inspect the tenant’s subsidiaries. Offboarding reassigns active records before a subsidiary leaves."
        primary={<Button variant="primary" leadIcon="plus" onClick={() => setOnboard(true)}>Onboard subsidiary</Button>}
        right={<StateSwitcher state={state} onState={onState} />}
      />
      <Card style={{ overflow: 'visible' }}>
        <Toolbar onSearch={() => {}} searchPlaceholder="Search subsidiaries…"
          right={<label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', font: '400 12px/1 var(--iso-font-body)', color: 'var(--iso-fg-muted)' }}>
            <Toggle on={includeOff} onChange={() => setIncludeOff(v => !v)} />Include offboarded
          </label>} />
        <DataTable
          columns={columns}
          rows={showData ? rows : []}
          state={eff}
          onRetry={() => onState('ready')}
          rowActions={(r) => r.active
            ? [{ label: 'Offboard subsidiary', icon: 'log-out', tone: 'danger', onClick: () => setOffboard(r) }]
            : [{ label: 'Offboarded — read only', icon: 'lock' }]}
          empty={{ icon: 'network', title: 'No subsidiaries yet', scopeLine: 'Northwind Trading',
            body: 'Onboard your first subsidiary to start managing scoped records.',
            action: { label: 'Onboard subsidiary', icon: 'plus', onClick: () => setOnboard(true), autoFocus: true } }}
        />
      </Card>

      {onboard && <OnboardForm onClose={() => setOnboard(false)} />}
      {offboard && <OffboardDialog sub={offboard} scope={scope} onClose={() => setOffboard(null)} />}
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onChange} style={{
      width: 36, height: 20, borderRadius: 'var(--iso-radius-full)', border: 0, cursor: 'pointer', padding: 2, flex: 'none',
      background: on ? 'var(--iso-brand)' : 'var(--iso-n-300)', transition: 'background var(--crm-fast) var(--crm-ease-standard)' }}>
      <span style={{ display: 'block', width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transform: `translateX(calc(var(--crm-travel) * ${on ? 16 : 0}px))`, transition: 'transform var(--crm-fast) var(--crm-ease-standard)' }} />
    </button>
  );
}

/* ============================================================ SCREEN B — Onboard subsidiary */
function OnboardForm({ onClose }) {
  const st = Store.get();
  const [name, setName] = useTn('');
  const [parent, setParent] = useTn('top');
  const [err, setErr] = useTn(null);
  const [outcome, setOutcome] = useTn('success');
  const panelRef = useTnR(null);
  const firstRef = useTnR(null);

  useTnE(() => {
    const t = setTimeout(() => firstRef.current?.focus(), 30);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab') {
        const f = [...(panelRef.current?.querySelectorAll('input,select,button') || [])].filter(x => !x.disabled);
        if (!f.length) return; const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); };
  }, []);

  const valid = name.trim().length > 0;
  const submit = () => {
    if (!valid) { setErr('This field is required'); setTimeout(() => firstRef.current?.focus(), 0); return; }
    // optimistic add — row appears immediately
    const sub = Store.onboard({ name: name.trim(), parentId: parent });
    onClose();
    if (outcome === 'success') {
      pushToast({ tone: 'success', title: 'Subsidiary onboarded.', sub: `${sub.name} inherits the tenant configuration by default.` });
    } else {
      // rollback: remove the optimistic row after the server rejects
      setTimeout(() => {
        Store.set(s => ({ subsidiaries: s.subsidiaries.filter(x => x.id !== sub.id) }));
        pushToast({ tone: 'danger', title: 'Couldn’t onboard — rolled back.', sub: 'The subsidiary was removed. Try again.', persist: true, action: { label: 'Retry' } });
      }, 700);
    }
  };

  const parentOptions = [{ value: 'top', label: 'Top-level (no parent)' }, ...activeSubs(st).map(s => ({ value: s.id, label: s.name }))];

  return (
    <ModalShell label="Onboard subsidiary" icon="building-2" onClose={onClose} panelRef={panelRef} width={500}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={submit}>Onboard subsidiary</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <TextField label="Subsidiary name" required error={err} value={name} onChange={(v) => { setName(v); if (err) setErr(null); }} placeholder="e.g. LATAM subsidiary" ref={firstRef} data-fid="name" />
        <SelectField label="Parent" value={parent} onChange={setParent} options={parentOptions} help="Choose an existing subsidiary to nest under, or keep it top-level." />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 13px', borderRadius: 'var(--iso-radius-sm)', background: 'var(--iso-blue-3-50)', border: '1px solid var(--iso-border-muted)' }}>
          <Icon name="info" size={15} style={{ color: 'var(--iso-accent)', marginTop: 1, flex: 'none' }} />
          <span style={{ font: '400 12px/1.5 var(--iso-font-ui)', color: 'var(--iso-fg-muted)' }}>The new subsidiary inherits the tenant configuration by default. You can adjust it afterward.</span>
        </div>
        <OutcomePicker outcome={outcome} setOutcome={setOutcome} options={[{ value: 'success', label: 'Success' }, { value: 'fail', label: 'Server error' }]} />
      </div>
    </ModalShell>
  );
}

/* ============================================================ SCREEN C — Offboard subsidiary */
function OffboardDialog({ sub, scope, onClose }) {
  const impact = useMemoTn(() => Store.offboardImpact(sub.id), [sub.id]);
  const total = impact.leads + impact.customers + impact.tickets;
  const [target, setTarget] = useTn('');
  const [phase, setPhase] = useTn('choose'); // choose | running
  const [done, setDone] = useTn(0);
  const [simulateFail, setSimulateFail] = useTn(false);
  const panelRef = useTnR(null);
  const cancelRef = useTnR(null);
  const runningRef = useTnR(false);

  useTnE(() => {
    const t = setTimeout(() => cancelRef.current?.focus(), 0); // focus SAFE control, never destructive
    const onKey = (e) => {
      if (e.key === 'Escape' && !runningRef.current) { e.preventDefault(); onClose(); }
      if (e.key === 'Tab') {
        const f = [...(panelRef.current?.querySelectorAll('button,select,input') || [])].filter(x => !x.disabled);
        if (!f.length) return; const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); };
  }, []);

  const st = Store.get();
  const targetOptions = [
    ...activeSubs(st).filter(s => s.id !== sub.id).map(s => ({ value: s.id, label: s.name })),
    { value: 'parent', label: 'Parent level (shared)' },
  ];
  const targetName = target === 'parent' ? 'Parent level' : (activeSubs(st).find(s => s.id === target)?.name || '');

  const run = () => {
    if (!target) return;
    setPhase('running'); runningRef.current = true;
    if (total === 0) { finish(); return; }
    const failAt = simulateFail ? Math.max(1, Math.floor(total * 0.6)) : -1;
    let i = 0;
    const stepMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--crm-base')) || 200;
    const tick = () => {
      i += 1; setDone(i);
      if (i === failAt) { // rollback mid-batch — nothing committed
        runningRef.current = false;
        pushToast({ tone: 'danger', title: 'Reassignment failed mid-batch — rolled back.', sub: `No records moved. ${sub.name} is still active.`, persist: true, action: { label: 'Try again' } });
        onClose();
        return;
      }
      if (i >= total) { finish(); return; }
      setTimeout(tick, Math.max(90, stepMs / 2));
    };
    setTimeout(tick, 200);
  };
  const finish = () => {
    Store.commitOffboard(sub.id, target);
    if (scope === sub.id) Store.setScope('tenant'); // can't stay scoped to an offboarded sub
    runningRef.current = false;
    pushToast({ tone: 'success', title: `${sub.name} offboarded.`, sub: total > 0 ? `${total} active record${total === 1 ? '' : 's'} reassigned to ${targetName}.` : 'No active records to reassign.' });
    onClose();
  };

  return (
    <ModalShell label={`Offboard ${sub.name}`} icon="alert-triangle" tone="danger" onClose={runningRef.current ? () => {} : onClose} panelRef={panelRef} width={500}
      footer={phase === 'choose'
        ? <><Button ref={cancelRef} variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="danger" disabled={!target} onClick={run}>Offboard subsidiary</Button></>
        : <Button variant="secondary" disabled>Reassigning…</Button>}>
      {phase === 'choose' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, font: '400 13px/20px var(--iso-font-body)', color: 'var(--iso-fg-muted)' }}>
            Offboarding soft-deletes <b style={{ color: 'var(--iso-fg)', fontWeight: 500 }}>{sub.name}</b> — it disappears from lists and the scope switcher. Its active records must be reassigned first.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['Leads', impact.leads], ['Customers', impact.customers], ['Tickets', impact.tickets]].map(([l, n], i) => (
              <div key={i} style={{ flex: 1, padding: '12px 14px', borderRadius: 'var(--iso-radius-sm)', background: 'var(--iso-blue-3-50)', border: '1px solid var(--iso-border-muted)' }}>
                <div style={{ font: '500 22px/1 var(--iso-font-display)', color: 'var(--iso-fg-strong)' }}>{n}</div>
                <div style={{ font: '400 11px/1 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)', marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{l}</div>
              </div>
            ))}
          </div>
          <SelectField label="Reassign active records to" required value={target} onChange={setTarget} options={targetOptions} placeholder="Choose a target…"
            help="Records and their ownership move to this target. Targets are limited to active subsidiaries in this tenant." />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 9, cursor: 'pointer', font: '400 12px/1.4 var(--iso-font-ui)', color: 'var(--iso-fg-muted)' }}>
            <Toggle on={simulateFail} onChange={() => setSimulateFail(v => !v)} />Simulate a mid-batch failure (rolls back)
          </label>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '6px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ font: '500 13px/1 var(--iso-font-body)', color: 'var(--iso-fg)' }}>Reassigning to {targetName}</span>
            <span style={{ font: '500 13px/1 var(--iso-font-ui)', color: 'var(--iso-fg-muted)' }}>{done} / {total}</span>
          </div>
          <div style={{ height: 8, borderRadius: 'var(--iso-radius-full)', background: 'var(--iso-n-100)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${total ? (done / total) * 100 : 100}%`, background: 'var(--iso-brand)', borderRadius: 'inherit', transition: 'width var(--crm-base) var(--crm-ease-decelerate)' }} />
          </div>
          <span style={{ font: '400 12px/1.4 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)' }}>Moving leads, customers and tickets and re-scoping their owners…</span>
        </div>
      )}
    </ModalShell>
  );
}

/* ============================================================ SCREEN E — Cross-subsidiary roll-up */
function RollupPage({ role, scope, scopeName, scopeLoading, state, onState, onNotFound }) {
  const st = useStore();
  const rows = useMemoTn(() => rollup(st, scope), [st, scope]);
  const totals = rows.reduce((a, r) => ({ leads: a.leads + r.leads, customers: a.customers + r.customers, tickets: a.tickets + r.tickets }), { leads: 0, customers: 0, tickets: 0 });
  const grand = totals.leads + totals.customers + totals.tickets;
  let eff = scopeLoading ? 'loading' : state;
  if (eff === 'ready' && grand === 0) eff = 'empty';

  const col = { font: '400 14px/1 var(--iso-font-ui)', color: 'var(--iso-fg)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  const th = { font: '500 10px/1 var(--iso-font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)' };

  return (
    <div style={TN_PAD}>
      <PageHeader
        eyebrow={`${role.label} · ${scopeName}`}
        title="Cross-subsidiary roll-up"
        subtitle={scope === 'tenant' ? 'A read-only aggregate across every subsidiary in the tenant. No editing, no cross-boundary writes.' : 'Read-only counts for your current scope. Sibling subsidiaries are not shown.'}
        right={<StateSwitcher state={state} onState={onState} />}
        secondary={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '500 11px/1 var(--iso-font-ui)', color: 'var(--iso-fg-muted)', border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius-full)', padding: '6px 11px' }}><Icon name="lock" size={12} />Read-only</span>}
      />
      {eff === 'error' ? <Card><ErrorState title="Can't load roll-up" onRetry={() => onState('ready')} /></Card>
        : eff === 'empty' ? <Card><EmptyState icon="layers" title="Nothing to roll up yet" scopeLine={scopeName} body="Once subsidiaries hold records, their counts aggregate here." /></Card>
        : (
          <Card style={{ overflow: 'hidden' }}>
            <div role="table">
              <div role="row" style={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(4, 1fr)', alignItems: 'center', height: 40, padding: '0 var(--iso-space-5)', borderBottom: '1px solid var(--iso-border)', background: 'var(--iso-blue-3-50)' }}>
                <div style={th}>Subsidiary</div><div style={{ ...th, textAlign: 'right' }}>Leads</div><div style={{ ...th, textAlign: 'right' }}>Customers</div><div style={{ ...th, textAlign: 'right' }}>Tickets</div><div style={{ ...th, textAlign: 'right' }}>Total</div>
              </div>
              {eff === 'loading'
                ? [...Array(4)].map((_, i) => <div key={i} role="row" style={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(4, 1fr)', alignItems: 'center', minHeight: 52, padding: '0 var(--iso-space-5)', borderBottom: '1px solid var(--iso-border-muted)' }}><Skeleton w="55%" h={13} /><Skeleton w={28} h={12} style={{ justifySelf: 'end' }} /><Skeleton w={28} h={12} style={{ justifySelf: 'end' }} /><Skeleton w={28} h={12} style={{ justifySelf: 'end' }} /><Skeleton w={28} h={12} style={{ justifySelf: 'end' }} /></div>)
                : rows.map(r => {
                  const t = r.leads + r.customers + r.tickets;
                  return (
                    <div key={r.id} role="row" style={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(4, 1fr)', alignItems: 'center', minHeight: 52, padding: '0 var(--iso-space-5)', borderBottom: '1px solid var(--iso-border-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 500, font: '500 14px/1.3 var(--iso-font-body)', color: 'var(--iso-fg)' }}>
                        <span style={{ width: 26, height: 26, borderRadius: 'var(--iso-radius-xs)', background: r.id === 'parent' ? 'var(--iso-n-100)' : 'var(--iso-brand-soft)', color: r.id === 'parent' ? 'var(--iso-fg-muted)' : 'var(--iso-brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={r.id === 'parent' ? 'layers' : 'building-2'} size={14} /></span>
                        {r.name}
                      </div>
                      <div style={col}>{r.leads}</div><div style={col}>{r.customers}</div><div style={col}>{r.tickets}</div>
                      <div style={{ ...col, fontWeight: 600, color: 'var(--iso-fg-strong)' }}>{t}</div>
                    </div>
                  );
                })}
              {eff === 'ready' && (
                <div role="row" style={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(4, 1fr)', alignItems: 'center', minHeight: 52, padding: '0 var(--iso-space-5)', background: 'var(--iso-blue-3-50)' }}>
                  <div style={{ font: '500 13px/1 var(--iso-font-ui)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)' }}>Tenant total</div>
                  <div style={{ ...col, fontWeight: 600 }}>{totals.leads}</div><div style={{ ...col, fontWeight: 600 }}>{totals.customers}</div><div style={{ ...col, fontWeight: 600 }}>{totals.tickets}</div>
                  <div style={{ ...col, fontWeight: 700, color: 'var(--iso-brand)' }}>{grand}</div>
                </div>
              )}
            </div>
          </Card>
        )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '400 12px/1.4 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)' }}>
        <Icon name="external-link" size={13} />
        <span>Edge case:</span>
        <button onClick={onNotFound} style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer', font: '500 12px/1.4 var(--iso-font-body)', color: 'var(--iso-link)', textDecoration: 'underline', textUnderlineOffset: 2 }}>open a record from another workspace ↗</button>
      </div>
    </div>
  );
}

/* ============================================================ EDGE — Not found in this workspace */
function NotFoundView({ scopeName, onHome }) {
  return (
    <div style={{ ...TN_PAD, minHeight: '70vh', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, maxWidth: 460 }}>
        <span aria-hidden style={{ width: 64, height: 64, borderRadius: 'var(--iso-radius-xl)', background: 'var(--iso-blue-3-100)', color: 'var(--iso-brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Icon name="compass" size={30} strokeWidth={1.5} /></span>
        <div style={{ font: '500 10px/1 var(--iso-font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)' }}>404 · not found</div>
        <h1 style={{ margin: '4px 0 0', font: '500 26px/1.2 var(--iso-font-display)', letterSpacing: '-0.02em', color: 'var(--iso-fg-strong)' }}>Not found in this workspace</h1>
        <p style={{ margin: '8px 0 0', font: '400 14px/1.6 var(--iso-font-body)', color: 'var(--iso-fg-muted)', textWrap: 'pretty' }}>
          The record you tried to open isn’t part of <b style={{ color: 'var(--iso-fg)', fontWeight: 500 }}>{scopeName}</b>. It may belong to another subsidiary or tenant, or it may have moved. This is a calm not-found — never a permission warning.
        </p>
        <div style={{ marginTop: 18 }}><Button variant="primary" leadIcon="arrow-left" onClick={onHome}>Back to {scopeName}</Button></div>
      </div>
    </div>
  );
}

/* ---------------- shared modal shell + outcome picker ---------------- */
function ModalShell({ label, icon, tone, onClose, panelRef, width = 500, footer, children }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={label} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 'var(--iso-z-modal)', background: 'rgba(15,22,38,0.42)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 24px', overflow: 'auto', animation: 'crm-fade var(--crm-base) var(--crm-ease-decelerate)' }}>
      <div ref={panelRef} style={{ width, maxWidth: '100%', background: '#fff', borderRadius: 'var(--iso-radius-lg)', boxShadow: 'var(--iso-shadow-modal)', animation: 'crm-pop var(--crm-base) var(--crm-ease-decelerate)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 22px', borderBottom: '1px solid var(--iso-border-muted)' }}>
          <span style={{ width: 36, height: 36, borderRadius: 'var(--iso-radius-sm)', background: tone === 'danger' ? 'var(--iso-danger-soft)' : 'var(--iso-brand-soft)', color: tone === 'danger' ? 'var(--iso-danger)' : 'var(--iso-brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={icon} size={18} /></span>
          <h3 style={{ flex: 1, margin: 0, font: '500 18px/1.2 var(--iso-font-display)', color: 'var(--iso-fg-strong)' }}>{label}</h3>
          <button onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, borderRadius: 'var(--iso-radius-sm)', border: 0, background: 'transparent', color: 'var(--iso-fg-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={17} /></button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--iso-space-2)', padding: '4px 22px 20px' }}>{footer}</div>
      </div>
    </div>
  );
}
function OutcomePicker({ outcome, setOutcome, options }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 'var(--iso-radius-md)', background: 'var(--iso-blue-3-50)', border: '1px dashed var(--iso-blue-3-300)' }}>
      <Icon name="flask-conical" size={15} style={{ color: 'var(--iso-accent)', flex: 'none' }} />
      <span style={{ flex: 1, font: '400 12px/1.3 var(--iso-font-ui)', color: 'var(--iso-fg-muted)' }}>Simulate server response</span>
      <div style={{ display: 'inline-flex', gap: 2, padding: 2, background: '#fff', border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius-sm)' }}>
        {options.map(o => (
          <button key={o.value} onClick={() => setOutcome(o.value)} style={{ height: 26, padding: '0 10px', border: 0, borderRadius: 'var(--iso-radius-xs)',
            background: outcome === o.value ? 'var(--iso-brand-soft)' : 'transparent', color: outcome === o.value ? 'var(--iso-brand)' : 'var(--iso-fg-muted)',
            font: `${outcome === o.value ? 500 : 400} 11px/1 var(--iso-font-ui)`, cursor: 'pointer' }}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { SubsidiariesPage, OnboardForm, OffboardDialog, RollupPage, NotFoundView, Toggle, ModalShell, OutcomePicker });
