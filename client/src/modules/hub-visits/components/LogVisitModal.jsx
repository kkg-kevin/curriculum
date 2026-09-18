import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLogVisits } from "../hooks/useHubVisits";

const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: "9px",
  border: "1.5px solid #E5E7EB", fontSize: "13.5px", fontFamily: "Inter, sans-serif",
  color: "#111827", outline: "none",
};
const labelStyle = { display: "block", fontSize: "12px", fontWeight: "700", color: "#374151", marginBottom: "5px" };

const todayStr = () => new Date().toISOString().slice(0, 10);

function fmt(amount) {
  return `KES ${Number(amount || 0).toLocaleString()}`;
}

// Same rate resolution as the server's resolveEffectiveRate (hub-visit.service.js) — a learner's
// own pricingOverrideRate/Unit (set when enrolling them at the hub) wins over the space's list
// price, so the estimate shown here matches what actually gets charged.
function effectiveRate(learner, space) {
  if (!space) return null;
  return {
    pricingModel: space.pricingModel,
    rate: learner?.pricingOverrideRate != null ? Number(learner.pricingOverrideRate) : Number(space.rate || 0),
  };
}

function amountFor(learner, space, hours) {
  const eff = effectiveRate(learner, space);
  if (!eff) return null;
  if (eff.pricingModel === "free") return 0;
  if (eff.pricingModel === "hourly") return hours ? eff.rate * Number(hours) : null;
  return eff.rate;
}

// Logs the SAME visit (space/date/hours) for one or more learners at once — the common case is a
// group session (a class, a workshop) where everyone present used the same space on the same day,
// not one learner at a time. Each learner still gets their own hub_visits row and their own
// resolved rate (a learner can carry a per-learner override, see effectiveRate above), so this is
// a shortcut for the data entry, not a shared/merged record.
//
// Billing itself now happens server-side the moment a visit is logged (hub-visit.service.js's
// logVisit invoices it immediately whenever the learner has a resolvable guardian payer) — this
// modal no longer asks "bill now or later?" after logging. The confirm step just reports what
// happened: each succeeded visit comes back with its real billingStatus, "invoiced" or (no
// guardian on file, or a free space) "unbilled". Any still-unbilled visits get a "Generate
// charges" fallback link instead of a choice, for exactly the visits that couldn't be billed
// automatically — not a routine extra step for the common case anymore.
const STEP = { FORM: "form", CONFIRM: "confirm" };

export default function LogVisitModal({ hubId, learners, spaces, onClose }) {
  const { mutate: logVisits, isPending } = useLogVisits();
  const [step, setStep] = useState(STEP.FORM);
  const [logged, setLogged] = useState(null); // { count, amount } once logging succeeds
  const [learnerIds, setLearnerIds] = useState([]);
  const [spaceId, setSpaceId] = useState("");
  const [visitDate, setVisitDate] = useState(todayStr());
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState({});
  const [failures, setFailures] = useState([]);
  const [search, setSearch] = useState("");

  const space = spaces.find((s) => s.id === spaceId) || null;
  const isHourly = space?.pricingModel === "hourly";
  const selectedLearners = learners.filter((l) => learnerIds.includes(l.id));

  // When there's genuinely only one sensible answer — this hub has just one space, or every
  // selected learner is enrolled at the same one — show it as a fact instead of making the
  // operator pick from a dropdown with one real option. Still fully overridable via "Change".
  const [spaceLocked, setSpaceLocked] = useState(true);
  const onlySpace = spaces.length === 1 ? spaces[0] : null;
  const commonEnrolledSpaceId = selectedLearners.length > 0 && selectedLearners.every((l) => l.spaceId && l.spaceId === selectedLearners[0].spaceId)
    ? selectedLearners[0].spaceId
    : null;
  const impliedSpaceId = onlySpace?.id || commonEnrolledSpaceId || null;
  const showSpacePicker = !spaceLocked || !impliedSpaceId;

  // Keeps spaceId following the implied answer as the learner selection changes, as long as the
  // operator hasn't explicitly overridden it (spaceLocked). Picking "Change" below sets
  // spaceLocked false and hands control back to the dropdown permanently for this session.
  useEffect(() => {
    if (spaceLocked && impliedSpaceId) setSpaceId(impliedSpaceId);
  }, [spaceLocked, impliedSpaceId]);

  const totalEstimate = useMemo(() => {
    if (!space || selectedLearners.length === 0) return null;
    const amounts = selectedLearners.map((l) => amountFor(l, space, hours));
    if (amounts.some((a) => a === null)) return null;
    return amounts.reduce((sum, a) => sum + a, 0);
  }, [space, selectedLearners, hours]);

  const filteredLearners = learners.filter((l) => `${l.firstName} ${l.lastName}`.toLowerCase().includes(search.trim().toLowerCase()));

  const onToggle = (id) => {
    setLearnerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setFailures([]);
  };

  const validate = () => {
    const next = {};
    if (learnerIds.length === 0) next.learnerIds = "Pick at least one learner";
    if (!spaceId) next.spaceId = "Pick a space";
    if (!visitDate) next.visitDate = "Visit date is required";
    if (isHourly && !hours) next.hours = "Hours are required for an hourly-priced space";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    setFailures([]);
    logVisits(
      {
        hubId,
        learnerIds,
        spaceId,
        visitDate,
        hours: isHourly && hours ? Number(hours) : null,
        notes,
      },
      {
        onSuccess: ({ succeeded, failed }) => {
          if (succeeded.length > 0) {
            const amount = succeeded.reduce((sum, v) => sum + Number(v.amount || 0), 0);
            const invoicedCount = succeeded.filter((v) => v.billingStatus === "invoiced").length;
            setLogged({ count: succeeded.length, amount, date: visitDate, invoicedCount, unbilledCount: succeeded.length - invoicedCount });
          }
          if (failed.length === 0) {
            setStep(STEP.CONFIRM);
            return;
          }
          // Some learners logged fine, some didn't (e.g. a duplicate for just one of them) —
          // keep the modal open, drop the ones that succeeded, and show what's left to fix
          // rather than silently losing track of which learners still need attention. If at
          // least one succeeded, still move to the confirm step for those.
          const failedIds = failed.map((f) => f.learnerId);
          setLearnerIds(failedIds);
          setFailures(failed.map((f) => ({ ...f, name: learners.find((l) => l.id === f.learnerId) })));
          if (succeeded.length > 0) setStep(STEP.CONFIRM);
        },
      }
    );
  };

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto", backgroundColor: "rgba(15,38,69,0.45)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ backgroundColor: "#fff", borderRadius: "18px", width: "100%", maxWidth: "480px", boxShadow: "0 24px 64px rgba(0,0,0,0.25)", overflow: "hidden", fontFamily: "Inter, sans-serif" }}>
        {step === STEP.CONFIRM ? (
          <>
            <div style={{ padding: "20px 24px", background: "linear-gradient(135deg,#1a3550 0%,#25476a 60%,#2e7db5 100%)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#fff" }}>
                  Logged {logged.count} visit{logged.count === 1 ? "" : "s"}
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>{fmt(logged.amount)} total</p>
              </div>
              <button type="button" onClick={onClose} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", cursor: "pointer", fontSize: "16px", lineHeight: 1, width: "26px", height: "26px", borderRadius: "8px" }}>×</button>
            </div>

            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {failures.length > 0 && (
                <div style={{ fontSize: "12px", color: "#B91C1C", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "8px 12px" }}>
                  <strong>Some visits couldn&rsquo;t be logged:</strong>
                  {failures.map((f) => (
                    <div key={f.learnerId} style={{ marginTop: 4 }}>{f.name ? `${f.name.firstName} ${f.name.lastName}` : "A learner"}: {f.message}</div>
                  ))}
                </div>
              )}

              {logged.invoicedCount > 0 && (
                <p style={{ margin: 0, fontSize: 14, color: "#15803D", lineHeight: 1.6, display: "flex", alignItems: "center", gap: 8 }}>
                  ✓ {logged.invoicedCount === logged.count
                    ? `Billed — invoice${logged.invoicedCount === 1 ? "" : "s"} sent to the guardian.`
                    : `${logged.invoicedCount} of ${logged.count} billed — invoice${logged.invoicedCount === 1 ? "" : "s"} sent to their guardian.`}
                </p>
              )}

              {logged.unbilledCount > 0 && (
                <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
                  {logged.unbilledCount} visit{logged.unbilledCount === 1 ? "" : "s"} couldn&rsquo;t be billed automatically (no guardian on file yet) — fix that and use <strong>Generate charges</strong> from this hub&rsquo;s finance page once ready.
                </p>
              )}
            </div>

            <div style={{ padding: "16px 24px", display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid #F3F4F6" }}>
              <button type="button" onClick={onClose} style={{ padding: "9px 18px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                Done
              </button>
            </div>
          </>
        ) : (
        <>
        <div style={{ padding: "20px 24px", background: "linear-gradient(135deg,#1a3550 0%,#25476a 60%,#2e7db5 100%)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#fff" }}>Log a Visit</h2>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Record who used a space — we&rsquo;ll bill it automatically right after.</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", cursor: "pointer", fontSize: "16px", lineHeight: 1, width: "26px", height: "26px", borderRadius: "8px" }}>×</button>
        </div>

        <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <label style={labelStyle}>Learners {learnerIds.length > 0 && <span style={{ color: "#9CA3AF", fontWeight: 600 }}>({learnerIds.length} selected)</span>}</label>
              {filteredLearners.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const filteredIds = filteredLearners.map((l) => l.id);
                    const allSelected = filteredIds.every((id) => learnerIds.includes(id));
                    setLearnerIds((prev) => (allSelected
                      ? prev.filter((id) => !filteredIds.includes(id))
                      : [...new Set([...prev, ...filteredIds])]));
                    setFailures([]);
                  }}
                  style={{ background: "none", border: "none", color: "#25476a", fontSize: "12px", fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", padding: 0, marginBottom: "5px" }}
                >
                  {filteredLearners.every((l) => learnerIds.includes(l.id)) ? "Clear all" : "Select all"}
                </button>
              )}
            </div>
            {learners.length > 3 && (
              <input
                style={{ ...inputStyle, marginBottom: 8 }}
                placeholder="Search learners…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            )}
            <div style={{ maxHeight: 180, overflowY: "auto", border: "1.5px solid #E5E7EB", borderRadius: 9, padding: "4px 6px" }}>
              {filteredLearners.length === 0 ? (
                <p style={{ margin: "10px 6px", fontSize: "11.5px", color: "#9CA3AF" }}>
                  {learners.length === 0 ? "No learners enrolled at this hub yet." : "No learners match your search."}
                </p>
              ) : (
                filteredLearners.map((l) => (
                  <label key={l.id} style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "7px 6px", cursor: "pointer", borderRadius: 6 }}>
                    <input type="checkbox" checked={learnerIds.includes(l.id)} onChange={() => onToggle(l.id)} style={{ width: 15, height: 15, flexShrink: 0, cursor: "pointer", marginTop: 2 }} />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "block", fontSize: 13, color: "#111827" }}>{l.firstName} {l.lastName}</span>
                      {/* className/courses come from learner.service.js's getAllLearners merge
                          (learner_hub_links.classId -> classes -> class_course_teacher_links ->
                          courses) — only set when a class (e.g. a bootcamp cohort) is actually
                          running at this hub for this learner. Informational only: it doesn't
                          change the rate charged, just shows what they're here for alongside the
                          space visit being billed. */}
                      {l.className && (
                        <span style={{ display: "block", fontSize: 11, color: "#6B7280", marginTop: 1 }}>
                          {l.className}{l.courses?.length > 0 ? ` — ${l.courses.map((c) => c.name).join(", ")}` : ""}
                        </span>
                      )}
                    </span>
                    {/* Surfaced here, not just at bill time — a learner with no guardian email
                        can still be logged (the visit is real either way), but generateCharges
                        will skip them until this is fixed, so flag it where it can be acted on
                        early rather than as a surprise later. */}
                    {!l.guardianEmail && (
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: "#B45309", flexShrink: 0, marginTop: 2 }} title="No guardian email on file — they'll be skipped when generating charges until this is added">
                        no payer
                      </span>
                    )}
                  </label>
                ))
              )}
            </div>
            {errors.learnerIds && <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#DC2626" }}>{errors.learnerIds}</p>}
          </div>

          <div>
            <label style={labelStyle}>Space</label>
            {showSpacePicker ? (
              <select style={inputStyle} value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
                <option value="">Select a space…</option>
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {s.pricingModel === "free" ? "Free" : `${fmt(s.rate)} ${s.priceUnit}`}</option>
                ))}
              </select>
            ) : (
              // Only one sensible answer (this hub's only space, or every selected learner's
              // shared enrolled space) — shown as a fact, not a one-option dropdown to click
              // through. "Change" hands control back to the dropdown for this session.
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 11px", borderRadius: "9px", border: "1.5px solid #E5E7EB", background: "#F9FAFB" }}>
                <span style={{ fontSize: "13.5px", color: "#111827", fontWeight: 600 }}>
                  {space?.name} {space && (space.pricingModel === "free" ? "— Free" : `— ${fmt(space.rate)} ${space.priceUnit}`)}
                </span>
                <button type="button" onClick={() => setSpaceLocked(false)} style={{ background: "none", border: "none", color: "#25476a", fontSize: "12px", fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0 }}>
                  Change
                </button>
              </div>
            )}
            {spaces.length === 0 && <p style={{ margin: "5px 0 0", fontSize: "11.5px", color: "#9CA3AF" }}>No spaces configured for this hub yet.</p>}
            {errors.spaceId && <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#DC2626" }}>{errors.spaceId}</p>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isHourly ? "1fr 1fr" : "1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Visit Date</label>
              <input type="date" style={inputStyle} value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
              {errors.visitDate && <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#DC2626" }}>{errors.visitDate}</p>}
            </div>
            {isHourly && (
              <div>
                <label style={labelStyle}>Hours</label>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  {["1", "2", "3"].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHours(h)}
                      style={{
                        flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer",
                        border: `1.5px solid ${hours === h ? "#25476a" : "#E5E7EB"}`,
                        background: hours === h ? "#25476a" : "#fff",
                        color: hours === h ? "#fff" : "#374151",
                      }}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
                <input type="number" min="0.5" step="0.5" style={inputStyle} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Custom" />
                {errors.hours && <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#DC2626" }}>{errors.hours}</p>}
              </div>
            )}
          </div>

          {totalEstimate !== null && (
            <p style={{ margin: 0, fontSize: "12.5px", color: "#25476a", fontWeight: 700, backgroundColor: "#e8f5fb", border: "1px solid #a8d5ee", borderRadius: "8px", padding: "8px 12px" }}>
              Estimated charge: {fmt(totalEstimate)}{selectedLearners.length > 1 ? ` total (${selectedLearners.length} learners)` : ""}
            </p>
          )}

          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <textarea style={{ ...inputStyle, minHeight: "60px", resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </div>
        </div>

        <div style={{ padding: "16px 24px", display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid #F3F4F6" }}>
          <button type="button" onClick={onClose} style={{ padding: "9px 18px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Cancel
          </button>
          <button type="button" disabled={isPending} onClick={submit} style={{ padding: "9px 18px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer" }}>
            {isPending ? "Logging…" : learnerIds.length > 1 ? `Log ${learnerIds.length} visits` : "Log Visit"}
          </button>
        </div>
        </>
        )}
      </div>
    </div>,
    document.body
  );
}
