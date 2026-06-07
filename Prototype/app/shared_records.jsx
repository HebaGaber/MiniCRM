/* global React, Icon, Button, StatusPill, EmptyState, Store, TRANSITIONS, STATUS_META */
/* min-crm — shared record surfaces reused by Leads, Customers (and later Tickets):
   a generic state-machine ChangeStatusControl and a kind-aware activity RecordTimeline. */
const { useState: useSR, useEffect: useSRE, useRef: useSRR } = React;

const ENTITY_ORDER = {
  lead: ['new', 'contacted', 'qualified', 'disqualified', 'converted'],
  customer: ['prospect', 'onboarding', 'active', 'inactive', 'churned'],
  ticket: ['open', 'in_progress', 'pending', 'resolved', 'closed'],
};
const TRANSITION_FN = {
  lead: (id, to, actor) => Store.transitionLead(id, to, actor),
  customer: (id, to, actor) => Store.transitionCustomer(id, to, actor),
  ticket: (id, to, actor) => Store.transitionTicket ? Store.transitionTicket(id, to, actor) : { ok: false },
};
const STATUS_ICON = { converted: 'check-circle', disqualified: 'x-circle', churned: 'x-circle', inactive: 'pause-circle', active: 'check-circle', resolved: 'check-circle', closed: 'lock' };

/* Change-status control — offers ONLY legal next steps; illegal targets shown disabled and, when
   attempted, surface an inline "rule + next legal step" with NO pill change and NO toast (422). */
function ChangeStatusControl({ entity, record, actor, disabled }) {
  const [open, setOpen] = useSR(false);
  const [blocked, setBlocked] = useSR(null);
  const ref = useSRR(null);
  useSRE(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setBlocked(null); } };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const meta = STATUS_META[entity];
  const legal = TRANSITIONS[entity][record.status] || [];
  const illegal = ENTITY_ORDER[entity].filter(s => s !== record.status && !legal.includes(s));
  const terminal = legal.length === 0;
  const legalLabels = legal.map(s => meta[s].label).join(' or ');

  const doLegal = (to) => { const r = TRANSITION_FN[entity](record.id, to, actor); if (!r.ok && r.reason) { setBlocked({ to, reason: r.reason }); return; } setOpen(false); setBlocked(null); };
  const tryIllegal = (to) => { const r = TRANSITION_FN[entity](record.id, to, actor); if (!r.ok) setBlocked({ to, reason: r.reason }); };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <Button variant="secondary" leadIcon="repeat" trailIcon="chevron-down" disabled={disabled || terminal}
        onClick={() => setOpen(o => !o)} title={terminal ? `${meta[record.status].label} is terminal — read-only` : 'Change status'}>Change status</Button>
      {open && !terminal && (
        <div style={{ position: 'absolute', top: 44, right: 0, width: 288, background: '#fff', border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius-md)',
          boxShadow: 'var(--iso-shadow-lg)', padding: 8, zIndex: 'var(--iso-z-dropdown)', animation: 'crm-pop var(--crm-base) var(--crm-ease-decelerate)' }}>
          <div style={{ font: '500 10px/1 var(--iso-font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)', padding: '6px 8px 8px' }}>Move this {entity} to</div>
          {legal.map(s => {
            const m = meta[s];
            return (
              <button key={s} onClick={() => doLegal(s)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 8px', border: 0, background: 'transparent',
                borderRadius: 'var(--iso-radius-sm)', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--iso-n-100)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <StatusPill tone={m.tone} size="sm">{m.label}</StatusPill>
                <Icon name="arrow-right" size={14} style={{ marginLeft: 'auto', color: 'var(--iso-fg-subtle)' }} />
              </button>
            );
          })}
          {illegal.length > 0 && (
            <>
              <div style={{ height: 1, background: 'var(--iso-border-muted)', margin: '6px 6px' }} />
              <div style={{ font: '500 10px/1 var(--iso-font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)', padding: '4px 8px 6px' }}>Not available from {meta[record.status].label}</div>
              {illegal.map(s => {
                const m = meta[s];
                return (
                  <button key={s} onClick={() => tryIllegal(s)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 8px', border: 0, background: 'transparent',
                    borderRadius: 'var(--iso-radius-sm)', cursor: 'not-allowed', textAlign: 'left', opacity: 0.85 }}>
                    <StatusPill tone={m.tone} size="sm">{m.label}</StatusPill>
                    <Icon name="lock" size={13} style={{ marginLeft: 'auto', color: 'var(--iso-fg-subtle)' }} />
                  </button>
                );
              })}
              {blocked && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '6px 4px 2px', padding: '9px 11px', borderRadius: 'var(--iso-radius-sm)', background: 'var(--iso-warning-soft)', border: '1px solid var(--iso-yellow-300)' }}>
                  <Icon name="info" size={14} strokeWidth={2} style={{ color: 'var(--iso-yellow-700)', marginTop: 1, flex: 'none' }} />
                  <span style={{ font: '400 12px/1.5 var(--iso-font-ui)', color: 'var(--iso-yellow-800)' }}>
                    {blocked.reason
                      ? blocked.reason
                      : <>Can’t move from <b style={{ fontWeight: 600 }}>{meta[record.status].label}</b> to <b style={{ fontWeight: 600 }}>{meta[blocked.to].label}</b>. Next legal step: <b style={{ fontWeight: 600 }}>{legalLabels}</b>.</>}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const NOW_TS = Date.UTC(2026, 5, 6, 14, 30);
function relTime(at) {
  const ms = NOW_TS - at; const min = Math.round(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60); if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24); return d === 1 ? 'yesterday' : `${d} days ago`;
}

/* Designed activity surface. Interleaves status / conversion / ticket events in one stream.
   conversion + ticket entries carry a small kind tag so lineage reads distinctly from a raw log. */
function RecordTimeline({ events, emptyTitle = 'No activity yet', emptyBody = 'Events for this record will appear here, newest first.' }) {
  if (!events || events.length === 0) {
    return <EmptyState compact icon="history" title={emptyTitle} body={emptyBody} />;
  }
  const tc = { success: 'var(--iso-success)', info: 'var(--iso-accent)', neutral: 'var(--iso-n-600)', warning: 'var(--iso-warning)', danger: 'var(--iso-danger)' };
  const ordered = [...events].sort((a, b) => b.at - a.at); // newest first
  const kindTag = { conversion: { label: 'Lineage', bg: 'var(--iso-success-soft)', fg: 'var(--iso-green-800)' }, ticket: { label: 'Ticket', bg: 'var(--iso-info-soft)', fg: 'var(--iso-brand)' } };
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {ordered.map((e, i) => {
        const tag = kindTag[e.kind];
        return (
          <div key={e.id} style={{ display: 'flex', gap: 13, paddingBottom: i === ordered.length - 1 ? 0 : 20, position: 'relative' }}>
            {i !== ordered.length - 1 && <span style={{ position: 'absolute', left: 15, top: 32, bottom: 0, width: 1, background: 'var(--iso-border)' }} />}
            <span style={{ width: 31, height: 31, flex: 'none', borderRadius: '50%', background: tag ? tag.bg : '#fff', border: `1px solid ${tag ? 'transparent' : 'var(--iso-border)'}`, color: tc[e.tone] || tc.neutral,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}><Icon name={e.icon} size={15} /></span>
            <div style={{ paddingTop: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ font: '400 13px/1.5 var(--iso-font-body)', color: 'var(--iso-fg)' }}><b style={{ fontWeight: 600 }}>{e.actor}</b> {e.sentence}</span>
                {tag && <span style={{ font: '500 9px/1 var(--iso-font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase', color: tag.fg, background: tag.bg, borderRadius: 'var(--iso-radius-xs)', padding: '3px 6px' }}>{tag.label}</span>}
              </div>
              <div title={e.abs} style={{ font: '400 11px/1 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)', marginTop: 4, cursor: 'default', width: 'fit-content' }}>{relTime(e.at)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, { ChangeStatusControl, RecordTimeline, relTime, ENTITY_ORDER, RecordPager });

/* ---------------- RecordPager: Gmail-style prev/next + side/full toggle + close ---------------- */
function RecordPager({ index, total, onPrev, onNext, viewMode, onViewMode, onClose, label }) {
  const hasPrev = index > 0, hasNext = index < total - 1;
  const navBtn = (dir, enabled, onClick, icon, title) => (
    <button onClick={enabled ? onClick : undefined} disabled={!enabled} title={title} aria-label={title} style={{
      width: 30, height: 30, borderRadius: 'var(--iso-radius-sm)', border: '1px solid var(--iso-border)', background: '#fff',
      color: enabled ? 'var(--iso-fg-muted)' : 'var(--iso-fg-disabled)', cursor: enabled ? 'pointer' : 'default',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: enabled ? 1 : 0.5,
      transition: 'background-color var(--crm-fast) var(--crm-ease-standard)' }}>
      <Icon name={icon} size={16} />
    </button>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--iso-border)', background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'saturate(140%) blur(6px)', position: 'sticky', top: 0, zIndex: 'var(--iso-z-sticky)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {navBtn('prev', hasPrev, onPrev, 'chevron-left', 'Previous record')}
        {navBtn('next', hasNext, onNext, 'chevron-right', 'Next record')}
      </div>
      <span style={{ font: '500 12px/1 var(--iso-font-ui)', color: 'var(--iso-fg-muted)', fontVariantNumeric: 'tabular-nums' }}>
        {total > 0 ? `${index + 1} of ${total}` : '—'}{label ? <span style={{ color: 'var(--iso-fg-subtle)' }}> · {label}</span> : null}
      </span>
      <span style={{ flex: 1 }} />
      <div style={{ display: 'inline-flex', padding: 2, gap: 2, background: 'var(--iso-blue-3-100)', borderRadius: 'var(--iso-radius-sm)', border: '1px solid var(--iso-border)' }}>
        {[['side', 'panel-right', 'Side view'], ['full', 'square', 'Full view']].map(([m, icon, title]) => {
          const active = viewMode === m;
          return (
            <button key={m} onClick={() => onViewMode(m)} title={title} aria-label={title} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 9px', border: 0, borderRadius: 'var(--iso-radius-xs)',
              background: active ? '#fff' : 'transparent', color: active ? 'var(--iso-brand)' : 'var(--iso-fg-muted)', boxShadow: active ? 'var(--iso-shadow-xs)' : 'none',
              cursor: 'pointer', font: `${active ? 500 : 400} 11px/1 var(--iso-font-ui)` }}>
              <Icon name={icon} size={13} />{title.split(' ')[0]}
            </button>
          );
        })}
      </div>
      <button onClick={onClose} aria-label="Close record" title="Close (Esc)" style={{ width: 30, height: 30, borderRadius: 'var(--iso-radius-sm)', border: '1px solid var(--iso-border)', background: '#fff', color: 'var(--iso-fg-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
