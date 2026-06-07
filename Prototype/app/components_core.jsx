/* global React */
/* min-crm — core component inventory.
   StatusPill · Button · fields · Skeleton · Empty/Error states · Toast host.
   All tokens come from iSolution; motion from the authored --crm-* layer. */
const { useState, useEffect, useRef, useCallback } = React;

/* ---------------- Icon (lucide, currentColor) ---------------- */
function Icon({ name, size = 16, strokeWidth = 1.6, style = {}, className }) {
  const ref = useRef(null);
  useEffect(() => {
    if (window.lucide && ref.current) {
      ref.current.innerHTML = '';
      const el = document.createElement('i');
      el.setAttribute('data-lucide', name);
      ref.current.appendChild(el);
      window.lucide.createIcons({ attrs: { 'stroke-width': strokeWidth, width: size, height: size } });
    }
  }, [name, size, strokeWidth]);
  return <span ref={ref} className={className} style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: size, height: size, lineHeight: 0, flex: 'none', ...style,
  }} />;
}

/* ---------------- Status tones (the ONLY source of a pill's tone) ---------------- */
const TONES = {
  neutral: { bg: 'var(--iso-n-100)',        fg: 'var(--iso-fg-muted)',  border: 'var(--iso-n-300)',      dot: 'var(--iso-n-600)' },
  info:    { bg: 'var(--iso-info-soft)',    fg: 'var(--iso-brand)',     border: 'var(--iso-blue-3-300)', dot: 'var(--iso-accent)' },
  success: { bg: 'var(--iso-success-soft)', fg: 'var(--iso-green-800)', border: 'var(--iso-green-300)',  dot: 'var(--iso-success)' },
  warning: { bg: 'var(--iso-warning-soft)', fg: 'var(--iso-yellow-800)',border: 'var(--iso-yellow-300)', dot: 'var(--iso-warning)' },
  danger:  { bg: 'var(--iso-danger-soft)',  fg: 'var(--iso-red-700)',   border: 'var(--iso-red-300)',    dot: 'var(--iso-danger)' },
};

function StatusPill({ tone = 'neutral', children, icon, size = 'md' }) {
  const t = TONES[tone] || TONES.neutral;
  const pad = size === 'sm' ? '2px 7px' : '3px 9px';
  const fs = size === 'sm' ? 9 : 10;
  return (
    <span style={{
      '--pill-bg': t.bg, '--pill-fg': t.fg, '--pill-bd': t.border, '--pill-dot': t.dot,
      display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
      padding: pad, borderRadius: 'var(--iso-radius-xs)',
      background: 'var(--pill-bg)', color: 'var(--pill-fg)', border: '1px solid var(--pill-bd)',
      font: `500 ${fs}px/14px var(--iso-font-ui)`, letterSpacing: '0.06em', textTransform: 'uppercase',
      transition: 'background-color var(--crm-fast) var(--crm-ease-standard), color var(--crm-fast) var(--crm-ease-standard), border-color var(--crm-fast) var(--crm-ease-standard)',
    }}>
      {icon
        ? <Icon name={icon} size={11} strokeWidth={2} style={{ color: 'var(--pill-dot)' }} />
        : <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--pill-dot)', transition: 'background-color var(--crm-fast) var(--crm-ease-standard)' }} />}
      {children}
    </span>
  );
}

/* ---------------- Button ---------------- */
function Button({ variant = 'primary', size = 'md', leadIcon, trailIcon, children, disabled, style = {}, ...rest }) {
  const btnBase = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderRadius: 'var(--iso-radius-sm)', fontFamily: 'var(--iso-font-body)', fontWeight: 500,
    cursor: disabled ? 'default' : 'pointer', border: '1px solid transparent', whiteSpace: 'nowrap',
    transition: 'color var(--crm-fast) var(--crm-ease-standard), border-color var(--crm-fast) var(--crm-ease-standard), box-shadow var(--crm-fast) var(--crm-ease-standard)',
  };
  const btnSizes = {
    lg: { height: 44, padding: '0 18px', fontSize: 14, minWidth: 110 },
    md: { height: 36, padding: '0 14px', fontSize: 13, minWidth: 84 },
    sm: { height: 28, padding: '0 11px', fontSize: 12, minWidth: 0 },
  };
  const btnVariants = {
    primary:   { background: 'var(--iso-brand)', color: '#fff', boxShadow: 'var(--iso-shadow-xs)' },
    secondary: { background: '#fff', color: 'var(--iso-brand)', borderColor: 'var(--iso-brand)' },
    ghost:     { background: 'transparent', color: 'var(--iso-fg-muted)' },
    danger:    { background: 'var(--iso-danger)', color: '#fff', boxShadow: 'var(--iso-shadow-xs)' },
    neutral:   { background: 'var(--iso-n-100)', color: 'var(--iso-fg)' },
  };
  const disabledStyle = disabled
    ? (variant === 'secondary' || variant === 'ghost'
        ? { color: 'var(--iso-fg-disabled)', borderColor: 'var(--iso-border)', background: '#fff' }
        : { background: 'var(--iso-blue-1-200)', color: '#fff', boxShadow: 'none' })
    : {};
  const ic = size === 'sm' ? 13 : 15;
  return (
    <button disabled={disabled} {...rest}
      className={'crm-btn crm-btn-' + variant}
      style={{ ...btnBase, ...btnSizes[size], ...btnVariants[variant], ...disabledStyle, ...style }}>
      {leadIcon && <Icon name={leadIcon} size={ic} />}
      {children}
      {trailIcon && <Icon name={trailIcon} size={ic} />}
    </button>
  );
}

/* ---------------- Form fields (controlled) ---------------- */
function FieldShell({ label, required, error, help, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <span style={{ font: '500 12px/1 var(--iso-font-body)', color: 'var(--iso-fg)' }}>
          {label}{required && <span style={{ color: 'var(--iso-danger)', marginLeft: 2 }}>*</span>}
        </span>
      )}
      {children}
      {(error || help) && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, font: '400 11px/1.3 var(--iso-font-ui)', color: error ? 'var(--iso-danger)' : 'var(--iso-fg-subtle)' }}>
          {error && <Icon name="alert-circle" size={12} strokeWidth={2} />}
          {error || help}
        </span>
      )}
    </label>
  );
}
function fieldBox(focused, error) {
  return {
    display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 12px',
    border: `1px solid ${error ? 'var(--iso-danger)' : focused ? 'var(--iso-brand)' : 'var(--iso-border)'}`,
    borderRadius: 'var(--iso-radius-sm)', background: '#fff',
    boxShadow: focused ? (error ? 'var(--iso-shadow-focus-danger)' : 'var(--iso-shadow-focus)') : 'none',
    transition: 'border-color var(--crm-fast) var(--crm-ease-standard), box-shadow var(--crm-fast) var(--crm-ease-standard)',
  };
}
function TextField({ label, required, error, help, leadIcon, value, onChange, placeholder, type = 'text', ...rest }) {
  const [f, setF] = useState(false);
  return (
    <FieldShell label={label} required={required} error={error} help={help}>
      <span style={fieldBox(f, error)}>
        {leadIcon && <Icon name={leadIcon} size={15} style={{ color: 'var(--iso-fg-subtle)' }} />}
        <input type={type} value={value ?? ''} placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)} {...rest}
          style={{ flex: 1, border: 0, outline: 0, background: 'transparent', font: '400 14px/1 var(--iso-font-body)', color: 'var(--iso-fg)', minWidth: 0 }} />
      </span>
    </FieldShell>
  );
}
function SelectField({ label, required, error, help, value, onChange, options = [], placeholder = 'Select…', ...rest }) {
  const [f, setF] = useState(false);
  return (
    <FieldShell label={label} required={required} error={error} help={help}>
      <span style={{ ...fieldBox(f, error), position: 'relative', padding: 0 }}>
        <select value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)} {...rest}
          style={{ flex: 1, height: '100%', border: 0, outline: 0, background: 'transparent', padding: '0 36px 0 12px',
            font: '400 14px/1 var(--iso-font-body)', color: value ? 'var(--iso-fg)' : 'var(--iso-fg-subtle)', appearance: 'none', cursor: 'pointer' }}>
          <option value="" disabled>{placeholder}</option>
          {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
        </select>
        <Icon name="chevron-down" size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--iso-fg-subtle)', pointerEvents: 'none' }} />
      </span>
    </FieldShell>
  );
}
function DateField({ label, required, error, help, value, onChange, ...rest }) {
  const [f, setF] = useState(false);
  return (
    <FieldShell label={label} required={required} error={error} help={help}>
      <span style={fieldBox(f, error)}>
        <Icon name="calendar" size={15} style={{ color: 'var(--iso-fg-subtle)' }} />
        <input type="date" value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)} {...rest}
          style={{ flex: 1, border: 0, outline: 0, background: 'transparent', font: '400 14px/1 var(--iso-font-body)', color: value ? 'var(--iso-fg)' : 'var(--iso-fg-subtle)' }} />
      </span>
    </FieldShell>
  );
}

/* ---------------- Skeleton ---------------- */
function Skeleton({ w = '100%', h = 12, r = 4, style = {} }) {
  return <span className="crm-skel" style={{ display: 'block', width: w, height: h, borderRadius: r, ...style }} />;
}

/* ---------------- Empty & Error states ---------------- */
function EmptyState({ icon = 'inbox', title, body, scopeLine, action, compact }) {
  const ref = useRef(null);
  useEffect(() => { if (action?.autoFocus && ref.current) ref.current.focus(); }, [action]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      padding: compact ? '32px 24px' : '56px 24px', gap: 6 }}>
      <span aria-hidden style={{ width: 56, height: 56, borderRadius: 'var(--iso-radius-lg)', background: 'var(--iso-brand-soft)',
        color: 'var(--iso-brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <Icon name={icon} size={26} strokeWidth={1.5} />
      </span>
      <h3 style={{ margin: 0, font: '500 17px/1.3 var(--iso-font-display)', color: 'var(--iso-fg-strong)' }}>{title}</h3>
      {scopeLine && <div style={{ font: '500 11px/1 var(--iso-font-ui)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)' }}>{scopeLine}</div>}
      {body && <p style={{ margin: '2px 0 0', maxWidth: '42ch', font: '400 13px/20px var(--iso-font-body)', color: 'var(--iso-fg-muted)', textWrap: 'pretty' }}>{body}</p>}
      {action && <div style={{ marginTop: 14 }}><Button ref={ref} variant="primary" leadIcon={action.icon} onClick={action.onClick}>{action.label}</Button></div>}
    </div>
  );
}
function ErrorState({ title = "Can't load data", body = 'Try refreshing — if the problem persists, contact support.', onRetry }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '48px 24px', gap: 6 }}>
      <span aria-hidden style={{ width: 56, height: 56, borderRadius: 'var(--iso-radius-lg)', background: 'var(--iso-danger-soft)',
        color: 'var(--iso-danger)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <Icon name="cloud-off" size={26} strokeWidth={1.5} />
      </span>
      <h3 style={{ margin: 0, font: '500 17px/1.3 var(--iso-font-display)', color: 'var(--iso-fg-strong)' }}>{title}</h3>
      <p style={{ margin: '2px 0 0', maxWidth: '40ch', font: '400 13px/20px var(--iso-font-body)', color: 'var(--iso-fg-muted)' }}>{body}</p>
      {onRetry && <div style={{ marginTop: 14 }}><Button variant="secondary" leadIcon="refresh-cw" onClick={onRetry}>Retry</Button></div>}
    </div>
  );
}

/* ---------------- Toast system (max 3 · success auto-dismiss · error persists) ---------------- */
const toastListeners = new Set();
let toastSeq = 0;
function pushToast(t) {
  const id = ++toastSeq;
  toastListeners.forEach(fn => fn({ tone: 'neutral', ...t, id }));
  return id;
}
function dismissToast(id) { toastListeners.forEach(fn => fn({ __dismiss: id })); }

function ToastHost() {
  const [items, setItems] = useState([]);
  const timers = useRef({});
  useEffect(() => {
    const fn = (msg) => {
      if (msg.__dismiss != null) { setItems(prev => prev.filter(x => x.id !== msg.__dismiss)); return; }
      setItems(prev => {
        const next = [...prev, msg].slice(-3); // max 3 stacked
        return next;
      });
      const persist = msg.persist ?? (msg.tone === 'danger');
      if (!persist) {
        timers.current[msg.id] = setTimeout(() => {
          setItems(prev => prev.filter(x => x.id !== msg.id));
        }, msg.duration ?? 4000);
      }
    };
    toastListeners.add(fn);
    return () => toastListeners.delete(fn);
  }, []);
  const close = (id) => { clearTimeout(timers.current[id]); setItems(prev => prev.filter(x => x.id !== id)); };
  const toneIcon = { success: 'check-circle', danger: 'rotate-ccw', warning: 'alert-triangle', info: 'info', neutral: 'info' };
  const toneColor = { success: 'var(--iso-green-300)', danger: 'var(--iso-red-300)', warning: 'var(--iso-yellow-300)', info: 'var(--iso-blue-3-300)', neutral: 'var(--iso-n-400)' };
  return (
    <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 'var(--iso-z-toast)',
      display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', pointerEvents: 'none' }}>
      {items.map(t => (
        <div key={t.id} className="crm-toast" style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, pointerEvents: 'auto',
          minWidth: 280, maxWidth: 420, background: 'var(--iso-n-900)', color: '#fff',
          borderRadius: 'var(--iso-radius-md)', padding: '12px 12px 12px 14px', boxShadow: 'var(--iso-shadow-lg)' }}>
          <Icon name={toneIcon[t.tone] || 'info'} size={16} strokeWidth={2} style={{ color: toneColor[t.tone], marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ font: '500 13px/1.4 var(--iso-font-body)' }}>{t.title}</div>
            {t.sub && <div style={{ font: '400 12px/1.4 var(--iso-font-body)', color: 'var(--iso-n-400)', marginTop: 1 }}>{t.sub}</div>}
            {t.action && <button onClick={() => { t.action.onClick?.(); close(t.id); }} style={{ marginTop: 7, background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
              font: '500 12px/1 var(--iso-font-body)', color: 'var(--iso-blue-2-200)' }}>{t.action.label}</button>}
          </div>
          <button onClick={() => close(t.id)} aria-label="Dismiss" style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--iso-n-500)', padding: 2, lineHeight: 0 }}>
            <Icon name="x" size={14} strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Card / panel ---------------- */
function Card({ children, style = {}, pad = false }) {
  return <div style={{ background: '#fff', border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius-lg)',
    boxShadow: 'var(--iso-shadow-sm)', ...(pad ? { padding: 'var(--iso-space-6)' } : {}), ...style }}>{children}</div>;
}
function SectionLabel({ children, style = {} }) {
  return <div style={{ font: '500 10px/1 var(--iso-font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)', ...style }}>{children}</div>;
}

Object.assign(window, {
  Icon, TONES, StatusPill, Button, FieldShell, TextField, SelectField, DateField,
  Skeleton, EmptyState, ErrorState, ToastHost, pushToast, dismissToast, Card, SectionLabel,
});
