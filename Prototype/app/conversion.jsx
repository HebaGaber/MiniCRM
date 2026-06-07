/* global React, Icon, Button, StatusPill, Card, SectionLabel, PageHeader, EmptyState, pushToast,
   Store, useStore, STATUS_META, SOURCE_LABEL, initialsOf */
/* min-crm — Conversion saga (E3-S1). A DetailPage VARIANT (not a modal): an inspector that runs the
   ordered conversion steps with per-step state, a field-map, and success / rollback / resume. */
const { useState: useCv, useEffect: useCvE, useRef: useCvR, useMemo: useCvM } = React;

const CV_PAD = { padding: '28px 32px', maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--iso-space-6)' };

const STEPS = [
  { id: 'guard',           title: 'Guard',            desc: 'Assert the lead is qualified and not already converted.', icon: 'shield-check' },
  { id: 'create-customer', title: 'Create customer',  desc: 'Create a new customer in status “prospect” from the field map.', icon: 'building-2' },
  { id: 'link-lineage',    title: 'Link lineage',     desc: 'Link customer ↔ lead in both directions.', icon: 'git-merge' },
  { id: 'lock-lead',       title: 'Lock lead',        desc: 'Move the lead to “converted” — it becomes read-only.', icon: 'lock' },
  { id: 'emit',            title: 'Emit',             desc: 'Finalize and write the linked conversion entry to both timelines.', icon: 'check-circle' },
];

function ConversionInspector({ leadId, role, scope, scopeName, actor, onBack, onOpenCustomer, onOpenLead }) {
  const st = useStore();
  const lead = useCvM(() => st.leads.find(l => l.id === leadId), [st, leadId]);

  // eligibility check (no saga starts if ineligible)
  const elig = useCvM(() => Store.eligibility(leadId), [leadId, lead?.status]);

  // saga runtime driven by EFFECTS (immune to closure staleness / remounts)
  const persisted = Store.getSaga(leadId);
  const [phase, setPhase] = useCv(persisted?.phase || 'running');   // running | rolling-back | failed | done
  const [cursor, setCursor] = useCv(persisted?.cursor ?? 0);        // completed-step count / current index
  const [rollCursor, setRollCursor] = useCv(0);                     // # of still-completed steps during rollback
  const [faultAt, setFaultAt] = useCv('none');                      // 'none' | step id | '409'
  const [result, setResult] = useCv(null);                          // { customer }
  const committedRef = useCvR(false);
  const baseMs = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--crm-base')) || 200;

  // forward driver: advance one step per tick; commit once past the last step
  useCvE(() => {
    if (!elig.ok || phase !== 'running') return;
    if (cursor >= STEPS.length) {
      if (committedRef.current) return;
      committedRef.current = true;
      const r = Store.commitConversion(leadId, actor);
      if (r.ok) { setResult({ customer: r.customer }); setPhase('done'); Store.clearSaga(leadId);
        pushToast({ tone: 'success', title: 'Lead converted.', sub: `Customer “${r.customer.name}” created in prospect.` }); }
      else { setFaultAt('409'); setRollCursor(STEPS.length - 1); setPhase('rolling-back'); }
      return;
    }
    Store.setSaga(leadId, { phase: 'running', cursor });
    const sid = STEPS[cursor].id;
    const t = setTimeout(() => {
      const is409 = faultAt === '409' && sid === 'lock-lead';
      if (is409 || faultAt === sid) { setRollCursor(cursor); setPhase('rolling-back'); }
      else setCursor(cursor + 1);
    }, baseMs() + 60);
    return () => clearTimeout(t);
  }, [phase, cursor, elig.ok, faultAt, leadId, actor]);

  // rollback driver: reverse completed steps top-down, then land on "failed"
  useCvE(() => {
    if (phase !== 'rolling-back') return;
    Store.setSaga(leadId, { phase: 'rolling-back', cursor: rollCursor });
    if (rollCursor <= 0) {
      const t = setTimeout(() => {
        setPhase('failed'); setCursor(0); Store.setSaga(leadId, { phase: 'failed', cursor: 0 });
        if (faultAt === '409') pushToast({ tone: 'danger', title: 'Record changed — conversion stopped.', sub: 'This lead changed while converting. Refresh and try again.', persist: true });
        else pushToast({ tone: 'danger', title: 'Conversion failed — rolled back.', sub: 'No customer was created; the lead is still qualified.', persist: true });
      }, baseMs() + 80);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRollCursor(rollCursor - 1), baseMs() + 80);
    return () => clearTimeout(t);
  }, [phase, rollCursor, faultAt, leadId]);

  const tryAgain = () => { committedRef.current = false; setFaultAt(faultAt); setCursor(0); setResult(null); setPhase('running'); };

  /* ---------- eligibility block (calm, no saga) — but never override a just-finished success ---------- */
  if (!elig.ok && phase !== 'done') {
    return (
      <div style={CV_PAD}>
        <PageHeader breadcrumbs={[{ label: 'Leads', onClick: onBack }, { label: lead?.name || 'Lead', onClick: onOpenLead }, { label: 'Convert' }]} back={onBack} title="Convert lead"
          right={null} />
        <Card>
          <EmptyState icon="shield-alert" title="This lead can’t be converted"
            scopeLine={scopeName}
            body={elig.reason}
            action={lead?.status === 'converted' && lead.convertedTo
              ? { label: 'Open linked customer', icon: 'arrow-up-right', onClick: () => onOpenCustomer(Store.getCustomer(lead.convertedTo)) }
              : { label: 'Back to lead', icon: 'arrow-left', onClick: onOpenLead }} />
        </Card>
      </div>
    );
  }

  const statusByStep = (sid, idx) => {
    if (phase === 'rolling-back') {
      if (idx === rollCursor) return 'reversing';
      if (idx < rollCursor) return 'done';
      return 'pending';
    }
    if (phase === 'done') return 'done';
    if (idx < cursor) return 'done';
    if (phase === 'running' && idx === cursor) return 'current';
    return 'pending';
  };

  const overallPill = phase === 'done'
    ? <StatusPill tone="success" icon="check">Converted</StatusPill>
    : phase === 'failed'
    ? <StatusPill tone="danger" icon="x">Failed</StatusPill>
    : phase === 'rolling-back'
    ? <StatusPill tone="warning" icon="rotate-ccw">Rolling back…</StatusPill>
    : <StatusPill tone="info" icon="loader">Converting…</StatusPill>;

  const fieldMap = [
    ['Name', lead.name], ['Company', lead.company || '—'], ['Email', lead.email || '—'],
    ['Phone', lead.phone || '—'], ['Source', SOURCE_LABEL[lead.source] || lead.source], ['Owner', lead.owner],
    ['BANT note', lead.bant || '—'],
  ];

  return (
    <div style={CV_PAD}>
      <PageHeader
        breadcrumbs={[{ label: 'Leads', onClick: onBack }, { label: lead.name, onClick: onOpenLead }, { label: 'Convert' }]}
        back={onBack}
        title={`Convert ${lead.name}`}
        statusPill={overallPill}
        secondary={phase === 'failed' ? <Button variant="secondary" leadIcon="rotate-ccw" onClick={tryAgain}>Try again</Button> : null}
        primary={phase === 'done' && result ? <Button variant="primary" leadIcon="arrow-up-right" onClick={() => onOpenCustomer(result.customer)}>Open customer</Button> : null}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 'var(--iso-space-6)', alignItems: 'start' }}>
        {/* saga steps */}
        <Card pad>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <SectionLabel>Conversion saga</SectionLabel>
            {phase !== 'done' && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, font: '400 11px/1 var(--iso-font-ui)', color: 'var(--iso-fg-muted)' }}>
                <Icon name="flask-conical" size={13} style={{ color: 'var(--iso-accent)' }} />
                Simulate fault
                <select value={faultAt} onChange={(e) => setFaultAt(e.target.value)} style={{ border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius-sm)', height: 28, padding: '0 6px', font: '500 11px/1 var(--iso-font-ui)', color: 'var(--iso-fg)', cursor: 'pointer' }}>
                  <option value="none">None</option>
                  <option value="create-customer">at create-customer</option>
                  <option value="link-lineage">at link-lineage</option>
                  <option value="409">409 at lock-lead</option>
                </select>
              </label>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {STEPS.map((s, idx) => {
              const stt = statusByStep(s.id, idx);
              const tone = { done: 'success', current: 'info', reversing: 'warning', pending: 'neutral' }[stt];
              const ring = { done: 'var(--iso-success)', current: 'var(--iso-accent)', reversing: 'var(--iso-warning)', pending: 'var(--iso-border-strong)' }[stt];
              const bg = { done: 'var(--iso-success-soft)', current: 'var(--iso-info-soft)', reversing: 'var(--iso-warning-soft)', pending: '#fff' }[stt];
              const fg = { done: 'var(--iso-success)', current: 'var(--iso-accent)', reversing: 'var(--iso-warning)', pending: 'var(--iso-fg-subtle)' }[stt];
              return (
                <div key={s.id} style={{ display: 'flex', gap: 14, paddingBottom: idx === STEPS.length - 1 ? 0 : 18, position: 'relative' }}>
                  {idx !== STEPS.length - 1 && <span style={{ position: 'absolute', left: 16, top: 34, bottom: 0, width: 2, background: (stt === 'done') ? 'var(--iso-success)' : 'var(--iso-border)', transition: 'background-color var(--crm-base) var(--crm-ease-standard)' }} />}
                  <span style={{ width: 33, height: 33, flex: 'none', borderRadius: '50%', background: bg, border: `2px solid ${ring}`, color: fg,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
                    transition: 'background-color var(--crm-base) var(--crm-ease-standard), border-color var(--crm-base) var(--crm-ease-standard), color var(--crm-base) var(--crm-ease-standard)' }}>
                    {stt === 'current' ? <Icon name="loader" size={16} className="crm-spin" /> : stt === 'reversing' ? <Icon name="rotate-ccw" size={15} /> : stt === 'done' ? <Icon name="check" size={16} strokeWidth={2.4} /> : <Icon name={s.icon} size={15} />}
                  </span>
                  <div style={{ paddingTop: 3, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ font: '500 14px/1.2 var(--iso-font-body)', color: stt === 'pending' ? 'var(--iso-fg-muted)' : 'var(--iso-fg-strong)' }}>{idx + 1}. {s.title}</span>
                      {stt === 'done' && <StatusPill tone="success" size="sm">Done</StatusPill>}
                      {stt === 'current' && <StatusPill tone="info" size="sm">Running</StatusPill>}
                      {stt === 'reversing' && <StatusPill tone="warning" size="sm">Reversing</StatusPill>}
                    </div>
                    <div style={{ font: '400 12.5px/1.5 var(--iso-font-body)', color: 'var(--iso-fg-muted)', marginTop: 3 }}>{s.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {phase === 'failed' && (
            <div style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 'var(--iso-radius-md)', background: 'var(--iso-danger-soft)', border: '1px solid var(--iso-red-300)' }}>
              <Icon name="alert-triangle" size={16} strokeWidth={2} style={{ color: 'var(--iso-danger)', marginTop: 1, flex: 'none' }} />
              <span style={{ font: '400 13px/1.5 var(--iso-font-body)', color: 'var(--iso-red-700)' }}>Conversion failed and fully rolled back. No customer was created and <b style={{ fontWeight: 600 }}>{lead.name}</b> is still qualified. Use <b style={{ fontWeight: 600 }}>Try again</b> to retry.</span>
            </div>
          )}
          {phase === 'done' && result && (
            <div style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 'var(--iso-radius-md)', background: 'var(--iso-success-soft)', border: '1px solid var(--iso-green-300)' }}>
              <Icon name="check-circle" size={16} strokeWidth={2} style={{ color: 'var(--iso-success)', marginTop: 1, flex: 'none' }} />
              <span style={{ font: '400 13px/1.5 var(--iso-font-body)', color: 'var(--iso-green-800)' }}>Customer <b style={{ fontWeight: 600 }}>{result.customer.name}</b> created in prospect. The lead is now converted and read-only. A single linked conversion entry was written to both timelines.</span>
            </div>
          )}
        </Card>

        {/* field map */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--iso-space-4)' }}>
          <Card pad>
            <SectionLabel style={{ marginBottom: 4 }}>Field map</SectionLabel>
            <div style={{ font: '400 11px/1.4 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)', marginBottom: 14 }}>Lead <Icon name="arrow-right" size={11} style={{ verticalAlign: '-1px' }} /> customer</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {fieldMap.map(([k, val], i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ font: '400 10px/1 var(--iso-font-ui)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)' }}>{k}</span>
                  <span style={{ font: '400 13px/1.4 var(--iso-font-body)', color: 'var(--iso-fg)' }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--iso-border-muted)', display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <Icon name="link" size={14} style={{ color: 'var(--iso-accent)', marginTop: 1, flex: 'none' }} />
              <span style={{ font: '400 12px/1.5 var(--iso-font-ui)', color: 'var(--iso-fg-muted)' }}>Activity history is <b style={{ fontWeight: 600, color: 'var(--iso-fg)' }}>linked</b>, not copied — the lead’s timeline stays its own and the customer references it.</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

window.ConversionInspector = ConversionInspector;
