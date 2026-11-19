import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiBookOpen, FiCheck } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { sectionPath } from "../../../routes/portalPaths";
import { btn } from "../../qa/shared";
import { BRAND, FONT, HERO_GRADIENT, card, cardHeading } from "../../../theme/brand";
import { JoinOnlineButton } from "../../timetable/components/OnlineClass";
import { useCoverAttendance, useCoverPage, useCoverTaught } from "../hooks/useCovers";
import { StatusPill, whenLabel } from "../shared";

/*
 * One session someone is covering (/teacher-portal/covers/:id, 19 Nov 2026) — the cover educator's
 * whole job for that day: whose class it is and their note, the session plan, the class list for
 * attendance, Mark as taught. Only this class on this date; marking stays with the class's educator.
 */
const STATUSES = [["present", "Present"], ["late", "Late"], ["absent", "Absent"], ["excused", "Excused"]];
const STATUS_COLOR = { present: "#047857", late: "#B45309", absent: "#B91C1C", excused: "#4B5563" };

export default function CoverSessionPage() {
  const { coverId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: cover, isLoading, isError } = useCoverPage(coverId);
  const saveAttendance = useCoverAttendance(coverId);
  const taught = useCoverTaught(coverId);
  const [marks, setMarks] = useState({});
  useEffect(() => { if (cover) setMarks(Object.fromEntries(cover.learners.map((l) => [l.id, l.status]))); }, [cover]);

  if (isLoading) return <p style={{ fontFamily: FONT, fontSize: 13, color: BRAND.faint }}>Loading…</p>;
  if (isError || !cover) {
    return (
      <div style={{ fontFamily: FONT }}>
        <Link to="/teacher-portal/covers" style={{ fontSize: 13, fontWeight: 700, color: BRAND.mid }}>← Covers</Link>
        <p style={{ color: BRAND.danger, fontSize: 14 }}>This cover couldn&apos;t be found, or isn&apos;t yours.</p>
      </div>
    );
  }
  const marked = cover.learners.filter((l) => marks[l.id]).length;
  const changed = cover.learners.some((l) => (marks[l.id] || null) !== (l.status || null));
  const accepted = cover.status === "accepted";

  return (
    <div style={{ fontFamily: FONT, display: "flex", flexDirection: "column", gap: 14, maxWidth: 900 }}>
      <Link to="/teacher-portal/covers" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: BRAND.mid, textDecoration: "none", alignSelf: "flex-start" }}><FiArrowLeft size={14} /> Covers</Link>
      <div style={{ background: HERO_GRADIENT, borderRadius: 20, padding: "22px 26px", color: "#fff" }}>
        <p style={{ margin: 0, fontSize: 11.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9BD7F2" }}>Covering{cover.originalTeacherName ? ` for ${cover.originalTeacherName}` : ""}</p>
        <h1 style={{ margin: "6px 0 4px", fontSize: 22, fontWeight: 900 }}>{cover.courseName}{cover.sessionTitle ? ` — ${cover.sessionTitle}` : ""}</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: "rgba(255,255,255,0.85)" }}>{whenLabel(cover)} · {cover.className}{cover.hubName ? `, ${cover.hubName}` : ""}</p>
      </div>

      <section style={{ ...card, padding: "16px 18px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <StatusPill status={cover.status} />
        <span style={{ flex: 1 }} />
        {cover.meetingLink && <JoinOnlineButton href={cover.meetingLink} label="Join online class" />}
        <button type="button" className="ci-btn" onClick={() => navigate(sectionPath(user?.role, cover.courseId, cover.sessionId, "outcomes"))} style={{ ...btn("secondary"), gap: 6 }}><FiBookOpen /> Session plan</button>
        {accepted && (
          <button type="button" className="ci-btn" disabled={!cover.canTeach || cover.taught || taught.isPending} onClick={() => taught.mutate()}
            style={{ ...btn("primary", { disabled: !cover.canTeach || cover.taught || taught.isPending }), gap: 6 }}>
            <FiCheck /> {cover.taught ? "Taught" : taught.isPending ? "Saving…" : "Mark as taught"}
          </button>
        )}
      </section>

      {cover.note && (
        <section style={{ ...card, padding: "14px 18px" }}>
          <h2 style={{ ...cardHeading, marginBottom: 6 }}>Note from {cover.originalTeacherName || "the class"}</h2>
          <p style={{ margin: 0, fontSize: 14, color: BRAND.ink, whiteSpace: "pre-wrap" }}>{cover.note}</p>
        </section>
      )}

      <section style={{ ...card, padding: "16px 18px", display: "grid", gap: 10, gridTemplateColumns: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ ...cardHeading, flex: 1 }}>Attendance · {marked} of {cover.learners.length} marked</h2>
          {accepted && cover.canTeach && (
            <>
              <button type="button" className="ci-btn" onClick={() => setMarks(Object.fromEntries(cover.learners.map((l) => [l.id, marks[l.id] || "present"])))} style={btn("secondary")}>Everyone else present</button>
              <button type="button" className="ci-btn" disabled={!changed || !marked || saveAttendance.isPending}
                onClick={() => saveAttendance.mutate(cover.learners.filter((l) => marks[l.id]).map((l) => ({ learnerId: l.id, status: marks[l.id] })))}
                style={btn("primary", { disabled: !changed || !marked || saveAttendance.isPending })}>{saveAttendance.isPending ? "Saving…" : "Save attendance"}</button>
            </>
          )}
        </div>
        {!accepted ? <p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>This cover isn&apos;t accepted, so there&apos;s nothing to take here.</p>
          : !cover.canTeach ? <p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>Attendance opens on the day of the session.</p> : null}
        {cover.learners.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: BRAND.faint }}>No learners in this class.</p> : (
          <div style={{ display: "grid", gap: 6, gridTemplateColumns: "100%" }}>
            {cover.learners.map((l) => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 10px", borderRadius: 10, border: `1px solid ${BRAND.line}` }}>
                <span style={{ flex: "1 1 160px", fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>{l.name}</span>
                <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
                  {STATUSES.map(([key, text]) => {
                    const on = marks[l.id] === key;
                    return (
                      <button key={key} type="button" disabled={!accepted || !cover.canTeach} onClick={() => setMarks((m) => ({ ...m, [l.id]: key }))}
                        style={{ padding: "5px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, fontFamily: FONT, cursor: !accepted || !cover.canTeach ? "default" : "pointer", border: `1.5px solid ${on ? STATUS_COLOR[key] : BRAND.border}`, background: on ? STATUS_COLOR[key] : "#fff", color: on ? "#fff" : BRAND.muted }}>
                        {text}
                      </button>
                    );
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
