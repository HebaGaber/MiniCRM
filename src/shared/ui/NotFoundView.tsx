// NotFoundView (E1-S1, AC3 UX): the calm centered 404 surface shown when a record
// is out of the user's tenant/subsidiary scope. The copy is explicitly NOT a
// permission warning — it never discloses that the record exists elsewhere (ADR-009
// 404-not-403: existence is never revealed, only that the record isn't in this scope).
//
// Props: `scopeName` for personalised copy; `onBack` to return to the scoped list.

import { Icon } from "./components/Icon";
import { Button } from "./components/Button";

export interface NotFoundViewProps {
  /** Human-readable name of the active scope (from `useTenant().scopeName`). */
  scopeName: string;
  /** Called when the user activates the "Back to <scopeName>" button. */
  onBack: () => void;
}

/**
 * Renders the out-of-scope 404 surface (E1-S1 AC3, ADR-009).
 * - Compass glyph — visually distinct from error/empty surfaces.
 * - Eyebrow: "404 · not found"
 * - Heading: "Not found in this workspace"
 * - Body: contextual copy referencing `scopeName`; never implies denial.
 * - Primary action: "Back to <scopeName>" → `onBack()`
 */
export function NotFoundView({ scopeName, onBack }: NotFoundViewProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "320px",
        padding: "var(--iso-space-12) var(--iso-space-8)",
        textAlign: "center",
        gap: "var(--iso-space-4)",
      }}
    >
      {/* Compass glyph — distinct from the ErrorState icon */}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "56px",
          height: "56px",
          borderRadius: "var(--iso-radius-full)",
          background: "var(--iso-n-100)",
          color: "var(--iso-fg-muted)",
        }}
        aria-hidden="true"
      >
        <Icon name="compass" size={28} />
      </span>

      {/* Eyebrow */}
      <p
        style={{
          font: "500 11px/1 var(--iso-font-ui)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--iso-fg-subtle)",
          margin: 0,
        }}
      >
        404 · not found
      </p>

      {/* Heading */}
      <h2
        style={{
          font: "600 20px/1.2 var(--iso-font-display)",
          color: "var(--iso-fg-strong)",
          margin: 0,
        }}
      >
        Not found in this workspace
      </h2>

      {/* Body — no mention of permissions, no existence disclosure */}
      <p
        style={{
          font: "400 14px/1.5 var(--iso-font-body)",
          color: "var(--iso-fg-muted)",
          maxWidth: "360px",
          margin: 0,
        }}
      >
        {`This record is not available in ${scopeName}.`}
      </p>

      {/* Primary action */}
      <Button
        variant="primary"
        size="md"
        onClick={onBack}
      >
        {`Back to ${scopeName}`}
      </Button>
    </div>
  );
}
