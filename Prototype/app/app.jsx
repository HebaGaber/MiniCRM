/* global React, ReactDOM, Login, Sidebar, Topbar, ListPage, DetailPage, DashboardPage,
   EntityForm, ComponentGallery, ConfirmDialog, ToastHost, pushToast, ROLES, NAV, navFor, canAccess, canWrite, canCreate,
   useStore, Store, subName, SubsidiariesPage, RollupPage, NotFoundView, LeadForm, LeadDetail,
   ConversionInspector, CustomerForm, CustomerDetail, TicketForm, TicketDetail, AuditLog, NotificationsPage, RecordPager */
const { useState: useA, useEffect: useAE, useCallback: useAC } = React;

const ENTITY_OF = { leads: 'lead', customers: 'customer', tickets: 'ticket', audit: 'event' };
const ACTOR_OF = { tenant_admin: 'Sara Khan', sales_agent: 'Marco Ruiz', support_agent: 'Lena Bauer', viewer: 'Sara Khan' };
const NOUN_OF = { leads: 'Leads', customers: 'Customers', tickets: 'Tickets' };
const LOOKUP = { leads: (id) => Store.getLead(id), customers: (id) => Store.getCustomer(id), tickets: (id) => Store.getTicket(id) };

function App() {
  const [roleId, setRoleId] = useA(null);
  const [view, setView] = useA({ type: 'dashboard', navId: 'dashboard' });
  const [record, setRecord] = useA(null);
  const [navList, setNavList] = useA([]);                 // ordered record ids = the list's current filter/sort
  const [viewMode, setViewMode] = useA(() => localStorage.getItem('crm-view-mode') || 'full'); // side | full
  const [gallery, setGallery] = useA(false);
  const [collapsed, setCollapsed] = useA(false);
  const [form, setForm] = useA(null);
  const [leadForm, setLeadForm] = useA(null);
  const [custForm, setCustForm] = useA(null);
  const [ticketForm, setTicketForm] = useA(false);
  const [confirm, setConfirm] = useA(null);
  const [pstate, setPstate] = useA({});

  const st = useStore();
  const role = roleId ? ROLES[roleId] : null;
  const scope = st.scope;
  const scopeLoading = st.scopeLoading;

  const setMode = (m) => { setViewMode(m); localStorage.setItem('crm-view-mode', m); };

  const signIn = (rid) => { const r = ROLES[rid]; setRoleId(rid); Store.setScope(r.scopeFixed ? r.fixedScope : 'tenant'); setView({ type: 'dashboard', navId: 'dashboard' }); setGallery(false); };
  const signOut = () => { setRoleId(null); setGallery(false); };
  const switchRole = (rid) => { const r = ROLES[rid]; setRoleId(rid); Store.setScope(r.scopeFixed ? r.fixedScope : 'tenant'); setGallery(false); setRecord(null); setView(v => (v.navId !== 'dashboard' && !canAccess(rid, v.navId)) ? { type: 'dashboard', navId: 'dashboard' } : (v.type === 'detail' ? { type: 'list', navId: v.navId } : v)); };

  const navigate = (navId) => {
    setGallery(false); setRecord(null);
    const item = NAV.find(n => n.id === navId);
    const t = item ? item.template : 'list';
    if (t === 'dashboard') setView({ type: 'dashboard', navId });
    else if (t === 'subsidiaries') setView({ type: 'subsidiaries', navId });
    else if (t === 'rollup') setView({ type: 'rollup', navId });
    else if (t === 'audit') setView({ type: 'audit', navId });
    else setView({ type: 'list', navId });
  };

  const stateFor = (key) => pstate[key] ?? 'ready';
  const setStateFor = (key, s) => setPstate(prev => ({ ...prev, [key]: s }));

  /* open a record into the detail view, carrying the list's ordered ids for prev/next */
  const openRecord = (navId, row, orderedRows) => {
    setRecord(row);
    setNavList((orderedRows || [row]).map(r => r.id));
    setStateFor('detail:' + navId, 'ready');
    setView({ type: 'detail', navId });
  };
  const closeRecord = () => { setView(v => ({ type: 'list', navId: v.navId })); setRecord(null); };

  /* prev/next through the carried list (respects the filter/sort that produced it) */
  const navIndex = record ? navList.indexOf(record.id) : -1;
  const goRel = useAC((delta) => {
    if (view.type !== 'detail' || navIndex < 0) return;
    const ni = navIndex + delta;
    if (ni < 0 || ni >= navList.length) return;
    const lookup = LOOKUP[view.navId];
    const rec = lookup ? lookup(navList[ni]) : null;
    if (rec) { setRecord(rec); setStateFor('detail:' + view.navId, 'ready'); }
  }, [view, navIndex, navList]);

  const anyModal = form || leadForm || custForm || ticketForm || confirm;

  /* keyboard nav (Gmail-style): ↑/k prev · ↓/j next · ←/→ · Esc close — when a record is open */
  useAE(() => {
    if (view.type !== 'detail' || anyModal) return;
    const onKey = (e) => {
      const t = e.target;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'k') { e.preventDefault(); goRel(-1); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'j') { e.preventDefault(); goRel(1); }
      else if (e.key === 'Escape') { e.preventDefault(); closeRecord(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, anyModal, goRel]);

  if (!role) return (<><Login onSignIn={signIn} /><ToastHost /></>);

  const scopeName = scope === 'tenant' ? 'Whole tenant (roll-up)' : subName(st, scope);
  const navTab = view.navId;

  /* ---- builders ---- */
  const buildList = (navId, activeId) => {
    const ent = ENTITY_OF[navId];
    return <ListPage navId={navId} role={role} scope={scope} scopeName={scopeName} scopeLoading={scopeLoading}
      canWrite={canWrite(role.id, ent)} canCreate={canCreate(role.id, ent)} activeId={activeId}
      state={stateFor('list:' + navId)} onState={(s) => setStateFor('list:' + navId, s)}
      onCreate={() => navId === 'leads' ? setLeadForm({ mode: 'create' }) : navId === 'customers' ? setCustForm({ mode: 'create' }) : navId === 'tickets' ? setTicketForm(true) : setForm(navId)}
      onOpenRecord={(row, rows) => openRecord(navId, row, rows)} />;
  };
  const buildDetail = (navId) => {
    if (navId === 'leads') return <LeadDetail record={record} role={role} scope={scope} scopeName={scopeName} canWrite={canWrite(role.id, 'lead')}
      state={stateFor('detail:leads')} onState={(s) => setStateFor('detail:leads', s)} onBack={closeRecord}
      onEdit={(lead) => setLeadForm({ mode: 'edit', lead })}
      onConvert={(lead) => setConfirm({ kind: 'convert', leadId: lead.id, name: lead.name })} />;
    if (navId === 'customers') return <CustomerDetail record={record} role={role} scope={scope} scopeName={scopeName} canWrite={canWrite(role.id, 'customer')}
      state={stateFor('detail:customers')} onState={(s) => setStateFor('detail:customers', s)} onBack={closeRecord}
      onEdit={(cust) => setCustForm({ mode: 'edit', customer: cust })}
      canCreateTicket={canCreate(role.id, 'ticket')} onNewTicket={(name) => setTicketForm({ customer: name })}
      onOpenLead={(cust) => { const l = cust.originatingLeadId && Store.getLead(cust.originatingLeadId); if (l) openRecord('leads', l, [l]); else setView({ type: 'notfound', navId: 'customers' }); }}
      onOpenTicket={() => { setRecord(null); setView({ type: 'list', navId: 'tickets' }); }} />;
    if (navId === 'tickets') return <TicketDetail record={record} role={role} scope={scope} scopeName={scopeName} canWrite={canWrite(role.id, 'ticket')}
      state={stateFor('detail:tickets')} onState={(s) => setStateFor('detail:tickets', s)} onBack={closeRecord}
      onOpenCustomer={(name) => { const c = Store.get().customers.find(x => x.name === name); if (c) openRecord('customers', c, [c]); }} />;
    return null;
  };

  let content;
  if (gallery) content = <ComponentGallery />;
  else if (view.type === 'dashboard') content = <DashboardPage role={role} scope={scope} scopeName={scopeName} scopeLoading={scopeLoading} state={stateFor('dashboard')} onState={(s) => setStateFor('dashboard', s)} />;
  else if (view.type === 'subsidiaries') content = <SubsidiariesPage role={role} scope={scope} scopeName={scopeName} scopeLoading={scopeLoading} state={stateFor('subsidiaries')} onState={(s) => setStateFor('subsidiaries', s)} />;
  else if (view.type === 'rollup') content = <RollupPage role={role} scope={scope} scopeName={scopeName} scopeLoading={scopeLoading} state={stateFor('rollup')} onState={(s) => setStateFor('rollup', s)} onNotFound={() => setView({ type: 'notfound', navId: view.navId })} />;
  else if (view.type === 'notfound') content = <NotFoundView scopeName={scopeName} onHome={() => setView({ type: 'rollup', navId: 'rollup' })} />;
  else if (view.type === 'convert') content = <ConversionInspector leadId={view.leadId} role={role} scope={scope} scopeName={scopeName} actor={ACTOR_OF[role.id]}
      onBack={() => { setRecord(null); setView({ type: 'list', navId: 'leads' }); }}
      onOpenLead={() => { const l = Store.getLead(view.leadId); openRecord('leads', l, [l]); }}
      onOpenCustomer={(cust) => openRecord('customers', cust, [cust])} />;
  else if (view.type === 'notifications') content = <NotificationsPage role={role} scopeName={scopeName} />;
  else if (view.type === 'audit') content = <AuditLog role={role} scope={scope} scopeName={scopeName} scopeLoading={scopeLoading} state={stateFor('audit')} onState={(s) => setStateFor('audit', s)} />;
  else if (view.type === 'list') content = buildList(view.navId);
  else if (view.type === 'detail') {
    const pageable = !!LOOKUP[view.navId];
    const pager = pageable ? <RecordPager index={navIndex < 0 ? 0 : navIndex} total={navList.length || 1}
      onPrev={() => goRel(-1)} onNext={() => goRel(1)} viewMode={viewMode} onViewMode={setMode} onClose={closeRecord} label={NOUN_OF[view.navId]} /> : null;
    const detail = buildDetail(view.navId);
    if (viewMode === 'side' && pageable) {
      content = (
        <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
          <div style={{ flex: '1 1 0', minWidth: 320, overflow: 'auto', borderRight: '1px solid var(--iso-border)', background: 'var(--iso-blue-3-50)' }}>{buildList(view.navId, record?.id)}</div>
          <aside style={{ flex: '0 0 clamp(420px, 50%, 720px)', display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto', background: '#fff' }}>{pager}{detail}</aside>
        </div>
      );
    } else {
      content = <div>{pager}{detail}</div>;
    }
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `${collapsed ? 64 : 248}px 1fr`, gridTemplateRows: '64px 1fr',
      gridTemplateAreas: '"logo top" "nav main"', height: '100vh', background: 'var(--iso-blue-3-50)',
      transition: 'grid-template-columns var(--crm-base) var(--crm-ease-standard)',
    }}>
      <Sidebar role={role} current={navTab} collapsed={collapsed} onCollapse={() => setCollapsed(c => !c)} onNavigate={navigate} onOpenGallery={() => setGallery(true)} galleryOpen={gallery} />
      <Topbar role={role} scope={scope} onScope={Store.setScope} onSignOut={signOut} onSwitchRole={switchRole} onViewNotifications={() => { setGallery(false); setRecord(null); setView({ type: 'notifications', navId: view.navId }); }} />
      <main style={{ gridArea: 'main', overflow: viewMode === 'side' && view.type === 'detail' ? 'hidden' : 'auto', background: 'var(--iso-blue-3-50)' }}>
        {content}
      </main>

      {form && <EntityForm navId={form} onClose={() => setForm(null)} />}
      {leadForm && <LeadForm mode={leadForm.mode} lead={leadForm.lead} scope={scope} actor={ACTOR_OF[role.id]} onClose={() => setLeadForm(null)}
        onCreated={(lead) => openRecord('leads', lead, [lead])} />}
      {custForm && <CustomerForm mode={custForm.mode} customer={custForm.customer} scope={scope} actor={ACTOR_OF[role.id]} onClose={() => setCustForm(null)}
        onCreated={(cust) => openRecord('customers', cust, [cust])} />}
      {ticketForm && <TicketForm scope={scope} actor={ACTOR_OF[role.id]} presetCustomer={typeof ticketForm === 'object' ? ticketForm.customer : undefined} onClose={() => setTicketForm(false)}
        onCreated={(tk) => openRecord('tickets', tk, [tk])} />}

      <ConfirmDialog
        open={!!confirm}
        tone={confirm?.kind === 'delete' ? 'danger' : 'brand'}
        title={confirm?.kind === 'delete' ? 'Delete this record?' : 'Convert this lead?'}
        body={confirm?.kind === 'delete'
          ? 'This permanently removes the record and its activity timeline from the current scope. This can’t be undone.'
          : `Converting starts the conversion saga for ${confirm?.name || 'this lead'}: it creates a customer in prospect, links lineage both ways, and locks the lead as converted.`}
        confirmLabel={confirm?.kind === 'delete' ? 'Delete record' : 'Start conversion'}
        cancelLabel="Cancel"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const c = confirm; setConfirm(null);
          if (c.kind === 'delete') { setRecord(null); setView({ type: 'list', navId: c.navId }); pushToast({ tone: 'success', title: 'Record deleted.' }); }
          else { Store.clearSaga(c.leadId); setRecord(null); setView({ type: 'convert', leadId: c.leadId }); }
        }} />

      <ToastHost />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
