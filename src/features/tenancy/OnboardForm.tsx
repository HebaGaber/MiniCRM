// OnboardForm — modal for onboarding a new subsidiary (E1-S2, AC5).
// Optimistic create: repo.create() persists immediately; row appears in the list.
// OutcomePicker injects a simulated "server error": after ~700ms the row is
// removed from storage (repo.remove) + rolled back from UI state + persistent
// danger toast fires ("Couldn't onboard — rolled back").
// Motion: modal enter crm-pop at --crm-base; rollback snap-back at --crm-slow.
// Focus-trap, first-field autofocus, Esc cancels (prototype §UX).

import { useEffect, useRef, useState } from "react";
import type { Repository } from "../../shared/data/Repository";
import type { Subsidiary } from "../../shared/domain/tenant.types";
import { EntityForm, TextField, SelectField } from "../../shared/ui/templates/EntityForm";
import { Icon } from "../../shared/ui/components/Icon";
import { pushToast } from "../../shared/ui/components/Toast";
import { z } from "zod";

// ── Form schema (user-supplied fields only — BaseEntity fields are set by repo) ──
const onboardFormSchema = z.object({
  name: z.string().min(1, "Subsidiary name is required"),
  parentSubsidiaryId: z.string().nullable(),
});
type OnboardFormValues = z.infer<typeof onboardFormSchema>;

type Props = {
  repo: Repository<Subsidiary>;
  activeSubs: Subsidiary[];
  onClose: () => void;
  onOptimisticAdd: (sub: Subsidiary) => void;
  onRollback: (id: string) => void;
};

export function OnboardForm({ repo, activeSubs, onClose, onOptimisticAdd, onRollback }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [outcome, setOutcome] = useState<"success" | "fail">("success");

  // Focus-trap + Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusable = Array.from(
          panel.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
            "input,select,button",
          ),
        ).filter((el) => !el.disabled);
        if (!focusable.length) return;
        const [first] = focusable;
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const handleSubmit = async (values: OnboardFormValues) => {
    let created: Subsidiary;
    try {
      created = await repo.create({
        name: values.name,
        parentSubsidiaryId: values.parentSubsidiaryId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create subsidiary";
      pushToast({ tone: "danger", title: "Failed to create subsidiary", body: msg });
      return;
    }

    // Optimistic row appears at --crm-instant
    onOptimisticAdd(created);
    onClose();

    if (outcome === "fail") {
      // Simulate server rejection: rollback after ~700ms (snap-back at --crm-slow)
      setTimeout(async () => {
        try {
          await repo.remove(created.id);
        } catch {
          // ignore remove error in simulation
        }
        onRollback(created.id);
        pushToast({
          tone: "danger",
          title: "Couldn't onboard — rolled back.",
          body: "The subsidiary was removed. Try again.",
          action: { label: "Retry", onClick: () => {} },
        });
      }, 700);
    } else {
      pushToast({
        tone: "success",
        title: "Subsidiary onboarded.",
        body: `${created.name} inherits the tenant configuration by default.`,
      });
    }
  };

  const parentOptions = [
    { value: "", label: "Top-level (no parent)" },
    ...activeSubs.map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    // Scrim + top-anchored layout (prototype ModalShell). DEC-CC-4: scrim/blur are DS
    // tokens, never a raw rgba(); the panel is anchored ~64px from top, not centered.
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--iso-z-modal)",
        background: "var(--crm-scrim)",
        backdropFilter: "var(--crm-backdrop-blur)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "64px 24px",
        overflow: "auto",
        animation: "crm-fade var(--crm-base) var(--crm-ease-decelerate)",
      }}
    >
      {/* Panel — crm-pop modal enter */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Onboard subsidiary"
        style={{
          width: "500px",
          maxWidth: "100%",
          animation: "crm-pop var(--crm-base) var(--crm-ease-decelerate)",
        }}
      >
        <EntityForm<OnboardFormValues>
          title="Onboard subsidiary"
          noun="subsidiary"
          schema={onboardFormSchema}
          defaultValues={{ name: "", parentSubsidiaryId: null }}
          submitLabel="Onboard subsidiary"
          onCancel={onClose}
          onSubmit={handleSubmit}
        >
          {(form) => (
            <>
              <TextField
                label="Subsidiary name"
                required
                placeholder="e.g. LATAM subsidiary"
                error={form.formState.errors.name?.message}
                value={form.watch("name")}
                onChange={(v) => form.setValue("name", v, { shouldValidate: true })}
                data-testid="sub-name"
                autoFocus
              />

              <SelectField
                label="Parent"
                options={parentOptions}
                placeholder="Top-level (no parent)"
                value={form.watch("parentSubsidiaryId") ?? ""}
                onChange={(v) =>
                  form.setValue("parentSubsidiaryId", v === "" ? null : v)
                }
                help="Choose an existing subsidiary to nest under, or keep it top-level."
              />

              {/* Config inheritance info strip */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "11px 13px",
                  borderRadius: "var(--iso-radius-sm)",
                  background: "var(--iso-blue-3-50)",
                  border: "1px solid var(--iso-border-muted)",
                }}
              >
                <Icon
                  name="info"
                  size={15}
                  style={{ color: "var(--iso-accent)", marginTop: 1, flexShrink: 0 }}
                />
                <span
                  style={{
                    font: "400 12px/1.5 var(--iso-font-ui)",
                    color: "var(--iso-fg-muted)",
                  }}
                >
                  The new subsidiary inherits the tenant configuration by default. You can
                  adjust it afterward.
                </span>
              </div>

              <OutcomePicker outcome={outcome} onChange={setOutcome} />
            </>
          )}
        </EntityForm>
      </div>
    </div>
  );
}

// ── OutcomePicker — fault-injection toggle (ADR-007) ─────────────────────────

function OutcomePicker({
  outcome,
  onChange,
}: {
  outcome: "success" | "fail";
  onChange: (v: "success" | "fail") => void;
}) {
  const options = [
    { value: "success", label: "Success" },
    { value: "fail", label: "Server error" },
  ] as const;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 13px",
        borderRadius: "var(--iso-radius-md)",
        background: "var(--iso-blue-3-50)",
        border: "1px dashed var(--iso-blue-3-300)",
      }}
    >
      <Icon
        name="flask-conical"
        size={15}
        style={{ color: "var(--iso-accent)", flexShrink: 0 }}
      />
      <span
        style={{ flex: 1, font: "400 12px/1.3 var(--iso-font-ui)", color: "var(--iso-fg-muted)" }}
      >
        Simulate server response
      </span>
      <div
        style={{
          display: "inline-flex",
          gap: 2,
          padding: 2,
          background: "var(--iso-bg)",
          border: "1px solid var(--iso-border)",
          borderRadius: "var(--iso-radius-sm)",
        }}
      >
        {options.map((o) => {
          const active = outcome === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              data-testid={`outcome-${o.value}`}
              style={{
                height: 26,
                padding: "0 10px",
                border: 0,
                borderRadius: "var(--iso-radius-xs)",
                background: active ? "var(--iso-brand-soft)" : "transparent",
                color: active ? "var(--iso-brand)" : "var(--iso-fg-muted)",
                font: `${active ? 500 : 400} 11px/1 var(--iso-font-ui)`,
                cursor: "pointer",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
