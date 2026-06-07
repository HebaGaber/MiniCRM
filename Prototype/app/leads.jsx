/* global React, Icon, Button, StatusPill, Skeleton, EmptyState, ErrorState, Card, SectionLabel,
   PageHeader, StateSwitcher, ModalShell, OutcomePicker, TextField, SelectField, FieldShell, pushToast,
   Store, useStore, TRANSITIONS, STATUS_META, leadOwners, initialsOf, Pill, ChangeStatusControl, RecordTimeline */
/* min-crm — Leads module. Capture/edit form · qualification state machine · convert · activity timeline. */
const { useState: useLd, useEffect: useLdE, useRef: useLdR, useMemo: useLdM } = React;

const LEAD_PAD = { padding: '28px 32px', maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--iso-space-6)' };
const SOURCES = [{ value: 'web', label: 'Web' }, { value: 'referral', label: 'Referral' }, { value: 'event', label: 'Event' }, { value: 'outbound', label: 'Outbound' }, { value: 'import', label: 'Import' }];
const SOURCE_LABEL = Object.fromEntries(SOURCES.map(s => [s.value, s.label]));
const NOW_TS = Date.UTC(2026, 5, 6, 14, 30);
function relTime(at) {
  const ms = NOW_TS - at; const min = Math.round(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60); if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24); return d === 1 ? 'yesterday' : `${d} days ago`;
}

/* ============================================================ SCREEN A — Capture / edit lead */
function LeadForm({ mode = 'create', lead, scope, actor, onClose, onCreated }) {
  const init = lead || {};
  const [v, setV] = useLd({ name: init.name || '', company: init.company || '', email: init.email || '', phone: init.phone || '', source: init.source || '', owner: init.owner || '', bant: init.bant || '' });
  const [errors, setErrors] = useLd({});
  const [outcome, setOutcome] = useLd('success');
  const panelRef = useLdR(null), firstRef = useLdR(null);

  useLdE(() => {
    const t = setTimeout(() => firstRef.current?.focus(), 30);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab') {
        const f = [...(panelRef.current?.querySelectorAll('input,select,textarea,button') || [])].filter(x => !x.disabled);
        if (!f.length) return; const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); };
  }, []);

  const set = (k, val) => { setV(p => ({ ...p, [k]: val })); if (errors[k]) setErrors(e => ({ ...e, [k]: null })); };
  const validate = () => {
    const e = {};
    if (!v.name.trim()) e.name = 'This field is required';
    if (!v.source) e.source = 'Choose a source';
    if (!v.owner) e.owner = 'Assign a single owner';
    if (v.email && !/.+@.+\..+/.test(v.email)) e.email = 'Enter a valid email address';
    return e;
  };
  const valid = v.name.trim() && v.source && v.owner && (!v.email || /.+@.+\..+/.test(v.email));

  const submit = () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      const firstId = ['name', 'email', 'source', 'owner'].find(k => e[k]);
      setTimeout(() => panelRef.current?.querySelector(`[data-fid="${firstId}"]`)?.focus(), 0);
      return;
    }
    if (mode === 'edit') {
      Store.editLead(lead.id, v, actor);
      onClose();
      pushToast({ tone: 'success', title: 'Lead updated.' });
      return;
    }
    // optimistic create — status "new"
    const created = Store.createLead(v, scope, actor);
    if (outcome === 'success') {
      onClose();
      pushToast({ tone: 'success', title: 'Lead captured.', sub: `${created.name} created in status “new”.` });
      onCreated?.(created); // redirect to detail
    } else {
      onClose();
      setTimeout(() => {
        Store.removeLead(created.id);
        pushToast({ tone: 'danger', title: 'Couldn’t capture lead — rolled back.', sub: 'The draft was removed. Try again.', persist: true, action: { label: 'Retry' } });
      }, 700);
    }
  };

  return (
    <ModalShell label={mode === 'edit' ? 'Edit lead' : 'Capture lead'} icon="user-plus" onClose={onClose} panelRef={panelRef} width={560}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={submit}>{mode === 'edit' ? 'Save changes' : 'Capture lead'}</Button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ gridColumn: 'span 2' }}><TextField label="Name" required error={errors.name} value={v.name} onChange={(x) => set('name', x)} placeholder="e.g. Avery Stone" ref={firstRef} data-fid="name" /></div>
        <TextField label="Company" value={v.company} onChange={(x) => set('company', x)} placeholder="e.g. Helix Labs" />
        <TextField label="Email" error={errors.email} value={v.email} onChange={(x) => set('email', x)} placeholder="name@company.com" data-fid="email" />
        <TextField label="Phone" value={v.phone} onChange={(x) => set('phone', x)} placeholder="+49 …" />
        <SelectField label="Source" required error={errors.source} value={v.source} onChange={(x) => set('source', x)} options={SOURCES} placeholder="Select a source…" data-fid="source" />
        <div style={{ gridColumn: 'span 2' }}><SelectField label="Owner" required error={errors.owner} value={v.owner} onChange={(x) => set('owner', x)} options={leadOwners()} placeholder="Assign one owner…" data-fid="owner" /></div>
        <div style={{ gridColumn: 'span 2' }}>
          <FieldShell label="BANT note" help="A short qualification judgment — budget, authority, need, timing. Free text, not a score.">
            <textarea value={v.bant} onChange={(e) => set('bant', e.target.value)} rows={3} placeholder="e.g. Budget approved; champion is the VP Ops; needs to go live before Q4."
              style={{ width: '100%', resize: 'vertical', border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius-sm)', padding: '10px 12px',
                font: '400 14px/1.5 var(--iso-font-body)', color: 'var(--iso-fg)', outline: 'none' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--iso-brand)'; e.target.style.boxShadow = 'var(--iso-shadow-focus)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--iso-border)'; e.target.style.boxShadow = 'none'; }} />
          </FieldShell>
        </div>
      </div>
      {mode === 'create' && <div style={{ marginTop: 16 }}><OutcomePicker outcome={outcome} setOutcome={setOutcome} options={[{ value: 'success', label: 'Success' }, { value: 'fail', label: 'Server error' }]} /></div>}
    </ModalShell>
  );
}

/* ============================================================ SCREEN C — Lead detail */
function LeadDetail({ record, role, scope, scopeName, canWrite, state, onState, onBack, onEdit, onConvert }) {
  const st = useStore();
  const lead = useLdM(() => st.leads.find(l => l.id === record?.id) || record, [st, record]);
  const [tab, setTab] = useLd('activity');
  const actor = { tenant_admin: 'Sara Khan', sales_agent: 'Marco Ruiz', viewer: 'Sara Khan' }[role.id] || 'You';

  if (state === 'loading') {
    return (<div style={LEAD_PAD}><Skeleton w={220} h={12} /><div style={{ display: 'flex', justifyContent: 'space-between' }}><Skeleton w={280} h={28} /><Skeleton w={220} h={36} r={6} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}><Card pad><div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{[...Array(5)].map((_, i) => <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}><Skeleton w={90} h={10} /><Skeleton w={i % 2 ? '60%' : '80%'} h={14} /></div>)}</div></Card><Card pad><Skeleton w="100%" h={120} /></Card></div></div>);
  }
  if (state === 'error') return <div style={LEAD_PAD}><PageHeader back={onBack} title="Lead" right={<StateSwitcher state={state} onState={onState} />} /><Card><ErrorState onRetry={() => onState('ready')} /></Card></div>;
  if (state === 'empty' || !lead) return <div style={LEAD_PAD}><PageHeader back={onBack} title="Lead" right={<StateSwitcher state={state} onState={onState} />} /><Card><EmptyState icon="file-question" title="This lead no longer exists" scopeLine={scopeName} body="It may have been deleted or moved out of your scope." action={{ label: 'Back to Leads', icon: 'arrow-left', onClick: onBack }} /></Card></div>;

  const fields = [['Name', lead.name], ['Company', lead.company || '—'], ['Email', lead.email || '—'], ['Phone', lead.phone || '—'], ['Source', SOURCE_LABEL[lead.source] || lead.source], ['Owner', lead.owner]];
  const canConvert = lead.status === 'qualified';

  return (
    <div style={LEAD_PAD}>
      <PageHeader
        breadcrumbs={[{ label: 'Leads', onClick: onBack }, { label: lead.name }]}
        back={onBack}
        title={lead.name}
        statusPill={<Pill entity="lead" status={lead.status} />}
        right={<StateSwitcher state={state} onState={onState} />}
        secondary={canWrite && <Button variant="ghost" leadIcon="pencil" onClick={() => onEdit(lead)}>Edit</Button>}
        primary={canWrite
          ? <div style={{ display: 'flex', gap: 'var(--iso-space-2)' }}>
              <ChangeStatusControl entity="lead" record={lead} actor={actor} />
              {canConvert && <Button variant="primary" leadIcon="git-merge" onClick={() => onConvert(lead)}>Convert</Button>}
            </div>
          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '500 11px/1 var(--iso-font-ui)', color: 'var(--iso-fg-muted)', border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius-full)', padding: '7px 11px' }}><Icon name="eye" size={13} />Read-only</span>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--iso-space-6)', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--iso-space-4)' }}>
          <Card pad>
            <SectionLabel style={{ marginBottom: 16 }}>Lead details</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 32px' }}>
              {fields.map(([k, val], i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ font: '400 11px/1 var(--iso-font-ui)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)' }}>{k}</span>
                  <span style={{ font: '400 14px/1.4 var(--iso-font-body)', color: 'var(--iso-fg)' }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--iso-border-muted)' }}>
              <span style={{ font: '400 11px/1 var(--iso-font-ui)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)' }}>BANT note</span>
              <p style={{ margin: '7px 0 0', font: '400 14px/1.6 var(--iso-font-body)', color: lead.bant ? 'var(--iso-fg)' : 'var(--iso-fg-subtle)', maxWidth: '70ch' }}>{lead.bant || 'No qualification note yet.'}</p>
            </div>
          </Card>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: '1px solid var(--iso-border-muted)' }}>
              <Icon name="history" size={15} style={{ color: 'var(--iso-brand)' }} />
              <span style={{ font: '500 13px/1 var(--iso-font-body)', color: 'var(--iso-fg-strong)' }}>Activity</span>
              <span style={{ marginLeft: 'auto', font: '400 11px/1 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)' }}>Newest first</span>
            </div>
            <div style={{ padding: 'var(--iso-space-6) var(--iso-space-6) var(--iso-space-6)' }}>
              <RecordTimeline events={lead.timeline} emptyTitle="No activity yet" emptyBody="Status changes, edits and notes for this lead will appear here, newest first." />
            </div>
          </Card>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--iso-space-4)' }}>
          <Card pad>
            <SectionLabel style={{ marginBottom: 14 }}>Owner</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--iso-blue-3-400)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: '500 13px/1 var(--iso-font-ui)' }}>{initialsOf(lead.owner)}</span>
              <div><div style={{ font: '500 13px/1.3 var(--iso-font-body)' }}>{lead.owner}</div><div style={{ font: '400 11px/1.3 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)' }}>Single owner</div></div>
            </div>
          </Card>
          <Card pad>
            <SectionLabel style={{ marginBottom: 14 }}>Meta</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[['Scope', scopeName], ['Created', '2 Jun 2026'], ['Last updated', `${lead.updated} 2026`], ['Lead ID', lead.id]].map(([k, val], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, font: '400 12px/1.4 var(--iso-font-ui)' }}>
                  <span style={{ color: 'var(--iso-fg-subtle)' }}>{k}</span><span style={{ color: 'var(--iso-fg)' }}>{val}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LeadForm, LeadDetail, SOURCES, SOURCE_LABEL });
