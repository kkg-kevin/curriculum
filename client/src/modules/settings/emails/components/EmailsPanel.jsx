import toast from "react-hot-toast";
import EmailNotificationSettings, { Toggle } from "../../../../components/ui/EmailNotificationSettings";
import { useWorkspaceEmails, useUpdateWorkspaceEmails } from "../../../notifications/hooks/useNotifications";

const heading = { margin: 0, fontSize: 15, fontWeight: 800, color: "#111827" };
const hint = { margin: "4px 0 0", fontSize: 12.5, color: "#6B7280", lineHeight: 1.5, maxWidth: 640 };
const box = { border: "1.5px solid #E5E7EB", borderRadius: 14, overflow: "hidden" };

// Settings → Emails (owner only). Two separate things: which emails the WORKSPACE sends to anyone
// at all, and which ones the admin personally receives. A type switched off for the workspace is
// sent to nobody, whatever each person has chosen for themselves; one left on still respects each
// person's own choice.
export default function EmailsPanel() {
  const { data, isLoading, isError } = useWorkspaceEmails();
  const { mutate: update, isPending } = useUpdateWorkspaceEmails();
  const save = (type, enabled) => update({ [type]: enabled }, { onError: (err) => toast.error(err.message || "Could not save email settings") });

  const groups = [];
  for (const t of data?.types || []) {
    let group = groups.find((g) => g.name === t.group);
    if (!group) groups.push((group = { name: t.group, types: [] }));
    group.types.push(t);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <section>
        <h2 style={heading}>Emails this workspace sends</h2>
        <p style={hint}>Switch an email off to stop it for everyone in your workspace. Emails left on are still subject to each person's own choice. Password emails are always sent, and "Email invoice" on an invoice still works when automatic invoice emails are off.</p>

        {isLoading && <p style={{ ...hint, marginTop: 14 }}>Loading…</p>}
        {isError && <p style={{ ...hint, marginTop: 14, color: "#B91C1C" }}>Email settings could not be loaded.</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 14, marginTop: 14 }}>
          {groups.map((group) => (
            <div key={group.name} style={box}>
              <p style={{ margin: 0, padding: "11px 16px", borderBottom: "1px solid #F3F4F6", fontSize: 11, fontWeight: 700, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>{group.name}</p>
              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {group.types.map((t) => (
                  <div key={t.type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <p style={{ margin: 0, fontSize: 12.5, color: t.enabled ? "#374151" : "#9CA3AF", lineHeight: 1.5 }}>{t.label}</p>
                    <Toggle checked={t.enabled} disabled={isPending} onChange={(enabled) => save(t.type, enabled)} label={t.label} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 style={heading}>Emails you receive</h2>
        <p style={hint}>Your own choice, for your account only. Everyone else sets theirs from the notifications bell, their profile page, or the link at the bottom of any notification email.</p>
        <div style={{ ...box, maxWidth: 460, marginTop: 14 }}>
          <EmailNotificationSettings />
        </div>
      </section>
    </div>
  );
}
