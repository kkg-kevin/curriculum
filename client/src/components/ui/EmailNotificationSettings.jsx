import toast from "react-hot-toast";
import { useEmailPreferences, useUpdateEmailPreferences } from "../../modules/notifications/hooks/useNotifications";

export function Toggle({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        position: "relative", width: 34, height: 20, flexShrink: 0, border: "none", borderRadius: 10, padding: 0,
        backgroundColor: checked ? "#25476a" : "#D1D5DB", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1,
        transition: "background-color .15s",
      }}
    >
      <span style={{ position: "absolute", top: 2, left: checked ? 16 : 2, width: 16, height: 16, borderRadius: "50%", backgroundColor: "#fff", transition: "left .15s" }} />
    </button>
  );
}

// Which notifications this account also gets by email. Shown inside the notifications bell and
// on each portal's profile page, so every role reaches it from the same places — and, given a
// `token`, on the page an email's footer link opens for someone who isn't signed in (`highlight`
// is the type of the email they came from). Account emails (password resets) and invoices are
// not listed: those are always sent.
export default function EmailNotificationSettings({ token, highlight, padding = "12px 16px" }) {
  const { data, isLoading, isError, error } = useEmailPreferences({ token });
  const { mutate: update, isPending } = useUpdateEmailPreferences({ token });
  const save = (patch) => update(patch, { onError: (err) => toast.error(err.message || "Could not save email settings") });

  const text = { margin: 0, fontSize: 12, color: "#6B7280", lineHeight: 1.5 };
  if (isLoading) return <p style={{ ...text, padding }}>Loading…</p>;
  if (isError || !data) return <p style={{ ...text, padding }}>{(token && error?.message) || "Email settings could not be loaded."}</p>;

  if (!data.email) {
    return <p style={{ ...text, padding }}>This account has no email address, so notifications are shown here only.</p>;
  }
  if (data.types.length === 0) {
    return <p style={{ ...text, padding }}>There are no emailed notifications for this account type yet.</p>;
  }

  return (
    <div style={{ padding, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#111827" }}>Email me notifications</p>
          <p style={{ ...text, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Sent to {data.email}</p>
        </div>
        <Toggle checked={data.enabled} disabled={isPending} onChange={(enabled) => save({ enabled })} label="Email me notifications" />
      </div>
      {data.enabled && data.types.map((t) => (
        <div key={t.type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ ...text, color: "#374151", fontWeight: t.type === highlight ? 700 : 400 }}>{t.label}</p>
            {/* The workspace's admin has stopped this email for everyone (Settings → Emails). */}
            {t.workspaceOff && <p style={{ ...text, fontSize: 11, color: "#9CA3AF" }}>Not sent at the moment — switched off by your organisation.</p>}
          </div>
          <Toggle checked={t.enabled && !t.workspaceOff} disabled={isPending || t.workspaceOff} onChange={(enabled) => save({ types: { [t.type]: enabled } })} label={t.label} />
        </div>
      ))}
    </div>
  );
}
