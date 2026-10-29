import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Toggle } from "../../../components/ui/EmailNotificationSettings";
import { SettingsPage as SettingsLayoutPage, SettingsSection, FooterNote, LoadState } from "../../settings/components/SettingsLayout";
import { leadApi } from "../services/leadApi";

// Settings → Enquiries (server: leads/lead.housekeeping.js, run daily by `npm run
// enquiries:process`). Nothing deletes an enquiry: a reminder about ones still New, closing ones
// nobody has touched for a long time (they can be reopened), and — off until switched on —
// removing the personal details of old closed ones.

const KEY = ["leads", "settings"];

function Row({ title, description, on, onToggle, children }) {
  return (
    <div style={{ padding: "14px 0", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0, flex: "1 1 280px" }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: on ? "#111827" : "#6B7280" }}>{title}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6B7280", lineHeight: 1.45 }}>{description}</p>
        {on && children && <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151" }}>{children}</div>}
      </div>
      <Toggle checked={on} onChange={onToggle} label={title} />
    </div>
  );
}

export default function EnquirySettingsPanel() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: KEY, queryFn: leadApi.getSettings });
  const save = useMutation({
    mutationFn: leadApi.saveSettings,
    onSuccess: (saved) => { qc.setQueryData(KEY, saved); toast.success("Enquiry settings saved"); },
    onError: (err) => toast.error(err?.message || "Couldn't save the settings"),
  });
  const [form, setForm] = useState(null);
  useEffect(() => { if (data) setForm(data); }, [data]);

  if (isLoading || isError || !form) {
    return (
      <SettingsLayoutPage title="Enquiries" description="Keeping the Enquiries list tidy.">
        <LoadState isLoading={isLoading} isError={isError} what="Enquiry settings" />
      </SettingsLayoutPage>
    );
  }

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const keys = ["remindersOn", "remindAfterDays", "autoCloseOn", "autoCloseDays", "anonymiseOn", "anonymiseMonths"];
  const dirty = keys.some((k) => String(form[k]) !== String(data[k]));
  const number = (key, min, max, width = 72) => (
    <input className="stg-input" type="number" min={min} max={max} value={form[key]} onChange={(e) => set(key)(e.target.value)} style={{ width }} aria-label={key} />
  );
  const submit = (e) => {
    e.preventDefault();
    if (form.anonymiseOn && !data.anonymiseOn && !window.confirm(`Closed enquiries untouched for ${form.anonymiseMonths} months will lose their name, email, phone, child's name, message and replies — for good. Switch this on?`)) return;
    save.mutate(Object.fromEntries(keys.map((k) => [k, typeof form[k] === "boolean" ? form[k] : Number(form[k])])));
  };

  return (
    <SettingsLayoutPage title="Enquiries" description="Keeping the Enquiries list tidy — checked once a day. No enquiry is ever deleted.">
      <SettingsSection
        as="form"
        onSubmit={submit}
        title="Housekeeping"
        description="What happens to enquiries over time."
        footer={(
          <>
            <button type="submit" className="stg-btn-primary" disabled={!dirty || save.isPending}>{save.isPending ? "Saving…" : "Save"}</button>
            <FooterNote>Runs daily from the server's `npm run enquiries:process` job.</FooterNote>
          </>
        )}
      >
        <div>
          <Row
            title="Remind us about enquiries still New"
            description="Once a day, the admins get a notification (and an email, unless they've switched it off) saying how many enquiries are still New and how old the oldest is."
            on={form.remindersOn}
            onToggle={set("remindersOn")}
          >
            After {number("remindAfterDays", 1, 60)} days with nothing happening
          </Row>
          <Row
            title="Close enquiries nobody has touched"
            description="A New or Contacted enquiry with no change, reply or note for this long is Closed, with a note saying so. You can reopen it. Enquiries that led to a sign-up, an invoice or a payment are left alone."
            on={form.autoCloseOn}
            onToggle={set("autoCloseOn")}
          >
            After {number("autoCloseDays", 7, 730)} days
          </Row>
          <Row
            title="Remove personal details from old closed enquiries"
            description="For data protection: a Closed enquiry untouched for this long loses its name, email, phone, child's name, message and replies. What's left still counts in your figures (where it came from, what they were interested in, dates, paid or not). Sign-ups and bootcamp enrolments always keep their details. This can't be undone — check the period with whoever handles data protection."
            on={form.anonymiseOn}
            onToggle={set("anonymiseOn")}
          >
            After {number("anonymiseMonths", 1, 120)} months
          </Row>
        </div>
      </SettingsSection>
    </SettingsLayoutPage>
  );
}
