/* global React, Icon, Button, StatusPill, Skeleton, EmptyState, ErrorState, Card, SectionLabel,
   PageHeader, StateSwitcher, ModalShell, OutcomePicker, TextField, SelectField, pushToast,
   Store, useStore, STATUS_META, PRIORITY_META, leadOwners, initialsOf, Pill,
   ChangeStatusControl, RecordTimeline */
/* min-crm — Customers module (E3-S2 onboarding state machine, E3-S3 detail w/ lineage + interleaved
   timeline + Related tickets tab). The list itself is the shared store-backed ListPage. */
const { useState: useCu, useEffect: useCuE, useRef: useCuR, useMemo: useCuM } = React;

const CU_PAD = { padding: '28px 32px', maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--iso-space-6)' };

/* ---------------- Create / edit form ---------------- */
function CustomerForm({ mode = 'create', customer, scope, actor, onClose, onCreated }) {
  const init = customer || {};
  const [v, setV] = useCu({ name: init.name || '', primaryEmail: init.primaryEmail || '', phone: init.phone || '', owner: init.owner || '', taxId: init.taxId || '', contactAddress: init.contactAddress || '' });
  const [errors, setErrors] = useCu({});
  const [outcome, setOutcome] = useCu('success');
  const panelRef = useCuR(null), firstRef = useCuR(null);

  useCuE(() => {
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

  const set = (k, val) => { setV(p => ({ ...p, [k]: val })); if (errors[k]) setErrors(e => ({ ...e, [k]: null })); };
  const valid = v.name.trim() && v.primaryEmail.trim() && /.+@.+\..+/.test(v.primaryEmail) && v.owner;
  const submit = () => {
    const e = {};
    if (!v.name.trim()) e.name = 'This field is required';
    if (!v.primaryEmail.trim()) e.primaryEmail = 'This field is required';
    else if (!/.+@.+\..+/.test(v.primaryEmail)) e.primaryEmail = 'Enter a valid email address';
    if (!v.owner) e.owner = 'Assign an owner';
    if (Object.keys(e).length) { setErrors(e); const f = ['name', 'primaryEmail', 'owner'].find(k => e[k]); setTimeout(() => panelRef.current?.querySelector(`[data-fid="${f}"]`)?.focus(), 0); return; }
    if (mode === 'edit') { Store.editCustomer(customer.id, v, actor); onClose(); pushToast({ tone: 'success', title: 'Customer updated.' }); return; }
    const created = Store.createCustomer(v, scope, actor);
    if (outcome === 'success') { onClose(); pushToast({ tone: 'success', title: 'Customer created.', sub: `${created.name} created in status “prospect”.` }); onCreated?.(created); }
    else { onClose(); setTimeout(() => { Store.removeCustomer(created.id); pushToast({ tone: 'danger', title: 'Couldn’t create customer — rolled back.', sub: 'The draft was removed. Try again.', persist: true, action: { label: 'Retry' } }); }, 700); }
  };

  return (
    <ModalShell label={mode === 'edit' ? 'Edit customer' : 'New customer'} icon="building-2" onClose={onClose} panelRef={panelRef} width={520}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={submit}>{mode === 'edit' ? 'Save changes' : 'Create customer'}</Button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ gridColumn: 'span 2' }}><TextField label="Name" required error={errors.name} value={v.name} onChange={(x) => set('name', x)} placeholder="e.g. Helix Labs" ref={firstRef} data-fid="name" /></div>
        <TextField label="Primary email" required error={errors.primaryEmail} value={v.primaryEmail} onChange={(x) => set('primaryEmail', x)} placeholder="ops@company.com" data-fid="primaryEmail" />
        <TextField label="Phone" value={v.phone} onChange={(x) => set('phone', x)} placeholder="+1 …" />
        <div style={{ gridColumn: 'span 2' }}><SelectField label="Owner" required error={errors.owner} value={v.owner} onChange={(x) => set('owner', x)} options={leadOwners()} placeholder="Assign one owner…" data-fid="owner" /></div>
        <TextField label="Tax registration number" value={v.taxId} onChange={(x) => set('taxId', x)} placeholder="e.g. VAT-DE-123456" />
        <TextField label="Contact address" value={v.contactAddress} onChange={(x) => set('contactAddress', x)} placeholder="Street, city" />
        <div style={{ gridColumn: 'span 2', display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 'var(--iso-radius-sm)', background: 'var(--iso-blue-3-50)', border: '1px solid var(--iso-border-muted)' }}>
          <Icon name="info" size={14} style={{ color: 'var(--iso-accent)', marginTop: 1, flex: 'none' }} />
          <span style={{ font: '400 12px/1.5 var(--iso-font-ui)', color: 'var(--iso-fg-muted)' }}>Tax registration number and contact address are optional for a prospect, but both are required to activate the customer.</span>
        </div>
      </div>
      {mode === 'create' && <div style={{ marginTop: 16 }}><OutcomePicker outcome={outcome} setOutcome={setOutcome} options={[{ value: 'success', label: 'Success' }, { value: 'fail', label: 'Server error' }]} /></div>}
    </ModalShell>
  );
}

/* ---------------- Detail ---------------- */
function CustomerDetail({ record, role, scope, scopeName, canWrite, state, onState, onBack, onEdit, onOpenLead, onOpenTicket, canCreateTicket, onNewTicket }) {
  const st = useStore();
  const customer = useCuM(() => st.customers.find(c => c.id === record?.id) || record, [st, record]);
  const tickets = useCuM(() => customer ? Store.ticketsForCustomer(customer.name) : [], [st, customer]);
  const [tab, setTab] = useCu('activity');
  const actor = { tenant_admin: 'Sara Khan', sales_agent: 'Marco Ruiz', viewer: 'Sara Khan' }[role.id] || 'You';

  if (state === 'loading') {
    return (<div style={CU_PAD}><Skeleton w={220} h={12} /><div style={{ display: 'flex', justifyContent: 'space-between' }}><Skeleton w={280} h={28} /><Skeleton w={200} h={36} r={6} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}><Card pad><Skeleton w="100%" h={120} /></Card><Card pad><Skeleton w="100%" h={90} /></Card></div></div>);
  }
  if (state === 'error') return <div style={CU_PAD}><PageHeader back={onBack} title="Customer" right={<StateSwitcher state={state} onState={onState} />} /><Card><ErrorState onRetry={() => onState('ready')} /></Card></div>;
  if (state === 'empty' || !customer) return <div style={CU_PAD}><PageHeader back={onBack} title="Customer" right={<StateSwitcher state={state} onState={onState} />} /><Card><EmptyState icon="file-question" title="This customer no longer exists" scopeLine={scopeName} body="It may have been deleted or moved out of your scope." action={{ label: 'Back to Customers', icon: 'arrow-left', onClick: onBack }} /></Card></div>;

  const fields = [['Name', customer.name], ['Primary email', customer.primaryEmail || '—'], ['Phone', customer.phone || '—'], ['Tax registration number', customer.taxId || '—'], ['Contact address', customer.contactAddress || '—']];
  const lineageLead = customer.originatingLead;

  return (
    <div style={CU_PAD}>
      <PageHeader
        breadcrumbs={[{ label: 'Customers', onClick: onBack }, { label: customer.name }]}
        back={onBack}
        title={customer.name}
        statusPill={<Pill entity="customer" status={customer.status} />}
        right={<StateSwitcher state={state} onState={onState} />}
        secondary={canWrite && <Button variant="ghost" leadIcon="pencil" onClick={() => onEdit(customer)}>Edit</Button>}
        primary={canWrite
          ? <ChangeStatusControl entity="customer" record={customer} actor={actor} />
          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '500 11px/1 var(--iso-font-ui)', color: 'var(--iso-fg-muted)', border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius-full)', padding: '7px 11px' }}><Icon name="eye" size={13} />Read-only</span>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--iso-space-6)', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--iso-space-4)' }}>
          <Card pad>
            <SectionLabel style={{ marginBottom: 16 }}>Customer details</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 32px' }}>
              {fields.map(([k, val], i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ font: '400 11px/1 var(--iso-font-ui)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)' }}>{k}</span>
                  <span style={{ font: '400 14px/1.4 var(--iso-font-body)', color: 'var(--iso-fg)' }}>{val}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div style={{ display: 'flex', gap: 4, padding: '8px 12px 0', borderBottom: '1px solid var(--iso-border-muted)' }}>
              {[['activity', 'Activity', 'history'], ['tickets', `Tickets`, 'life-buoy']].map(([id, label, icon]) => (
                <button key={id} onClick={() => setTab(id)} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 12px', border: 0, background: 'transparent', cursor: 'pointer',
                  font: `${tab === id ? 500 : 400} 13px/1 var(--iso-font-body)`, color: tab === id ? 'var(--iso-brand)' : 'var(--iso-fg-muted)' }}>
                  <Icon name={icon} size={14} />{label}{id === 'tickets' && tickets.length > 0 && <span style={{ font: '500 10px/1 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)', background: 'var(--iso-n-100)', borderRadius: 'var(--iso-radius-full)', padding: '2px 6px' }}>{tickets.length}</span>}
                  {tab === id && <span style={{ position: 'absolute', left: 12, right: 12, bottom: -1, height: 2, background: 'var(--iso-brand)', borderRadius: 2 }} />}
                </button>
              ))}
            </div>
            <div style={{ padding: 'var(--iso-space-6)' }}>
              {tab === 'activity'
                ? <RecordTimeline events={customer.timeline} emptyTitle="No activity yet" emptyBody="Conversion lineage, status changes and ticket lifecycle for this customer appear here, newest first." />
                : <div>
                    {canCreateTicket && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: tickets.length ? 12 : 0 }}>
                        <Button variant="secondary" size="sm" leadIcon="plus" onClick={() => onNewTicket?.(customer.name)}>New ticket for this customer</Button>
                      </div>
                    )}
                    {tickets.length === 0
                      ? <EmptyState compact icon="life-buoy" title="No tickets yet" body="Open a ticket for this customer to start. Tickets link back to this account automatically." action={canCreateTicket ? { label: 'New ticket', icon: 'plus', onClick: () => onNewTicket?.(customer.name) } : undefined} />
                      : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {tickets.map(t => {
                      const m = STATUS_META.ticket[t.status], p = PRIORITY_META[t.priority];
                      return (
                        <button key={t.id} onClick={() => onOpenTicket?.(t)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid var(--iso-border-muted)', borderRadius: 'var(--iso-radius-md)', background: '#fff', cursor: onOpenTicket ? 'pointer' : 'default', textAlign: 'left', width: '100%' }}>
                          <span style={{ width: 30, height: 30, flex: 'none', borderRadius: 'var(--iso-radius-xs)', background: 'var(--iso-blue-3-100)', color: 'var(--iso-brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="life-buoy" size={15} /></span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', font: '500 13px/1.3 var(--iso-font-body)', color: 'var(--iso-fg)' }}>{t.subject}</span>
                            <span style={{ display: 'block', font: '400 11px/1.3 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)' }}>{t.assignee}</span>
                          </span>
                          <StatusPill tone={p.tone} size="sm">{p.label}</StatusPill>
                          <StatusPill tone={m.tone} size="sm">{m.label}</StatusPill>
                        </button>
                      );
                    })}
                  </div>}
                  </div>}
            </div>
          </Card>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--iso-space-4)' }}>
          {/* lineage */}
          <Card pad>
            <SectionLabel style={{ marginBottom: 14 }}>Lineage</SectionLabel>
            {lineageLead ? (
              <button onClick={() => onOpenLead?.(customer)} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '11px 12px', border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius-md)', background: 'var(--iso-success-soft)', cursor: onOpenLead ? 'pointer' : 'default', textAlign: 'left' }}>
                <span style={{ width: 32, height: 32, flex: 'none', borderRadius: 'var(--iso-radius-xs)', background: '#fff', color: 'var(--iso-success)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--iso-green-300)' }}><Icon name="git-merge" size={16} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', font: '400 11px/1.3 var(--iso-font-ui)', color: 'var(--iso-green-800)' }}>Converted from lead</span>
                  <span style={{ display: 'block', font: '500 13px/1.3 var(--iso-font-body)', color: 'var(--iso-fg-strong)' }}>{lineageLead}</span>
                </span>
                <Icon name="arrow-up-right" size={15} style={{ color: 'var(--iso-fg-subtle)' }} />
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, font: '400 12px/1.5 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)' }}>
                <Icon name="minus-circle" size={14} />No originating lead — created directly.
              </div>
            )}
          </Card>
          <Card pad>
            <SectionLabel style={{ marginBottom: 14 }}>Owner</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--iso-blue-3-400)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: '500 13px/1 var(--iso-font-ui)' }}>{initialsOf(customer.owner)}</span>
              <div><div style={{ font: '500 13px/1.3 var(--iso-font-body)' }}>{customer.owner}</div><div style={{ font: '400 11px/1.3 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)' }}>Account owner</div></div>
            </div>
          </Card>
          <Card pad>
            <SectionLabel style={{ marginBottom: 14 }}>Meta</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[['Scope', scopeName], ['Created', '2 Jun 2026'], ['Last updated', `${customer.updated} 2026`], ['Customer ID', customer.id]].map(([k, val], i) => (
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

Object.assign(window, { CustomerForm, CustomerDetail });
