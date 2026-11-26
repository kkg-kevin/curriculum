import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FiCheckCircle, FiRotateCcw, FiSearch, FiXCircle } from "react-icons/fi";
import { useBringBackLearners, useReturningLearners } from "../hooks/useBootcampHubs";
import { CheckinStyles, Modal, btn, hint, input, label } from "../../checkins/shared";

// "Bring back learners" (27 Nov 2026): the learners of this bootcamp's earlier runs, ticked and
// moved into this run at one hub — into the class chosen, or each into the class for their stage.
// A hub holds one place per learner, so each is MOVED (server: bootcamp-returning.service.js →
// Move learner): out of their earlier-run class, same admission number, written on their History,
// placed on this run's pathway; their reports, certificates and marked work stay theirs.

const fmt = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const check = { width: 18, height: 18, accentColor: "#25476a", cursor: "pointer", flexShrink: 0 };

export default function BringBackLearnersDialog({ bootcamp, onClose }) {
  const { data, isLoading } = useReturningLearners(bootcamp.id);
  const bring = useBringBackLearners(bootcamp.id);
  const hubs = data?.hubs || [];
  const learners = data?.learners || [];
  const earlierRuns = data?.earlierRuns || [];

  const [hubId, setHubId] = useState("");
  const [classId, setClassId] = useState("");
  const [runFilter, setRunFilter] = useState("");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(() => new Set());
  const [invoice, setInvoice] = useState(false);
  const [notifyParent, setNotifyParent] = useState(true);
  const [leaveEarlierPlace, setLeaveEarlierPlace] = useState(true);
  const [result, setResult] = useState(null);

  const hub = hubs.find((h) => h.hubId === (hubId || hubs[0]?.hubId)) || null;
  const price = Number(bootcamp.priceAmount) > 0 ? `${bootcamp.priceCurrency || "KES"} ${Number(bootcamp.priceAmount).toLocaleString()}` : null;

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return learners.filter((l) => (!runFilter || l.lastRun?.id === runFilter)
      && (!term || [l.name, l.guardianName, l.guardianPhone].filter(Boolean).some((v) => String(v).toLowerCase().includes(term))));
  }, [learners, q, runFilter]);
  const eligible = shown.filter((l) => !l.inThisRun);
  const allShownPicked = eligible.length > 0 && eligible.every((l) => picked.has(l.id));
  const toggle = (id) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setPicked((s) => {
    const n = new Set(s);
    if (allShownPicked) eligible.forEach((l) => n.delete(l.id)); else eligible.forEach((l) => n.add(l.id));
    return n;
  });

  const submit = () => {
    if (!hub || !picked.size) return;
    bring.mutate({ hubId: hub.hubId, classId: classId || null, learnerIds: [...picked], invoice, notifyParent, leaveEarlierPlace }, {
      onSuccess: (res) => {
        setResult(res);
        setPicked(new Set());
        if (res.moved) toast.success(`${res.moved} learner${res.moved === 1 ? "" : "s"} brought back`);
        if (res.failed) toast.error(`${res.failed} couldn't be moved — see why below`);
      },
    });
  };

  const ended = data?.run?.ended;
  const canSubmit = !!hub && picked.size > 0 && !bring.isPending && !ended;

  return (
    <Modal
      title="Bring back learners from earlier runs"
      onClose={onClose}
      width={760}
      footer={result ? (
        <>
          <button type="button" className="ci-btn" onClick={() => setResult(null)} style={btn("secondary")}>Bring back more</button>
          <button type="button" className="ci-btn" onClick={onClose} style={btn("primary")}>Done</button>
        </>
      ) : (
        <>
          <button type="button" className="ci-btn" onClick={onClose} style={btn("secondary")}>Cancel</button>
          <button type="button" className="ci-btn" onClick={submit} disabled={!canSubmit} style={btn("primary", { disabled: !canSubmit })}>
            <FiRotateCcw size={14} /> {bring.isPending ? "Moving…" : `Bring back ${picked.size || ""} learner${picked.size === 1 ? "" : "s"}`.replace("  ", " ")}
          </button>
        </>
      )}
    >
      <CheckinStyles />
      {result ? (
        <ResultList result={result} />
      ) : isLoading ? (
        <div style={{ height: 120, borderRadius: 10, background: "#F9FAFB" }} />
      ) : ended ? (
        <p style={{ ...hint, fontSize: 13 }}>This run has already ended. Open the run that hasn&rsquo;t to bring learners back into it.</p>
      ) : !hubs.length ? (
        <p style={{ ...hint, fontSize: 13 }}>This run isn&rsquo;t at any hub yet. Use <strong>Run at a Hub</strong> first: that makes its classes.</p>
      ) : !earlierRuns.length ? (
        <p style={{ ...hint, fontSize: 13 }}>
          This is the first run of <strong>{bootcamp.name}</strong>, so there&rsquo;s nobody to bring back. Runs made with <strong>Schedule another run</strong> are linked; a learner from a different bootcamp is moved from their own page (Move learner).
        </p>
      ) : (
        <>
          <p style={{ ...hint, margin: "0 0 14px", fontSize: 13 }}>
            Learners of earlier runs of <strong>{bootcamp.name}</strong>. Each is <strong>moved</strong> into this run (a hub holds one place per learner): out of their earlier class, same admission number, placed on this run&rsquo;s pathway. Their reports, certificates and marked work stay theirs, and the move shows on their History.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={label} htmlFor="bb-hub">Into this run at</label>
              <select id="bb-hub" value={hub?.hubId || ""} onChange={(e) => { setHubId(e.target.value); setClassId(""); }} style={input}>
                {hubs.map((h) => <option key={h.hubId} value={h.hubId}>{h.hubName}</option>)}
              </select>
            </div>
            <div>
              <label style={label} htmlFor="bb-class">Class</label>
              <select id="bb-class" value={classId} onChange={(e) => setClassId(e.target.value)} style={input}>
                <option value="">Each by their stage (automatic)</option>
                {(hub?.classes || []).filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <p style={hint}>Returning learners on a different course: pick the class whose cohort has that course.</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <div style={{ position: "relative", flex: "1 1 220px" }}>
              <FiSearch size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search learner or parent" style={{ ...input, paddingLeft: 30 }} />
            </div>
            {earlierRuns.length > 1 && (
              <select value={runFilter} onChange={(e) => setRunFilter(e.target.value)} style={{ ...input, width: "auto", flex: "0 1 240px" }}>
                <option value="">Every earlier run</option>
                {earlierRuns.map((r) => <option key={r.id} value={r.id}>{r.name} · {fmt(r.startDate)}</option>)}
              </select>
            )}
          </div>

          {!learners.length ? (
            <p style={{ ...hint, fontSize: 13 }}>No learners found on the earlier runs.</p>
          ) : (
            <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", fontSize: 12.5, fontWeight: 700, color: "#374151", cursor: eligible.length ? "pointer" : "default" }}>
                <input type="checkbox" checked={allShownPicked} onChange={toggleAll} disabled={!eligible.length} style={check} />
                Everyone shown ({eligible.length}){picked.size ? ` · ${picked.size} ticked` : ""}
              </label>
              <div style={{ maxHeight: 340, overflowY: "auto" }}>
                {shown.map((l) => (
                  <label key={l.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderBottom: "1px solid #F3F4F6", cursor: l.inThisRun ? "default" : "pointer", opacity: l.inThisRun ? 0.6 : 1 }}>
                    <input type="checkbox" checked={picked.has(l.id)} onChange={() => toggle(l.id)} disabled={!!l.inThisRun} style={{ ...check, marginTop: 2 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: "#111827" }}>{l.name}</span>
                        {l.age != null && <span style={{ fontSize: 12, color: "#6B7280" }}>{l.age} yrs</span>}
                        {l.inThisRun && <span style={{ fontSize: 11, fontWeight: 700, color: "#25476a", background: "#EAF2FB", borderRadius: 20, padding: "1px 8px" }}>Already in this run</span>}
                        {l.accountStatus !== "active" && <span style={{ fontSize: 11, fontWeight: 700, color: "#92400E", background: "#FEF3C7", borderRadius: 20, padding: "1px 8px" }}>{l.accountStatus === "pending_payment" ? "Waiting for payment" : "Switched off"}</span>}
                      </div>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6B7280", lineHeight: 1.45 }}>
                        {l.inThisRun ? l.inThisRun.label : [l.lastRun && `${l.lastRun.name} · ${fmt(l.lastRun.startDate)}`, l.lastPlace].filter(Boolean).join(" · ")}
                        {!l.inThisRun && l.now?.length > 0 && <><br />Now: {l.now.join("; ")}</>}
                        {l.guardianName && <><br />Parent: {l.guardianName}{l.guardianPhone ? ` · ${l.guardianPhone}` : ""}</>}
                      </p>
                    </div>
                  </label>
                ))}
                {!shown.length && <p style={{ ...hint, padding: 12, fontSize: 13 }}>Nobody matches.</p>}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
            {price && (
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "#374151", cursor: "pointer" }}>
                <input type="checkbox" checked={invoice} onChange={(e) => setInvoice(e.target.checked)} style={check} />
                <span>Raise this run&rsquo;s invoice for each ({price}), emailed to the family</span>
              </label>
            )}
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "#374151", cursor: "pointer" }}>
              <input type="checkbox" checked={notifyParent} onChange={(e) => setNotifyParent(e.target.checked)} style={check} />
              <span>Tell each parent where their child is now</span>
            </label>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "#374151", cursor: "pointer" }}>
              <input type="checkbox" checked={leaveEarlierPlace} onChange={(e) => setLeaveEarlierPlace(e.target.checked)} style={check} />
              <span>
                Also end their earlier-run place at another hub
                <span style={{ ...hint, display: "block", margin: 0 }}>At {hub?.hubName || "this hub"} their earlier class is always left: one place per learner per hub.</span>
              </span>
            </label>
          </div>
        </>
      )}
    </Modal>
  );
}

function ResultList({ result }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <p style={{ margin: "0 0 6px", fontSize: 13.5, color: "#374151" }}>
        <strong>{result.moved}</strong> brought back{result.failed ? <>, <strong>{result.failed}</strong> not moved</> : ""}.
        {result.moved > 0 && " Next: give the new classes an educator and lessons in Timetable (Weekly plan)."}
      </p>
      {result.results.map((r) => (
        <div key={r.learnerId} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 10px", borderRadius: 10, border: "1px solid #F3F4F6" }}>
          {r.ok ? <FiCheckCircle size={16} color="#15803D" style={{ marginTop: 2, flexShrink: 0 }} /> : <FiXCircle size={16} color="#B91C1C" style={{ marginTop: 2, flexShrink: 0 }} />}
          <div style={{ fontSize: 13, color: "#374151", minWidth: 0 }}>
            <strong>{r.name || "A learner"}</strong>
            <span style={{ color: "#6B7280" }}>
              {r.ok ? ` → ${r.label}${r.invoice ? ` · invoice ${r.invoice.invoiceNumber}` : ""}${r.parentTold ? " · parent told" : ""}` : ` · ${r.reason}`}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
