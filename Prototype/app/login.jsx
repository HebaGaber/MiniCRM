/* global React, Icon, Button, Wordmark, TextField, ROLES, SUBSIDIARIES, TENANT */
/* min-crm — mock SSO sign-in. Pick a role; lands signed-in with an active tenant + scope. */
const { useState: useL } = React;

function Login({ onSignIn }) {
  const [role, setRole] = useL('tenant_admin');
  const [email] = useL('sara.khan@northwind.com');

  const roleMeta = {
    tenant_admin:  { icon: 'shield-check', desc: 'Full access · can switch subsidiary or view the roll-up', scope: 'Whole tenant (roll-up)' },
    sales_agent:   { icon: 'user-plus',    desc: 'Leads, customers & tickets · pinned to one subsidiary',   scope: 'EU subsidiary' },
    support_agent: { icon: 'life-buoy',    desc: 'Tickets & customers · pinned to one subsidiary',           scope: 'US subsidiary' },
    viewer:        { icon: 'eye',          desc: 'Read-only · view leads, customers, tickets & timelines',   scope: 'EU subsidiary' },
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.05fr 1fr', background: '#fff' }}>
      {/* brand panel — the system's single decorative gradient */}
      <div style={{ position: 'relative', overflow: 'hidden', padding: 48, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: '#fff',
        background: 'var(--iso-gradient-blue)' }}>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Wordmark size={22} dim />
          <span style={{ font: '500 10px/1 var(--iso-font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 'var(--iso-radius-xs)', padding: '4px 7px' }}>Internal</span>
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ margin: 0, font: '300 42px/1.1 var(--iso-font-display)', letterSpacing: '-0.02em', maxWidth: '13ch' }}>The CRM your agents actually trust.</h2>
          <p style={{ marginTop: 18, maxWidth: 400, font: '400 15px/1.6 var(--iso-font-body)', color: 'rgba(255,255,255,0.85)' }}>
            Multi-tenant by design. Optimistic where it’s safe, honest when it isn’t — and the active scope is always in view.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 24 }}>
            {['Scope always visible', 'Audit-as-feature', 'Deny-wins, felt gracefully'].map(t => (
              <span key={t} style={{ font: '500 11px/1 var(--iso-font-ui)', color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 'var(--iso-radius-full)', padding: '6px 11px' }}>{t}</span>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', zIndex: 1, font: '400 12px/1 var(--iso-font-ui)', color: 'rgba(255,255,255,0.65)' }}>{TENANT.name} · {SUBSIDIARIES.length} subsidiaries · ISO 27001</div>
        <span aria-hidden style={{ position: 'absolute', right: -180, top: -160, width: 520, height: 520, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.14)' }} />
        <span aria-hidden style={{ position: 'absolute', right: -100, bottom: -260, width: 400, height: 400, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)' }} />
      </div>

      {/* sign-in panel */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ width: 400, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <div style={{ font: '500 10px/1 var(--iso-font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)', marginBottom: 8 }}>Single sign-on</div>
            <h1 style={{ margin: 0, font: '500 30px/1.15 var(--iso-font-display)', letterSpacing: '-0.02em', color: 'var(--iso-fg-strong)' }}>Sign in</h1>
            <p style={{ margin: '8px 0 0', font: '400 14px/1.5 var(--iso-font-body)', color: 'var(--iso-fg-muted)' }}>Continue with your {TENANT.name} account.</p>
          </div>

          <div>
            <div style={{ font: '500 12px/1 var(--iso-font-body)', color: 'var(--iso-fg)', marginBottom: 9 }}>Sign in as <span style={{ color: 'var(--iso-fg-subtle)', fontWeight: 400 }}>(demo role)</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.values(ROLES).map(r => {
                const active = role === r.id;
                const m = roleMeta[r.id];
                return (
                  <button key={r.id} onClick={() => setRole(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', textAlign: 'left', cursor: 'pointer',
                    border: `1px solid ${active ? 'var(--iso-brand)' : 'var(--iso-border)'}`, borderRadius: 'var(--iso-radius-md)', background: active ? 'var(--iso-brand-soft)' : '#fff',
                    boxShadow: active ? 'var(--iso-shadow-focus)' : 'none', transition: 'border-color var(--crm-fast) var(--crm-ease-standard), box-shadow var(--crm-fast) var(--crm-ease-standard)' }}>
                    <span style={{ width: 36, height: 36, flex: 'none', borderRadius: 'var(--iso-radius-sm)', background: active ? 'var(--iso-brand)' : 'var(--iso-blue-3-100)', color: active ? '#fff' : 'var(--iso-brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={m.icon} size={18} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', font: '500 14px/1.3 var(--iso-font-body)', color: 'var(--iso-fg-strong)' }}>{r.label}</span>
                      <span style={{ display: 'block', font: '400 12px/1.4 var(--iso-font-ui)', color: 'var(--iso-fg-muted)' }}>{m.desc}</span>
                    </span>
                    <span style={{ width: 18, height: 18, flex: 'none', borderRadius: '50%', border: `1.5px solid ${active ? 'var(--iso-brand)' : 'var(--iso-border-strong)'}`, background: active ? 'var(--iso-brand)' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{active && <Icon name="check" size={12} strokeWidth={3} style={{ color: '#fff' }} />}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--iso-radius-sm)', background: 'var(--iso-blue-3-50)', border: '1px solid var(--iso-border-muted)' }}>
            <Icon name="building-2" size={15} style={{ color: 'var(--iso-accent)' }} />
            <span style={{ font: '400 12px/1.4 var(--iso-font-ui)', color: 'var(--iso-fg-muted)' }}>Active scope on landing: <b style={{ color: 'var(--iso-fg)', fontWeight: 500 }}>{roleMeta[role].scope}</b></span>
          </div>

          <Button variant="primary" size="lg" leadIcon="building-2" style={{ width: '100%' }} onClick={() => onSignIn(role)}>Continue with SSO</Button>
          <p style={{ margin: 0, textAlign: 'center', font: '400 12px/1.5 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)' }}>You’ll land in the shell with this role’s nav and scope.</p>
        </div>
      </div>
    </div>
  );
}

window.Login = Login;
