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
import { Button } from "../../shared/ui/components/Button";
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
          title: "Couldn't onboard — rolled back",
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
    <>
      {/* Backdrop */}
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.25)",
          zIndex: 200,
        }}
      />
      {/* Panel — crm-pop modal enter */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Onboard subsidiary"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "500px",
          maxWidth: "calc(100vw - 32px)",
          zIndex: 201,
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
                  background: "var(--iso-brand-soft)",
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
    </>
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
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--iso-space-3)",
        padding: "var(--iso-space-2) var(--iso-space-3)",
        borderRadius: "var(--iso-radius-sm)",
        background: "var(--iso-bg-subtle)",
        border: "1px solid var(--iso-border-muted)",
      }}
    >
      <span
        style={{ font: "500 11px/1 var(--iso-font-ui)", color: "var(--iso-fg-subtle)" }}
      >
        Simulate server response:
      </span>
      {(["success", "fail"] as const).map((val) => (
        <Button
          key={val}
          variant={outcome === val ? "primary" : "ghost"}
          size="sm"
          type="button"
          onClick={() => onChange(val)}
          data-testid={`outcome-${val}`}
        >
          {val === "success" ? "Success" : "Server error"}
        </Button>
      ))}
    </div>
  );
}
