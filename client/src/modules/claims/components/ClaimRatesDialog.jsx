import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { teacherApi } from "../../teachers/services/teacherApi";
import { useClaimSettings, useUpdateClaimSettings } from "../hooks/useClaims";
import { Dialog, T, formatMoney, ghostButton, inputStyle, primaryButton } from "../shared";

const label = { display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 700, color: T.ink };
const hint = { margin: "5px 0 0", fontSize: 11.5, color: T.inkMuted, lineHeight: 1.5 };

// What a session pays and how big an advance is — for the whole workspace, with an optional rate
// of their own for individual educators. A change applies to claims submitted from then on; a
// claim already submitted keeps the figures it was submitted with.
export default function ClaimRatesDialog({ onClose }) {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useClaimSettings();
  const save = useUpdateClaimSettings();
  // Staff who can approve claims but can't see Educators simply don't get the per-educator part.
  const { data: teachersData } = useQuery({ queryKey: ["teachers", "claim-rates"], queryFn: () => teacherApi.getAll(), retry: false });
  const teachers = teachersData?.data || [];

  const [sessionRate, setSessionRate] = useState("");
  const [advancePercent, setAdvancePercent] = useState("");
  const [own, setOwn] = useState({}); // teacherId → what's typed in their box
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setSessionRate(String(settings.sessionRate));
    setAdvancePercent(String(settings.advancePercent));
  }, [settings]);

  const rate = Number(sessionRate);
  const pct = Number(advancePercent);
  const valid = rate > 0 && Number.isInteger(pct) && pct >= 0 && pct <= 100;
  const stored = (teacher) => (teacher.sessionRate == null ? "" : String(Number(teacher.sessionRate)));
  const typed = (teacher) => (own[teacher.id] ?? stored(teacher));
  const changed = teachers.filter((t) => typed(t).trim() !== stored(t));
  const ownValid = changed.every((t) => typed(t).trim() === "" || Number(typed(t)) > 0);

  const submit = async () => {
    setSaving(true);
    try {
      await save.mutateAsync({ sessionRate: rate, advancePercent: pct });
      for (const teacher of changed) {
        const value = typed(teacher).trim();
        await teacherApi.update(teacher.id, { sessionRate: value === "" ? null : Number(value) });
      }
      if (changed.length) queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("Rates saved");
      onClose();
    } catch (err) {
      toast.error(err.errors?.[0]?.message || err.message || "Could not save the rates");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog title="Session rates" subtitle="What educators are paid, and how much they can take as an advance." onClose={onClose} busy={saving} width={560}>
      {isLoading ? <p style={{ margin: 0, padding: "24px 0", textAlign: "center", fontSize: 14, color: T.inkMuted }}>Loading…</p> : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <div>
              <label htmlFor="session-rate" style={label}>Rate per session (KSh)</label>
              <input id="session-rate" type="number" min="0" step="0.001" value={sessionRate} onChange={(e) => setSessionRate(e.target.value)} style={inputStyle} />
              <p style={hint}>A 12-session course pays {rate > 0 ? formatMoney(12 * rate, settings.currency) : "—"}. Course totals are rounded to the shilling.</p>
            </div>
            <div>
              <label htmlFor="advance-percent" style={label}>Advance (% of the course)</label>
              <input id="advance-percent" type="number" min="0" max="100" step="1" value={advancePercent} onChange={(e) => setAdvancePercent(e.target.value)} style={inputStyle} />
              <p style={hint}>{valid ? `On that course, an advance of ${formatMoney((12 * rate * pct) / 100, settings.currency)}.` : "A whole number from 0 to 100."}</p>
            </div>
          </div>

          {teachers.length > 0 && (
            <>
              <p style={{ margin: "22px 0 4px", fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: T.inkMuted }}>Educators with their own rate</p>
              <p style={{ ...hint, margin: "0 0 10px" }}>Leave a box empty to pay that educator the rate above.</p>
              <div style={{ maxHeight: 260, overflowY: "auto", borderRadius: 12, border: `1px solid ${T.border}`, background: "#fff" }}>
                {teachers.map((teacher, index) => (
                  <div key={teacher.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 14px", borderTop: index ? `1px solid #F1F5F9` : "none" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{teacher.firstName} {teacher.lastName}</p>
                      <p style={{ margin: 0, fontSize: 11.5, color: T.inkFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{teacher.email || "No email"}</p>
                    </div>
                    <input type="number" min="0" step="0.001" aria-label={`Session rate for ${teacher.firstName} ${teacher.lastName}`} placeholder={sessionRate || "—"} value={typed(teacher)} onChange={(e) => setOwn((prev) => ({ ...prev, [teacher.id]: e.target.value }))} style={{ ...inputStyle, width: 130, padding: "8px 10px" }} />
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button type="button" onClick={onClose} disabled={saving} style={ghostButton}>Cancel</button>
            <button type="button" onClick={submit} disabled={!valid || !ownValid || saving} style={primaryButton(!valid || !ownValid || saving)}>{saving ? "Saving…" : "Save rates"}</button>
          </div>
        </>
      )}
    </Dialog>
  );
}
