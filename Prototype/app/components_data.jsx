/* global React, Icon, Button, StatusPill, Skeleton, EmptyState, ErrorState, SectionLabel */
/* min-crm — data & overlay components.
   DataTable (4 states) · Toolbar · FilterBar · Pagination · ConfirmDialog · RowActions. */
const { useState: useStateD, useEffect: useEffectD, useRef: useRefD } = React;

/* ---------------- Toolbar (search + slots) ---------------- */
function Toolbar({ children, onSearch, searchValue, searchPlaceholder = 'Search…', right }) {
  const [f, setF] = useStateD(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--iso-space-3)', flexWrap: 'wrap',
      padding: 'var(--iso-space-3) var(--iso-space-4)', borderBottom: '1px solid var(--iso-border-muted)' }}>
      {onSearch && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 12px', flex: '0 1 280px',
          border: `1px solid ${f ? 'var(--iso-brand)' : 'var(--iso-border)'}`, borderRadius: 'var(--iso-radius-sm)', background: '#fff',
          boxShadow: f ? 'var(--iso-shadow-focus)' : 'none',
          transition: 'border-color var(--crm-fast) var(--crm-ease-standard), box-shadow var(--crm-fast) var(--crm-ease-standard)' }}>
          <Icon name="search" size={15} style={{ color: 'var(--iso-fg-subtle)' }} />
          <input value={searchValue ?? ''} placeholder={searchPlaceholder} onChange={(e) => onSearch(e.target.value)}
            onFocus={() => setF(true)} onBlur={() => setF(false)}
            style={{ flex: 1, border: 0, outline: 0, background: 'transparent', font: '400 13px/1 var(--iso-font-body)', color: 'var(--iso-fg)', minWidth: 0 }} />
        </span>
      )}
      {children}
      {right && <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--iso-space-2)' }}>{right}</div>}
    </div>
  );
}

/* ---------------- FilterBar (chips) ---------------- */
function FilterChip({ children, selected, onClick, count, removable }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 11px',
      border: `1px solid ${selected ? 'var(--iso-brand)' : 'var(--iso-border)'}`, borderRadius: 'var(--iso-radius-sm)',
      background: selected ? 'var(--iso-brand-soft)' : '#fff', color: selected ? 'var(--iso-brand)' : 'var(--iso-fg-muted)',
      font: '500 12px/1 var(--iso-font-body)', cursor: 'pointer',
      transition: 'border-color var(--crm-fast) var(--crm-ease-standard), color var(--crm-fast) var(--crm-ease-standard)' }}>
      {children}
      {count != null && <span style={{ opacity: 0.7 }}>{count}</span>}
      {removable && selected && <Icon name="x" size={12} strokeWidth={2} />}
    </button>
  );
}
function FilterBar({ groups = [], sort }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--iso-space-3)', flexWrap: 'wrap',
      padding: 'var(--iso-space-3) var(--iso-space-4)', borderBottom: '1px solid var(--iso-border-muted)', background: 'var(--iso-blue-3-50)' }}>
      <Icon name="filter" size={14} style={{ color: 'var(--iso-fg-subtle)' }} />
      {groups.map((g, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{g}</div>
      ))}
      {sort && <div style={{ marginLeft: 'auto' }}>{sort}</div>}
    </div>
  );
}

/* ---------------- Row actions (kebab) ---------------- */
function RowActions({ actions = [] }) {
  const [open, setOpen] = useStateD(false);
  const ref = useRefD(null);
  useEffectD(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }} aria-label="Row actions" style={{
        width: 30, height: 30, borderRadius: 'var(--iso-radius-sm)', border: '1px solid transparent', background: open ? 'var(--iso-n-100)' : 'transparent',
        color: 'var(--iso-fg-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="more-horizontal" size={16} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 34, right: 0, minWidth: 168, background: '#fff', border: '1px solid var(--iso-border)',
          borderRadius: 'var(--iso-radius-md)', boxShadow: 'var(--iso-shadow-lg)', padding: 4, zIndex: 'var(--iso-z-dropdown)' }}>
          {actions.map((a, i) => (
            <button key={i} onClick={(e) => { e.stopPropagation(); setOpen(false); a.onClick?.(); }} style={{
              display: 'flex', alignItems: 'center', gap: 9, width: '100%', height: 34, padding: '0 10px', border: 0, background: 'transparent',
              borderRadius: 'var(--iso-radius-xs)', cursor: 'pointer', textAlign: 'left',
              font: '400 13px/1 var(--iso-font-body)', color: a.tone === 'danger' ? 'var(--iso-danger)' : 'var(--iso-fg)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = a.tone === 'danger' ? 'var(--iso-danger-soft)' : 'var(--iso-n-100)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              {a.icon && <Icon name={a.icon} size={14} />}{a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- DataTable (loading / empty / error / ready) ---------------- */
function DataTable({ columns = [], rows = [], state = 'ready', onRetry, empty, rowActions, onRowClick, skeletonRows = 6, activeId, sortCol, sortDir, onSort }) {
  const gridCols = columns.map(c => c.width || '1fr').join(' ') + (rowActions ? ' 44px' : '');
  const HeaderRow = (
    <div role="row" style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 'var(--iso-space-4)', alignItems: 'center',
      padding: '0 var(--iso-space-4)', height: 40, borderBottom: '1px solid var(--iso-border)', background: 'var(--iso-blue-3-50)' }}>
      {columns.map((c, i) => {
        const sortable = onSort && c.id;
        const active = sortable && sortCol === c.id;
        const base = { font: '500 10px/1 var(--iso-font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase',
          color: active ? 'var(--iso-brand)' : 'var(--iso-fg-subtle)', textAlign: c.align || 'left' };
        if (!sortable) return <div key={i} role="columnheader" style={base}>{c.header}</div>;
        return (
          <button key={i} role="columnheader" aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={() => onSort(c)}
            style={{ ...base, display: 'inline-flex', alignItems: 'center', gap: 4, border: 0, background: 'transparent', cursor: 'pointer', padding: 0,
              justifyContent: c.align === 'right' ? 'flex-end' : 'flex-start' }}>
            {c.header}
            <Icon name={active ? (sortDir === 'asc' ? 'arrow-up' : 'arrow-down') : 'chevrons-up-down'} size={12} style={{ color: active ? 'var(--iso-brand)' : 'var(--iso-n-300)' }} />
          </button>
        );
      })}
      {rowActions && <div />}
    </div>
  );

  let bodyContent;
  if (state === 'loading') {
    bodyContent = Array.from({ length: skeletonRows }).map((_, r) => (
      <div key={r} role="row" style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 'var(--iso-space-4)', alignItems: 'center',
        padding: '0 var(--iso-space-4)', height: 52, borderBottom: '1px solid var(--iso-border-muted)' }}>
        {columns.map((c, i) => <Skeleton key={i} w={c.skelW || (i === 0 ? '70%' : '45%')} h={12} />)}
        {rowActions && <Skeleton w={18} h={18} r={4} />}
      </div>
    ));
  } else if (state === 'error') {
    bodyContent = <ErrorState onRetry={onRetry} />;
  } else if (state === 'empty') {
    bodyContent = <EmptyState {...(empty || { title: 'Nothing here yet', body: 'When records exist in this scope, they appear here.' })} />;
  } else {
    bodyContent = rows.map((row, r) => (
      <div key={row.id ?? r} role="row" tabIndex={0}
        onClick={() => onRowClick?.(row)}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onRowClick) { e.preventDefault(); onRowClick(row); } }}
        className="crm-trow" data-active={activeId != null && row.id === activeId ? 'true' : undefined}
        style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 'var(--iso-space-4)', alignItems: 'center',
          padding: '0 var(--iso-space-4)', minHeight: 52, borderBottom: '1px solid var(--iso-border-muted)',
          background: activeId != null && row.id === activeId ? 'var(--iso-brand-soft)' : undefined,
          boxShadow: activeId != null && row.id === activeId ? 'inset 3px 0 0 var(--iso-brand)' : undefined,
          cursor: onRowClick ? 'pointer' : 'default', outline: 'none',
          transition: 'color var(--crm-fast) var(--crm-ease-standard)' }}>
        {columns.map((c, i) => (
          <div key={i} style={{ font: '400 13px/1.4 var(--iso-font-body)', color: 'var(--iso-fg)', textAlign: c.align || 'left', minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: c.wrap ? 'normal' : 'nowrap' }}>
            {c.render ? c.render(row) : row[c.key]}
          </div>
        ))}
        {rowActions && <div style={{ display: 'flex', justifyContent: 'flex-end' }}><RowActions actions={rowActions(row)} /></div>}
      </div>
    ));
  }

  return (
    <div role="table" style={{ display: 'flex', flexDirection: 'column' }}>
      {HeaderRow}
      <div>{bodyContent}</div>
    </div>
  );
}

/* ---------------- Pagination ---------------- */
function Pagination({ page = 1, pageCount = 1, total, perPage = 25, onPage, disabled }) {
  const go = (p) => { if (!disabled && p >= 1 && p <= pageCount) onPage?.(p); };
  const nums = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 'var(--iso-space-3) var(--iso-space-4)', flexWrap: 'wrap' }}>
      <span style={{ font: '400 12px/1 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)' }}>
        {total != null ? `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} of ${total}` : `Page ${page} of ${pageCount}`}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <PagBtn disabled={disabled || page <= 1} onClick={() => go(page - 1)}><Icon name="chevron-left" size={15} /></PagBtn>
        {nums.map((n, i) => n === '…'
          ? <span key={i} style={{ width: 18, textAlign: 'center', color: 'var(--iso-fg-subtle)', font: '400 12px/1 var(--iso-font-ui)' }}>…</span>
          : <PagBtn key={i} active={n === page} disabled={disabled} onClick={() => go(n)}>{n}</PagBtn>)}
        <PagBtn disabled={disabled || page >= pageCount} onClick={() => go(page + 1)}><Icon name="chevron-right" size={15} /></PagBtn>
      </div>
    </div>
  );
}
function PagBtn({ children, active, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      minWidth: 30, height: 30, padding: '0 6px', borderRadius: 'var(--iso-radius-sm)',
      border: `1px solid ${active ? 'var(--iso-brand)' : 'transparent'}`,
      background: active ? 'var(--iso-brand-soft)' : 'transparent', color: active ? 'var(--iso-brand)' : 'var(--iso-fg-muted)',
      font: '500 12px/1 var(--iso-font-ui)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      transition: 'color var(--crm-fast) var(--crm-ease-standard)' }}>{children}</button>
  );
}

/* ---------------- ConfirmDialog (focus-trapped, Esc cancels, safe default) ---------------- */
function ConfirmDialog({ open, title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'danger', onConfirm, onCancel }) {
  const cancelRef = useRefD(null);
  const panelRef = useRefD(null);
  useEffectD(() => {
    if (!open) return;
    // focus the SAFE control (cancel), never the destructive one
    const t = setTimeout(() => cancelRef.current?.focus(), 0);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel?.(); }
      if (e.key === 'Tab') {
        const f = panelRef.current?.querySelectorAll('button');
        if (!f || !f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); };
  }, [open]);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 'var(--iso-z-modal)', background: 'rgba(15,22,38,0.42)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        animation: 'crm-fade var(--crm-base) var(--crm-ease-decelerate)' }}>
      <div ref={panelRef} style={{ width: 420, maxWidth: '100%', background: '#fff', borderRadius: 'var(--iso-radius-lg)', boxShadow: 'var(--iso-shadow-modal)',
        animation: 'crm-pop var(--crm-base) var(--crm-ease-decelerate)' }}>
        <div style={{ padding: 'var(--iso-space-6) var(--iso-space-6) var(--iso-space-4)', display: 'flex', gap: 14 }}>
          <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 'var(--iso-radius-sm)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: tone === 'danger' ? 'var(--iso-danger-soft)' : 'var(--iso-brand-soft)', color: tone === 'danger' ? 'var(--iso-danger)' : 'var(--iso-brand)' }}>
            <Icon name={tone === 'danger' ? 'alert-triangle' : 'help-circle'} size={20} strokeWidth={1.8} />
          </span>
          <div>
            <h3 style={{ margin: '2px 0 6px', font: '500 18px/1.3 var(--iso-font-display)', color: 'var(--iso-fg-strong)' }}>{title}</h3>
            <p style={{ margin: 0, font: '400 13px/20px var(--iso-font-body)', color: 'var(--iso-fg-muted)', textWrap: 'pretty' }}>{body}</p>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--iso-space-2)', padding: 'var(--iso-space-4) var(--iso-space-6) var(--iso-space-6)' }}>
          <Button ref={cancelRef} variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Toolbar, FilterChip, FilterBar, RowActions, DataTable, Pagination, ConfirmDialog });
