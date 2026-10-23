// The shared shape of a settings page (Certificates, Payments, Educator pay): a short page header,
// then one card per topic — a title and one line saying what it's for, the fields, and an optional
// footer bar holding that card's buttons. Fields are a label, the control, and at most one short
// note under it (a warning when something's wrong).

const COLORS = { ink: "#111827", muted: "#6B7280", faint: "#9CA3AF", border: "#E5E7EB", warn: "#B45309", error: "#B91C1C" };

// Full width of the settings card, end to end — the same as the Competencies tab.
export function SettingsPage({ title, description, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.ink }}>{title}</h2>
        {description && <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.muted, lineHeight: 1.55 }}>{description}</p>}
      </header>
      {children}
    </div>
  );
}

export function SettingsSection({ title, description, aside, footer, children, as = "section", onSubmit }) {
  const Tag = as;
  return (
    <Tag onSubmit={onSubmit} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 14, background: "#fff", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", borderBottom: children ? `1px solid #F3F4F6` : "none" }}>
        <div style={{ minWidth: 0, flex: "1 1 280px" }}>
          <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: COLORS.ink }}>{title}</h3>
          {description && <p style={{ margin: "3px 0 0", fontSize: 12.5, color: COLORS.muted, lineHeight: 1.5 }}>{description}</p>}
        </div>
        {aside && <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{aside}</div>}
      </div>
      {children && <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>}
      {footer && (
        <div style={{ padding: "12px 20px", background: "#F9FAFB", borderTop: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {footer}
        </div>
      )}
    </Tag>
  );
}

// Fields laid out in columns that wrap on narrow screens.
export function FieldGrid({ children, min = 200 }) {
  return <div style={{ display: "grid", gap: 14, gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))` }}>{children}</div>;
}

export function Field({ label, htmlFor, note, warning, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      {label && <label htmlFor={htmlFor} style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#374151", marginBottom: 5 }}>{label}</label>}
      {children}
      {(warning || note) && <p style={{ margin: "5px 0 0", fontSize: 11.5, lineHeight: 1.45, color: warning ? COLORS.warn : COLORS.muted }}>{warning || note}</p>}
    </div>
  );
}

// A small heading inside a card, for a group of fields.
export function SubHeading({ children, note }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>{children}</p>
      {note && <p style={{ margin: "3px 0 0", fontSize: 12, color: COLORS.muted, lineHeight: 1.45 }}>{note}</p>}
    </div>
  );
}

// "Ready" / "Not set up" style status, for a card's aside.
export function StatusDot({ ok, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: ok ? "#047857" : COLORS.muted, background: ok ? "#ECFDF5" : "#F3F4F6" }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: ok ? "#10B981" : "#D1D5DB" }} />{children}
    </span>
  );
}

export function FooterNote({ children }) {
  return <span style={{ fontSize: 12, color: COLORS.muted }}>{children}</span>;
}

export function LoadState({ isLoading, isError, what }) {
  if (isLoading) return <p style={{ margin: 0, fontSize: 13, color: COLORS.muted }}>Loading…</p>;
  if (isError) return <p style={{ margin: 0, fontSize: 13, color: COLORS.error }}>{what} could not be loaded.</p>;
  return null;
}
