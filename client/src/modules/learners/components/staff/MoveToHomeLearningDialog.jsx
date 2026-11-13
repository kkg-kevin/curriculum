import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiAlertTriangle, FiArrowRight, FiHome, FiInfo, FiX } from "react-icons/fi";
import api from "../../../../services/api";
import { BRAND, FONT } from "../../../../theme/brand";
import { homeLearningApi } from "../../../home-learning/services/homeLearningApi";
import { EnrollmentFields, HouseholdFields } from "../../../home-learning/components/HouseholdFields";

// Moving a learner already in the system (a bootcamp, a hub) into Home Learning, in one go (server
// home-learning/home-learning.move.js): a household — the family's own, or a new one with the
// parent's details from the child's record — the child's Home Learning place, and the places they
// leave ended (kept, inactive, written to their History as a transfer). Their reports, work,
// attendance, certificates and invoices stay theirs; nothing owed changes.

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
const NEW = "new";
const lower = (s) => String(s || "").trim().toLowerCase();

export default function MoveToHomeLearningDialog({ open, learnerId, onClose, onMoved }) {
  const queryClient = useQueryClient();
  const optionsQuery = useQuery({
    queryKey: ["home-learning", "move", learnerId],
    queryFn: () => api.get(`/api/home-learning/move/${learnerId}`).then((r) => r.data.data),
    enabled: Boolean(open && learnerId),
    staleTime: 0,
  });
  const { data: packageRows } = useQuery({ queryKey: ["home-learning", "packages"], queryFn: homeLearningApi.getPackages, enabled: open });
  const { data: curriculumRows } = useQuery({ queryKey: ["home-learning", "curricula"], queryFn: () => api.get("/api/curricula").then((r) => r.data.data || []), enabled: open });
  const { data: teacherRows } = useQuery({ queryKey: ["home-learning", "educators"], queryFn: () => api.get("/api/teachers").then((r) => r.data.data || []), enabled: open });
  const packages = Array.isArray(packageRows) ? packageRows : [];
  const curricula = Array.isArray(curriculumRows) ? curriculumRows : [];
  const educators = Array.isArray(teacherRows) ? teacherRows.filter((t) => (t.status || "active") === "active") : [];

  const [householdChoice, setHouseholdChoice] = useState(NEW);
  const [household, setHousehold] = useState({});
  const [placement, setPlacement] = useState({ curriculumId: "", gradeId: "", educatorId: "" });
  const [endHubIds, setEndHubIds] = useState([]);
  const [saving, setSaving] = useState(false);

  const options = optionsQuery.data;
  // Start from the child's record: the parent's details, today, active; the family's own household
  // when they have one with room; every active place ticked to end.
  useEffect(() => {
    if (!options) return;
    const l = options.learner;
    setHousehold({
      guardianName: l.guardianName, guardianEmail: l.guardianEmail, guardianPhone: l.guardianPhone,
      packageId: "", billingPeriod: "", childCount: "", status: "active", startDate: today(),
      county: "", subCounty: "", town: "", addressLine: "", landmark: "", mapUrl: "", locationPhotos: [], notes: "", portalPassword: "",
    });
    const withRoom = options.households.find((h) => h.activeChildren < h.childCount);
    setHouseholdChoice(withRoom ? withRoom.id : NEW);
    setEndHubIds(options.places.filter((p) => p.status === "active").map((p) => p.hubId));
  }, [options]);
  useEffect(() => {
    if (!open) { setPlacement({ curriculumId: "", gradeId: "", educatorId: "" }); setSaving(false); }
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape" && !saving) onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  const emailDiffers = useMemo(() => {
    if (!options || householdChoice !== NEW) return false;
    const was = lower(options.learner.guardianEmail);
    return Boolean(was) && lower(household.guardianEmail) !== was;
  }, [options, householdChoice, household.guardianEmail]);

  if (!open) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (!placement.curriculumId || !placement.gradeId) { toast.error("Choose their curriculum and grade"); return; }
    if (householdChoice === NEW && !household.packageId) { toast.error("Choose a package for the household"); return; }
    setSaving(true);
    try {
      const { billingPeriod, childCount, ...rest } = household;
      const body = {
        enrollment: placement,
        endHubIds,
        ...(householdChoice === NEW
          ? { household: { ...rest, ...(billingPeriod ? { billingPeriod } : {}), ...(childCount ? { childCount: Number(childCount) } : {}) } }
          : { householdId: householdChoice }),
      };
      const result = await api.post(`/api/home-learning/move/${learnerId}`, body).then((r) => r.data.data);
      toast.success(result.householdStatus === "active" ? "Moved to Home Learning" : "Moved to Home Learning — their place starts once the household is active");
      queryClient.invalidateQueries();
      onMoved?.(result);
    } catch (err) {
      toast.error(err.errors?.[0]?.message || err.message || "Couldn't move them");
    } finally {
      setSaving(false);
    }
  };

  const learnerName = options ? `${options.learner.firstName} ${options.learner.lastName}`.trim() : "this learner";

  return createPortal(
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose?.(); }}
      style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(17,32,51,0.45)", backdropFilter: "blur(3px)", fontFamily: FONT }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="move-hl-title"
        style={{ position: "relative", width: "100%", maxWidth: 820, maxHeight: "calc(100vh - 32px)", display: "flex", flexDirection: "column", background: BRAND.surface, borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 64px rgba(17,32,51,0.28)" }}>
        <div aria-hidden="true" style={{ height: 5, flexShrink: 0, background: `linear-gradient(90deg, ${BRAND.navy}, ${BRAND.mid} 55%, ${BRAND.sky})` }} />
        <button type="button" aria-label="Close" onClick={() => !saving && onClose?.()}
          style={{ position: "absolute", top: 14, right: 12, width: 32, height: 32, display: "grid", placeItems: "center", border: "none", borderRadius: 10, background: "transparent", color: BRAND.faint, cursor: "pointer" }}>
          <FiX size={18} />
        </button>

        <div style={{ padding: "20px 24px 12px", borderBottom: `1px solid ${BRAND.line}`, flexShrink: 0 }}>
          <h2 id="move-hl-title" style={{ margin: "0 36px 4px 0", fontSize: 18, fontWeight: 800, color: BRAND.ink, display: "flex", alignItems: "center", gap: 8 }}><FiHome size={18} color={BRAND.mid} /> Move {learnerName} to Home Learning</h2>
          <p style={{ margin: 0, fontSize: 13, color: BRAND.muted, lineHeight: 1.5 }}>Their reports, work, attendance, certificates and invoices stay with them. Home Learning invoices start from the household&apos;s start date.</p>
        </div>

        <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1 }}>
          {optionsQuery.isLoading && <p style={{ color: BRAND.muted, fontSize: 14 }}>Loading…</p>}
          {optionsQuery.isError && <Note tone="danger">{optionsQuery.error?.message || "Couldn't load this learner."}</Note>}

          {options?.alreadyInHomeLearning && (
            <Note tone="info">They&apos;re already in Home Learning. Change their place from the <Link to={`/home-learning?household=${options.alreadyInHomeLearning.householdId}`} onClick={onClose} style={{ color: BRAND.navy, fontWeight: 800 }}>Home Learning page</Link>.</Note>
          )}

          {options && !options.alreadyInHomeLearning && (
            <>
              {options.openInvoices.length > 0 && (
                <Note tone="waiting">
                  {options.openInvoices.length === 1 ? "An invoice is" : `${options.openInvoices.length} invoices are`} still unpaid ({options.openInvoices.map((i) => `${i.invoiceNumber} · ${i.currency} ${i.owed.toLocaleString("en-KE")}`).join(", ")}). Moving doesn&apos;t change that: it stays owed, and the usual pause for unpaid invoices still applies.
                </Note>
              )}

              <Section title="Where they are now">
                {options.places.length === 0 ? <p style={muted}>No other place — they&apos;ll only be in Home Learning.</p> : options.places.map((p) => (
                  <label key={p.hubId} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 12px", border: `1px solid ${BRAND.border}`, borderRadius: 12, marginBottom: 6, cursor: "pointer" }}>
                    <input type="checkbox" checked={endHubIds.includes(p.hubId)} onChange={(e) => setEndHubIds((ids) => (e.target.checked ? [...ids, p.hubId] : ids.filter((x) => x !== p.hubId)))} style={{ marginTop: 3 }} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>{p.bootcamp ? `${p.bootcamp} — ` : ""}{p.hubName}{p.className ? ` · ${p.className}` : ""}</span>
                      <span style={{ display: "block", fontSize: 12, color: BRAND.muted }}>{p.status === "active" ? "Leave this place (kept on their record as ended)" : `Already ${p.status}`}</span>
                    </span>
                  </label>
                ))}
              </Section>

              <Section title="Household">
                <select value={householdChoice} onChange={(e) => setHouseholdChoice(e.target.value)} style={{ ...field, width: "100%" }} aria-label="Household">
                  {options.households.map((h) => {
                    const full = h.activeChildren >= h.childCount;
                    return <option key={h.id} value={h.id} disabled={full}>{h.guardianName}&apos;s household · {h.activeChildren}/{h.childCount} children · {h.status}{full ? " — full" : ""}</option>;
                  })}
                  <option value={NEW}>A new household</option>
                </select>
                {householdChoice === NEW && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginTop: 12 }}>
                    <HouseholdFields values={household} setValue={(key, value) => setHousehold((h) => ({ ...h, [key]: value }))} packages={packages} showStatus />
                  </div>
                )}
                {emailDiffers && (
                  <Note tone="waiting">This isn&apos;t the parent email on {options.learner.firstName}&apos;s record ({options.learner.guardianEmail}). The parent&apos;s login won&apos;t see the Home Learning invoices unless it&apos;s the same email.</Note>
                )}
              </Section>

              <Section title="Their Home Learning place">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
                  <EnrollmentFields values={placement} setValue={(key, value) => setPlacement((p) => ({ ...p, [key]: value }))} curricula={curricula} educators={educators} />
                </div>
                <p style={{ ...muted, display: "flex", gap: 6, marginTop: 8 }}><FiInfo size={14} style={{ flexShrink: 0, marginTop: 2 }} /> With the same curriculum as before, the work they&apos;ve done there still counts. A different one starts its courses fresh, with their old ones kept as history.</p>
              </Section>
            </>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap", padding: "14px 24px", borderTop: `1px solid ${BRAND.line}`, flexShrink: 0 }}>
          <button type="button" onClick={onClose} disabled={saving} style={button("ghost")}>Cancel</button>
          {options && !options.alreadyInHomeLearning && (
            <button type="submit" disabled={saving} style={button("primary", saving)}><FiArrowRight size={15} /> {saving ? "Moving…" : "Move to Home Learning"}</button>
          )}
        </div>
      </form>
    </div>,
    document.body,
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 16 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 800, color: BRAND.sky, textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</h3>
      {children}
    </section>
  );
}

function Note({ tone, children }) {
  const [bg, border, color] = {
    info: [BRAND.skyTint, BRAND.skyBorder, BRAND.navy],
    waiting: [BRAND.goldTint, BRAND.goldBorder, BRAND.goldText],
    danger: [BRAND.dangerTint, BRAND.dangerBorder, BRAND.danger],
  }[tone] || [BRAND.greyTint, BRAND.border, BRAND.greyText];
  return (
    <div role={tone === "danger" ? "alert" : undefined} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 12, background: bg, border: `1px solid ${border}`, color, fontSize: 13, lineHeight: 1.5, margin: "8px 0 12px" }}>
      <FiAlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

const muted = { margin: 0, fontSize: 12.5, color: BRAND.muted, lineHeight: 1.5 };
const field = { padding: "9px 11px", borderRadius: 10, border: `1.5px solid ${BRAND.border}`, background: "#fff", fontSize: 13.5, color: BRAND.ink, fontFamily: FONT };

function button(variant, disabled = false) {
  const base = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 18px", borderRadius: 12, fontSize: 14, fontWeight: 800, fontFamily: FONT, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.65 : 1 };
  return variant === "ghost"
    ? { ...base, background: "#fff", color: BRAND.inkSoft, border: `1.5px solid ${BRAND.border}` }
    : { ...base, background: BRAND.navy, color: "#fff", border: `1.5px solid ${BRAND.navy}` };
}
