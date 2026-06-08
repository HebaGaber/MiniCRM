---
baseline_commit: b61e74b2078c48e47c224d68a40730220088f29d
---

# Story 0.9: Build the shared component inventory + page templates

Status: review

- **Story ID:** E0-S9 (`0-9-shared-component-inventory-page-templates`)
- **Epic:** E0 — Platform Guidelines & Standards (the governing contract) · **Feature:** 0.5 — UI Kernel & Component Inventory
- **Cut:** Pilot · **Depends on:** E0-S1 (`STATUS_TONE`), E0-S3 (`Page<T>` / `ListQuery`) · **ADRs:** ADR-006, ADR-007 · **Constitution:** §8

## Story

As the platform,
all screens are assembled from one fixed component inventory and page templates wired to a four-state boundary and design tokens,
so that every feature looks and behaves consistently and no view hardcodes styling or status color.

## Acceptance Criteria

1. **AC1 — Component inventory.** Build `AppShell` (nav + tenant/subsidiary switcher), `DataTable`, `StatusPill` (tone **only** from `STATUS_TONE`), `Toolbar`, `FilterBar`, `EntityForm` fields, `ConfirmDialog`, `Toast`, `EmptyState`, `ErrorState`, `Skeleton`, and `RecordPager` (DEC-CC-3 — prev/next + Side/Full view, see UX block).
   *Files:* `src/shared/ui/components/*`
2. **AC2 — Page templates.** Build `ListPage`, `DetailPage`, `EntityForm` (template), and `Dashboard` templates that features specialize.
   *Files:* `src/shared/ui/templates/{ListPage,DetailPage,EntityForm,Dashboard}.tsx`
3. **AC3 — Four-state harness (UC-1).** Ship `QueryStateBoundary` rendering loading/empty/error/data states; any data view plugs into it.
   *File:* `src/shared/ui/QueryStateBoundary.tsx`
4. **AC4 — Tokens only (NFR-10).** No hardcoded hex/px/font anywhere; styling reads design tokens from `src/shared/ui/tokens.css`.
5. **AC5 — Destructive/convert require ConfirmDialog.** Destructive and convert actions are gated by `ConfirmDialog`.
6. **AC6 — Accessibility & responsiveness.** Components are keyboard-accessible and responsive down to tablet width (768px).

## Tasks / Subtasks

### Task 0 — Install ADR-006 packages (run ONCE before writing code)
- [ ] `npm install @tanstack/react-query react-router-dom react-hook-form @hookform/resolvers`
  - These are the ADR-006 pilot stack; none of these is installed yet (current package.json only has `zod`).
  - `@tanstack/react-query` → QueryStateBoundary + feature hooks (Epics 1-5)
  - `react-router-dom` → AppShell `<Link>` / routing (library/SPA mode only — never framework mode)
  - `react-hook-form` + `@hookform/resolvers` → EntityForm (RHF v7 + Zod v4 already in package.json)
  - Confirm clean `npx tsc -b` after install.

### Task 1 — `src/shared/ui/tokens.css` (AC4)
- [ ] Create the CRM-layer token sheet that imports both DS token files and adds the two scrim/blur tokens (DEC-CC-4) not present in the DS.
- [ ] File must `@import` (or the app must import) the two existing token files already committed to `src/shared/ui/tokens/`:
  - `./tokens/colors_and_type.css` (DS color + typography + spacing + radii + shadows + z-index)
  - `./tokens/motion.css` (CRM motion ramp: `--crm-instant/fast/base/slow` + easings + `--crm-travel`)
- [ ] Add CRM-layer tokens (not in DS):
  ```css
  /* DEC-CC-4: scrim/blur — realized values logged in decision-log.md */
  --crm-scrim: rgba(15, 22, 38, 0.42);
  --crm-backdrop-blur: blur(2px);
  /* Skeleton shimmer animation */
  @keyframes crm-skel { from { background-position: -200% 0 } to { background-position: 200% 0 } }
  /* Dialog pop entry */
  @keyframes crm-pop { from { opacity: 0; transform: scale(0.96) translateY(calc(-6px * var(--crm-travel))) } to { opacity: 1; transform: none } }
  ```
- [ ] Import `src/shared/ui/tokens.css` in `src/main.tsx` (or `src/index.css`) so tokens are globally available.
- [ ] No hardcoded hex/px/font in this file beyond the two DEC-CC-4 scrim/blur values (which are the realized values of DS tokens not yet exposed).

### Task 2 — `src/shared/ui/components/Icon.tsx`
- [ ] A thin wrapper around SVG icons. In the pilot, use **Lucide React** (`lucide-react` — install it: `npm install lucide-react`).
- [ ] Props: `name: string, size?: number (default 16), strokeWidth?: number (default 1.6), className?: string, style?: React.CSSProperties`
- [ ] Use dynamic import from `lucide-react` for the icon by name. Pattern:
  ```tsx
  // lucide-react exports named icons, e.g. ChevronRight.
  // Build a lookup so <Icon name="chevron-right" /> works.
  import * as LucideIcons from 'lucide-react';
  const toComponent = (name: string) =>
    LucideIcons[name.replace(/(^|-)[a-z]/g, s => s.replace('-', '').toUpperCase()) as keyof typeof LucideIcons];
  ```
- [ ] Fall through gracefully if icon not found (render null).

### Task 3 — `src/shared/ui/components/StatusPill.tsx` (AC1, AC4)
- [ ] Props: `tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger', children: React.ReactNode, icon?: string, size?: 'sm' | 'md'`
- [ ] The five tone objects (bg, fg, border, dot) use **only** DS semantic tokens — no hex:
  ```tsx
  const TONES = {
    neutral: { bg: 'var(--iso-n-100)',        fg: 'var(--iso-fg-muted)',    border: 'var(--iso-n-300)',      dot: 'var(--iso-n-600)' },
    info:    { bg: 'var(--iso-info-soft)',     fg: 'var(--iso-brand)',       border: 'var(--iso-blue-3-300)', dot: 'var(--iso-accent)' },
    success: { bg: 'var(--iso-success-soft)',  fg: 'var(--iso-green-800)',   border: 'var(--iso-green-300)',  dot: 'var(--iso-success)' },
    warning: { bg: 'var(--iso-warning-soft)',  fg: 'var(--iso-yellow-800)',  border: 'var(--iso-yellow-300)', dot: 'var(--iso-warning)' },
    danger:  { bg: 'var(--iso-danger-soft)',   fg: 'var(--iso-red-700)',     border: 'var(--iso-red-300)',    dot: 'var(--iso-danger)' },
  } as const;
  ```
- [ ] Pill always has a text label (`children`). Dot variant = a 6×6 `border-radius:50%` span; Icon variant = `<Icon size={11} strokeWidth={2} />`.
- [ ] Tone change transition: `transition: background-color var(--crm-fast) var(--crm-ease-standard), color var(--crm-fast) var(--crm-ease-standard), border-color var(--crm-fast) var(--crm-ease-standard)`.
- [ ] Font: `500 10px/14px var(--iso-font-ui)`, `letterSpacing: 0.06em`, `textTransform: uppercase`.
- [ ] Padding: `sm` → `2px 7px`; `md` → `3px 9px`. Border radius: `var(--iso-radius-xs)`.
- [ ] Export `StatusPillTone` type: `'neutral' | 'info' | 'success' | 'warning' | 'danger'`.

### Task 4 — `src/shared/ui/components/Button.tsx` (AC1, AC4)
- [ ] Props: `variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'neutral' (default 'primary')`, `size?: 'sm' | 'md' | 'lg' (default 'md')`, `leadIcon?: string`, `trailIcon?: string`, `disabled?: boolean`, `children`, `...rest` (forwarded to `<button>`).
- [ ] All colors via DS tokens (match prototype `components_core.jsx Button` exactly).
- [ ] Heights: sm=28px, md=36px, lg=44px; padding/fontSize as in prototype.
- [ ] Transition: `color/border-color/box-shadow var(--crm-fast) var(--crm-ease-standard)`.

### Task 5 — `src/shared/ui/components/Skeleton.tsx` (AC1, AC4)
- [ ] Props: `w?: string | number (default '100%')`, `h?: number (default 12)`, `r?: number (default 4)`, `style?: React.CSSProperties`.
- [ ] Uses CSS class `crm-skel` with shimmer animation defined in tokens.css:
  ```css
  .crm-skel {
    background: linear-gradient(90deg, var(--iso-n-100) 25%, var(--iso-n-50) 50%, var(--iso-n-100) 75%);
    background-size: 200% 100%;
    animation: crm-skel 1.4s var(--crm-ease-standard) infinite;
    border-radius: 4px;
    display: block;
  }
  ```
- [ ] Never a bare spinner — must mirror the real layout (requirement from UX spec).

### Task 6 — `src/shared/ui/components/EmptyState.tsx` + `ErrorState.tsx` (AC1, AC4)
- [ ] `EmptyState` props: `icon?: string (default 'inbox')`, `title: string`, `body?: string`, `scopeLine?: string`, `action?: { label: string; icon?: string; onClick: () => void; autoFocus?: boolean }`, `compact?: boolean`.
  - Brand-soft icon container (`--iso-brand-soft` bg + `--iso-brand` color), 56×56, radius `--iso-radius-lg`.
  - `scopeLine` = uppercase eyebrow below title.
  - Action button auto-focused if `action.autoFocus`. Do not render a disabled button if the role can't perform it — omit the action prop instead.
- [ ] `ErrorState` props: `title?: string`, `body?: string`, `onRetry?: () => void`.
  - `cloud-off` glyph, danger-soft container.
  - Contained panel — NOT a toast/takeover (must not overlay).
  - Retry = `<Button variant="secondary" leadIcon="refresh-cw">`.

### Task 7 — `src/shared/ui/components/Toast.tsx` + `ToastHost.tsx` (AC1, AC4, AC7)
- [ ] **External API:** `pushToast({ tone: 'success' | 'danger' | 'warning' | 'info', title: string, body?: string, action?: { label: string; onClick: () => void } })` — module-level function, importable anywhere (no React context needed).
- [ ] **ToastHost** renders as bottom-center fixed stack, `z-index: var(--iso-z-toast)` (1000).
  - Max 3 toasts; oldest collapses when 4th arrives.
  - `success` auto-dismisses after 4000ms; `danger`/`error` persist until dismissed.
  - Enter: opacity 0→1 + translateY at `--crm-fast` `--crm-ease-decelerate`.
  - Exit: opacity 1→0 + translateY at `--crm-fast` `--crm-ease-accelerate`.
  - `aria-live="polite"` (success) / `aria-live="assertive"` (danger/error).
- [ ] **Tone icons:** success → `check-circle`; danger → `rotate-ccw`; warning → `alert-triangle`; info → `info`.
- [ ] Dismiss button `×`; optional action button.
- [ ] Toasts are own-action outcome feedback, NOT a notification feed.

### Task 8 — `src/shared/ui/components/ConfirmDialog.tsx` (AC1, AC5)
- [ ] Props: `open: boolean`, `title: string`, `body?: string`, `confirmLabel?: string`, `tone?: 'danger' | 'warning' | 'primary' (default 'danger')`, `onConfirm: () => void`, `onCancel: () => void`.
- [ ] Overlay: `background: var(--crm-scrim); backdrop-filter: var(--crm-backdrop-blur)`. Z-index: `var(--iso-z-modal)` (900). **No raw rgba/px** — token references only (DEC-CC-4).
- [ ] Panel enter: `crm-pop` animation at `var(--crm-base)` `var(--crm-ease-decelerate)`.
- [ ] **Focus-trapped** (focus cycles only within the dialog while open). `Esc` → cancel; click-outside → cancel.
- [ ] Confirm button: `danger` tone → uses `<Button variant="danger">`. **Safe** action button (`Cancel`) is focused by default. Destructive confirm is `danger`-toned and **never** default-focused (keyboard safety).
- [ ] No double-confirm for convert actions — convert hands off to the saga inspector.

### Task 9 — `src/shared/ui/components/Toolbar.tsx` + `FilterBar.tsx` (AC1, AC4)
- [ ] **Toolbar**: search input + left children + right slot. Border-bottom, `--iso-border-muted`. Focus ring on search input.
- [ ] **FilterBar**: chip-based filter row. Background `var(--iso-blue-3-50)`, filter icon.
- [ ] **FilterChip**: `selected` prop → `--iso-brand-soft` bg + `--iso-brand` border + brand color. Removable `×` when selected.

### Task 10 — `src/shared/ui/components/DataTable.tsx` (AC1, AC3, AC4, AC6)
- [ ] Props:
  ```tsx
  type ColumnDef<R> = {
    id?: string; header: string; width?: string; align?: 'left' | 'right';
    sortVal?: (r: R) => string | number;
    render?: (r: R) => React.ReactNode;
    key?: keyof R;
    skelW?: string;
  };
  type DataTableProps<R> = {
    columns: ColumnDef<R>[];
    rows: R[];
    state?: 'loading' | 'empty' | 'error' | 'ready';
    onRetry?: () => void;
    empty?: { title?: string; body?: string; action?: { label: string; icon?: string; onClick: () => void; autoFocus?: boolean } };
    rowActions?: (row: R) => Array<{ label: string; icon?: string; tone?: 'danger'; onClick: () => void }>;
    onRowClick?: (row: R) => void;
    skeletonRows?: number;
    activeId?: string | null;
    sortCol?: string;
    sortDir?: 'asc' | 'desc';
    onSort?: (col: ColumnDef<R>) => void;
  };
  ```
- [ ] Internally renders all four states:
  - **loading**: skeleton rows (match column widths with `skelW`).
  - **empty**: `<EmptyState {...empty} />`.
  - **error**: `<ErrorState onRetry={onRetry} />`.
  - **ready**: data rows.
- [ ] **Keyboard navigation**: rows have `tabIndex={0}`, Enter/Space fires `onRowClick`.
- [ ] **Sortable headers**: `aria-sort` attribute. Active header = `--iso-brand` color. Toggle asc/desc.
- [ ] **Active row** = `--iso-brand-soft` bg + `inset 3px 0 0 var(--iso-brand)` box-shadow.
- [ ] **Row actions** via kebab menu (`RowActions` sub-component, `z-index: var(--iso-z-dropdown)`).
- [ ] `aria-label="table"` on outer container; each header cell has `role="columnheader"`.

### Task 11 — `src/shared/ui/components/AppShell.tsx` (AC1, AC4, AC6)
- [ ] **CSS Grid**: `[logo | topbar]` 64px row over `[nav | main]`. App background: `var(--iso-blue-3-50)`.
- [ ] **Sidebar collapse**: `248px ↔ 64px` via `grid-template-columns` transition at `var(--crm-base)` `var(--crm-ease-standard)`.
- [ ] **Wordmark**: "min●crm" where ● = `--iso-accent` circle, "crm" = `--iso-brand`. Font: `500 18px/1 var(--iso-font-display)`, `letter-spacing: -0.02em`. Visible when expanded only.
- [ ] **Nav items** (role-gated, from `permissions.ts`): use `<Link>` from `react-router-dom`. Groups: **Workspace** (Leads, Customers, Tickets) · **Tenancy** · pinned-bottom **Build** (Components gallery).
  - Active item: `--iso-brand` bg + white text; color transition at `--crm-fast`.
  - Collapsed state: icon only, centered; no label.
- [ ] **Topbar** (left→right): `ScopeSwitcher` placeholder (E1-S4 fills it) · Search box (decorative in pilot — focus toggles ring only, no search logic) · `NotificationsBell` placeholder (E0-S12 fills it) · `UserMenu`.
- [ ] **UserMenu**: avatar + name + role; dropdown: email, **"Switch role (demo)"** (calls `signIn` from `useAuth`; on failure surface a toast with the error), "View all notifications", "Sign out".
  - **Deferred item from E0-S5**: `signIn` gives no programmatic failure signal → wrap in try/catch, on Auth.LoginFailed event surface a `pushToast({ tone: 'danger', title: 'Sign in failed' })`. See `deferred-work.md` E0-S5 entry.
- [ ] **AppShell** accepts `children` for the `main` area. It does NOT own routing — feature pages are rendered as children.
- [ ] Props: `currentPath?: string` (optional hint for nav active state; primary active state is from `useLocation()` of react-router-dom).

### Task 12 — `src/shared/ui/components/RecordPager.tsx` (AC1, DEC-CC-3)
- [ ] **RecordPager** sticky bar (top of DetailPage): prev/next chevrons, "N of M · <noun>", Side/Full view toggle, Close ×.
- [ ] Props:
  ```tsx
  type RecordPagerProps = {
    index: number;      // 0-based position in filtered list
    total: number;
    noun: string;       // e.g. "Leads", "Customers"
    viewMode: 'side' | 'full';
    onViewMode: (mode: 'side' | 'full') => void;
    onPrev: () => void;
    onNext: () => void;
    onClose: () => void;
  };
  ```
- [ ] **Keyboard**: `↑/←/k` = prev, `↓/→/j` = next, `Esc` = close. **Suppress** when focus is inside an `input`, `textarea`, or `select`, and only when a record is open and no modal is open.
- [ ] **Sticky**: `position: sticky; top: 0; z-index: var(--iso-z-sticky)` (200).
- [ ] **Side/Full toggle**: two icon-buttons (`layout-panel-left` = side, `maximize-2` = full). Persist user preference in `localStorage('crm-view-mode')`.
- [ ] Glassmorphism: `background: rgba(255,255,255,0.92); backdrop-filter: saturate(140%) blur(6px)`.
- [ ] Visual oracle: `prototype/screenshots/sideview.png`.

### Task 13 — `src/shared/ui/QueryStateBoundary.tsx` (AC3)
- [ ] A **generic, adapter-agnostic** boundary. Does NOT import TanStack Query directly — converts TanStack Query state in the feature hook, then passes this typed state to QueryStateBoundary.
- [ ] Props:
  ```tsx
  type QueryState = 'loading' | 'empty' | 'error' | 'ready';
  type QueryStateBoundaryProps = {
    state: QueryState;
    error?: Error | null;
    empty?: { title?: string; body?: string; action?: { label: string; icon?: string; onClick: () => void } };
    skeleton?: React.ReactNode;   // custom skeleton; falls back to <Skeleton />
    children: React.ReactNode;
  };
  ```
- [ ] Skeleton → ready cross-fade: use CSS opacity transition at `var(--crm-base)` `var(--crm-ease-decelerate)`.
- [ ] **Mutation failures** → use Toast + rollback path (ADR-007), NOT ErrorState. `QueryStateBoundary` ErrorState is for **query** (fetch) failures only.
- [ ] Export a helper: `toQueryState<T>(data: T[] | undefined, isLoading: boolean, isError: boolean): QueryState` that feature hooks can use to bridge TanStack Query state.

### Task 14 — `src/shared/ui/templates/ListPage.tsx` (AC2)
- [ ] Template that features specialize for listing entities.
- [ ] Props:
  ```tsx
  type ListPageProps<R> = {
    title: string;
    noun: string;
    icon?: string;
    createLabel?: string | null;
    onCreate?: () => void;
    toolbar?: React.ReactNode;
    filterBar?: React.ReactNode;
    table: React.ReactNode;   // feature passes <DataTable .../>
    pagination?: React.ReactNode;
  };
  ```
- [ ] Layout: `PageHeader` (title + primary Create button) + `<main>` with `Toolbar` area + `FilterBar` area + `DataTable` area.
- [ ] Page padding: `28px 32px`, max-width `1280px`, centered.
- [ ] Feeds `Page<T>` pagination via `<Pagination>` component (prev/next/page-size).

### Task 15 — `src/shared/ui/templates/DetailPage.tsx` (AC2, DEC-CC-3)
- [ ] Template for entity detail views.
- [ ] Props:
  ```tsx
  type DetailPageProps = {
    pager?: React.ReactNode;     // <RecordPager> — optional; present when navigated from list
    header: React.ReactNode;     // <PageHeader> with back button, title, statusPill, actions
    aside?: React.ReactNode;     // right column (details panel)
    children: React.ReactNode;   // main content (tabs, timeline, etc.)
    viewMode?: 'side' | 'full';  // set by RecordPager
    sideList?: React.ReactNode;  // the list rendered beside detail in Side view
  };
  ```
- [ ] **Side view**: two-pane layout — list on left (~40%), detail on right (~60%). The open row in the list is highlighted (activeId). Toggled by RecordPager.
- [ ] **Full view**: detail takes the full width.
- [ ] View mode persisted via RecordPager → `localStorage('crm-view-mode')`.
- [ ] No new layout type — this IS the DetailPage variant referenced in NFR-10 exception for the saga inspector and ConversionInspector.

### Task 16 — `src/shared/ui/templates/EntityForm.tsx` (AC2)
- [ ] Wrapper template for create/edit forms, backed by React Hook Form.
- [ ] Props:
  ```tsx
  type EntityFormProps<TFormValues extends Record<string, unknown>> = {
    title: string;
    noun: string;
    schema: import('zod').ZodType<TFormValues>;
    defaultValues?: Partial<TFormValues>;
    onSubmit: (values: TFormValues) => Promise<void> | void;
    onCancel: () => void;
    children: (form: import('react-hook-form').UseFormReturn<TFormValues>) => React.ReactNode;
    submitLabel?: string;
    isSubmitting?: boolean;
  };
  ```
- [ ] Uses `useForm` from `react-hook-form` with `zodResolver` from `@hookform/resolvers/zod`.
- [ ] Renders field errors from `form.formState.errors` below each field.
- [ ] Submit + Cancel buttons in a footer row.
- [ ] Re-export form field primitives: `TextField`, `SelectField`, `DateField` (from components) as part of this module.

### Task 17 — `src/shared/ui/templates/Dashboard.tsx` (AC2)
- [ ] Minimal scaffold template for the Dashboard page (E5-S1 fills real widgets).
- [ ] Props: `title?: string, children: React.ReactNode`.
- [ ] Layout: page header + widget grid (CSS grid, auto-fill min 280px).

### Task 18 — Tests (AC1–AC6, NFR-12)
- [ ] **`src/shared/ui/components/StatusPill.test.tsx`** (RTL + jsdom):
  - StatusPill derives color only from `STATUS_TONE` — no literal color strings appear as computed styles; verify tone class maps to token-referenced variable names.
  - All 5 tones render with a text label.
  - AC4 lint assertion: no raw hex/px/font string literals in `StatusPill.tsx` (test reads the source file and asserts no `/[0-9a-fA-F]{6}/` hex matches outside comments/strings for token values).
- [ ] **`src/shared/ui/components/ConfirmDialog.test.tsx`** (RTL + jsdom):
  - `open=false` → dialog not in DOM.
  - `open=true` → dialog in DOM; confirm button exists; cancel button exists.
  - Clicking cancel calls `onCancel`.
  - Clicking confirm calls `onConfirm`.
  - Pressing Esc calls `onCancel`.
  - Danger confirm is NOT default-focused (cancel button is).
- [ ] **`src/shared/ui/QueryStateBoundary.test.tsx`** (RTL + jsdom):
  - `state='loading'` → renders skeleton (not children, not error, not empty).
  - `state='empty'` → renders `EmptyState` (not children, not skeleton).
  - `state='error'` → renders `ErrorState` (not children, not skeleton).
  - `state='ready'` → renders children.
  - Keyboard navigation: all interactive controls reachable via Tab.
- [ ] **Tablet-width layout** assertion (RTL with `jsdom`): render `AppShell` with `window.innerWidth = 768`; assert the shell renders without overflow.
- [ ] **Token lint test** (`src/shared/ui/tokens.lint.test.ts`): reads the CSS and TSX files in `src/shared/ui/` and asserts no raw 6-digit hex literal (`/#[0-9a-fA-F]{6}/`) appears outside of the token definition files (`colors_and_type.css`) and outside of comments. This codifies NFR-10.

### Task 19 — Conformance gates + DoD self-check
- [ ] `npx tsc -b` — clean (no enum; `import type` for type-only imports).
- [ ] `npm run lint` — clean; no unused variables or params.
- [ ] `npm run test` — all tests green (≥310 prior + new UI tests); no regressions.
- [ ] Self-check against DoD (§10).

## Dev Notes

### What this story IS and IS NOT

**IS:** The entire shared UI kernel — tokens, design system components, page templates, four-state boundary, and RecordPager/Side-view. Every screen in Epics 1–5 assembles from exactly these pieces and no others.

**IS NOT:**
- A login screen. The AppShell renders a demo role-switcher in the UserMenu; real auth flow (E0-S5) is already implemented.
- Real data. AppShell navigation is wired but feature pages (Epics 1–5) are not built here.
- A routing configuration. `src/app/router.tsx` is not modified in this story — AppShell accepts `children` from whoever wraps it.
- A new layout type. Even the ConversionInspector and saga inspector reuse `DetailPage`.

### Package installation (CRITICAL — do before writing any code)

```bash
npm install @tanstack/react-query react-router-dom react-hook-form @hookform/resolvers lucide-react
```

After install, confirm `npx tsc -b` is still clean before proceeding.

The ADR-006 mandate: `npm i @tanstack/react-query react-router-dom react-hook-form zod @hookform/resolvers` (zod is already installed; adding `lucide-react` for the Icon component).

### File locations (fixed — do not deviate)

```
src/shared/ui/
├── tokens.css                         # Task 1 — imports both token files + adds crm-layer
├── tokens/
│   ├── colors_and_type.css            # existing — DS tokens; do NOT modify
│   └── motion.css                     # existing — crm motion ramp; do NOT modify
├── QueryStateBoundary.tsx             # Task 13
├── components/
│   ├── Icon.tsx                       # Task 2
│   ├── StatusPill.tsx                 # Task 3
│   ├── Button.tsx                     # Task 4
│   ├── Skeleton.tsx                   # Task 5
│   ├── EmptyState.tsx                 # Task 6
│   ├── ErrorState.tsx                 # Task 6
│   ├── Toast.tsx                      # Task 7
│   ├── ToastHost.tsx                  # Task 7
│   ├── ConfirmDialog.tsx              # Task 8
│   ├── Toolbar.tsx                    # Task 9
│   ├── FilterBar.tsx                  # Task 9
│   ├── DataTable.tsx                  # Task 10
│   ├── AppShell.tsx                   # Task 11
│   └── RecordPager.tsx                # Task 12
└── templates/
    ├── ListPage.tsx                   # Task 14
    ├── DetailPage.tsx                 # Task 15
    ├── EntityForm.tsx                 # Task 16
    └── Dashboard.tsx                  # Task 17
```

**No barrel `index.ts`** — all prior stories use direct-file imports (e.g. `import { canTransition } from '../domain/status'`). Keep that pattern. Feature code will import like: `import { StatusPill } from '../../shared/ui/components/StatusPill'`.

### Compiler constraints (same as all prior E0 stories)

`tsconfig.app.json` sets `verbatimModuleSyntax: true` and `erasableSyntaxOnly: true` (`target: es2023`).
- **`import type` for type-only imports.** If you import only a type/interface, use `import type { ... }`.
- **No TS `enum`.** Use string-literal unions.
- **No bare `React` global** — React 19, ESM; always `import React from 'react'` or use named imports.
- Components must be `.tsx` (not `.ts`).

### Icon system: lucide-react

The prototype uses Lucide icons (via a global `window.lucide`). In the production code:
```tsx
import { ChevronRight, Search, Bell } from 'lucide-react';
// OR via the dynamic Icon wrapper (Task 2)
import { Icon } from '../../shared/ui/components/Icon';
// <Icon name="chevron-right" size={16} />
```

The dynamic `Icon` component converts kebab-case names to PascalCase to look up `lucide-react` named exports. This lets prototype code `<Icon name="chevron-right">` translate directly without renaming every usage.

### TokenCSS: what goes where

| Layer | File | Content |
|-------|------|---------|
| DS tokens | `src/shared/ui/tokens/colors_and_type.css` | ALL colors, typography, spacing, radii, shadows, z-index. **Already committed. Do NOT modify.** |
| Motion tokens | `src/shared/ui/tokens/motion.css` | `--crm-instant/fast/base/slow`, easings, `--crm-travel`. **Already committed. Do NOT modify.** |
| CRM layer | `src/shared/ui/tokens.css` | `@import` both above, plus `--crm-scrim`, `--crm-backdrop-blur`, `crm-skel` class + animation, `crm-pop` animation. |

In component files: **zero hardcoded hex/px/font**. Reference only `var(--iso-*)` or `var(--crm-*)` names.

Exception: the `--crm-scrim` and `--crm-backdrop-blur` variables in `tokens.css` contain the realized rgba/blur values — this is the DEC-CC-4 token definition point, not usage. Components reference `var(--crm-scrim)`, never `rgba(...)`.

### ModalShell / ConfirmDialog overlay (DEC-CC-4)

The DS exposes no scrim/blur tokens. DEC-CC-4 logs the realized values:
- Scrim: `rgba(15, 22, 38, 0.42)` — defined as `--crm-scrim` in `tokens.css`
- Blur: `blur(2px)` — defined as `--crm-backdrop-blur` in `tokens.css`

In `ConfirmDialog.tsx`:
```css
/* correct */
background: var(--crm-scrim);
backdrop-filter: var(--crm-backdrop-blur);
/* WRONG — never do this in a component */
background: rgba(15, 22, 38, 0.42);
```

### QueryStateBoundary: how it bridges TanStack Query

Feature hooks (built in Epics 1–5) will convert TanStack Query state:
```tsx
// In a feature hook (NOT this story — example for future):
import { toQueryState } from '../../shared/ui/QueryStateBoundary';
const { data, isLoading, isError } = useQuery({ queryKey: ['leads'], queryFn: fetchLeads });
const state = toQueryState(data?.data, isLoading, isError);
// <QueryStateBoundary state={state}>...</QueryStateBoundary>
```

The `QueryStateBoundary` itself never imports `@tanstack/react-query` — it stays adapter-agnostic.

### RecordPager & Side view (DEC-CC-3)

The UX spec resolves C-4: RecordPager + Side-view ARE in the inventory, built in this story.

**Side view**: the list is rendered beside the detail panel. The open row in the list is highlighted (uses `activeId` on `DataTable`). This is a two-pane split on the `DetailPage` template level — `sideList` prop contains the list, `children` contains the detail.

**Keyboard suppression** (required): The RecordPager keyboard shortcuts (↑↓←→/j/k/Esc) are active only when:
- A record detail is open (tracked by the page; not RecordPager's concern)
- No modal is open (ConfirmDialog sets `aria-modal="true"` — check `document.querySelector('[aria-modal="true"]')`)
- Focus is NOT inside `input`, `textarea`, or `select`

Check focus position in the `keydown` handler:
```tsx
const inInput = () => {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
};
```

**View mode persistence**: `localStorage.setItem('crm-view-mode', mode)` / `localStorage.getItem('crm-view-mode')`. This is a direct localStorage call (exception to the Repository rule — it's a UI preference, not a domain entity).

### AppShell navigation (role-gated)

The nav groups and their routes (map from the permission matrix in `src/shared/auth/permissions.ts`):

| Group | Item | Icon | Route |
|-------|------|------|-------|
| Workspace | Leads | `user-plus` | `/leads` |
| Workspace | Customers | `building-2` | `/customers` |
| Workspace | Tickets | `life-buoy` | `/tickets` |
| Tenancy | Subsidiaries | `layers` | `/subsidiaries` |
| Build (pinned bottom) | Components | `component` | (opens gallery state) |

Role gating: `tenant_admin` sees all; `sales` sees Leads + Customers; `support` sees Customers + Tickets; `viewer` sees Customers only. Use `can(session, 'list', entity)` from `permissions.ts` to gate nav items.

The `ScopeSwitcher` and `NotificationsBell` in Topbar are **placeholder slots** in this story (rendered as `null` or stub UI). E1-S4 and E0-S12 fill them.

### UserMenu "Switch role (demo)" — deferred E0-S5 item

From `deferred-work.md`: `signIn` returns `void`, so failure is signaled via the `Auth.LoginFailed` event on the bus. Pattern for UserMenu:

```tsx
import { bus } from '../../events/bus';
const handleSwitchRole = (roleId: string) => {
  const unsub = bus.subscribe('Auth.LoginFailed', () => {
    pushToast({ tone: 'danger', title: 'Role not found', body: `"${roleId}" is not a valid demo role.` });
    unsub();
  });
  signIn(roleId);
  // If Auth.LoggedIn fires instead, the bus subscriber never fires (memory cleanup after a timeout or on unmount)
};
```

### Testing: what works in this repo (from prior stories)

- **Vitest + RTL + jsdom** (already in devDependencies). Environment is `jsdom` for UI tests.
- Add `/// <reference types="vitest/globals" />` or configure in `vite.config.ts` if needed.
- Vitest config is in `vite.config.ts` (not a separate file). Check existing setup.
- **`@testing-library/react`** and **`@testing-library/dom`** are in devDependencies ✓.
- `localStorage` IS available in jsdom — RecordPager view-mode tests can use it directly.
- No Playwright for this story; template E2E coverage comes from feature stories (Epics 1–5).
- The vite config may need `test.environment: 'jsdom'` and `test.globals: true` — check `vite.config.ts` for the existing test config block.

### Vite config check

Before writing tests, confirm `vite.config.ts` has a `test` block:
```ts
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./src/test-setup.ts'],  // if it exists
}
```

If not, add it. If there's no `test-setup.ts`, create a minimal one that imports `@testing-library/jest-dom`.

### Previous story intelligence (E0-S8 — done)

From the completed logger story, these patterns are established and MUST be followed:
- **No `enum`**: string-literal union everywhere.
- **`import type`**: for type-only symbols. Runtime values (functions, components) use plain `import`.
- **ESLint has no `argsIgnorePattern`**: don't use unused `_`-prefixed params; drop them.
- **`import type`** is required for any interface-only import given `verbatimModuleSyntax: true`.
- **No second masker / no duplicate utilities**: reuse existing shared modules.

### E0-S5 deferred item (relevant to AppShell UserMenu)

From `deferred-work.md`: `signIn` gives the caller no programmatic failure signal. Resolution for this story: subscribe to `Auth.LoginFailed` on the bus immediately before calling `signIn()`, then unsubscribe on next event. Surface a `danger` toast.

### Architecture compliance guardrails

1. **NFR-1 one-way dependency**: `src/shared/ui/*` must import from siblings in `src/shared/` only. **Never** from `src/features/*` or `src/app/*`.
2. **No hardcoded hex/px/font/ms/curve** in any component (NFR-10). Token names only. The only exceptions are:
   - The token definition in `tokens.css` itself (DEC-CC-4 values).
   - The `--iso-shadow-*` tokens which already contain `rgba()` literals — but those are referenced via `var(--iso-shadow-*)` in components, not inline.
3. **StatusPill tone comes ONLY from STATUS_TONE**: never from a hardcoded tone string based on the status name directly. The feature layer calls `STATUS_TONE[entity][status]` and passes the result `tone` prop to `<StatusPill tone={tone}>`.
4. **Elevation reserved for transient overlays only** (dropdown/modal/toast). Saga inspector is in-page and does NOT elevate.
5. **Z-index ladder** (from DS tokens):
   - dropdown: `var(--iso-z-dropdown)` (100)
   - sticky: `var(--iso-z-sticky)` (200)
   - overlay: `var(--iso-z-overlay)` (800)
   - modal: `var(--iso-z-modal)` (900)
   - toast: `var(--iso-z-toast)` (1000)
6. **Focus trapping in ConfirmDialog**: cycle Tab within the dialog. On open, focus the safe (Cancel) button. On close, restore focus to the trigger element.

### Definition of Done (scoped for a UI kernel story) — constitution §10

**Applicable & met when:**
- Meets all 6 ACs
- `npx tsc -b` clean (no enum; `import type` for type-only imports)
- `npm run lint` clean
- `npm run test` — all tests green (≥310 prior + new UI tests)
- All components in the inventory built and accessible
- Tokens-only: no raw hex/px/font in any component file
- ConfirmDialog focus-trapping works; danger confirm never default-focused
- RecordPager keyboard nav suppresses in inputs/modals
- View mode persisted in localStorage
- Passes `bmad-code-review`
- Traceable chain (`Closes #<issue>`)

**N/A for this story:** 4-beat orchestration (no mutations), REST status codes (no HTTP), domain events (no mutations), audit records (no mutations). The UI components fire no domain events — those are the feature layer's responsibility (Epics 1–5).

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-0-platform-guidelines/E0-S9.md] — story spec & ACs
- [Source: prototype/app/shell.jsx] — AppShell, ScopeSwitcher, NotificationsBell, UserMenu prototype
- [Source: prototype/app/components_core.jsx] — StatusPill, Button, FieldShell, TextField, SelectField, DateField, Skeleton, EmptyState, ErrorState, Toast
- [Source: prototype/app/components_data.jsx] — Toolbar, FilterBar, FilterChip, RowActions, DataTable, ConfirmDialog
- [Source: prototype/app/templates.jsx] — PageHeader, ListPage, DetailPage
- [Source: prototype/app/shared_records.jsx] — RecordPager, RecordTimeline
- [Source: prototype/tokens/motion.css] — `--crm-*` motion tokens (already in `src/shared/ui/tokens/motion.css`)
- [Source: prototype/tokens/colors_and_type.css] — DS tokens (already in `src/shared/ui/tokens/colors_and_type.css`)
- [Source: prototype/screenshots/sideview.png] — Side view visual oracle ("2 of 4 · Leads")
- [Source: prototype/screenshots/01-roles.png] — Component gallery / StatusPill dot+icon variants
- [Source: src/shared/domain/status.ts] — STATUS_TONE (the ONLY source for pill tone)
- [Source: src/shared/data/Repository.ts] — Page<T>, ListQuery (for list templates)
- [Source: src/shared/auth/permissions.ts] — can() for nav role-gating
- [Source: src/shared/auth/useAuth.ts] — useAuth() hook (signIn, signOut, session)
- [Source: src/shared/events/bus.ts] — subscribe/publish (UserMenu role-switch failure pattern)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — E0-S5 signIn failure item, E0-S4 UserMenu re-auth note
- [Source: architecture.md:804-808] — file structure
- [Source: architecture.md ADR-006] — TanStack Query + RHF + Zod + React Router
- [Source: architecture.md ADR-007] — optimistic mutations + toast rollback
- [Source: architecture.md NFR-10] — fixed UI inventory + tokens only
- PRD: prd.md §6 E0-S9 · ADR(s): ADR-006, ADR-007 · Inherited UC: UC-1, TC · Constitution: §8

## Dev Agent Record

### Agent Model Used

_to be filled by dev agent_

### Debug Log References

_to be filled by dev agent_

### Completion Notes List

_to be filled by dev agent_

### File List

_to be filled by dev agent_

### Review Findings

_to be filled by code review agent_

## Change Log

| Date       | Change |
|------------|--------|
| 2026-06-08 | Story context created (ready-for-dev): shared component inventory — AppShell, DataTable, StatusPill, Toolbar, FilterBar, EntityForm fields, ConfirmDialog, Toast, EmptyState, ErrorState, Skeleton, RecordPager (DEC-CC-3); templates ListPage, DetailPage, EntityForm, Dashboard; QueryStateBoundary; tokens.css with DEC-CC-4 scrim tokens. ADR-006 package installs required. |
