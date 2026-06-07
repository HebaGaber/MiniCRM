/* global React, Icon, Button, StatusPill, Skeleton, EmptyState, ErrorState, Card, SectionLabel,
   PageHeader, StateSwitcher, ModalShell, OutcomePicker, TextField, SelectField, FieldShell, pushToast,
   Store, useStore, STATUS_META, PRIORITY_META, recordsFor, supportUsersInScope, initialsOf, Pill,
   ChangeStatusControl, RecordTimeline */
/* min-crm — Ticketing (E4-S1 create w/ customer-state gate, E4-S2/S3 queue + detail + lifecycle + assign). */
const { useState: useTk, useEffect: useTkE, useRef: useTkR, useMemo: useTkM } = React;

const TK_PAD = { padding: '28px 32px', maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--iso-space-6)' };
const PRIORITIES = [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }];

/* ============================================================ SCREEN A — Create ticket (customer-state gate) */
function TicketForm({ scope, actor, presetCustomer, onClose, onCreated }) {
  const st = useStore();
  const customers = useTkM(() => recordsFor(st, 'customer', scope), [st, scope]);
  const [v, setV] = useTk({ customer: presetCustomer || '', subject: '', description: '', priority: '' });
  const [errors, setErrors] = useTk({});
  const [outcome, setOutcome] = useTk('success');
  const panelRef = useTkR(null), firstRef = useTkR(null);

  useTkE(() => {
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
  const gate = v.customer ? Store.canOpenTicketFor(v.customer) : null;   // customer-state gate
  const gateBlocked = gate && !gate.ok;
  const valid = v.customer && v.subject.trim() && v.priority && !gateBlocked;

  const submit = () => {
    const e = {};
    if (!v.customer) e.customer = 'Choose a customer';
    if (!v.subject.trim()) e.subject = 'This field is required';
    if (!v.priority) e.priority = 'Choose a priority';
    if (Object.keys(e).length) { setErrors(e); const f = ['customer', 'subject', 'priority'].find(k => e[k]); setTimeout(() => panelRef.current?.querySelector(`[data-fid="${f}"]`)?.focus(), 0); return; }
    if (gateBlocked) return; // gate handled inline, no save
    const r = Store.createTicket(v, actor);
    if (!r.ok) { return; } // gate (defensive)
    if (outcome === 'success') { onClose(); pushToast({ tone: 'success', title: 'Ticket created.', sub: `“${r.ticket.subject}” opened for ${r.ticket.customer}.` }); onCreated?.(r.ticket); }
    else { onClose(); setTimeout(() => { Store.removeTicket(r.ticket.id); pushToast({ tone: 'danger', title: 'Couldn’t create ticket — rolled back.', sub: 'The draft was removed. Try again.', persist: true, action: { label: 'Retry' } }); }, 700); }
  };

  const custOptions = customers.map(c => ({ value: c.name, label: `${c.name} · ${STATUS_META.customer[c.status].label}` }));

  return (
    <ModalShell label="Create ticket" icon="life-buoy" onClose={onClose} panelRef={panelRef} width={560}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={submit}>Create ticket</Button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ gridColumn: 'span 2' }}>
          <SelectField label="Customer" required error={errors.customer} value={v.customer} onChange={(x) => set('customer', x)} options={custOptions} placeholder="Select a customer in scope…" ref={firstRef} data-fid="customer" />
        </div>
        {gateBlocked && (
          <div style={{ gridColumn: 'span 2', display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: -4, padding: '11px 13px', borderRadius: 'var(--iso-radius-sm)', background: 'var(--iso-warning-soft)', border: '1px solid var(--iso-yellow-300)' }}>
            <Icon name="info" size={15} strokeWidth={2} style={{ color: 'var(--iso-yellow-700)', marginTop: 1, flex: 'none' }} />
            <span style={{ font: '400 12.5px/1.5 var(--iso-font-ui)', color: 'var(--iso-yellow-800)' }}>{gate.reason}</span>
          </div>
        )}
        <div style={{ gridColumn: 'span 2' }}><TextField label="Subject" required error={errors.subject} value={v.subject} onChange={(x) => set('subject', x)} placeholder="Short summary of the issue" data-fid="subject" /></div>
        <div style={{ gridColumn: 'span 2' }}>
          <FieldShell label="Description" help="What happened, and how to reproduce it.">
            <textarea value={v.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="Steps, expected vs actual…"
              style={{ width: '100%', resize: 'vertical', border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius-sm)', padding: '10px 12px', font: '400 14px/1.5 var(--iso-font-body)', color: 'var(--iso-fg)', outline: 'none' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--iso-brand)'; e.target.style.boxShadow = 'var(--iso-shadow-focus)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--iso-border)'; e.target.style.boxShadow = 'none'; }} />
          </FieldShell>
        </div>
        <SelectField label="Priority" required error={errors.priority} value={v.priority} onChange={(x) => set('priority', x)} options={PRIORITIES} placeholder="Select…" data-fid="priority" />
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 'var(--iso-radius-sm)', background: 'var(--iso-blue-3-50)', border: '1px solid var(--iso-border-muted)' }}>
        <Icon name="info" size={14} style={{ color: 'var(--iso-accent)', marginTop: 1, flex: 'none' }} />
        <span style={{ font: '400 12px/1.5 var(--iso-font-ui)', color: 'var(--iso-fg-muted)' }}>New tickets open in status “open” and inherit the customer’s subsidiary. The assignee defaults to that subsidiary’s support agent — reassign from the ticket.</span>
      </div>
      <div style={{ marginTop: 16 }}><OutcomePicker outcome={outcome} setOutcome={setOutcome} options={[{ value: 'success', label: 'Success' }, { value: 'fail', label: 'Server error' }]} /></div>
    </ModalShell>
  );
}

/* ============================================================ Assign control (single assignee) */
function AssignControl({ ticket, actor, scope, disabled }) {
  const [open, setOpen] = useTk(false);
  const ref = useTkR(null);
  useTkE(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const users = supportUsersInScope(ticket.subsidiaryId === 'parent' ? 'tenant' : ticket.subsidiaryId);
  const choose = (u) => { Store.assignTicket(ticket.id, u, actor); setOpen(false); pushToast({ tone: 'success', title: 'Ticket reassigned.', sub: `${u} was notified.` }); };
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <Button variant="secondary" leadIcon="user-check" trailIcon="chevron-down" disabled={disabled} onClick={() => setOpen(o => !o)}>Assign</Button>
      {open && (
        <div style={{ position: 'absolute', top: 44, right: 0, width: 260, background: '#fff', border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius-md)', boxShadow: 'var(--iso-shadow-lg)', padding: 8, zIndex: 'var(--iso-z-dropdown)', animation: 'crm-pop var(--crm-base) var(--crm-ease-decelerate)' }}>
          <div style={{ font: '500 10px/1 var(--iso-font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)', padding: '6px 8px 8px' }}>Assign to (single)</div>
          {users.map(u => {
            const active = u === ticket.assignee;
            return (
              <button key={u} onClick={() => choose(u)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 8px', border: 0, borderRadius: 'var(--iso-radius-sm)', background: active ? 'var(--iso-brand-soft)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--iso-n-100)'; }} onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', flex: 'none', background: 'var(--iso-green-400)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: '500 10px/1 var(--iso-font-ui)' }}>{initialsOf(u)}</span>
                <span style={{ flex: 1, font: '400 13px/1.3 var(--iso-font-body)', color: 'var(--iso-fg)' }}>{u}</span>
                {active && <Icon name="check" size={15} style={{ color: 'var(--iso-brand)' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================ SCREEN C — Ticket detail */
function TicketDetail({ record, role, scope, scopeName, canWrite, state, onState, onBack, onEdit, onOpenCustomer }) {
  const st = useStore();
  const ticket = useTkM(() => st.tickets.find(t => t.id === record?.id) || record, [st, record]);
  const actor = { tenant_admin: 'Sara Khan', support_agent: 'Lena Bauer', sales_agent: 'Marco Ruiz', viewer: 'Ivo Petrov' }[role.id] || 'You';

  if (state === 'loading') return <div style={TK_PAD}><Skeleton w={220} h={12} /><div style={{ display: 'flex', justifyContent: 'space-between' }}><Skeleton w={280} h={28} /><Skeleton w={220} h={36} r={6} /></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}><Card pad><Skeleton w="100%" h={120} /></Card><Card pad><Skeleton w="100%" h={90} /></Card></div></div>;
  if (state === 'error') return <div style={TK_PAD}><PageHeader back={onBack} title="Ticket" right={<StateSwitcher state={state} onState={onState} />} /><Card><ErrorState onRetry={() => onState('ready')} /></Card></div>;
  if (state === 'empty' || !ticket) return <div style={TK_PAD}><PageHeader back={onBack} title="Ticket" right={<StateSwitcher state={state} onState={onState} />} /><Card><EmptyState icon="file-question" title="This ticket no longer exists" scopeLine={scopeName} body="It may have been deleted or moved out of your scope." action={{ label: 'Back to Tickets', icon: 'arrow-left', onClick: onBack }} /></Card></div>;

  const pm = PRIORITY_META[ticket.priority];
  const fields = [['Subject', ticket.subject], ['Customer', ticket.customer], ['Priority', pm.label], ['Status', STATUS_META.ticket[ticket.status].label], ['Channel', 'Email']];

  return (
    <div style={TK_PAD}>
      <PageHeader
        breadcrumbs={[{ label: 'Tickets', onClick: onBack }, { label: ticket.subject }]}
        back={onBack}
        title={ticket.subject}
        statusPill={<span style={{ display: 'inline-flex', gap: 8 }}><Pill entity="ticket" status={ticket.status} /><StatusPill tone={pm.tone} size="sm">{pm.label}</StatusPill></span>}
        right={<StateSwitcher state={state} onState={onState} />}
        secondary={canWrite ? <AssignControl ticket={ticket} actor={actor} scope={scope} /> : null}
        primary={canWrite
          ? <ChangeStatusControl entity="ticket" record={ticket} actor={actor} />
          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '500 11px/1 var(--iso-font-ui)', color: 'var(--iso-fg-muted)', border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius-full)', padding: '7px 11px' }}><Icon name="eye" size={13} />Read-only</span>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--iso-space-6)', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--iso-space-4)' }}>
          <Card pad>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <SectionLabel>Ticket details</SectionLabel>
              {ticket.status === 'pending' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '500 10px/1 var(--iso-font-ui)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--iso-yellow-800)', background: 'var(--iso-warning-soft)', border: '1px solid var(--iso-yellow-300)', borderRadius: 'var(--iso-radius-xs)', padding: '4px 8px' }}><Icon name="pause" size={11} />SLA paused</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 32px' }}>
              {fields.map(([k, val], i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ font: '400 11px/1 var(--iso-font-ui)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)' }}>{k}</span>
                  <span style={{ font: '400 14px/1.4 var(--iso-font-body)', color: 'var(--iso-fg)' }}>{val}</span>
                </div>
              ))}
            </div>
            {ticket.description && (
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--iso-border-muted)' }}>
                <span style={{ font: '400 11px/1 var(--iso-font-ui)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)' }}>Description</span>
                <p style={{ margin: '7px 0 0', font: '400 14px/1.6 var(--iso-font-body)', color: 'var(--iso-fg)', maxWidth: '70ch' }}>{ticket.description}</p>
              </div>
            )}
          </Card>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: '1px solid var(--iso-border-muted)' }}>
              <Icon name="history" size={15} style={{ color: 'var(--iso-brand)' }} />
              <span style={{ font: '500 13px/1 var(--iso-font-body)', color: 'var(--iso-fg-strong)' }}>Activity</span>
              <span style={{ marginLeft: 'auto', font: '400 11px/1 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)' }}>Newest first</span>
            </div>
            <div style={{ padding: 'var(--iso-space-6)' }}>
              <RecordTimeline events={ticket.timeline} emptyTitle="No activity yet" emptyBody="Created, status changes and assignments for this ticket appear here, newest first." />
            </div>
          </Card>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--iso-space-4)' }}>
          <Card pad>
            <SectionLabel style={{ marginBottom: 14 }}>Assignee</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--iso-green-400)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: '500 13px/1 var(--iso-font-ui)' }}>{initialsOf(ticket.assignee)}</span>
              <div><div style={{ font: '500 13px/1.3 var(--iso-font-body)' }}>{ticket.assignee}</div><div style={{ font: '400 11px/1.3 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)' }}>Single assignee</div></div>
            </div>
          </Card>
          <Card pad>
            <SectionLabel style={{ marginBottom: 14 }}>Customer</SectionLabel>
            <button onClick={() => onOpenCustomer?.(ticket.customer)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius-md)', background: '#fff', cursor: onOpenCustomer ? 'pointer' : 'default', textAlign: 'left' }}>
              <span style={{ width: 30, height: 30, flex: 'none', borderRadius: 'var(--iso-radius-xs)', background: 'var(--iso-brand-soft)', color: 'var(--iso-brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="building-2" size={15} /></span>
              <span style={{ flex: 1, font: '500 13px/1.3 var(--iso-font-body)', color: 'var(--iso-fg)' }}>{ticket.customer}</span>
              <Icon name="arrow-up-right" size={15} style={{ color: 'var(--iso-fg-subtle)' }} />
            </button>
          </Card>
          <Card pad>
            <SectionLabel style={{ marginBottom: 14 }}>Meta</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[['Scope', scopeName], ['Created', '2 Jun 2026'], ['Last updated', `${ticket.updated} 2026`], ['Ticket ID', ticket.id]].map(([k, val], i) => (
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

Object.assign(window, { TicketForm, TicketDetail, AssignControl, PRIORITIES });
