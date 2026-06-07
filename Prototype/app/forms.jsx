/* global React, Icon, Button, TextField, SelectField, DateField, StatusPill, pushToast, ENTITY */
/* min-crm — EntityForm (modal). Controlled fields · inline validation · submit disabled until valid ·
   optimistic save with rollback. Outcome selector demos the success / 409 / 422 mutation laws. */
const { useState: useF, useEffect: useFE, useRef: useFR } = React;

const FORM_FIELDS = {
  leads:     { title: 'New lead',     icon: 'user-plus',  fields: [
    { id: 'name', label: 'Full name', kind: 'text', required: true, placeholder: 'e.g. Avery Stone' },
    { id: 'company', label: 'Company', kind: 'text', required: true, placeholder: 'e.g. Helix Labs' },
    { id: 'email', label: 'Email', kind: 'text', required: true, placeholder: 'name@company.com', validate: (v) => /.+@.+\..+/.test(v) ? null : 'Enter a valid email address' },
    { id: 'stage', label: 'Stage', kind: 'select', required: true, options: ['New', 'Qualified', 'At risk', 'Won', 'Lost'] },
    { id: 'owner', label: 'Owner', kind: 'select', options: ['Unassigned', 'Marco Ruiz', 'Sara Khan'] },
    { id: 'close', label: 'Expected close', kind: 'date' },
  ] },
  customers: { title: 'New customer', icon: 'building-2', fields: [
    { id: 'name', label: 'Account name', kind: 'text', required: true, placeholder: 'e.g. Helix Labs' },
    { id: 'tier', label: 'Tier', kind: 'select', required: true, options: ['Mid-market', 'Growth', 'Enterprise'] },
    { id: 'contact', label: 'Primary contact', kind: 'text', placeholder: 'e.g. Jordan Vale' },
    { id: 'email', label: 'Contact email', kind: 'text', required: true, placeholder: 'name@company.com', validate: (v) => /.+@.+\..+/.test(v) ? null : 'Enter a valid email address' },
    { id: 'renewal', label: 'Renewal date', kind: 'date' },
  ] },
  tickets:   { title: 'New ticket',   icon: 'life-buoy',  fields: [
    { id: 'subject', label: 'Subject', kind: 'text', required: true, placeholder: 'Short summary of the issue' },
    { id: 'account', label: 'Account', kind: 'select', required: true, options: ['Helix Labs', 'Orbital Freight', 'Brightwell', 'Marlow & Co'] },
    { id: 'priority', label: 'Priority', kind: 'select', required: true, options: ['Low', 'Normal', 'High', 'Urgent'] },
    { id: 'assignee', label: 'Assignee', kind: 'select', options: ['Unassigned', 'Lena Bauer'] },
  ] },
};

const OUTCOMES = [
  { value: 'success', label: 'Success' },
  { value: '409', label: '409 — record changed' },
  { value: '422', label: '422 — validation error' },
];

function EntityForm({ navId, onClose }) {
  const cfg = FORM_FIELDS[navId] || FORM_FIELDS.customers;
  const [values, setValues] = useF({});
  const [errors, setErrors] = useF({});
  const [outcome, setOutcome] = useF('success');
  const [saving, setSaving] = useF(false);
  const panelRef = useFR(null);
  const firstFieldRef = useFR(null);

  // focus first field on open; Esc closes; focus trap
  useFE(() => {
    const t = setTimeout(() => firstFieldRef.current?.focus(), 30);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab') {
        const f = panelRef.current?.querySelectorAll('input, select, button, [tabindex]');
        if (!f || !f.length) return;
        const list = [...f].filter(el => !el.disabled);
        const first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); };
  }, []);

  const set = (id, v) => { setValues(prev => ({ ...prev, [id]: v })); if (errors[id]) setErrors(prev => ({ ...prev, [id]: null })); };

  const validate = () => {
    const errs = {};
    cfg.fields.forEach(f => {
      const v = values[f.id];
      if (f.required && (!v || !String(v).trim())) errs[f.id] = 'This field is required';
      else if (f.validate && v) { const m = f.validate(v); if (m) errs[f.id] = m; }
    });
    return errs;
  };
  const isValid = cfg.fields.filter(f => f.required).every(f => values[f.id] && String(values[f.id]).trim()) &&
    cfg.fields.every(f => !(f.validate && values[f.id]) || !f.validate(values[f.id]));

  const focusFirstError = (errs) => {
    const firstId = cfg.fields.find(f => errs[f.id])?.id;
    if (firstId) setTimeout(() => panelRef.current?.querySelector(`[data-fid="${firstId}"]`)?.focus(), 0);
  };

  const submit = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); focusFirstError(errs); return; }

    if (outcome === '422') {
      // 422: rollback + inline field errors; StatusPill never changes; NO toast.
      const serverErrs = { [cfg.fields[0].id]: 'A record with this value already exists' };
      setErrors(serverErrs);
      focusFirstError(serverErrs);
      return;
    }

    // optimistic apply — commit & close at instant
    setSaving(true);
    onClose();
    if (outcome === 'success') {
      pushToast({ tone: 'success', title: `${cfg.title.replace('New ', '').replace(/^./, c => c.toUpperCase())} created.` });
    } else if (outcome === '409') {
      // generic rollback toast variant — persists, dismissible
      pushToast({ tone: 'danger', title: 'Couldn’t save — rolled back.', sub: 'Record changed, refresh and try again.', persist: true, action: { label: 'Refresh' } });
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={cfg.title}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 'var(--iso-z-modal)', background: 'rgba(15,22,38,0.42)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 24px', overflow: 'auto',
        animation: 'crm-fade var(--crm-base) var(--crm-ease-decelerate)' }}>
      <div ref={panelRef} style={{ width: 520, maxWidth: '100%', background: '#fff', borderRadius: 'var(--iso-radius-lg)', boxShadow: 'var(--iso-shadow-modal)',
        animation: 'crm-pop var(--crm-base) var(--crm-ease-decelerate)' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 22px', borderBottom: '1px solid var(--iso-border-muted)' }}>
          <span style={{ width: 36, height: 36, borderRadius: 'var(--iso-radius-sm)', background: 'var(--iso-brand-soft)', color: 'var(--iso-brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={cfg.icon} size={18} /></span>
          <h3 style={{ flex: 1, margin: 0, font: '500 18px/1.2 var(--iso-font-display)', color: 'var(--iso-fg-strong)' }}>{cfg.title}</h3>
          <button onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, borderRadius: 'var(--iso-radius-sm)', border: 0, background: 'transparent', color: 'var(--iso-fg-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={17} /></button>
        </div>
        {/* body */}
        <div style={{ padding: '22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {cfg.fields.map((f, i) => {
            const span = f.kind === 'text' && (f.id === 'subject' || f.id === 'name') ? 'span 2' : (f.id === 'email' ? 'span 2' : undefined);
            const common = { label: f.label, required: f.required, error: errors[f.id], value: values[f.id], onChange: (v) => set(f.id, v),
              'data-fid': f.id, ref: i === 0 ? firstFieldRef : undefined };
            let ctrl;
            if (f.kind === 'select') ctrl = <SelectField {...common} options={f.options} placeholder="Select…" />;
            else if (f.kind === 'date') ctrl = <DateField {...common} />;
            else ctrl = <TextField {...common} placeholder={f.placeholder} />;
            return <div key={f.id} style={{ gridColumn: span }}>{ctrl}</div>;
          })}
        </div>
        {/* outcome selector (scaffold demo affordance) */}
        <div style={{ margin: '0 22px', padding: '12px 14px', borderRadius: 'var(--iso-radius-md)', background: 'var(--iso-blue-3-50)', border: '1px dashed var(--iso-blue-3-300)',
          display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="flask-conical" size={15} style={{ color: 'var(--iso-accent)', flex: 'none' }} />
          <span style={{ font: '400 12px/1.3 var(--iso-font-ui)', color: 'var(--iso-fg-muted)', flex: 1 }}>Simulate server response</span>
          <div style={{ display: 'inline-flex', gap: 2, padding: 2, background: '#fff', border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius-sm)' }}>
            {OUTCOMES.map(o => (
              <button key={o.value} onClick={() => setOutcome(o.value)} style={{ height: 26, padding: '0 9px', border: 0, borderRadius: 'var(--iso-radius-xs)',
                background: outcome === o.value ? 'var(--iso-brand-soft)' : 'transparent', color: outcome === o.value ? 'var(--iso-brand)' : 'var(--iso-fg-muted)',
                font: `${outcome === o.value ? 500 : 400} 11px/1 var(--iso-font-ui)`, cursor: 'pointer' }}>{o.label}</button>
            ))}
          </div>
        </div>
        {/* footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--iso-space-2)', padding: '18px 22px 20px' }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!isValid} onClick={submit}>Create {cfg.title.replace('New ', '')}</Button>
        </div>
      </div>
    </div>
  );
}

window.EntityForm = EntityForm;
