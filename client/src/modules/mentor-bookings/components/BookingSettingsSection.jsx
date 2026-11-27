import { useEffect, useState } from "react";
import { SettingsSection, Field, FieldGrid, FooterNote } from "../../settings/components/SettingsLayout";
import { useBookingSettings, useSaveBookingSettings } from "../hooks/useMentorBookings";

// Settings → Educator Pay → Mentor bookings (modules/mentor-bookings/): whether families can book a
// mentor, the lengths offered with what the family pays and what the mentor earns for each, and the
// rules — notice, how long an unpaid time is held, how late a family may cancel for their money
// back. A hub's space fee is set on the hub (its spaces), not here. Family credits (27 Nov 2026):
// whether parents can buy credits, whether children can book for themselves with them, the least
// a parent can buy and the amounts offered.

const LENGTHS = [30, 45, 60, 90, 120];
const asText = (v) => (v == null ? "" : String(v));
const lengthName = (m) => (m < 60 ? `${m} minutes` : m === 60 ? "1 hour" : `${m / 60} hours`);

export default function BookingSettingsSection({ readOnly = false }) {
  const { data, isLoading } = useBookingSettings();
  const save = useSaveBookingSettings();
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!data) return;
    const rows = Object.fromEntries(LENGTHS.map((m) => {
      const l = data.lengths.find((x) => x.minutes === m);
      return [m, { on: !!l, price: asText(l?.price), educatorPay: asText(l?.educatorPay) }];
    }));
    setForm({
      enabled: data.enabled, rows, noticeHours: asText(data.noticeHours), holdMinutes: asText(data.holdMinutes), cancelHours: asText(data.cancelHours),
      creditsEnabled: data.creditsEnabled !== false, childBooking: data.childBooking !== false,
      minimumPurchase: asText(data.minimumPurchase ?? 100), creditPresets: (data.creditPresets || [500, 1000, 2000, 5000]).join(", "),
    });
  }, [data]);

  if (isLoading || !form) return null;
  const setRow = (m, patch) => setForm((f) => ({ ...f, rows: { ...f.rows, [m]: { ...f.rows[m], ...patch } } }));
  const submit = (e) => {
    e.preventDefault();
    save.mutate({
      enabled: form.enabled,
      lengths: LENGTHS.filter((m) => form.rows[m].on).map((m) => ({ minutes: m, price: form.rows[m].price === "" ? null : Number(form.rows[m].price), educatorPay: form.rows[m].educatorPay === "" ? null : Number(form.rows[m].educatorPay) })),
      noticeHours: Number(form.noticeHours), holdMinutes: Number(form.holdMinutes), cancelHours: Number(form.cancelHours),
      creditsEnabled: form.creditsEnabled, childBooking: form.childBooking, minimumPurchase: Number(form.minimumPurchase) || 100,
      creditPresets: form.creditPresets.split(/[\s,]+/).map(Number).filter((n) => n > 0).slice(0, 6),
    });
  };
  const cell = { padding: "8px 6px", borderBottom: "1px solid #F3F4F6", fontSize: 13 };

  return (
    <SettingsSection
      as="form"
      onSubmit={submit}
      title="Mentor bookings"
      description="Families book a mentor when their child is stuck on a session — paid before it's confirmed. What they pay and what the mentor earns, per length. A desk at a hub adds that space's own price."
      aside={(
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#374151", cursor: readOnly ? "default" : "pointer" }}>
          <input type="checkbox" checked={form.enabled} disabled={readOnly} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} /> Families can book
        </label>
      )}
      footer={!readOnly && (
        <>
          <button type="submit" className="stg-btn-primary" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save mentor bookings"}</button>
          <FooterNote>A change applies to new bookings; ones already made keep their price.</FooterNote>
        </>
      )}
    >
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 440 }}>
          <thead>
            <tr style={{ textAlign: "left", fontSize: 11.5, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              <th style={cell}>Offered</th><th style={cell}>Length</th><th style={cell}>Family pays (KES)</th><th style={cell}>Mentor earns (KES)</th>
            </tr>
          </thead>
          <tbody>
            {LENGTHS.map((m) => {
              const r = form.rows[m];
              return (
                <tr key={m}>
                  <td style={cell}><input type="checkbox" aria-label={`Offer ${lengthName(m)}`} checked={r.on} disabled={readOnly} onChange={(e) => setRow(m, { on: e.target.checked })} /></td>
                  <td style={{ ...cell, fontWeight: 700, color: r.on ? "#111827" : "#9CA3AF" }}>{lengthName(m)}</td>
                  <td style={cell}><input className="stg-input" type="number" min="0" step="1" disabled={!r.on || readOnly} value={r.price} onChange={(e) => setRow(m, { price: e.target.value })} placeholder="e.g. 1500" style={{ maxWidth: 140 }} /></td>
                  <td style={cell}><input className="stg-input" type="number" min="0" step="1" disabled={!r.on || readOnly} value={r.educatorPay} onChange={(e) => setRow(m, { educatorPay: e.target.value })} placeholder="e.g. 1000" style={{ maxWidth: 140 }} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <FieldGrid min={180}>
        <Field label="Notice (hours)" htmlFor="mb-notice" note="The soonest a session can be booked.">
          <input id="mb-notice" className="stg-input" type="number" min="1" max="336" disabled={readOnly} value={form.noticeHours} onChange={(e) => setForm((f) => ({ ...f, noticeHours: e.target.value }))} />
        </Field>
        <Field label="Hold while paying (minutes)" htmlFor="mb-hold" note="An unpaid time is released after this.">
          <input id="mb-hold" className="stg-input" type="number" min="15" max="2880" disabled={readOnly} value={form.holdMinutes} onChange={(e) => setForm((f) => ({ ...f, holdMinutes: e.target.value }))} />
        </Field>
        <Field label="Families may cancel up to (hours before)" htmlFor="mb-cancel" note="For their money back. Later than this it's charged as booked.">
          <input id="mb-cancel" className="stg-input" type="number" min="0" max="336" disabled={readOnly} value={form.cancelHours} onChange={(e) => setForm((f) => ({ ...f, cancelHours: e.target.value }))} />
        </Field>
      </FieldGrid>
      <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #F3F4F6", display: "grid", gap: 10 }}>
        <strong style={{ fontSize: 14, color: "#111827" }}>Family credits</strong>
        <p style={{ margin: 0, fontSize: 12.5, color: "#6B7280", lineHeight: 1.5 }}>Parents buy credits (1 credit = KSh 1) on an invoice; paid, they&apos;re in the family&apos;s wallet. Any of their children can then book a mentor from their own login, without waiting for the parent, and the parent can pay with them too. A cancelled session&apos;s credits go straight back. Wallets are in Mentor bookings → Credits.</p>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#374151" }}>
          <input type="checkbox" checked={form.creditsEnabled} disabled={readOnly} onChange={(e) => setForm((f) => ({ ...f, creditsEnabled: e.target.checked }))} /> Parents can buy and use credits
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#374151" }}>
          <input type="checkbox" checked={form.childBooking} disabled={readOnly || !form.creditsEnabled} onChange={(e) => setForm((f) => ({ ...f, childBooking: e.target.checked }))} /> Children can book a mentor themselves with their family&apos;s credits
        </label>
        <FieldGrid min={200}>
          <Field label="Least a parent can buy (credits)" htmlFor="mb-cr-min">
            <input id="mb-cr-min" className="stg-input" type="number" min="1" max="100000" disabled={readOnly || !form.creditsEnabled} value={form.minimumPurchase} onChange={(e) => setForm((f) => ({ ...f, minimumPurchase: e.target.value }))} />
          </Field>
          <Field label="Amounts offered" htmlFor="mb-cr-presets" note="Up to 6, separated by commas.">
            <input id="mb-cr-presets" className="stg-input" disabled={readOnly || !form.creditsEnabled} value={form.creditPresets} onChange={(e) => setForm((f) => ({ ...f, creditPresets: e.target.value }))} placeholder="500, 1000, 2000, 5000" />
          </Field>
        </FieldGrid>
      </div>
    </SettingsSection>
  );
}
