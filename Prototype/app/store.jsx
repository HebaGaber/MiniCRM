/* global React */
/* min-crm — central data store. Scope-aware. Single source of truth for the tenant,
   its subsidiaries, and all records. Plain external store + useSyncExternalStore. */

/* ---------------- status / priority / transition maps (shared across modules) ---------------- */
const STATUS_META = {
  lead: {
    new:          { tone: 'neutral', label: 'New' },
    contacted:    { tone: 'info',    label: 'Contacted' },
    qualified:    { tone: 'info',    label: 'Qualified' },
    disqualified: { tone: 'danger',  label: 'Disqualified' },
    converted:    { tone: 'success', label: 'Converted' },
  },
  customer: {
    prospect:   { tone: 'neutral', label: 'Prospect' },
    onboarding: { tone: 'info',    label: 'Onboarding' },
    active:     { tone: 'success', label: 'Active' },
    inactive:   { tone: 'warning', label: 'Inactive' },
    churned:    { tone: 'danger',  label: 'Churned' },
  },
  ticket: {
    open:        { tone: 'neutral', label: 'Open' },
    in_progress: { tone: 'info',    label: 'In progress' },
    pending:     { tone: 'warning', label: 'Pending' },
    resolved:    { tone: 'success', label: 'Resolved' },
    closed:      { tone: 'neutral', label: 'Closed' },
  },
};
const PRIORITY_META = {
  low:    { tone: 'neutral', label: 'Low' },
  medium: { tone: 'info',    label: 'Medium' },
  high:   { tone: 'warning', label: 'High' },
  urgent: { tone: 'danger',  label: 'Urgent' },
};
const TRANSITIONS = {
  lead:     { new: ['contacted', 'disqualified'], contacted: ['qualified', 'disqualified'], qualified: ['converted', 'disqualified'], disqualified: ['contacted'], converted: [] },
  customer: { prospect: ['onboarding'], onboarding: ['active'], active: ['inactive', 'churned'], inactive: ['active', 'churned'], churned: [] },
  ticket:   { open: ['in_progress', 'pending', 'closed'], in_progress: ['pending', 'resolved', 'open'], pending: ['in_progress', 'resolved'], resolved: ['closed', 'open'], closed: [] },
};
/* a record is "active" (eligible for reassignment on offboard) when not in a terminal/closed state */
const ACTIVE_STATES = { lead: ['new', 'contacted', 'qualified'], customer: ['prospect', 'onboarding', 'active', 'inactive'], ticket: ['open', 'in_progress', 'pending', 'resolved'] };
function isActiveRecord(entity, status) { return ACTIVE_STATES[entity].includes(status); }

/* ---------------- per-subsidiary default people ---------------- */
const SUB_PEOPLE = {
  eu:     { sales: 'Marco Ruiz',  support: 'Ingrid Solberg' },
  us:     { sales: 'Dana Lee',    support: 'Lena Bauer' },
  apac:   { sales: 'Wei Chen',    support: 'Arun Pillai' },
  parent: { sales: 'Sara Khan',   support: 'Sara Khan' },
};

/* map an owner/person back to their subsidiary (for new-lead placement + offboard re-scope) */
const OWNER_SUB = { 'Marco Ruiz': 'eu', 'Dana Lee': 'us', 'Wei Chen': 'apac', 'Sara Khan': 'parent' };
function leadOwners() { return ['Marco Ruiz', 'Dana Lee', 'Wei Chen', 'Sara Khan']; }

/* ---------------- timeline helpers (audit-as-feature) ---------------- */
let _clock = Date.UTC(2026, 5, 6, 14, 30);
function fmtAbs(t) {
  const d = new Date(t);
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];
  const hh = String(d.getUTCHours()).padStart(2, '0'), mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCDate()} ${mon} 2026 · ${hh}:${mm}`;
}
function mkEvent(actor, sentence, icon, tone, daysAgo, kind) {
  const t = _clock - (daysAgo || 0) * 86400000;
  return { id: nid('ev'), actor, sentence, icon, tone: tone || 'neutral', at: t, abs: fmtAbs(t), kind: kind || 'status' };
}
function buildLeadTimeline(owner, status) {
  const ev = [mkEvent('System', 'created this lead', 'plus-circle', 'neutral', 4)];
  if (status === 'contacted') ev.push(mkEvent(owner, 'moved this lead to contacted', 'repeat', 'info', 2));
  if (status === 'qualified') { ev.push(mkEvent(owner, 'moved this lead to contacted', 'repeat', 'info', 3)); ev.push(mkEvent(owner, 'moved this lead to qualified', 'repeat', 'info', 1)); }
  if (status === 'disqualified') ev.push(mkEvent(owner, 'moved this lead to disqualified', 'x-circle', 'danger', 1));
  if (status === 'converted') { ev.push(mkEvent(owner, 'moved this lead to qualified', 'repeat', 'info', 3)); ev.push(mkEvent(owner, 'converted this lead to a customer', 'check-circle', 'success', 1)); }
  return ev;
}
/* customer timeline interleaves conversion lineage (if any) with ticket lifecycle events */
function buildCustomerTimeline(owner, status, lead) {
  const ev = [];
  if (lead) {
    ev.push(mkEvent('System', `converted from lead ${lead}`, 'git-merge', 'success', 6, 'conversion'));
    ev.push(mkEvent(owner, 'created this customer in status prospect', 'plus-circle', 'neutral', 6));
  } else {
    ev.push(mkEvent(owner, 'created this customer', 'plus-circle', 'neutral', 6));
  }
  if (['onboarding', 'active', 'inactive', 'churned'].includes(status)) ev.push(mkEvent(owner, 'moved this customer to onboarding', 'repeat', 'info', 4));
  if (['onboarding', 'active', 'inactive', 'churned'].includes(status)) ev.push(mkEvent(owner, 'opened a ticket: onboarding checklist', 'life-buoy', 'info', 3, 'ticket'));
  if (['active', 'inactive', 'churned'].includes(status)) ev.push(mkEvent(owner, 'moved this customer to active', 'repeat', 'success', 2));
  if (['active', 'inactive', 'churned'].includes(status)) ev.push(mkEvent('Lena Bauer', 'resolved a ticket: onboarding checklist', 'check-circle', 'success', 1, 'ticket'));
  if (status === 'inactive') ev.push(mkEvent(owner, 'moved this customer to inactive', 'repeat', 'warning', 0));
  if (status === 'churned') ev.push(mkEvent(owner, 'moved this customer to churned', 'x-circle', 'danger', 0));
  return ev;
}

/* support users (for ticket assignment) keyed by subsidiary */
const SUPPORT_SUB = { 'Ingrid Solberg': 'eu', 'Lena Bauer': 'us', 'Arun Pillai': 'apac', 'Sara Khan': 'parent' };
function supportUsersInScope(scope) {
  const all = Object.keys(SUPPORT_SUB);
  if (scope === 'tenant') return all;
  return all.filter(u => SUPPORT_SUB[u] === scope || SUPPORT_SUB[u] === 'parent');
}

function buildTicketTimeline(assignee, status) {
  const ev = [mkEvent('System', 'opened this ticket', 'plus-circle', 'neutral', 5)];
  ev.push(mkEvent('System', `assigned this ticket to ${assignee}`, 'user-check', 'info', 5, 'assign'));
  if (['in_progress', 'pending', 'resolved', 'closed'].includes(status)) ev.push(mkEvent(assignee, 'moved this ticket to in progress', 'repeat', 'info', 4));
  if (status === 'pending') ev.push(mkEvent(assignee, 'moved this ticket to pending (SLA paused)', 'pause-circle', 'warning', 2));
  if (['resolved', 'closed'].includes(status)) ev.push(mkEvent(assignee, 'moved this ticket to resolved', 'check-circle', 'success', 2));
  if (status === 'closed') ev.push(mkEvent(assignee, 'moved this ticket to closed', 'lock', 'neutral', 1));
  return ev;
}

/* ---------------- seed ---------------- */
let _seq = 0;
const nid = (p) => `${p}_${(++_seq).toString(36)}`;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

function mkLead(sub, name, company, status, source) {
  return { id: nid('lead'), subsidiaryId: sub, name, company,
    email: `${slug(name)}@${slug(company)}.com`, phone: '+49 30 55 0' + (10 + (_seq % 80)),
    source, owner: SUB_PEOPLE[sub].sales, bant: 'Budget approved; authority confirmed; need within the quarter.',
    status, updated: '5 Jun', timeline: buildLeadTimeline(SUB_PEOPLE[sub].sales, status) };
}
function mkCustomer(sub, name, status, lead) {
  const owner = SUB_PEOPLE[sub].sales;
  const activated = ['active', 'inactive', 'churned'].includes(status);
  return { id: nid('cust'), subsidiaryId: sub, name,
    primaryEmail: `ops@${slug(name)}.com`, phone: '+1 312 555 0' + (10 + (_seq % 80)),
    taxId: activated ? `VAT-${slug(name).slice(0, 5).toUpperCase()}-${100 + (_seq % 900)}` : '',
    contactAddress: activated ? `${10 + (_seq % 80)} Commerce Avenue, ${SUB_PEOPLE[sub] ? sub.toUpperCase() : ''} office` : '',
    status, originatingLead: lead || null, originatingLeadId: null, owner, updated: '5 Jun',
    timeline: buildCustomerTimeline(owner, status, lead) };
}
function mkTicket(sub, customer, subject, priority, status) {
  const assignee = SUB_PEOPLE[sub].support;
  return { id: nid('tick'), subsidiaryId: sub, customer, subject,
    description: 'Reported via email. Reproduced on latest build.', priority,
    assignee, status, updated: '5 Jun', timeline: buildTicketTimeline(assignee, status) };
}

function seed() {
  const subsidiaries = [
    { id: 'eu',   name: 'EU subsidiary',   parentId: null, region: 'Frankfurt', created: '12 Jan 2026', active: true },
    { id: 'us',   name: 'US subsidiary',   parentId: null, region: 'Chicago',   created: '3 Feb 2026',  active: true },
    { id: 'apac', name: 'APAC subsidiary', parentId: 'eu', region: 'Singapore', created: '21 Mar 2026', active: true },
  ];
  const leads = [
    mkLead('eu', 'Avery Stone', 'Helix Labs', 'qualified', 'web'),
    mkLead('eu', 'Priya Nadar', 'Orbital Freight', 'contacted', 'referral'),
    mkLead('eu', 'Tomás Vidal', 'Brightwell', 'new', 'event'),
    mkLead('eu', 'Noor Haddad', 'Cedar & Vale', 'disqualified', 'outbound'),
    mkLead('eu', 'Hugo Reyes', 'Northgate Mills', 'converted', 'referral'),
    mkLead('eu', 'Lina Fält', 'Aubergine', 'contacted', 'web'),
    mkLead('us', 'Dana Brooks', 'Pinemark', 'new', 'import'),
    mkLead('us', 'Carl Jin', 'Vega Logistics', 'qualified', 'web'),
    mkLead('us', 'Rosa Méndez', 'Tallgrass', 'contacted', 'event'),
    mkLead('us', 'Owen Pratt', 'Lumen Retail', 'disqualified', 'outbound'),
    mkLead('us', 'Mabel Ote', 'Cobalt Health', 'new', 'web'),
    mkLead('apac', 'Hiro Tan', 'Marlow & Co', 'contacted', 'referral'),
    mkLead('apac', 'Sun-Hee Park', 'Delta Foods', 'qualified', 'web'),
    mkLead('apac', 'Ravi Anand', 'Pertex', 'new', 'event'),
  ];
  const customers = [
    mkCustomer('eu', 'Helix Labs', 'active', 'Avery Stone'),
    mkCustomer('eu', 'Northgate Mills', 'onboarding', 'Hugo Reyes'),
    mkCustomer('eu', 'Saffron Bank', 'active'),
    mkCustomer('eu', 'Wexler Group', 'inactive'),
    mkCustomer('us', 'Pinemark', 'prospect'),
    mkCustomer('us', 'Lumen Retail', 'active'),
    mkCustomer('us', 'Cobalt Health', 'churned'),
    mkCustomer('apac', 'Delta Foods', 'active'),
    mkCustomer('apac', 'Marlow & Co', 'onboarding'),
    mkCustomer('parent', 'Northwind Holdings', 'active'),
    mkCustomer('parent', 'Northwind R&D', 'active'),
  ];
  const tickets = [
    mkTicket('eu', 'Helix Labs', 'Login MFA loop on SSO', 'urgent', 'in_progress'),
    mkTicket('eu', 'Saffron Bank', 'Export to CSV fails over 10k rows', 'high', 'open'),
    mkTicket('eu', 'Helix Labs', 'Rename a saved view', 'low', 'pending'),
    mkTicket('eu', 'Northgate Mills', 'Webhook retries duplicate', 'medium', 'resolved'),
    mkTicket('eu', 'Wexler Group', 'Billing address change', 'low', 'closed'),
    mkTicket('us', 'Lumen Retail', 'API rate limit unclear', 'medium', 'open'),
    mkTicket('us', 'Pinemark', 'Onboarding checklist stuck', 'high', 'in_progress'),
    mkTicket('us', 'Lumen Retail', 'SAML metadata mismatch', 'urgent', 'pending'),
    mkTicket('us', 'Cobalt Health', 'Data export request', 'low', 'closed'),
    mkTicket('apac', 'Delta Foods', 'Timezone on reports wrong', 'medium', 'open'),
    mkTicket('apac', 'Marlow & Co', 'Invite emails not received', 'high', 'resolved'),
  ];
  const notifications = [
    { id: nid('ntf'), to: 'Lena Bauer', icon: 'user-plus', tone: 'info', text: 'A ticket was assigned to you: SAML metadata mismatch.', at: Date.UTC(2026, 5, 6, 13, 50), unread: true },
    { id: nid('ntf'), to: 'Lena Bauer', icon: 'alert-triangle', tone: 'warning', text: 'Ticket “Onboarding checklist stuck” is high priority.', at: Date.UTC(2026, 5, 6, 11, 0), unread: true },
    { id: nid('ntf'), to: 'Marco Ruiz', icon: 'user-plus', tone: 'info', text: 'A lead was added to your queue.', at: Date.UTC(2026, 5, 6, 9, 30), unread: true },
    { id: nid('ntf'), to: 'Sara Khan', icon: 'check-circle', tone: 'success', text: 'Customer record merge completed.', at: Date.UTC(2026, 5, 5, 16, 0), unread: false },
  ];
  const audit = [
    mkAudit('Sara Khan', 'permission.change', 'subsidiary', 'EU subsidiary', 'eu', { role: 'sales_agent' }, { role: 'tenant_admin' }, 0.2),
    mkAudit('Marco Ruiz', 'lead.transition', 'lead', 'Avery Stone', 'eu', { status: 'contacted' }, { status: 'qualified' }, 0.5),
    mkAudit('Lena Bauer', 'ticket.assign', 'ticket', 'SAML metadata mismatch', 'us', { assignee: 'Unassigned' }, { assignee: 'Lena Bauer' }, 0.7),
    mkAudit('Lena Bauer', 'ticket.transition', 'ticket', 'Invite emails not received', 'apac', { status: 'in_progress' }, { status: 'resolved' }, 1.1),
    mkAudit('Dana Lee', 'customer.transition', 'customer', 'Lumen Retail', 'us', { status: 'onboarding' }, { status: 'active' }, 1.4),
    mkAudit('Sara Khan', 'subsidiary.offboard', 'subsidiary', 'LATAM subsidiary', 'tenant', { active: true }, { active: false }, 2.0),
    mkAudit('Marco Ruiz', 'lead.create', 'lead', 'Tomás Vidal', 'eu', null, { status: 'new' }, 2.3),
    mkAudit('Lena Bauer', 'ticket.create', 'ticket', 'API rate limit unclear', 'us', null, { status: 'open' }, 2.6),
  ];
  return { subsidiaries, leads, customers, tickets, notifications, audit, sagas: {}, scope: 'tenant', scopeLoading: false };
}

let _auditClock = Date.UTC(2026, 5, 6, 14, 30);
function mkAudit(actor, action, entity, recordLabel, scope, before, after, daysAgo) {
  const t = _auditClock - (daysAgo || 0) * 86400000;
  return { id: nid('aud'), actor, action, entity, recordLabel, scope, before, after, at: t, abs: fmtAbs(t) };
}

/* ---------------- external store ---------------- */
const Store = (function () {
  let state = seed();
  const listeners = new Set();
  let scopeTimer = null;
  const get = () => state;
  const set = (patch) => { state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }; listeners.forEach(l => l()); };
  const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };

  function setScope(scope) {
    clearTimeout(scopeTimer);
    set({ scope, scopeLoading: true });
    const ms = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--crm-base')) || 200;
    scopeTimer = setTimeout(() => set({ scopeLoading: false }), ms + 220);
  }
  function onboard({ name, parentId }) {
    const sub = { id: nid('sub'), name, parentId: parentId === 'top' ? null : parentId, region: 'New region', created: todayStr(), active: true };
    set(s => ({ subsidiaries: [sub, ...s.subsidiaries] }));
    return sub;
  }
  /* compute what an offboard of subId would move */
  function offboardImpact(subId) {
    const s = state;
    const count = (arr, ent) => arr.filter(r => r.subsidiaryId === subId && isActiveRecord(ent, r.status)).length;
    return { leads: count(s.leads, 'lead'), customers: count(s.customers, 'customer'), tickets: count(s.tickets, 'ticket') };
  }
  /* commit: soft-delete + reassign active records to target ('parent' or a subsidiaryId) */
  function commitOffboard(subId, targetId) {
    set(s => {
      const reassign = (arr, ent) => arr.map(r => {
        if (r.subsidiaryId !== subId || !isActiveRecord(ent, r.status)) return r;
        const person = SUB_PEOPLE[targetId] || SUB_PEOPLE.parent;
        const patch = { ...r, subsidiaryId: targetId };
        if (ent === 'ticket') patch.assignee = person.support;
        else patch.owner = person.sales;
        return patch;
      });
      return {
        subsidiaries: s.subsidiaries.map(x => x.id === subId ? { ...x, active: false } : x),
        leads: reassign(s.leads, 'lead'),
        customers: reassign(s.customers, 'customer'),
        tickets: reassign(s.tickets, 'ticket'),
      };
    });
  }
  function getLead(id) { return state.leads.find(l => l.id === id); }
  const shortToday = () => '6 Jun';
  function createLead(data, scope, actor) {
    const sub = data.subsidiaryId || OWNER_SUB[data.owner] || (scope !== 'tenant' ? scope : 'eu');
    const lead = { id: nid('lead'), subsidiaryId: sub, name: data.name, company: data.company || '', email: data.email || '',
      phone: data.phone || '', source: data.source, owner: data.owner, bant: data.bant || '', status: 'new', updated: shortToday(),
      timeline: [mkEvent(actor || 'You', 'created this lead', 'plus-circle', 'neutral', 0)] };
    set(s => ({ leads: [lead, ...s.leads] }));
    return lead;
  }
  function removeLead(id) { set(s => ({ leads: s.leads.filter(l => l.id !== id) })); }
  function editLead(id, patch, actor) {
    set(s => ({ leads: s.leads.map(l => l.id === id ? { ...l, ...patch, updated: shortToday(), timeline: [...l.timeline, mkEvent(actor || 'You', 'updated the lead details', 'pencil', 'neutral', 0)] } : l) }));
  }
  /* state machine: returns {ok} or {ok:false, allowed, from} for an illegal move */
  function transitionLead(id, to, actor) {
    const lead = state.leads.find(l => l.id === id); if (!lead) return { ok: false };
    const allowed = TRANSITIONS.lead[lead.status] || [];
    if (!allowed.includes(to)) return { ok: false, allowed, from: lead.status };
    const meta = STATUS_META.lead[to];
    set(s => ({ leads: s.leads.map(l => l.id === id ? { ...l, status: to, updated: shortToday(),
      timeline: [...l.timeline, mkEvent(actor || 'You', `moved this lead to ${meta.label.toLowerCase()}`, to === 'disqualified' ? 'x-circle' : 'repeat', meta.tone, 0)] } : l) }));
    return { ok: true };
  }
  function convertLead(id, actor) {
    const lead = state.leads.find(l => l.id === id); if (!lead || lead.status !== 'qualified') return { ok: false };
    const cust = { id: nid('cust'), subsidiaryId: lead.subsidiaryId, name: lead.company || lead.name,
      primaryEmail: lead.email || `ops@${slug(lead.company || lead.name)}.com`, phone: lead.phone || '', status: 'prospect',
      originatingLead: lead.name, owner: lead.owner, updated: shortToday() };
    set(s => ({ leads: s.leads.map(l => l.id === id ? { ...l, status: 'converted', updated: shortToday(),
      timeline: [...l.timeline, mkEvent(actor || 'You', 'converted this lead to a customer', 'check-circle', 'success', 0)] } : l), customers: [cust, ...s.customers] }));
    return { ok: true, customer: cust };
  }
  function getCustomer(id) { return state.customers.find(c => c.id === id); }
  function createCustomer(data, scope, actor) {
    const sub = data.subsidiaryId || OWNER_SUB[data.owner] || (scope !== 'tenant' ? scope : 'eu');
    const cust = { id: nid('cust'), subsidiaryId: sub, name: data.name, primaryEmail: data.primaryEmail || '', phone: data.phone || '',
      taxId: data.taxId || '', contactAddress: data.contactAddress || '',
      status: 'prospect', originatingLead: null, originatingLeadId: null, owner: data.owner || SUB_PEOPLE[sub].sales, updated: shortToday(),
      timeline: [mkEvent(actor || 'You', 'created this customer in status prospect', 'plus-circle', 'neutral', 0)] };
    set(s => ({ customers: [cust, ...s.customers] }));
    return cust;
  }
  function removeCustomer(id) { set(s => ({ customers: s.customers.filter(c => c.id !== id) })); }
  function ticketsForCustomer(name) { return state.tickets.filter(t => t.customer === name); }
  function editCustomer(id, patch, actor) {
    set(s => ({ customers: s.customers.map(c => c.id === id ? { ...c, ...patch, updated: shortToday(), timeline: [...(c.timeline || []), mkEvent(actor || 'You', 'updated the customer details', 'pencil', 'neutral', 0)] } : c) }));
  }
  function transitionCustomer(id, to, actor) {
    const cust = state.customers.find(c => c.id === id); if (!cust) return { ok: false };
    const allowed = TRANSITIONS.customer[cust.status] || [];
    if (!allowed.includes(to)) return { ok: false, allowed, from: cust.status };
    /* activation gate: a customer can't be activated without a tax registration number + contact address */
    if (to === 'active' && (!cust.taxId || !cust.contactAddress)) {
      const missing = [!cust.taxId && 'tax registration number', !cust.contactAddress && 'contact address'].filter(Boolean).join(' and ');
      return { ok: false, gate: true, reason: `Add a ${missing} before activating this customer. Edit the customer to fill it in, then activate.` };
    }
    const meta = STATUS_META.customer[to];
    const icon = to === 'churned' ? 'x-circle' : to === 'inactive' ? 'pause-circle' : to === 'active' ? 'check-circle' : 'repeat';
    set(s => ({ customers: s.customers.map(c => c.id === id ? { ...c, status: to, updated: shortToday(),
      timeline: [...(c.timeline || []), mkEvent(actor || 'You', `moved this customer to ${meta.label.toLowerCase()}`, icon, meta.tone, 0)] } : c) }));
    return { ok: true };
  }

  /* ---- conversion saga ---- */
  function getSaga(leadId) { return state.sagas[leadId] || null; }
  function setSaga(leadId, patch) { set(s => ({ sagas: { ...s.sagas, [leadId]: { ...(s.sagas[leadId] || {}), ...patch } } })); }
  function clearSaga(leadId) { set(s => { const n = { ...s.sagas }; delete n[leadId]; return { sagas: n }; }); }
  /* atomic commit — create customer (prospect), link lineage both ways, lock lead, add ONE linked
     conversion entry to BOTH timelines. Returns {ok, customer} or {ok:false, reason:'409'}. */
  function commitConversion(leadId, actor) {
    const lead = state.leads.find(l => l.id === leadId);
    if (!lead) return { ok: false, reason: 'missing' };
    if (lead.status === 'converted') return { ok: false, reason: '409' }; // record changed
    if (lead.status !== 'qualified') return { ok: false, reason: 'ineligible' };
    const custId = nid('cust');
    const convEntry = (sentence) => mkEvent(actor || 'You', sentence, 'git-merge', 'success', 0, 'conversion');
    const cust = { id: custId, subsidiaryId: lead.subsidiaryId, name: lead.company || lead.name,
      primaryEmail: lead.email || `ops@${slug(lead.company || lead.name)}.com`, phone: lead.phone || '', status: 'prospect',
      originatingLead: lead.name, originatingLeadId: lead.id, owner: lead.owner, updated: shortToday(),
      timeline: [convEntry(`converted from lead ${lead.name}`), mkEvent(actor || 'You', 'created this customer in status prospect', 'plus-circle', 'neutral', 0)] };
    set(s => ({
      customers: [cust, ...s.customers],
      leads: s.leads.map(l => l.id === leadId ? { ...l, status: 'converted', convertedTo: custId, updated: shortToday(),
        timeline: [...l.timeline, convEntry(`converted this lead to customer ${cust.name}`)] } : l),
      sagas: (() => { const n = { ...s.sagas }; delete n[leadId]; return n; })(),
    }));
    logAudit({ actor: actor || 'You', action: 'conversion', entity: 'lead', recordLabel: lead.name, scope: lead.subsidiaryId, before: { status: 'qualified' }, after: { status: 'converted', customer: cust.name } });
    if (lead.owner && lead.owner !== actor) notify(lead.owner, `A lead you own converted: ${lead.name} → ${cust.name}.`, 'git-merge', 'success');
    return { ok: true, customer: cust };
  }
  function eligibility(leadId) {
    const lead = state.leads.find(l => l.id === leadId);
    if (!lead) return { ok: false, reason: 'This lead no longer exists.' };
    if (lead.status === 'converted') return { ok: false, reason: 'This lead is already converted. Open the linked customer instead.' };
    if (lead.status !== 'qualified') return { ok: false, reason: `Only qualified leads can be converted. This lead is ${STATUS_META.lead[lead.status].label.toLowerCase()} — move it to qualified first.` };
    return { ok: true };
  }

  /* ---- notifications + audit ---- */
  function notify(to, text, icon, tone) {
    const n = { id: nid('ntf'), to, text, icon: icon || 'bell', tone: tone || 'info', at: Date.now(), unread: true };
    set(s => ({ notifications: [n, ...s.notifications] }));
    return n;
  }
  function notificationsFor(user) { return state.notifications.filter(n => n.to === user); }
  function markNotificationsRead(user) { set(s => ({ notifications: s.notifications.map(n => n.to === user ? { ...n, unread: false } : n) })); }
  function markOneRead(id) { set(s => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, unread: false } : n) })); }
  function logAudit(rec) {
    const a = { id: nid('aud'), at: Date.now(), abs: fmtAbs(Date.now()), before: null, after: null, ...rec };
    set(s => ({ audit: [a, ...s.audit] }));
    return a;
  }
  /* matrix gate: admin = all; sales/support = only rows they acted on; viewer = none (caller hides nav) */
  function auditFor(roleId, user) {
    if (roleId === 'tenant_admin') return state.audit;
    if (roleId === 'viewer') return [];
    return state.audit.filter(a => a.actor === user);
  }

  /* ---- tickets ---- */
  function getTicket(id) { return state.tickets.find(t => t.id === id); }
  const TICKET_GATE = ['active', 'onboarding']; // customer-state gate for ticket creation
  function canOpenTicketFor(customerName) {
    const c = state.customers.find(x => x.name === customerName);
    if (!c) return { ok: false, reason: 'Choose a customer first.' };
    if (!TICKET_GATE.includes(c.status)) return { ok: false, status: c.status, reason: `This customer is ${STATUS_META.customer[c.status].label.toLowerCase()}. A ticket can be opened only when the customer is active or onboarding — move the customer to active first.` };
    return { ok: true, customer: c };
  }
  function createTicket(data, actor) {
    const gate = canOpenTicketFor(data.customer);
    if (!gate.ok) return { ok: false, reason: gate.reason };
    const sub = gate.customer.subsidiaryId; // inherit customer's tenant/subsidiary
    const assignee = data.assignee || SUB_PEOPLE[sub]?.support || 'Sara Khan';
    const tick = { id: nid('tick'), subsidiaryId: sub, customer: data.customer, subject: data.subject,
      description: data.description || '', priority: data.priority, assignee, status: 'open', updated: shortToday(),
      timeline: [mkEvent(actor || 'You', 'opened this ticket', 'plus-circle', 'neutral', 0), mkEvent(actor || 'You', `assigned this ticket to ${assignee}`, 'user-check', 'info', 0, 'assign')] };
    set(s => ({ tickets: [tick, ...s.tickets] }));
    logAudit({ actor: actor || 'You', action: 'ticket.create', entity: 'ticket', recordLabel: tick.subject, scope: sub, before: null, after: { status: 'open' } });
    if (assignee !== actor) notify(assignee, `A ticket was assigned to you: ${tick.subject}.`, 'user-plus', 'info');
    return { ok: true, ticket: tick };
  }
  function removeTicket(id) { set(s => ({ tickets: s.tickets.filter(t => t.id !== id) })); }
  function editTicket(id, patch, actor) {
    set(s => ({ tickets: s.tickets.map(t => t.id === id ? { ...t, ...patch, updated: shortToday(), timeline: [...(t.timeline || []), mkEvent(actor || 'You', 'updated the ticket details', 'pencil', 'neutral', 0)] } : t) }));
  }
  function transitionTicket(id, to, actor) {
    const tk = state.tickets.find(t => t.id === id); if (!tk) return { ok: false };
    const allowed = TRANSITIONS.ticket[tk.status] || [];
    if (!allowed.includes(to)) return { ok: false, allowed, from: tk.status };
    const meta = STATUS_META.ticket[to];
    const icon = to === 'closed' ? 'lock' : to === 'resolved' ? 'check-circle' : to === 'pending' ? 'pause-circle' : 'repeat';
    const sentence = to === 'pending' ? 'moved this ticket to pending (SLA paused)' : `moved this ticket to ${meta.label.toLowerCase()}`;
    const before = tk.status;
    set(s => ({ tickets: s.tickets.map(t => t.id === id ? { ...t, status: to, updated: shortToday(), timeline: [...(t.timeline || []), mkEvent(actor || 'You', sentence, icon, meta.tone, 0)] } : t) }));
    logAudit({ actor: actor || 'You', action: 'ticket.transition', entity: 'ticket', recordLabel: tk.subject, scope: tk.subsidiaryId, before: { status: before }, after: { status: to } });
    return { ok: true };
  }
  function assignTicket(id, assignee, actor) {
    const tk = state.tickets.find(t => t.id === id); if (!tk) return { ok: false };
    const before = tk.assignee;
    if (before === assignee) return { ok: true };
    set(s => ({ tickets: s.tickets.map(t => t.id === id ? { ...t, assignee, updated: shortToday(), timeline: [...(t.timeline || []), mkEvent(actor || 'You', `assigned this ticket to ${assignee}`, 'user-check', 'info', 0, 'assign')] } : t) }));
    logAudit({ actor: actor || 'You', action: 'ticket.assign', entity: 'ticket', recordLabel: tk.subject, scope: tk.subsidiaryId, before: { assignee: before || 'Unassigned' }, after: { assignee } });
    if (assignee !== actor) notify(assignee, `A ticket was assigned to you: ${tk.subject}.`, 'user-plus', 'info');
    return { ok: true };
  }

  return { get, set, subscribe, setScope, onboard, offboardImpact, commitOffboard,
    getLead, createLead, removeLead, editLead, transitionLead, convertLead,
    getCustomer, createCustomer, removeCustomer, ticketsForCustomer, editCustomer, transitionCustomer,
    getSaga, setSaga, clearSaga, commitConversion, eligibility,
    notify, notificationsFor, markNotificationsRead, markOneRead, logAudit, auditFor,
    getTicket, canOpenTicketFor, createTicket, removeTicket, editTicket, transitionTicket, assignTicket };
})();

function todayStr() {
  const d = new Date(2026, 5, 6);
  return `${d.getDate()} Jun 2026`;
}

/* ---------------- hooks + selectors ---------------- */
function useStore() { return React.useSyncExternalStore(Store.subscribe, Store.get); }

function inScope(rec, scope) { return scope === 'tenant' ? true : (rec.subsidiaryId === scope || rec.subsidiaryId === 'parent'); }
function activeSubs(state) { return state.subsidiaries.filter(s => s.active); }
function recordsFor(state, entity, scope) {
  const key = entity === 'lead' ? 'leads' : entity === 'customer' ? 'customers' : 'tickets';
  // hide records belonging to offboarded subsidiaries (they'd have been reassigned, but guard anyway)
  const activeIds = new Set(activeSubs(state).map(s => s.id).concat('parent'));
  return state[key].filter(r => activeIds.has(r.subsidiaryId) && inScope(r, scope));
}
function subName(state, id) {
  if (id === 'parent') return 'Parent level';
  const s = state.subsidiaries.find(x => x.id === id);
  return s ? s.name : id;
}
/* roll-up: counts per visible subsidiary (+ parent) per entity, respecting scope */
function rollup(state, scope) {
  const subs = scope === 'tenant' ? activeSubs(state) : activeSubs(state).filter(s => s.id === scope);
  const rows = subs.map(s => ({
    id: s.id, name: s.name,
    leads: state.leads.filter(r => r.subsidiaryId === s.id).length,
    customers: state.customers.filter(r => r.subsidiaryId === s.id).length,
    tickets: state.tickets.filter(r => r.subsidiaryId === s.id).length,
  }));
  // parent-level (shared) row — always visible
  const parent = {
    id: 'parent', name: 'Parent level (shared)',
    leads: state.leads.filter(r => r.subsidiaryId === 'parent').length,
    customers: state.customers.filter(r => r.subsidiaryId === 'parent').length,
    tickets: state.tickets.filter(r => r.subsidiaryId === 'parent').length,
  };
  rows.push(parent);
  return rows;
}

Object.assign(window, {
  Store, useStore, STATUS_META, PRIORITY_META, TRANSITIONS, ACTIVE_STATES, isActiveRecord,
  SUB_PEOPLE, OWNER_SUB, leadOwners, supportUsersInScope, inScope, activeSubs, recordsFor, subName, rollup, todayStr,
});
