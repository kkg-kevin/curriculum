import toast from "react-hot-toast";
import { useEmailPreferences, useUpdateEmailPreferences } from "../../modules/notifications/hooks/useNotifications";

function Toggle({ checked, disabled, onChange, label }) {
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

// Which notifications this account also gets by email — shown inside the notifications bell, so
// every role reaches it from the same place. Account emails (password resets) and invoices are
// not listed: those are always sent.
export default function EmailNotificationSettings() {
  const { data, isLoading, isError } = useEmailPreferences();
  const { mutate: update, isPending } = useUpdateEmailPreferences();
  const save = (patch) => update(patch, { onError: (err) => toast.error(err.message || "Could not save email settings") });

  const text = { margin: 0, fontSize: 12, color: "#6B7280", lineHeight: 1.5 };
  if (isLoading) return <p style={{ ...text, padding: "12px 16px" }}>Loading…</p>;
  if (isError || !data) return <p style={{ ...text, padding: "12px 16px" }}>Email settings could not be loaded.</p>;

  if (!data.email) {
    return <p style={{ ...text, padding: "12px 16px" }}>This account has no email address, so notifications are shown here only.</p>;
  }
  if (data.types.length === 0) {
    return <p style={{ ...text, padding: "12px 16px" }}>There are no emailed notifications for this account type yet.</p>;
  }

  return (
    <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#111827" }}>Email me notifications</p>
          <p style={{ ...text, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Sent to {data.email}</p>
        </div>
        <Toggle checked={data.enabled} disabled={isPending} onChange={(enabled) => save({ enabled })} label="Email me notifications" />
      </div>
      {data.enabled && data.types.map((t) => (
        <div key={t.type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <p style={{ ...text, color: "#374151" }}>{t.label}</p>
          <Toggle checked={t.enabled} disabled={isPending} onChange={(enabled) => save({ types: { [t.type]: enabled } })} label={t.label} />
        </div>
      ))}
    </div>
  );
}
