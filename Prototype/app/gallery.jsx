/* global React, Icon, Button, StatusPill, TextField, SelectField, DateField, Skeleton,
   EmptyState, ErrorState, Card, SectionLabel, Toolbar, FilterBar, FilterChip, DataTable,
   Pagination, ConfirmDialog, pushToast, TONES */
/* min-crm — component inventory. Every shared component with its states & variants. */
const { useState: useG } = React;

function GSection({ id, title, count, desc, children }) {
  return (
    <section id={id} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, font: '500 20px/1.2 var(--iso-font-display)', letterSpacing: '-0.01em', color: 'var(--iso-fg-strong)' }}>{title}</h2>
        {count && <span style={{ font: '400 12px/1 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)' }}>{count}</span>}
      </div>
      {desc && <p style={{ margin: '-6px 0 0', font: '400 13px/20px var(--iso-font-body)', color: 'var(--iso-fg-muted)', maxWidth: '70ch' }}>{desc}</p>}
      <Card pad>{children}</Card>
    </section>
  );
}
function Row({ children, label, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, ...style }}>
      {label && <SectionLabel>{label}</SectionLabel>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

const galleryCols = [
  { header: 'Record', key: 'name', width: '1.4fr', render: (r) => <span style={{ fontWeight: 500 }}>{r.name}</span> },
  { header: 'Status', width: '120px', render: (r) => <StatusPill tone={r.tone}>{r.status}</StatusPill> },
  { header: 'Owner', key: 'owner', width: '1fr' },
];
const galleryRows = [
  { id: 1, name: 'Helix Labs', status: 'Healthy', tone: 'success', owner: 'Sara Khan' },
  { id: 2, name: 'Brightwell', status: 'At risk', tone: 'warning', owner: 'Marco Ruiz' },
  { id: 3, name: 'Pertex', status: 'Churned', tone: 'danger', owner: '—' },
];

function ComponentGallery() {
  const [confirm, setConfirm] = useG(false);
  const [tableState, setTableState] = useG('ready');
  const [errVal, setErrVal] = useG('');

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--iso-space-8)' }}>
      <div>
        <div style={{ font: '500 10px/1 var(--iso-font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)', marginBottom: 8 }}>Build · inventory</div>
        <h1 style={{ margin: 0, font: '500 28px/1.15 var(--iso-font-display)', letterSpacing: '-0.02em', color: 'var(--iso-fg-strong)' }}>Component inventory</h1>
        <p style={{ margin: '8px 0 0', maxWidth: '70ch', font: '400 14px/1.5 var(--iso-font-body)', color: 'var(--iso-fg-muted)' }}>
          Every shared component the screens are built from, shown with its states and variants. Tokens come from the iSolution Design System; motion from the authored <span style={{ fontFamily: 'Inter, monospace', fontSize: 13 }}>--crm-*</span> layer.
        </p>
      </div>

      {/* StatusPill */}
      <GSection id="g-pill" title="StatusPill" desc="Tone-driven and always labelled. A pill's tone comes only from the five-tone map; dot or icon, never colour alone.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Row label="Dot variant">
            <StatusPill tone="neutral">Draft</StatusPill>
            <StatusPill tone="info">Open</StatusPill>
            <StatusPill tone="success">Won</StatusPill>
            <StatusPill tone="warning">At risk</StatusPill>
            <StatusPill tone="danger">Blocked</StatusPill>
          </Row>
          <Row label="Icon variant">
            <StatusPill tone="neutral" icon="circle-dashed">Draft</StatusPill>
            <StatusPill tone="info" icon="loader">In progress</StatusPill>
            <StatusPill tone="success" icon="check">Resolved</StatusPill>
            <StatusPill tone="warning" icon="triangle-alert">SLA risk</StatusPill>
            <StatusPill tone="danger" icon="ban">Denied</StatusPill>
          </Row>
        </div>
      </GSection>

      {/* Buttons */}
      <GSection id="g-btn" title="Button" desc="Hover steps one tone darker; press two darker. No scale-down, no shadow change — the iSolution interaction rule.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Row label="Variants">
            <Button variant="primary" leadIcon="plus">Primary</Button>
            <Button variant="secondary" leadIcon="download">Secondary</Button>
            <Button variant="neutral">Neutral</Button>
            <Button variant="ghost" leadIcon="filter">Ghost</Button>
            <Button variant="danger" leadIcon="trash-2">Danger</Button>
          </Row>
          <Row label="Sizes">
            <Button variant="primary" size="lg">Large</Button>
            <Button variant="primary" size="md">Medium</Button>
            <Button variant="primary" size="sm">Small</Button>
          </Row>
          <Row label="Disabled (brand swaps to lighter blue, never opacity)">
            <Button variant="primary" disabled>Primary</Button>
            <Button variant="secondary" disabled>Secondary</Button>
          </Row>
        </div>
      </GSection>

      {/* Fields */}
      <GSection id="g-fields" title="Form fields" desc="Controlled Text, Select and Date. Focus keeps the border and adds the brand focus ring; errors show inline with an icon.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          <TextField label="Text" placeholder="Type here…" help="Helper text" />
          <SelectField label="Select" options={['Mid-market', 'Growth', 'Enterprise']} />
          <DateField label="Date" />
          <TextField label="With error" required value={errVal} onChange={setErrVal} error={!errVal ? 'This field is required' : undefined} placeholder="Required" />
          <TextField label="Lead icon" leadIcon="mail" placeholder="name@company.com" />
          <SelectField label="Disabled" options={['One']} disabled />
        </div>
      </GSection>

      {/* Toolbar + FilterBar */}
      <GSection id="g-toolbar" title="Toolbar & FilterBar" desc="The list-page command rows: search + actions, then filter chips with an active-tone fill and a sort affordance.">
        <div style={{ border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius-md)', overflow: 'hidden' }}>
          <Toolbar onSearch={() => {}} searchPlaceholder="Search records…" right={<><Button variant="ghost" size="sm" leadIcon="arrow-up-down">Sort</Button><Button variant="ghost" size="sm" leadIcon="sliders-horizontal">Columns</Button></>} />
          <FilterBar groups={[
            <FilterChip selected>All</FilterChip>,
            <FilterChip>Assigned to me</FilterChip>,
            <FilterChip count={3}>At risk</FilterChip>,
          ]} sort={<span style={{ font: '400 12px/1 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)' }}>Sorted by Updated ↓</span>} />
        </div>
      </GSection>

      {/* DataTable — four states */}
      <GSection id="g-table" title="DataTable" desc="One component, four states. Rows are keyboard-operable (Tab to focus, Enter to open); the status column uses StatusPill.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <SectionLabel>State</SectionLabel>
          {['loading', 'empty', 'error', 'ready'].map(s => (
            <button key={s} onClick={() => setTableState(s)} style={{ height: 28, padding: '0 11px', borderRadius: 'var(--iso-radius-sm)', cursor: 'pointer',
              border: `1px solid ${tableState === s ? 'var(--iso-brand)' : 'var(--iso-border)'}`, background: tableState === s ? 'var(--iso-brand-soft)' : '#fff',
              color: tableState === s ? 'var(--iso-brand)' : 'var(--iso-fg-muted)', font: `${tableState === s ? 500 : 400} 12px/1 var(--iso-font-body)`, textTransform: 'capitalize' }}>{s}</button>
          ))}
        </div>
        <div style={{ border: '1px solid var(--iso-border)', borderRadius: 'var(--iso-radius-md)', overflow: 'hidden' }}>
          <DataTable columns={galleryCols} rows={tableState === 'ready' ? galleryRows : []} state={tableState} skeletonRows={3}
            onRetry={() => setTableState('ready')}
            empty={{ icon: 'inbox', title: 'No records yet', body: 'Create your first record to get started.', action: { label: 'New record', icon: 'plus' } }}
            rowActions={() => [{ label: 'Open', icon: 'arrow-up-right' }, { label: 'Delete', icon: 'trash-2', tone: 'danger' }]} />
          {tableState === 'ready' && <Pagination page={1} pageCount={4} total={84} perPage={25} onPage={() => {}} />}
        </div>
      </GSection>

      {/* Overlays: Toast + ConfirmDialog */}
      <GSection id="g-overlay" title="Toast & ConfirmDialog" desc="Toasts stack to a max of three: success auto-dismisses in ~4s, error and 409 persist, all are dismissible. Confirm dialogs focus the safe control, trap focus and close on Esc.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Row label="Toasts">
            <Button variant="secondary" size="sm" onClick={() => pushToast({ tone: 'success', title: 'Subscription created.' })}>Success</Button>
            <Button variant="secondary" size="sm" onClick={() => pushToast({ tone: 'info', title: 'Export started.', sub: 'We’ll notify you when it’s ready.' })}>Info</Button>
            <Button variant="secondary" size="sm" onClick={() => pushToast({ tone: 'danger', title: 'Couldn’t save — rolled back.', sub: 'Record changed, refresh.', persist: true, action: { label: 'Refresh' } })}>Error (persists)</Button>
            <Button variant="ghost" size="sm" onClick={() => { pushToast({ tone: 'neutral', title: 'One' }); pushToast({ tone: 'info', title: 'Two' }); pushToast({ tone: 'success', title: 'Three' }); pushToast({ tone: 'warning', title: 'Four — oldest is dropped' }); }}>Stack 4 → keeps 3</Button>
          </Row>
          <Row label="Confirm dialog">
            <Button variant="danger" size="sm" leadIcon="trash-2" onClick={() => setConfirm(true)}>Delete record…</Button>
          </Row>
        </div>
      </GSection>

      {/* Feedback states */}
      <GSection id="g-states" title="EmptyState · ErrorState · Skeleton" desc="The non-ready surfaces. Empty leads with an illustration, scope line and a primary action; Error is a contained panel with Retry; Skeleton mirrors the layout it stands in for.">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ border: '1px solid var(--iso-border-muted)', borderRadius: 'var(--iso-radius-md)' }}>
            <EmptyState icon="user-plus" title="No leads in this scope yet" scopeLine="EU subsidiary" body="Create your first lead to get started." action={{ label: 'New lead', icon: 'plus' }} />
          </div>
          <div style={{ border: '1px solid var(--iso-border-muted)', borderRadius: 'var(--iso-radius-md)' }}>
            <ErrorState onRetry={() => pushToast({ tone: 'info', title: 'Retrying…' })} />
          </div>
        </div>
        <div style={{ marginTop: 16, padding: 18, border: '1px solid var(--iso-border-muted)', borderRadius: 'var(--iso-radius-md)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionLabel>Skeleton</SectionLabel>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Skeleton w={36} h={36} r={18} /><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}><Skeleton w="40%" h={13} /><Skeleton w="65%" h={11} /></div></div>
          <Skeleton w="100%" h={11} /><Skeleton w="85%" h={11} /><Skeleton w="92%" h={11} />
        </div>
      </GSection>

      <ConfirmDialog open={confirm} tone="danger" title="Delete this record?"
        body="This permanently removes the record and its activity timeline from the current scope. This can’t be undone."
        confirmLabel="Delete record" cancelLabel="Cancel"
        onCancel={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); pushToast({ tone: 'success', title: 'Record deleted.' }); }} />
    </div>
  );
}

window.ComponentGallery = ComponentGallery;
