import { useState } from "react";
import toast from "react-hot-toast";
import { FiAward, FiBell, FiBookOpen, FiCalendar, FiChevronDown, FiChevronRight, FiClipboard, FiCreditCard, FiDollarSign, FiGift, FiHeart, FiInbox, FiMessageCircle, FiShield } from "react-icons/fi";
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

// Each emailed notification type in a topic, by the start of its key — so a long list (an educator
// has 20+) reads as a few groups. Anything unknown falls into "Other".
const GROUPS = [
  { key: "mentor-checkins", label: "Parent check-ins", icon: FiMessageCircle, match: (t) => t.startsWith("mentor_checkin_") },
  { key: "mentor-bookings", label: "Mentor sessions", icon: FiCalendar, match: (t) => t.startsWith("mentor_booking_") || t === "mentor_help_requested" },
  { key: "checkins", label: "Hub check-ins", icon: FiClipboard, match: (t) => t.startsWith("checkin_") },
  { key: "quality", label: "Quality reviews", icon: FiShield, match: (t) => t.startsWith("qa_") },
  { key: "feedback", label: "Feedback & your profile", icon: FiHeart, match: (t) => t.startsWith("mentor_review") || t.startsWith("educator_profile") || t === "mentor_requested" },
  { key: "learning", label: "Learning & reports", icon: FiAward, match: (t) => ["session_report_published", "certificate_issued", "level_up", "assessment_graded", "account_activated", "assessment_reissued"].includes(t) },
  { key: "training", label: "Training", icon: FiBookOpen, match: (t) => t.startsWith("tot_") },
  { key: "claims", label: "Claims & pay", icon: FiDollarSign, match: (t) => t.startsWith("claim_") },
  { key: "signups", label: "Sign-ups, orders & payments", icon: FiCreditCard, match: (t) => /^(home_learning|tech_club|store_order|payment_|bootcamp_)/.test(t) },
  { key: "enquiries", label: "Enquiries", icon: FiInbox, match: (t) => t.startsWith("lead_") || t.startsWith("enquir") },
  { key: "referrals", label: "Referrals", icon: FiGift, match: (t) => t.startsWith("affiliate_") },
];
const groupOf = (type) => GROUPS.find((g) => g.match(type)) || { key: "other", label: "Other", icon: FiBell };

const text = { margin: 0, fontSize: 12, color: "#6B7280", lineHeight: 1.5 };

function TypeRow({ t, highlight, isPending, save }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "6px 0" }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ ...text, color: "#374151", fontWeight: t.type === highlight ? 700 : 400 }}>{t.label}</p>
        {/* The workspace's admin has stopped this email for everyone (Settings → Emails). */}
        {t.workspaceOff && <p style={{ ...text, fontSize: 11, color: "#9CA3AF" }}>Switched off by your organisation.</p>}
      </div>
      <Toggle checked={t.enabled && !t.workspaceOff} disabled={isPending || t.workspaceOff} onChange={(enabled) => save({ types: { [t.type]: enabled } })} label={t.label} />
    </div>
  );
}

// One topic: its name, "3 of 4 on", a switch for the whole group, and its emails when opened.
function Group({ group, items, highlight, isPending, save, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const usable = items.filter((t) => !t.workspaceOff);
  const on = usable.filter((t) => t.enabled).length;
  const all = usable.length > 0 && on === usable.length;
  const setAll = (enabled) => save({ types: Object.fromEntries(usable.map((t) => [t.type, enabled])) });
  return (
    <div style={{ borderTop: "1px solid #F1F3F6" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0" }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
        >
          {open ? <FiChevronDown size={15} color="#6B7280" /> : <FiChevronRight size={15} color="#6B7280" />}
          <span aria-hidden style={{ width: 28, height: 28, borderRadius: 8, background: "#EAF6FD", color: "#25476a", display: "grid", placeItems: "center", flexShrink: 0 }}><group.icon size={14} /></span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{group.label}</span>
          <span style={{ fontSize: 11.5, color: "#9CA3AF", whiteSpace: "nowrap" }}>{on} of {usable.length || items.length} on</span>
        </button>
        <Toggle checked={all} disabled={isPending || usable.length === 0} onChange={setAll} label={`All ${group.label} emails`} />
      </div>
      {open && (
        <div style={{ padding: "0 0 8px 59px" }}>
          {items.map((t) => <TypeRow key={t.type} t={t} highlight={highlight} isPending={isPending} save={save} />)}
        </div>
      )}
    </div>
  );
}

// Which notifications this account also gets by email. Shown inside the notifications bell and
// on each portal's profile page, so every role reaches it from the same places — and, given a
// `token`, on the page an email's footer link opens for someone who isn't signed in (`highlight`
// is the type of the email they came from). Account emails (password resets) and invoices are
// not listed: those are always sent. More than a handful are grouped by topic (11 Nov 2026), each
// group folded with a switch for all of it; the group holding `highlight` starts open.
export default function EmailNotificationSettings({ token, highlight, padding = "12px 16px" }) {
  const { data, isLoading, isError, error } = useEmailPreferences({ token });
  const { mutate: update, isPending } = useUpdateEmailPreferences({ token });
  const save = (patch) => update(patch, { onError: (err) => toast.error(err.message || "Could not save email settings") });

  if (isLoading) return <p style={{ ...text, padding }}>Loading…</p>;
  if (isError || !data) return <p style={{ ...text, padding }}>{(token && error?.message) || "Email settings could not be loaded."}</p>;

  if (!data.email) {
    return <p style={{ ...text, padding }}>This account has no email address, so notifications are shown here only.</p>;
  }
  if (data.types.length === 0) {
    return <p style={{ ...text, padding }}>There are no emailed notifications for this account type yet.</p>;
  }

  const grouped = data.types.length > 6;
  const groups = [];
  if (grouped) {
    for (const t of data.types) {
      const g = groupOf(t.type);
      let entry = groups.find((x) => x.group.key === g.key);
      if (!entry) { entry = { group: g, items: [] }; groups.push(entry); }
      entry.items.push(t);
    }
  }

  return (
    <div style={{ padding, display: "flex", flexDirection: "column", gap: grouped ? 0 : 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBottom: grouped ? 10 : 0 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#111827" }}>Email me notifications</p>
          <p style={{ ...text, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Sent to {data.email}</p>
        </div>
        <Toggle checked={data.enabled} disabled={isPending} onChange={(enabled) => save({ enabled })} label="Email me notifications" />
      </div>
      {data.enabled && (grouped
        ? groups.map(({ group, items }) => (
          <Group key={group.key} group={group} items={items} highlight={highlight} isPending={isPending} save={save} defaultOpen={items.some((t) => t.type === highlight)} />
        ))
        : data.types.map((t) => <TypeRow key={t.type} t={t} highlight={highlight} isPending={isPending} save={save} />))}
    </div>
  );
}
