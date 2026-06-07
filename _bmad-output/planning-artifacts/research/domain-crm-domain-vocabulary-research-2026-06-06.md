---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: ['_bmad-output/brainstorming/brainstorming-session-2026-06-06.md', '_bmad-output/project-context.md']
workflowType: 'research'
lastStep: 6
research_type: 'domain'
research_topic: 'CRM domain vocabulary, rules & best practices (lead management, lead-to-customer conversion, ticketing, multi-tenant org modeling, roles & permissions) for min-crm'
research_goals: 'Establish shared, unambiguous domain terminology + recommended status sets/transitions + role→permission expectations for the PRD and stories; flag conflicts with the current min-crm standard'
user_name: 'Heba'
date: '2026-06-06'
web_research_enabled: true
source_verification: true
---

# Research Report: domain

**Date:** 2026-06-06
**Author:** Heba
**Research Type:** domain (vocabulary, rules & best-practice study — NOT market/industry analysis)

---

## Research Overview

**Purpose.** Establish a shared, unambiguous **domain vocabulary, business rules, and accepted best practices** for the min-crm problem space — lead management, lead-to-customer conversion, ticketing, multi-tenant org modeling, and roles/permissions. This is a **semantics study**, deliberately *not* a market/industry analysis and *not* a technical-architecture design (the latter is a separate technical-research run).

**Why it matters.** min-crm is "Product A" on the iSolution Platform Boilerplate; its value is partly as a *reference implementation* whose terms the PRD and every story reuse verbatim. Ambiguous status names or role definitions discovered late become expensive rework, so we pin the vocabulary first and reconcile it against the existing draft standard before the PRD.

**Method.** Each domain area is grounded against current public sources — primarily vendor documentation and de-facto standards (Salesforce, HubSpot, Zendesk, Freshdesk, Atlassian/Jira Service Management, ITIL 4) plus established sales/support practice references. Claims are cited with URLs; where practice is genuinely contested or vendor-specific the report says so and assigns a confidence level. Every recommendation is filtered for **fit to a lightweight, multi-tenant CRM** rather than enterprise maximalism.

**Confidence legend.** 🟢 High = consistent across multiple authoritative sources · 🟡 Medium = common but vendor-/context-dependent · 🔴 Low = contested or thin evidence.

**Existing draft standard under reconciliation:**
- **Lead:** `new / contacted / qualified / disqualified / converted`
- **Ticket:** `open / in_progress / pending / resolved / closed`
- **Roles:** `tenant_admin / sales / support / viewer`

---

## 1. Lead Management

### 1.1 Two axes, not one: Lifecycle Stage vs. Lead Status

The single most important vocabulary distinction in modern CRM practice is that **"where a contact is in the funnel" and "what the salesperson has done about them" are two different fields.** 🟢

- **Lifecycle Stage** describes the contact's *relationship* to the company and is largely monotonic (it generally only moves forward): `Subscriber → Lead → Marketing Qualified Lead (MQL) → Sales Qualified Lead (SQL) → Opportunity → Customer`. HubSpot ships exactly these eight default stages and states they "cover most business models." ([HubSpot](https://knowledge.hubspot.com/records/use-lifecycle-stages))
- **Lead Status** describes *sales activity during qualification* and can cycle (a lead can go `Contacted → Nurturing → Contacted` again). HubSpot is explicit: "Lifecycle Stage describes a contact's relationship with your company, while Lead Status describes sales activities during the qualification process." ([Default.com 2026 guide](https://www.default.com/post/hubspot-lead-status-lifecycle-stages))

**Implication for min-crm:** the draft `new / contacted / qualified / disqualified / converted` set is a *Lead Status* sequence with the terminal *lifecycle* transition (`converted`) bolted onto the end. That's a defensible simplification for a lightweight CRM — but it means "qualified" is doing double duty (activity outcome *and* lifecycle position). Flagged for synthesis (§6).

### 1.2 Stage / status definitions

| Term | Accepted meaning | Source confidence |
|---|---|---|
| **New** (a.k.a. Open – Not Contacted) | Lead exists (form, import, manual add) but sales has not yet engaged. Salesforce defaults new leads to `Open – Not Contacted`. | 🟢 |
| **Contacted** / Working | Sales has made an outreach attempt; engagement in progress. | 🟢 |
| **MQL** (Marketing Qualified Lead) | Qualified **automatically by the system** via scoring/engagement; "shown interest but not yet ready for a direct sales conversation." | 🟢 |
| **SQL** (Sales Qualified Lead) | Qualified **by a human**; sales has confirmed need/budget/authority and accepts the lead as a real prospect. "An MQL becomes an SQL once your sales team confirms the lead is ready." | 🟢 |
| **Qualified** | Umbrella term for "meets the criteria to pursue." In lightweight CRMs that don't split MQL/SQL, a single `Qualified` collapses both. | 🟡 |
| **Disqualified** / Unqualified / Nurturing | Does not currently meet criteria. May be terminal (bad fit) or temporary (re-enter nurture). | 🟡 |
| **Converted** | Lead has become a Customer/Opportunity; the lead record is typically closed/locked and lineage preserved (see §2). | 🟢 |

Key distinction to encode: **MQL = machine-qualified, SQL = human-qualified.** ([The Lead Generation Company](https://theleadgenerationcompany.co.uk/mlq-vs-sql-vs-sal-lead-stages/), [Digitopia](https://www.digitopia.agency/blog/the-difference-between-mqls-and-sqls)) Salesforce's standard picklist is intentionally minimal — `Open`, `Qualified`, `Converted` — and explicitly designed to be renamed/extended per company. ([Salesforce Lead Status](https://marcloudconsulting.com/sf-basics/salesforce-lead-status/))

### 1.3 Qualification frameworks — and which fits a lightweight CRM

| Framework | Dimensions | Time/touch | Best fit |
|---|---|---|---|
| **BANT** | **B**udget, **A**uthority, **N**eed, **T**imeline | 3–5 min, one-time check | Transactional / short cycles with clear budget ownership |
| **CHAMP** | **C**hallenges, **A**uthority, **M**oney, **P**rioritization | Lead with the *problem* not the budget | Consultative selling |
| **MEDDIC(C)** | **M**etrics, **E**conomic buyer, **D**ecision criteria, **D**ecision process, **I**dentify pain, **C**hampion | 30–90 min, continuous through the deal | Complex enterprise deals (3+ stakeholders, >$50K ACV) |

Sources converge clearly: **"For most B2B sales teams, BANT is sufficient for initial qualification, while MEDDIC becomes necessary for … deal[s] above $50K ACV or involving 3+ stakeholders."** ([Leads at Scale](https://leadsatscale.com/insights/b2b-lead-qualification-framework-bant-vs-champ-vs-meddic/), [SyncGTM](https://syncgtm.com/blog/lead-qualification-frameworks-compared))

> **Recommendation for min-crm:** adopt **BANT** as the qualification vocabulary. 🟢 It is the lightest framework, maps to a single qualification gate (`new/contacted → qualified | disqualified`), and is the only one whose four criteria can sensibly live as optional fields on a lead in a minimal CRM. MEDDIC is over-engineered for the demo's purpose and would require opportunity/stakeholder modeling we don't have. CHAMP is BANT reordered and can be a documentation note, not a separate feature.

### 1.4 Lead sources, ownership/assignment, scoring

- **Lead sources** — the channel a lead originated from (web form, import, manual entry, referral, event, inbound call). Source is a first-class attribute used for funnel attribution and is a standard reporting dimension. 🟢
- **Ownership / assignment** — every lead has exactly one **owner** (the responsible salesperson). Assignment conventions: by **territory, capacity (round-robin / load-balanced), or specialization**. ([Salesforce blog](https://www.salesforce.com/blog/sales/lead-scoring/)) For a lightweight multi-tenant CRM, **manual assignment + round-robin within a subsidiary** is the realistic baseline; auto-routing engines are enterprise add-ons. 🟡
- **Lead scoring basics** — rank leads by fit + intent. Two components: **demographic/firmographic** ("who they are": job title, company size, industry, location) and **behavioral** ("what they do": page views, downloads, demo requests). Best practice combines both: demographics test ICP fit, behavior signals buying intent. A lead crossing a threshold (commonly **60–80 points**) flips to MQL. ([Nimble](https://www.nimble.com/blog/crm-best-practices-for-lead-scoring-qualification/), [Nutshell](https://www.nutshell.com/blog/behavioral-lead-scoring)) 🟢

> **Recommendation for min-crm:** treat **lead scoring as out-of-scope vocabulary** (document the terms, don't build the engine). A lightweight CRM with localStorage and no marketing-automation event stream cannot meaningfully compute behavioral scores. Keep **lead source** and **single-owner assignment** as real fields; note scoring as a known extension point. 🟡

---

## 2. Lead → Customer Conversion

### 2.1 What "conversion" means in CRM practice

Conversion is the **moment a qualified lead is promoted into the post-sale data model.** It is not a status flag flip — it is a *transformation* that spawns new records. In the canonical Salesforce model, converting one Lead produces up to three records: an **Account** (the organization), a **Contact** (the person), and optionally an **Opportunity** (the deal). "Salesforce will automatically create a new Account for a converted Lead unless you connect that Lead with an existing Account." ([Default.com](https://www.default.com/post/salesforce-lead-conversion-mapping), [Salesforce Help](https://help.salesforce.com/s/articleView?id=sales.lead_conversion_mapping.htm&language=en_US&type=5)) 🟢

> **Translation to min-crm's vocabulary:** we have no Account/Contact/Opportunity split — we have **Lead → Customer**. So conversion here means: *create a Customer record from a qualified Lead, carry the relevant data across, mark the Lead converted, and preserve the link.* This aligns directly with the brainstorm's **"Conversion = The Reference Saga"** concept (a persisted, resumable, compensating workflow that lands a Customer in `prospect`). 🟢

### 2.2 What data carries from lead to customer

Standard fields map **automatically**; custom fields map **only if explicitly configured** — "If you create a custom field for a Lead without mapping it … the data will have nowhere to go. So it won't carry over." Each target field accepts exactly one source field. ([Salesforce Help — Lead Conversion Field Mapping](https://help.salesforce.com/s/articleView?id=sales.lead_conversion_mapping.htm&language=en_US&type=5), [Getboomerang](https://www.getboomerang.ai/post/blog-salesforce-lead-conversion-field-mappings-setup-best-practices)) 🟢

The lesson for min-crm: **define the lead→customer field map as an explicit, reviewable contract**, not an implicit copy. Typical carry-over: name, company, contact details, source, owner, and qualification data (BANT fields). Activity history (the audit timeline) should be *linked*, not duplicated.

### 2.3 Lineage / traceability — the mechanism

Salesforce keeps the original Lead but makes it **read-only** and stamps it with back-pointer fields: `IsConverted = true`, plus `ConvertedAccountId`, `ConvertedContactId`, `ConvertedOpportunityId`. "If True, the Converted Account/Contact/Opportunity Id fields will be populated… These fields are not editable." ([SFDC Developers](https://sfdcdevelopers.com/2025/11/17/how-to-view-converted-leads-salesforce/)) 🟢

Two distinct concepts that min-crm should keep separate (both relevant to the "Audit-as-Feature" pillar): 🟢
- **Audit trail** — *who did what, when, why,* inside one system; captures user identity, timestamp, before/after values. ([Secoda](https://www.secoda.co/blog/data-lineage-vs-audit-trail))
- **Data lineage** — *how a record traveled and transformed* (Lead → Customer). The `convertedFromLeadId` back-pointer is min-crm's lineage edge.

> **Recommendation:** on conversion, set the Lead to a terminal read-only `converted` state, write `convertedToCustomerId` on the Lead and `convertedFromLeadId` on the Customer (bidirectional lineage), and append a conversion event to both records' activity timelines. This makes lineage queryable and the audit-as-feature timeline complete. 🟢

### 2.4 When a lead should NOT be converted

| Don't convert when… | Why | Correct action |
|---|---|---|
| Lead is **unqualified / low intent** | "One of the most common mistakes … is giving unnecessary attention to unqualified leads" — wastes effort and pollutes the customer base. ([Octopus CRM](https://octopuscrm.io/blog/convert-leads-into-customers/), [Nutshell](https://www.nutshell.com/blog/convert-sales-leads)) | Set `disqualified` (or nurture); never promote to Customer |
| Lead is a **duplicate** of an existing customer/lead | Duplicates cause double outreach and broken reporting; they arise from "unmanaged data input from multiple sources … without real-time checks." ([Convergehub](https://www.convergehub.com/blog/why-crm-creates-duplicate-leads-and-how-to-fix-it/), [4Thought](https://4thoughtmarketing.com/articles/resolving-lead-duplicate-issues/)) | Merge / link to the existing record instead of converting |
| Lead **fails BANT** (no budget, no authority, no real need, no timeline) | Conversion implies a real commercial relationship; without it the Customer record is hollow | Keep as lead; re-qualify later |
| Conversion **already happened** | Re-converting creates duplicate customers | Block: a `converted` lead is read-only/terminal |

> **min-crm rule to encode:** conversion is **only legal from `qualified`** (guarded transition), and a `converted` lead is **immutable**. Disqualified and uncontacted leads cannot be converted. This makes "when not to convert" a *state-machine guard*, not a matter of user discipline — consistent with the "structurally impossible to forget" design ethos.

---

## 3. Ticketing / Customer Support

### 3.1 Standard ticket lifecycle states

Across Zendesk, Freshdesk, and Jira Service Management the de-facto state set converges on: **New → Open → Pending → (Resolved/Solved) → Closed**, with **On-hold** and **Escalated** as common optional states. ([Zendesk — ticket lifecycle](https://support.zendesk.com/hc/en-us/articles/8263915942938-About-the-ticket-lifecycle-and-ticket-statuses), [Chatboq](https://chatboq.com/blogs/ticketing-system)) 🟢

| State | Accepted meaning | Notes |
|---|---|---|
| **New** | Just arrived, not yet triaged/assigned. Zendesk auto-sets new tickets to `New`. | Often merged with Open in lighter systems |
| **Open** | Accepted by the team and actively being worked, or **re-opened** when a customer replies. | The "ball is in our court" state |
| **Pending** / Awaiting reply / On-hold | Waiting on the **customer** or a **third party**; out of the team's control. **The SLA timer pauses here.** | Critical for fair SLA accounting |
| **In Progress** | Optional state for "actively being worked" (distinct from triaged-but-untouched Open). Zendesk treats it as account-configurable. | 🟡 vendor-dependent |
| **Escalated** | Routed to a higher tier / specialist. | Optional |
| **Resolved** / Solved | Team believes it's fixed; awaiting confirmation or auto-close. A customer reply can move it **back to Open**. | Not yet terminal |
| **Closed** | **Terminal and immutable** — "the requester can no longer reopen it and it can't be modified." Zendesk default: auto-close 4 days after Solved. | A new issue requires a new ticket |

**The two-step close (Resolved → Closed)** is deliberate and near-universal: *Resolved* = "we think it's done, you can still reopen"; *Closed* = "locked, start a new ticket." 🟢

> **Reconciliation with min-crm's draft** (`open / in_progress / pending / resolved / closed`): strong alignment. The draft maps cleanly onto the standard. Two notes for synthesis (§6): (a) min-crm has **no `new`** — fine if tickets enter directly as `open`, but decide whether "untriaged" needs its own state; (b) the **Pending → SLA-pause rule** is the most commonly forgotten semantic — encode it explicitly.

### 3.2 Priority vs. Severity — distinct concepts

These are **not synonyms**, and conflating them is a classic vocabulary bug: 🟢

- **Severity** = *how bad the problem is technically* (full outage > broken button). A property of the issue itself.
- **Priority** = *how urgently we will handle it* = **Impact × Urgency**, factoring business context (customer tier, deadlines). The ITIL Priority Matrix derives priority from Impact and Urgency. ([InvGate](https://blog.invgate.com/itil-priority-matrix), [Atomicwork](https://www.atomicwork.com/itil/itil-priority-matrix))

The canonical illustration: *"A severity-1 bug in a rarely-used feature might be a P3. A severity-2 bug that blocks your largest customer at month-end might be a P1."* Priority levels are typically **P1–P4/P5** (P1 = critical). ([Jitbit](https://www.jitbit.com/news/helpdesk-ticket-priority-levels/))

> **Recommendation for min-crm:** ship **Priority** (e.g. `low / medium / high / urgent`) as the single user-facing field — it's what drives queue order and SLA. Treat Severity and the full Impact×Urgency matrix as **documented vocabulary, not built fields** for the MVP. 🟡 A lightweight CRM that exposes both invites the exact priority/severity confusion the literature warns about.

### 3.3 SLA — response vs. resolution

Two distinct clocks, both standard: 🟢
- **First Response Time (FRT)** — submission → first meaningful reply (human message, or assignment/triage). "Fast response builds confidence."
- **Resolution Time** — submission → final closure, covering diagnosis, fix, customer verification. "Thorough resolution builds trust." ([EasyDesk](https://easydesk.app/blog/sla-response-time-vs-resolution-time), [Atlassian community](https://community.atlassian.com/forums/App-Central-articles/Understanding-SLA-metrics-Time-to-resolution-time-to-first/ba-p/2715307))

ITIL best practice for SLAs: define priority tiers, **pause rules for external/customer dependencies** (the `Pending` pause), state business hours vs 24/7, and review breaches. ([Freshworks](https://www.freshworks.com/itsm/sla/response-time/)) 🟢

> **Recommendation:** define FRT and Resolution SLA **targets per priority** as vocabulary in the PRD; min-crm can *display* SLA targets and elapsed time without a full timer engine. The non-negotiable semantic is **"the SLA clock pauses while a ticket is `pending`."**

### 3.4 Assignment / queue conventions & linking to customers

- **Assignment** — a ticket has one **assignee** (agent) and belongs to a **group/queue** (e.g. Billing, Technical Support). All agents belong to ≥1 group. Auto-assignment is configured at the **group** level; common strategies: **round-robin, load-balanced, skill-based**. ([Freshdesk](https://support.freshdesk.com/support/solutions/articles/196581-automatic-ticket-assignment-in-a-group-round-robin-), [Zendesk groups](https://support.zendesk.com/hc/en-us/articles/4408886146842-About-organizations-and-groups), [HelpDesk strategies](https://www.helpdesk.com/learn/customer-support-essentials/customer-ticket-assignment-strategies/)) 🟢
- **Linking to customers** — tickets attach to a **customer/organization**; organizations group users by company/domain and are where customer-level SLAs live. Zendesk can auto-route an organization's tickets to a designated group. ([Zendesk — organizations](https://support.zendesk.com/hc/en-us/articles/4408886146842-About-organizations-and-groups)) 🟢

> **Recommendation for min-crm:** a ticket **must link to a Customer** (and inherit its tenant/subsidiary) and has a **single assignee** (a `support` user). Per the brainstorm's `Customer Lifecycle` concept, gate ticket creation on customer state — e.g. tickets allowed only when the customer is `active` (or `onboarding`), proving status-gating as a business rule. Group/queue routing beyond single-assignee is an explicit extension point. 🟡

---

## 4. Multi-Tenant Org Modeling (Tenant → Subsidiary)

### 4.1 The hierarchy pattern

The standard B2B SaaS pattern for a parent→child org is a **hierarchical (tree) data model**: data elements linked in parent-child relationships, "suitable for multi-tenant SaaS because it inherently supports a tiered organization of data **and permissions**." ([ThinkAI](https://thinkaicorp.com/scaling-the-heights-of-multi-tenant-saas-with-hierarchical-data-models/)) The enterprise framing: a **parent organization has many child units** (subsidiaries/departments), each with its own data and usage tracking, "while still treating them as a unified entity" — a one-to-many parent→child structure. ([Kinde](https://www.kinde.com/learn/billing/billing-infrastructure/multi-tenant-billing-architecture-scaling-b2b-saas-across-enterprise-hierarchies/)) 🟢

min-crm's `tenant → subsidiary` is exactly this: **tenant = parent node, subsidiary = child node**, leads/customers/tickets owned at the subsidiary level and tagged with both ids. This matches the brainstorm's key partitioning `t:{tid}:s:{sid}:...`.

### 4.2 Data roll-up to parent

Hierarchical models "support aggregation by creating higher-level nodes … enabling summary views or analytics **without compromising tenant isolation**. Aggregating data in shared nodes … prevent[s] individual tenant data from being exposed." ([ThinkAI](https://thinkaicorp.com/scaling-the-heights-of-multi-tenant-saas-with-hierarchical-data-models/)) 🟢

> **Vocabulary for min-crm:** **roll-up** = a parent-level (tenant) read model that aggregates child (subsidiary) data — counts, funnels, ticket volumes — read from the event log per the brainstorm's "per-subsidiary roll-up" dashboard. A `tenant_admin` sees roll-up across subsidiaries; a subsidiary user sees only their own. Roll-up is a **read concern**, never a write path across the isolation boundary.

### 4.3 Config / role inheritance vs. override

The accepted pattern is **inheritance with explicit narrowing + deny-wins**: 🟢
- Child tenants **inherit** from parent roles/config but must **re-state** inherited permissions to retain them ("Role Policies are exhaustive… to allow inherited actions from the parent, they must be re-stated"). ([Cerbos](https://www.cerbos.dev/blog/multi-tenant-saas-authorization-role-policies-and-scoped-resource-policies))
- **Deny always wins**: an `EFFECT_DENY` at the child scope overrides a parent allow. ([Cerbos](https://www.cerbos.dev/blog/multi-tenant-saas-authorization-role-policies-and-scoped-resource-policies))
- Clear **precedence order**: more-specific (subsidiary) settings override less-specific (tenant) defaults, which override system defaults. ([WorkOS](https://workos.com/blog/how-to-design-multi-tenant-rbac-saas)) Inheritance must be "cycle-proof, deterministic."

> **Recommendation for min-crm:** model config as **tenant defaults that a subsidiary may override**, with a deterministic precedence `subsidiary > tenant > system`. Keep it simple for the MVP — a single override layer (subsidiary can override tenant) is enough to *demonstrate* the inheritance seam (the brainstorm's `F0.9 Flags/Config inheritance`) without deep policy machinery. 🟡

### 4.4 Subsidiary onboarding / offboarding

- **Onboarding/provisioning** — create the subsidiary node, seed it with inherited config/roles, provision its initial admin user. Automate via workflow for consistency. ([Kodekx](https://kodekx-solutions.medium.com/practical-multi-tenant-saas-provisioning-and-automated-onboarding-3bb6fdd3e84f), [Azure tenant life cycle](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenant-life-cycle)) 🟢
- **Offboarding/deprovisioning** — suspend access, revoke permissions, **reassign ownership** of orphaned records, then apply data retention. Best practice is **soft-delete / archive**: "preserve audit logs … account remains suspended/archived until a defined retention period (e.g. 180 days) … after which permanent deletion." ([Torii](https://www.toriihq.com/articles/saas-offboarding-process), [Emerline](https://medium.com/emerline-tech-talk/mastering-multitenant-data-management-essential-strategies-for-saas-success-e0abb0c1accd)) 🟢

> **Vocabulary to encode:** a subsidiary has a lifecycle (`active → suspended → archived`); **offboarding is soft-delete, not hard-delete**, to keep the audit/lineage trail intact — directly reinforcing the audit-as-feature pillar. Record reassignment on offboarding is the notable rule (don't orphan leads/customers/tickets).

---

## 5. Roles & Permissions

### 5.1 Standard CRM role definitions

CRM vendors converge on a small set of archetypes. RBAC = users get **roles**, roles carry **permissions**, permissions gate **actions (view/create/edit/delete/export)** on **resources**. ([Freshsales](https://crmsupport.freshworks.com/support/solutions/articles/50000002412-how-to-configure-roles-and-manage-user-permissions-), [CRM Experts Online](https://crmexpertsonline.com/role-based-access-control-in-crm-systems/), [Nutshell](https://www.nutshell.com/blog/crm-access-controls-and-permissions)) 🟢

| Standard role | Accepted scope |
|---|---|
| **Administrator** | "Full access to all data and system settings… can create other user roles and edit permissions." Configures the system. |
| **Sales Rep** | View/edit **leads** and customer/sales data; update contacts; generate sales reports. May be restricted from deleting/exporting. |
| **Support / Service Agent** | Works **tickets** within assigned groups; communicates with customers. May be restricted from exporting reports. |
| **Manager** (optional) | Team performance + reporting; oversees a group's workload and SLAs. |
| **Read-Only / Viewer** | View-only on specified data; no create/edit/delete. (e.g. "view team's quotas without the ability to make edits.") |

### 5.2 min-crm's four roles — mapped & validated

min-crm's `tenant_admin / sales / support / viewer` maps **cleanly onto the standard archetypes** (it folds Manager into tenant_admin). 🟢 Recommended permission expectations — *least privilege, scoped to the user's tenant/subsidiary, with deny-wins*:

| Capability | tenant_admin | sales | support | viewer |
|---|:--:|:--:|:--:|:--:|
| Manage users / roles / config | ✅ | — | — | — |
| Onboard/offboard subsidiaries | ✅ | — | — | — |
| View cross-subsidiary roll-up | ✅ | — | — | scoped¹ |
| **Leads** — create/edit | ✅ | ✅ | — | — |
| **Leads** — convert to customer | ✅ | ✅ | — | — |
| **Leads** — view | ✅ | ✅ | ✅² | ✅ |
| **Customers** — create/edit | ✅ | ✅ | — | — |
| **Customers** — view | ✅ | ✅ | ✅ | ✅ |
| **Tickets** — create/edit/assign | ✅ | —³ | ✅ | — |
| **Tickets** — view | ✅ | ✅ | ✅ | ✅ |
| Delete / export | ✅ | restricted | restricted | — |

¹ viewer roll-up only within its own scope. ² support may need read-only lead context for a customer's history. ³ a sales user *may* file a ticket on a customer's behalf — decision point (§6). **All rows are implicitly tenant/subsidiary-scoped** — no role escapes its tenant boundary; that's the cross-cutting `TenantContext` guarantee, not a per-role grant. 🟢

> **Recommendation:** adopt the four roles as-is; they're well-aligned with industry norms. The reconciliation work is **defining each cell explicitly** (the matrix above is the proposed starting contract) and confirming the two decision points: viewer's roll-up scope, and whether sales can open tickets.

---

## 6. Synthesis & Deliverables

> Reconciled against the live **min-crm Engineering Guidelines** (`_bmad-output/project-context.md`, §2–3 entities/statuses, §6 roles) and the brainstorm session, not just the brief summary. Where the constitution already pins a value, that is treated as the standard and the research either confirms or flags it.

### 6.1 Glossary of domain terms

| Term | Definition (as min-crm should use it) |
|---|---|
| **Lead** | A potential customer who has not yet been qualified+converted. Product-layer entity (Sales Journey). |
| **Lead source** | Channel a lead originated from: `web / referral / event / outbound / import`. Reporting/attribution dimension. |
| **Lead owner** | The single `sales` (or `tenant_admin`) user responsible for the lead (`ownerId`). |
| **Lifecycle Stage** | A contact's *relationship* to the company (Lead→MQL→SQL→Customer); mostly forward-only. min-crm collapses this into Lead + Customer status. |
| **Lead Status** | *Sales-activity* state during qualification: `new / contacted / qualified / disqualified / converted`. Can cycle (disqualified→contacted). |
| **MQL / SQL** | Marketing-Qualified (machine/score-qualified) vs Sales-Qualified (human-qualified). min-crm collapses both into a single `qualified`. |
| **BANT** | Lightweight qualification framework: **B**udget, **A**uthority, **N**eed, **T**imeline. Recommended qualification vocabulary for min-crm. |
| **Lead scoring** | Ranking by demographic/firmographic fit + behavioral intent. *Vocabulary only — not built in pilot.* |
| **Qualification** | Confirming a lead is worth pursuing (BANT met) → moves `contacted → qualified`. |
| **Conversion** | Transforming a `qualified` Lead into a Customer; terminal for the lead, creates lineage (`Customer.convertedFromLeadId`). Implemented as a saga. |
| **Lineage** | *How a record traveled/transformed* (Lead→Customer). Distinct from audit. |
| **Audit trail** | *Who did what, when, why* — immutable `AuditEvent` per mutation (§7 constitution). |
| **Customer** | A converted/active account. **Shared-platform** entity; CRM consumes it. Status `active / inactive / churned` (⚠️ see §6.5-C). |
| **Ticket** | A customer support request. Product-layer entity on shared Tasks/Workflow. Linked to exactly one Customer. |
| **Priority** | How *urgently* a ticket is handled (Impact × Urgency): `low / medium / high / urgent`. |
| **Severity** | How *bad the issue is technically*. **Vocabulary only — not a field** in pilot. |
| **First Response Time (FRT)** | Submission → first meaningful reply. SLA metric. |
| **Resolution Time** | Submission → final closure. SLA metric. |
| **SLA pause** | The resolution/response clock **stops while a ticket is `pending`** (awaiting customer/3rd party). ⚠️ not yet encoded. |
| **Assignee** | The single `support` user working a ticket (`assigneeId`). |
| **Tenant** | Top-level customer org (parent node). `tenantId` mandatory on every record. Status `active / suspended`. |
| **Subsidiary** | Child org node under a tenant. Records carry `subsidiaryId` (null = parent-level). |
| **Roll-up** | Parent-level (tenant) **read model** aggregating subsidiary data. Never a cross-boundary write. |
| **Inheritance / override** | Subsidiary inherits tenant config/roles; may override. Precedence `subsidiary > tenant > system`, **deny-wins**. ⚠️ precedence not yet specified in constitution. |
| **Offboarding** | Removing a subsidiary/user via **soft-delete** (`deletedAt`) + record reassignment + retention, never hard-delete. |
| **RBAC** | Role-Based Access Control: roles `tenant_admin / sales / support / viewer` → permissions on actions/resources, always tenant-scoped. |

### 6.2 Recommended status set + transitions — LEAD

**Status set:** `new / contacted / qualified / disqualified / converted` — ✅ **confirmed**, aligns with the minimal Salesforce model and the two-axis principle. Constitution transitions are sound:

```
        ┌──────────────┐
  new ──┤              ├─► disqualified ──► (revive) contacted
   │    │   contacted  │         ▲
   └───►│      │       │         │
        │      ▼       │         │
        │  qualified ──┴─────────┘
        │      │
        │      ▼
        │  converted  (TERMINAL, read-only)
```
- `new → contacted | disqualified` · `contacted → qualified | disqualified` · `qualified → converted | disqualified` · `disqualified → contacted` (revive) · `converted → ∅` (terminal). 🟢
- **Guard:** conversion legal **only from `qualified`** ✅ (constitution already enforces — `qualified` is the only state with `converted` in its transition list). Industry-correct.
- **Minor note:** `qualified` carries both "activity outcome" and "lifecycle position." Acceptable lightweight simplification; document it so MQL/SQL nuance isn't lost.

### 6.3 Recommended status set + transitions — CUSTOMER ⚠️

**This is the area needing the most reconciliation.** Three sources disagree:

| Source | Customer states |
|---|---|
| **Constitution** (`status.ts`) | `active / inactive / churned` — **no transitions defined**, no `prospect`/`onboarding` |
| **Brainstorm** (Concept #7) | `prospect → onboarding → active` (conversion lands in `prospect`; onboarding workflow walks to `active`) |
| **Industry norm** | `prospect / active / inactive / churned` all standard; post-sale customer lifecycle commonly starts at a non-active state |

**Recommended reconciled set:** `prospect → onboarding → active → inactive → churned`, with:
```
prospect ──► onboarding ──► active ──► inactive ──► churned
                              ▲           │
                              └───────────┘   (reactivate)
```
- Conversion saga lands a Customer in **`prospect`** (per research §2 + brainstorm).
- `onboarding` is a real state + workflow (proves Tasks/Workflow a second time).
- **Ticket-creation gate:** tickets allowed only when customer is `active` (or `onboarding`) — encodes status-gating as a business rule.
- `inactive ↔ active` reactivation; `churned` terminal-ish (lost customer).

🟡 **Decision required (§6.5-C):** adopt this 5-state set, OR keep the constitution's 3-state set and explicitly drop the onboarding concept. The two cannot both stand — pick one before the PRD.

### 6.4 Recommended status set + transitions — TICKET

**Status set:** `open / in_progress / pending / resolved / closed` — ✅ confirmed, maps to the Zendesk/Freshdesk/Jira standard.

```
open ──► in_progress ──► resolved ──► closed
 │  ▲        │  ▲           │  ▲          (reopen? see ⚠️)
 │  └────────┘  │           │  │
 ▼              ▼           ▼  │
pending ◄──────────────────┘   │
 └──────────────► resolved ─────┘
```
- `open → in_progress | pending | closed` · `in_progress → pending | resolved | open` · `pending → in_progress | resolved` · `resolved → closed | open` (reopen) · `closed → open` (⚠️ reopen). 🟢 mostly.
- **Two-step close** (`resolved` reopenable, then `closed`) ✅ matches industry.
- ⚠️ **Conflict:** constitution allows `closed → open`. **Industry standard treats `closed` as terminal/immutable** ("the requester can no longer reopen it"; a new issue = a new ticket). See §6.5-D.
- ⚠️ **Missing semantic:** the **SLA clock pauses while `pending`** — encode this if SLA is in scope.
- **Priority** `low/medium/high/urgent` ✅ confirmed; **Severity** intentionally not a field 🟢.

### 6.5 ⚠️ Conflict-flags table (reconcile before the PRD)

| # | Area | Current min-crm standard | Best practice / research finding | Severity | Recommendation |
|---|---|---|---|:--:|---|
| **A** | Customer lifecycle | `active / inactive / churned`; **no transitions**, no `prospect`/`onboarding` | Conversion should land in a non-active state; brainstorm specifies `prospect → onboarding → active` | 🔴 **High** | Adopt `prospect → onboarding → active → inactive → churned` **and define `CUSTOMER_TRANSITIONS`** (currently absent). Or formally drop onboarding. **Cannot ship undefined.** |
| **B** | Conversion target state | Constitution implies Customer created `active` (default) | Research + brainstorm: land in `prospect` | 🔴 **High** | Decide with A. If onboarding kept, conversion → `prospect`. |
| **C** | Ticket `closed` reopen | `closed → open` allowed | Industry: `closed` is **terminal/immutable**; reopen only from `resolved`; new issue → new ticket | 🟡 Med | Make `closed` terminal; allow reopen only `resolved → open`. Keeps audit clean. |
| **D** | SLA pause-on-pending | Not encoded anywhere | Universal: SLA timer **pauses** while `pending` | 🟡 Med | If SLA targets are in scope, encode the pause rule explicitly; else document SLA as out-of-scope. |
| **E** | Support → lead access | §6.2: support has **no** lead access | Industry: support sometimes needs **read-only** lead/pre-sale context | 🟢 Low | Decide: keep support lead-blind, or grant read-only. Default: keep blind (simpler, least-privilege). |
| **F** | Sales → ticket access | §6.2: sales = **read** on tickets (cannot create) | Industry varies; some let sales file tickets for customers | 🟢 Low | Constitution already resolves this (sales read-only). Confirm intended; recommend keeping as-is. |
| **G** | Lineage direction | `Customer.convertedFromLeadId` only (one-way) | Research: bidirectional (`Lead.convertedToCustomerId` too) | 🟢 Low | Optional: add `convertedToCustomerId` to Lead for symmetric traceability. Event log already covers the audit need. |
| **H** | Config/role inheritance precedence | Config&Flags shared, but **precedence unspecified** | Standard: `subsidiary > tenant > system`, deny-wins, deterministic | 🟢 Low | Specify the precedence + deny-wins rule in §3/§6 before building Flags/Config inheritance (F0.9). |
| **I** | Subsidiary offboarding rule | Soft-delete via `deletedAt` exists; **no record-reassignment rule** | Industry: offboarding must reassign orphaned records + retention window | 🟢 Low | Add "reassign owned leads/customers/tickets on subsidiary offboard" rule. Soft-delete approach ✅ already correct. |
| **J** | BANT fields | Lead has no budget/authority/need/timeline fields | If BANT adopted, qualification needs inputs | 🟢 Low | Either add optional BANT fields, or document that `qualified` is a manual judgment call (recommended for pilot). |
| **K** | `qualified` double-duty | Single `qualified` = MQL+SQL+lifecycle | Two-axis (activity vs lifecycle) is the formal model | 🟢 Low | Accept simplification; **document** that `qualified` collapses MQL/SQL so the nuance is intentional, not lost. |

**Net assessment:** the existing standard is **strong and largely industry-aligned** — Lead, Ticket, Priority, and Roles need only minor confirmations (flags E–K). The **one material gap is the Customer lifecycle (A/B)**: it's underspecified (no transitions) and contradicts the brainstorm's onboarding concept. Resolve A/B first; treat C/D as quick decisions; E–K as documentation cleanups.

### 6.6 Recommended role → permission matrix (reconciled)

Confirmed against constitution §6.2 — industry-aligned; presented at finer granularity for the PRD. **All rows implicitly tenant/subsidiary-scoped; out-of-tenant access returns `404`, deny-wins.**

| Capability | tenant_admin | sales | support | viewer |
|---|:--:|:--:|:--:|:--:|
| Manage tenant/subsidiaries, users, config | ✅ | — | — | — |
| Onboard/offboard subsidiaries | ✅ | — | — | — |
| Cross-subsidiary roll-up view | ✅ | — | — | — |
| Leads — create / edit / convert | ✅ | ✅ | — | view |
| Leads — view | ✅ | ✅ | —¹ | ✅ |
| Customers — create / edit | ✅ | ✅ | — | view |
| Customers — view | ✅ | ✅ | ✅ | ✅ |
| Tickets — create / edit / assign | ✅ | —² | ✅ | — |
| Tickets — view | ✅ | ✅ | ✅ | ✅ |
| View audit / events | ✅ | own | own | — |
| Delete (soft) / export | ✅ | restricted | restricted | — |

¹ flag **E** — currently support has no lead access. ² flag **F** — sales read-only on tickets per constitution. 🟢

---

## Research Methodology & Sources

**Approach:** five domain blocks, each grounded in live web sources (vendor docs + de-facto standards), written immediately to this document with citations and confidence levels (🟢/🟡/🔴), then reconciled in §6 against the live min-crm Engineering Guidelines and the 2026-06-06 brainstorm.

**Primary source families:**
- **Lead / qualification / scoring:** HubSpot, Salesforce, The Lead Generation Company, Digitopia, Leads at Scale, SyncGTM, Nimble, Nutshell.
- **Conversion / lineage:** Salesforce Help (Lead Conversion Field Mapping), SFDC Developers (converted-lead fields), Secoda (audit vs lineage), Convergehub/4Thought (duplicates), Octopus CRM.
- **Ticketing / SLA / priority:** Zendesk, Freshdesk, Jira Service Management, ITIL Priority Matrix (InvGate, Atomicwork), EasyDesk, Atlassian community, Jitbit.
- **Multi-tenancy / RBAC:** ThinkAI & Kinde (hierarchical models/roll-up), Cerbos & WorkOS (inheritance/deny-wins), Torii & Emerline & Azure (onboarding/offboarding/retention), Freshsales/Zoho/Nutshell (CRM roles).

**Confidence:** the bulk of findings are 🟢 (multi-source consensus). The contested area is the Customer lifecycle (🔴 — three sources disagree), surfaced as conflict flags A/B for human reconciliation.

**Scope boundary honored:** this is domain semantics only. Technical architecture (persistence, repository seam, event bus implementation) is deferred to the separate technical-research run, though the constitution's architectural rules were read to ensure vocabulary consistency.

*Research completed 2026-06-06.*
