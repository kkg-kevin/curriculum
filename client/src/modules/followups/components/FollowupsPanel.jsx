import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiAlertTriangle, FiArrowUpRight, FiCalendar, FiCheckCircle, FiClock, FiEdit3, FiFlag, FiMessageCircle, FiPhone, FiSearch, FiSend, FiUser, FiUsers, FiX } from "react-icons/fi";
import { BRAND, FONT, card, pill } from "../../../theme/brand";
import { askText } from "../../../components/ui/AskDialog";
import { followupsApi, errorOf, day, when } from "../services/followupsApi";

// Learner follow-ups (26 Nov 2026 — server analytics.cases.js). Each learner the figures flag gets
// a case per reason (low scores, attendance, missed work, not signing in, absent in a row, stuck on
// a skill, reports not opened) with an owner, a due date and a status; opening one shows what's
// wrong, the parent's details, a message ready to send, the actions and everything done so far.
// Used by Reports & Analytics → Follow-ups (admins, a hub), the educator's Follow-ups page, and a
// learner's page (`learnerId`, compact).

const VIEWS = [["open", "Open"], ["mine", "Mine"], ["overdue", "Overdue"], ["escalated", "Escalated"], ["resolved", "Closed"]];
const ACTION_LABEL = {
  opened: "Opened", parent_message: "Message to the parent", educator_told: "Educators told", note: "Note", status: "Status",
  escalated: "Escalated to the admins", assigned: "Handed over", recheck: "Two-week check", resolved: "Closed",
  checkin: "Parent check-in booked", followed_up: "Followed up",
};
const btn = (kind = "ghost", extra = {}) => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 40, padding: "8px 14px", borderRadius: 11, border: kind === "primary" ? "none" : `1.5px solid ${kind === "danger" ? BRAND.dangerBorder : BRAND.border}`, background: kind === "primary" ? BRAND.navy : "#fff", color: kind === "primary" ? "#fff" : kind === "danger" ? BRAND.danger : BRAND.inkSoft, fontSize: 13.5, fontWeight: 800, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap", ...extra });
const field = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 11, border: `1.5px solid ${BRAND.border}`, fontSize: 15, fontFamily: FONT, color: BRAND.ink, background: "#fff" };

function useWide(min) {
  const [wide, setWide] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= min : true));
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= min);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [min]);
  return wide;
}

function Kpi({ label, value, tone = "navy", active, onClick }) {
  const color = tone === "danger" ? BRAND.danger : tone === "gold" ? BRAND.goldText : BRAND.navy;
  return (
    <button type="button" onClick={onClick} aria-pressed={active} style={{ ...card, padding: "11px 14px", textAlign: "left", cursor: onClick ? "pointer" : "default", fontFamily: FONT, borderColor: active ? BRAND.navy : BRAND.border, background: active ? BRAND.navyTint : "#fff", minWidth: 0 }}>
      <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1.1 }}>{value ?? 0}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.inkSoft }}>{label}</div>
    </button>
  );
}

// ── One case, opened over the page ───────────────────────────────────────────────────────────────
function CaseDrawer({ id, onClose, learnerLink, level }) {
  const qc = useQueryClient();
  const wide = useWide(760);
  const key = ["followups", "case", id];
  const { data: c, isLoading, error } = useQuery({ queryKey: key, queryFn: () => followupsApi.get(id) });
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => { if (c?.suggestedMessage) setMessage(c.suggestedMessage); }, [c?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = before; };
  }, [onClose]);
  const act = useMutation({
    mutationFn: ({ body }) => followupsApi.act(id, body),
    onSuccess: (d, v) => { qc.setQueryData(key, d); qc.invalidateQueries({ queryKey: ["followups", "list"] }); if (v.ok) toast.success(v.ok); if (v.after) v.after(); },
    onError: (err) => toast.error(errorOf(err)),
  });
  const run = (body, ok, after) => act.mutate({ body, ok, after });
  const closed = c?.status === "resolved";

  const resolve = async () => {
    const text = await askText({ title: "Close this follow-up?", message: "Say what happened (the family called back, a plan is working…).", label: "What happened", required: false, confirmLabel: "Close it" });
    if (text === null) return;
    run({ action: "status", status: "resolved", outcome: "sorted", note: text }, "Closed");
  };
  const escalate = async () => {
    const text = await askText({ title: "Hand this to the admins?", message: "Say why it needs them.", label: "Why", required: true, confirmLabel: "Escalate", tone: "danger" });
    if (text) run({ action: "escalate", note: text }, "Escalated to the admins");
  };
  const tell = async () => {
    const text = await askText({ title: "Tell the class's educators?", message: "They get a notice with the reason. Add anything they should know.", label: "Note (optional)", required: false, confirmLabel: "Tell them" });
    if (text !== null) run({ action: "tell_educators", note: text }, "Educators told");
  };

  return createPortal(
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100dvh", zIndex: 1600, background: "rgba(15,23,42,0.42)", display: "flex", justifyContent: "flex-end", fontFamily: FONT }}>
      <aside role="dialog" aria-modal="true" aria-label="Follow-up" style={{ width: wide ? "min(100%, 620px)" : "100%", height: "100%", background: BRAND.canvas || "#F8FAFC", display: "flex", flexDirection: "column", boxShadow: "-12px 0 40px rgba(15,23,42,0.22)" }}>
        <header style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "14px 18px", background: "#fff", borderBottom: `1px solid ${BRAND.line}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: BRAND.sky }}>Follow-up</div>
            <h2 style={{ margin: "2px 0 0", fontSize: 19, fontWeight: 900, color: BRAND.ink }}>{c?.learnerName || "…"}</h2>
            {c && <div style={{ fontSize: 13, color: BRAND.muted }}>{[c.className, c.hubName].filter(Boolean).join(" · ")}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ width: 40, height: 40, borderRadius: 10, border: "none", background: BRAND.greyTint, color: BRAND.muted, cursor: "pointer", display: "grid", placeItems: "center" }}><FiX /></button>
        </header>
        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "grid", gap: 12, alignContent: "start" }}>
          {isLoading && <div style={{ ...card, padding: 24, textAlign: "center", color: BRAND.faint }}>Loading…</div>}
          {error && <div style={{ ...card, padding: 20, color: BRAND.danger }}>{errorOf(error)}</div>}
          {c && (
            <>
              {/* What's wrong, and where it stands. */}
              <section style={{ ...card, padding: 14, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={pill(c.reasonTone)}><FiAlertTriangle size={11} /> {c.reasonLabel}</span>
                  <span style={pill(c.statusTone)}>{c.statusLabel}{c.outcomeLabel ? `: ${c.outcomeLabel}` : ""}</span>
                  {c.overdue && <span style={pill("danger")}><FiClock size={11} /> Overdue</span>}
                </div>
                <p style={{ margin: 0, fontSize: 15, color: BRAND.ink, lineHeight: 1.5 }}>{c.summary}</p>
                {!closed && !c.stillFlagged && <p style={{ margin: 0, fontSize: 13, color: BRAND.navy, fontWeight: 700 }}><FiCheckCircle size={13} /> Looks better now: the figures no longer flag this. It closes itself at the two-week check if it stays that way.</p>}
                {c.lastCheck && <p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>Two-week check {day(c.lastCheck.at)}: {c.lastCheck.summary}</p>}
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5, color: BRAND.muted }}>
                  <span><FiUser size={12} /> {c.ownerName}</span>
                  {!closed && c.dueOn && <span style={{ color: c.overdue ? BRAND.danger : BRAND.muted }}><FiClock size={12} /> Due {day(c.dueOn)}</span>}
                  {!closed && c.recheckOn && <span><FiCalendar size={12} /> Checked again {day(c.recheckOn)}</span>}
                  <span>Opened {day(c.openedAt)}</span>
                </div>
                {learnerLink && <Link to={learnerLink(c.learnerId)} onClick={onClose} style={{ fontSize: 13, fontWeight: 800, color: BRAND.mid }}>Open {c.firstName}&apos;s page <FiArrowUpRight size={12} /></Link>}
              </section>

              {/* The parent. */}
              <section style={{ ...card, padding: 14, display: "grid", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: BRAND.ink, display: "flex", gap: 6, alignItems: "center" }}><FiUsers size={14} /> Parent</h3>
                <div style={{ fontSize: 14, color: BRAND.inkSoft }}>
                  <strong>{c.parent.name || "Not on record"}</strong>
                  {c.parent.phone && <> · <a href={`tel:${c.parent.phone}`} style={{ color: BRAND.mid, fontWeight: 700 }}><FiPhone size={12} /> {c.parent.phone}</a></>}
                  {!c.parent.hasLogin && <span style={{ display: "block", fontSize: 12.5, color: BRAND.goldText }}>No parent login: call them, then add a note of the call.</span>}
                </div>
                {!closed && c.parent.hasLogin && (
                  <>
                    <label htmlFor="fu-msg" style={{ fontSize: 13, fontWeight: 800, color: BRAND.inkSoft }}>Message to the parent <span style={{ fontWeight: 500, color: BRAND.muted }}>(ready to send; change anything)</span></label>
                    <textarea id="fu-msg" rows={5} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} style={{ ...field, resize: "vertical", lineHeight: 1.5 }} />
                    <button type="button" style={btn("primary", { justifySelf: "start" })} disabled={act.isPending || !message.trim()} onClick={() => run({ action: "message_parent", message }, "Sent to the parent")}><FiSend /> Send to the parent</button>
                  </>
                )}
              </section>

              {/* What to do next. */}
              {!closed && (
                <section style={{ ...card, padding: 14, display: "grid", gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: BRAND.ink }}>Next step</h3>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {c.status !== "contacted" && <button type="button" style={btn()} disabled={act.isPending} onClick={() => run({ action: "status", status: "contacted" }, "Marked contacted")}><FiPhone /> Contacted</button>}
                    {c.status !== "plan" && <button type="button" style={btn()} disabled={act.isPending} onClick={() => run({ action: "status", status: "plan" }, "Plan agreed")}><FiCheckCircle /> Plan agreed</button>}
                    <button type="button" style={btn()} disabled={act.isPending} onClick={tell}><FiMessageCircle /> Tell the educators</button>
                    {level === "admin" && c.classId && <Link to={`/mentor-checkins/rounds/new?hubId=${c.hubId}&classId=${c.classId}&learnerId=${c.learnerId}`} style={{ ...btn(), textDecoration: "none" }}><FiCalendar /> Book a parent check-in</Link>}
                    <button type="button" style={btn("primary")} disabled={act.isPending} onClick={resolve}><FiCheckCircle /> Close it</button>
                    {c.status !== "escalated" && <button type="button" style={btn("danger")} disabled={act.isPending} onClick={escalate}><FiFlag /> Escalate</button>}
                  </div>
                  {c.owners && (
                    <label style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 800, color: BRAND.inkSoft }}>Looked after by
                      <select value={c.ownerUserId || ""} disabled={act.isPending} onChange={(e) => run({ action: "assign", ownerUserId: e.target.value || null }, "Handed over")} style={{ ...field, maxWidth: 340 }}>
                        {c.owners.map((o) => <option key={o.id || "admins"} value={o.id || ""}>{o.name}</option>)}
                      </select>
                    </label>
                  )}
                  <form onSubmit={(e) => { e.preventDefault(); if (note.trim()) run({ action: "note", note }, "Note added", () => setNote("")); }} style={{ display: "flex", gap: 8 }}>
                    <input aria-label="Add a note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Add a note (a call, what was agreed…)" style={{ ...field, flex: 1, minWidth: 0 }} />
                    <button type="submit" style={btn("ghost")} disabled={act.isPending || !note.trim()}><FiEdit3 /> Add</button>
                  </form>
                </section>
              )}

              {/* Everything done so far. */}
              <section style={{ ...card, padding: 14, display: "grid", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: BRAND.ink }}>What was done</h3>
                <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 0 }}>
                  {c.events.map((e) => (
                    <li key={e.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: `1px solid ${BRAND.line}` }}>
                      <span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", background: e.action === "escalated" ? BRAND.danger : e.action === "recheck" ? BRAND.gold : BRAND.sky, marginTop: 6, flexShrink: 0 }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12.5, color: BRAND.muted }}><strong style={{ color: BRAND.ink }}>{ACTION_LABEL[e.action] || e.action}</strong> · {when(e.createdAt)}{e.createdByName ? ` · ${e.createdByName}` : ""}</div>
                        {e.note && <div style={{ fontSize: 13.5, color: BRAND.inkSoft, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{e.note}</div>}
                      </div>
                    </li>
                  ))}
                </ol>
                {c.otherCases.length > 0 && (
                  <details>
                    <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, color: BRAND.mid }}>{c.firstName}&apos;s other follow-ups ({c.otherCases.length})</summary>
                    <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                      {c.otherCases.map((o) => <div key={o.id} style={{ fontSize: 13, color: BRAND.inkSoft }}><strong>{o.reasonLabel}</strong> · {o.statusLabel}{o.outcomeLabel ? `: ${o.outcomeLabel}` : ""} · opened {day(o.openedAt)}</div>)}
                    </div>
                  </details>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function CaseRow({ c, onOpen, compact }) {
  return (
    <button type="button" onClick={() => onOpen(c.id)} style={{ ...card, padding: "12px 14px", textAlign: "left", cursor: "pointer", fontFamily: FONT, display: "grid", gap: 5, borderColor: c.overdue ? BRAND.dangerBorder : BRAND.border }}>
      <span style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        {!compact && <strong style={{ fontSize: 15, color: BRAND.ink }}>{c.learnerName}</strong>}
        {!compact && <span style={{ fontSize: 12.5, color: BRAND.muted }}>{[c.className, c.hubName].filter(Boolean).join(" · ")}</span>}
      </span>
      <span style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={pill(c.reasonTone)}>{c.reasonLabel}</span>
        <span style={pill(c.statusTone)}>{c.statusLabel}{c.outcomeLabel ? `: ${c.outcomeLabel}` : ""}</span>
        {c.overdue && <span style={pill("danger")}><FiClock size={11} /> Overdue</span>}
        {c.status !== "resolved" && !c.stillFlagged && <span style={pill("good")}><FiCheckCircle size={11} /> Looks better</span>}
      </span>
      <span style={{ fontSize: 13.5, color: BRAND.inkSoft }}>{c.summary}</span>
      <span style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: BRAND.muted }}>
        <span><FiUser size={11} /> {c.ownerName}</span>
        {c.status !== "resolved" && c.dueOn && <span style={{ color: c.overdue ? BRAND.danger : BRAND.muted }}>Due {day(c.dueOn)}</span>}
        {c.status === "resolved" && c.resolvedAt && <span>Closed {day(c.resolvedAt)}</span>}
        {c.lastAction && <span>Last: {ACTION_LABEL[c.lastAction.action] || c.lastAction.action} {day(c.lastAction.at)}</span>}
      </span>
    </button>
  );
}

export default function FollowupsPanel({ level = "admin", learnerId = null, learnerLink = null }) {
  const [params, setParams] = useSearchParams();
  const compact = !!learnerId;
  const [view, setView] = useState(compact ? "all" : level === "educator" ? "mine" : "open");
  const [reason, setReason] = useState("");
  const [q, setQ] = useState("");
  const openId = params.get("case");
  const setOpen = (id) => setParams((p) => { const n = new URLSearchParams(p); if (id) n.set("case", id); else n.delete("case"); return n; }, { replace: !id });
  const { data, isLoading, error } = useQuery({
    queryKey: ["followups", "list", view, reason, learnerId],
    queryFn: () => followupsApi.list({ view: compact ? "all" : view, reason, learnerId }),
  });
  const shown = useMemo(() => (data?.cases || []).filter((c) => !q.trim() || `${c.learnerName} ${c.className} ${c.hubName}`.toLowerCase().includes(q.trim().toLowerCase())), [data, q]);
  const counts = data?.counts || {};

  return (
    <div style={{ display: "grid", gap: 12, fontFamily: FONT }}>
      {!compact && (
        <>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
            <Kpi label="Open" value={counts.open} active={view === "open"} onClick={() => setView("open")} />
            <Kpi label={level === "admin" ? "Mine or the admins'" : "Mine"} value={counts.mine} active={view === "mine"} onClick={() => setView("mine")} />
            <Kpi label="Overdue" value={counts.overdue} tone="danger" active={view === "overdue"} onClick={() => setView("overdue")} />
            <Kpi label="Escalated" value={counts.escalated} tone="danger" active={view === "escalated"} onClick={() => setView("escalated")} />
            <Kpi label="Back on track" value={counts.backOnTrack} active={view === "resolved"} onClick={() => setView("resolved")} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div role="group" aria-label="Show" style={{ display: "flex", gap: 6, overflowX: "auto" }}>
              {VIEWS.map(([k, l]) => <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)} style={btn(view === k ? "primary" : "ghost", { minHeight: 36, padding: "6px 12px", borderRadius: 999, fontSize: 12.5 })}>{l}</button>)}
            </div>
            <select aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...field, width: "auto", padding: "8px 10px", fontSize: 13.5 }}>
              <option value="">Every reason</option>
              {(data?.reasons || []).map((r) => <option key={r.key} value={r.key}>{r.label}{counts.byReason?.[r.key] ? ` · ${counts.byReason[r.key]}` : ""}</option>)}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 10px", borderRadius: 11, border: `1.5px solid ${BRAND.border}`, background: "#fff", flex: "1 1 200px", minWidth: 0 }}>
              <FiSearch color={BRAND.faint} />
              <input aria-label="Search learners" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a learner, class or hub…" style={{ border: "none", outline: "none", padding: "9px 0", fontSize: 14, fontFamily: FONT, width: "100%", background: "transparent" }} />
            </label>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>Opened by themselves every day from the figures: low scores, attendance, missed work, not signing in, absent several times in a row, stuck on a skill, reports not opened. Each goes to the class&apos;s educator, is due in 3 days and is checked again after 2 weeks.</p>
        </>
      )}
      {isLoading && <div style={{ ...card, padding: 24, textAlign: "center", color: BRAND.faint }}>Loading…</div>}
      {error && <div style={{ ...card, padding: 20, color: BRAND.danger }}>{errorOf(error)}</div>}
      {!isLoading && !error && !shown.length && <div style={{ ...card, padding: "28px 18px", textAlign: "center", color: BRAND.muted }}>{compact ? "No follow-ups for this learner." : view === "mine" ? "Nothing waiting for you." : "Nothing here."}</div>}
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: compact ? "100%" : "repeat(auto-fill, minmax(min(100%, 420px), 1fr))" }}>
        {shown.map((c) => <CaseRow key={c.id} c={c} onOpen={setOpen} compact={compact} />)}
      </div>
      {openId && <CaseDrawer id={openId} level={level} learnerLink={compact ? null : learnerLink} onClose={() => setOpen(null)} />}
    </div>
  );
}

// "Open a follow-up" for a learner by hand (staff learner page).
export function OpenFollowupButton({ learnerId }) {
  const qc = useQueryClient();
  const [, setParams] = useSearchParams();
  const open = async () => {
    const note = await askText({ title: "Open a follow-up", message: "Say what needs following up (a call from the parent, something seen in class…). It goes to the class's educator.", label: "What needs following up", required: true, confirmLabel: "Open it" });
    if (!note) return;
    try {
      const c = await followupsApi.open({ learnerId, note });
      qc.invalidateQueries({ queryKey: ["followups", "list"] });
      toast.success("Follow-up opened");
      setParams((p) => { const n = new URLSearchParams(p); n.set("case", c.id); return n; });
    } catch (err) {
      toast.error(errorOf(err));
    }
  };
  return <button type="button" style={btn("primary")} onClick={open}><FiFlag /> Open a follow-up</button>;
}
