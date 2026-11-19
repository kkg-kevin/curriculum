import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { FiSearch, FiUserCheck } from "react-icons/fi";
import { askConfirm } from "../../../components/ui/AskDialog";
import { useCancelCover, useCoverCandidates, useRequestCover } from "../hooks/useCovers";

/*
 * Session covers (19 Nov 2026) on a calendar session's detail — teacher and hub calendars.
 *   CoverSection    the class's side: who is covering (or has been asked), Cancel; or "Ask someone
 *                   to cover" — any educator in the workspace, same-hub first, each marked when
 *                   they're busy then, with a note for them.
 *   CoveringPanel   the cover educator's view of a session they're covering: whose it is, and the
 *                   cover page (plan, attendance, Mark as taught).
 */
const C = { ink: "#111827", muted: "#6B7280", faint: "#9CA3AF", border: "#E5E7EB", accent: "#25476a", mid: "#2e7db5", tint: "#e8f5fb", tintBorder: "#a8d5ee", amber: "#B45309", amberBg: "#FFFBEB", green: "#047857", greenBg: "#ECFDF5" };
const heading = { margin: 0, fontSize: 11, fontWeight: 800, color: C.faint, textTransform: "uppercase", letterSpacing: "0.05em" };
const button = (primary, disabled) => ({ padding: "8px 14px", borderRadius: 8, border: primary ? "none" : `1.5px solid ${C.border}`, backgroundColor: disabled ? "#b8d9ee" : primary ? C.accent : "#fff", color: primary ? "#fff" : C.accent, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: disabled ? "not-allowed" : "pointer" });

function AskForm({ event, onDone, onCancel }) {
  const ref = { classId: event.classId, courseId: event.courseId, sessionId: event.sessionId, date: event.date };
  const { data, isLoading, isError } = useCoverCandidates(ref);
  const request = useRequestCover();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(null);
  const [note, setNote] = useState("");
  const educators = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.educators || []).filter((e) => !q || e.name.toLowerCase().includes(q));
  }, [data, query]);
  const chosen = (data?.educators || []).find((e) => e.id === picked) || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, borderRadius: 10, border: `1.5px solid ${C.tintBorder}`, backgroundColor: "#F8FBFE" }}>
      <p style={{ margin: 0, fontSize: 12.5, color: C.ink, fontWeight: 700 }}>Who should cover {dayjs(event.date).format("ddd D MMM")}{event.startTime ? `, ${event.startTime}` : ""}?</p>
      <div style={{ position: "relative" }}>
        <FiSearch size={13} color={C.faint} style={{ position: "absolute", left: 9, top: 10 }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search educators" aria-label="Search educators"
          style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px 7px 28px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 12.5, fontFamily: "Inter, sans-serif" }} />
      </div>
      <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {isLoading ? <p style={{ margin: 0, fontSize: 12, color: C.faint }}>Loading educators…</p>
          : isError ? <p style={{ margin: 0, fontSize: 12, color: "#B91C1C" }}>Couldn't load educators.</p>
            : educators.length === 0 ? <p style={{ margin: 0, fontSize: 12, color: C.faint }}>No educators match.</p>
              : educators.map((e) => {
                const disabled = !e.hasLogin;
                const active = picked === e.id;
                return (
                  <button key={e.id} type="button" disabled={disabled} onClick={() => setPicked(e.id)}
                    style={{ display: "flex", alignItems: "center", gap: 8, textAlign: "left", padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${active ? C.accent : C.border}`, backgroundColor: active ? C.tint : "#fff", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1, fontFamily: "Inter, sans-serif" }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: C.ink }}>{e.name}</span>
                      <span style={{ display: "block", fontSize: 11, color: e.busy ? C.amber : C.muted }}>
                        {[e.sameHub ? "This hub" : "Another hub", e.busy, !e.hasLogin ? "No login yet — can't accept" : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {active && <FiUserCheck color={C.accent} />}
                  </button>
                );
              })}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} placeholder="A note for them — where the class is up to, what to bring (optional)"
        style={{ padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 12.5, fontFamily: "Inter, sans-serif", resize: "vertical" }} />
      {chosen?.busy && <p style={{ margin: 0, fontSize: 11.5, color: C.amber }}>{chosen.name}: {chosen.busy.toLowerCase()} — they may not be able to accept.</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={button(false)}>Cancel</button>
        <button type="button" disabled={!chosen || request.isPending} onClick={() => request.mutate({ ...ref, coverTeacherId: chosen.id, note: note.trim() || null }, { onSuccess: onDone })}
          style={button(true, !chosen || request.isPending)}>
          {request.isPending ? "Asking…" : chosen ? `Ask ${chosen.name.split(" ")[0]}` : "Choose someone"}
        </button>
      </div>
    </div>
  );
}

export function CoverSection({ event, onDone }) {
  const [asking, setAsking] = useState(false);
  const cancel = useCancelCover();
  const cover = event.cover;
  const past = dayjs(event.date).isBefore(dayjs(), "day");
  if (!cover && past) return null;

  const cancelCover = async () => {
    const ok = await askConfirm({
      title: cover.status === "pending" ? "Withdraw the request?" : `Cancel ${cover.coverTeacherName}'s cover?`,
      message: cover.status === "pending" ? `${cover.coverTeacherName} won't be asked any more.` : `${cover.coverTeacherName} will be told they're no longer covering this session, and it's back with the class's educator.`,
      confirmLabel: cover.status === "pending" ? "Withdraw request" : "Cancel cover",
      tone: "danger",
    });
    if (ok) cancel.mutate({ id: cover.id, reason: null }, { onSuccess: onDone });
  };

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={heading}>Cover</p>
      {cover ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 12px", borderRadius: 10, backgroundColor: cover.status === "accepted" ? C.greenBg : C.amberBg }}>
          <p style={{ margin: 0, flex: "1 1 200px", fontSize: 12.5, color: cover.status === "accepted" ? C.green : C.amber, fontWeight: 700 }}>
            {cover.status === "accepted" ? `${cover.coverTeacherName} is covering this session` : `${cover.coverTeacherName} has been asked — waiting for an answer`}
          </p>
          {!past && <button type="button" disabled={cancel.isPending} onClick={cancelCover} style={{ ...button(false, cancel.isPending), color: "#B91C1C" }}>{cancel.isPending ? "Cancelling…" : cover.status === "pending" ? "Withdraw" : "Cancel cover"}</button>}
        </div>
      ) : asking ? (
        <AskForm event={event} onDone={onDone} onCancel={() => setAsking(false)} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <p style={{ margin: 0, flex: "1 1 220px", fontSize: 12.5, color: C.muted }}>Can't teach this one? Another educator can take it — they see it on their timetable, take attendance and mark it taught.</p>
          <button type="button" onClick={() => setAsking(true)} style={button(true)}>Ask someone to cover</button>
        </div>
      )}
    </div>
  );
}

export function CoveringPanel({ event, onClose }) {
  const navigate = useNavigate();
  const f = event.coveringFor;
  return (
    <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ padding: "12px 14px", borderRadius: 10, backgroundColor: C.tint, border: `1.5px solid ${C.tintBorder}` }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.accent }}>You're covering this session{f.originalTeacherName ? ` for ${f.originalTeacherName}` : ""}</p>
        <p style={{ margin: "3px 0 0", fontSize: 12.5, color: C.muted }}>{f.className}{event.startTime ? ` · ${event.startTime}–${event.endTime}` : ""}</p>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: C.muted }}>The cover page has their note, the session plan, the class list for attendance and Mark as taught.</p>
      <button type="button" onClick={() => { onClose(); navigate(`/teacher-portal/covers/${f.coverId}`); }} style={{ ...button(true), alignSelf: "flex-start" }}>Open the cover page →</button>
    </div>
  );
}
