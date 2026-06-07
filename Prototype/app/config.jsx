/* global window */
/* min-crm — static configuration: tenant, subsidiaries, roles, nav access. */

const TENANT = { id: 'northwind', name: 'Northwind Trading' };

const SUBSIDIARIES = [
  { id: 'eu',   name: 'EU subsidiary',   region: 'Frankfurt' },
  { id: 'us',   name: 'US subsidiary',   region: 'Chicago' },
  { id: 'apac', name: 'APAC subsidiary', region: 'Singapore' },
];

/* Roles. scopeFixed = the agent is pinned to one subsidiary and sees no switcher choices.
   write = may create/edit/transition records (viewer is read-only). */
const ROLES = {
  tenant_admin:  { id: 'tenant_admin',  label: 'Tenant admin',  short: 'Admin',   scopeFixed: false, fixedScope: null,   color: 'var(--iso-brand)',       write: true },
  sales_agent:   { id: 'sales_agent',   label: 'Sales agent',   short: 'Sales',   scopeFixed: true,  fixedScope: 'eu',   color: 'var(--iso-blue-3-400)',  write: true },
  support_agent: { id: 'support_agent', label: 'Support agent', short: 'Support', scopeFixed: true,  fixedScope: 'us',   color: 'var(--iso-green-400)',   write: true },
  viewer:        { id: 'viewer',        label: 'Viewer',        short: 'Viewer',  scopeFixed: true,  fixedScope: 'eu',   color: 'var(--iso-n-600)',       write: false },
};

/* Per-module write capability. Support is LEAD-BLIND; sales is READ-ONLY on tickets; viewer read-only everywhere. */
function canWrite(roleId, entity) {
  if (roleId === 'viewer') return false;
  if (entity === 'lead') return roleId === 'tenant_admin' || roleId === 'sales_agent';
  if (entity === 'ticket') return roleId === 'tenant_admin' || roleId === 'support_agent';
  return roleId === 'tenant_admin' || roleId === 'sales_agent' || roleId === 'support_agent';
}

/* Per-module create capability. Tickets can be created by ANY role (everyone can raise a ticket
   and link it to a customer); create otherwise follows write. */
function canCreate(roleId, entity) {
  if (entity === 'ticket') return true;
  return canWrite(roleId, entity);
}

/* Nav. roles[] = which roles may see/reach the destination (role-gating). group = sidebar section. */
const NAV = [
  { id: 'dashboard',    label: 'Dashboard',      icon: 'layout-dashboard', roles: ['tenant_admin', 'sales_agent', 'support_agent', 'viewer'], group: 'workspace', template: 'dashboard' },
  { id: 'leads',        label: 'Leads',          icon: 'user-plus',        roles: ['tenant_admin', 'sales_agent', 'viewer'],                  group: 'workspace', template: 'list' },
  { id: 'customers',    label: 'Customers',      icon: 'building-2',       roles: ['tenant_admin', 'sales_agent', 'support_agent', 'viewer'], group: 'workspace', template: 'list' },
  { id: 'tickets',      label: 'Tickets',        icon: 'life-buoy',        roles: ['tenant_admin', 'sales_agent', 'support_agent', 'viewer'], group: 'workspace', template: 'list' },
  { id: 'subsidiaries', label: 'Subsidiaries',   icon: 'network',          roles: ['tenant_admin'],                                 group: 'tenancy',   template: 'subsidiaries' },
  { id: 'rollup',       label: 'Roll-up',        icon: 'layers',           roles: ['tenant_admin'],                                 group: 'tenancy',   template: 'rollup' },
  { id: 'audit',        label: 'Audit & events', icon: 'scroll-text',      roles: ['tenant_admin', 'sales_agent', 'support_agent'], group: 'tenancy',   template: 'audit' },
];

const NAV_GROUPS = [{ id: 'workspace', label: 'Workspace' }, { id: 'tenancy', label: 'Tenancy' }];

function navFor(roleId) { return NAV.filter(n => n.roles.includes(roleId)); }
function canAccess(roleId, navId) { const n = NAV.find(x => x.id === navId); return n ? n.roles.includes(roleId) : false; }

Object.assign(window, { TENANT, SUBSIDIARIES, ROLES, NAV, NAV_GROUPS, navFor, canAccess, canWrite, canCreate });
