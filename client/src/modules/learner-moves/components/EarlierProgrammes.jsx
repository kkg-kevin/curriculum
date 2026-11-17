import { useQuery } from "@tanstack/react-query";
import { FiAward, FiCheckCircle, FiClock, FiFileText, FiMapPin } from "react-icons/fi";
import { learnerMovesApi } from "../services/learnerMovesApi";
import { usePortalNavigate } from "../../learner-portal/utils/usePortalNavigate";
import { T, cardStyle } from "../../learner-portal/components/profile/theme";

/*
 * Earlier programmes (17 Nov 2026; server learner-move.past.js) — classes a learner has left, with
 * what they earned there: course reports, certificates, and how many session reports and pieces of
 * marked work. Under Reports on the learner's profile: their own, their parent's view of them, and
 * the staff learner page (`staffLearnerId`; rows there don't link into the portal). Nothing shows
 * when they have no earlier programmes.
 */

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "");
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function Row({ icon: Icon, title, sub, onOpen, tone = T.accent }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderRadius: 14, background: "#fff", border: `1.5px solid ${T.border}`, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: "1 1 200px" }}>
        <span aria-hidden style={{ width: 32, height: 32, borderRadius: 10, background: T.tintBg, color: tone, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={15} /></span>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: T.ink, overflowWrap: "anywhere" }}>{title}</p>
          {sub && <p style={{ margin: 0, fontSize: 11.5, color: T.inkMuted }}>{sub}</p>}
        </div>
      </div>
      {onOpen && (
        <button type="button" onClick={onOpen}
          style={{ padding: "6px 12px", background: T.tintBg, color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 10, fontSize: 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}>
          View
        </button>
      )}
    </div>
  );
}

function Programme({ p, navigate }) {
  const facts = [
    p.sessionReports ? plural(p.sessionReports, "session report", "session reports") : null,
    p.markedWork ? plural(p.markedWork, "piece of marked work", "pieces of marked work") : null,
  ].filter(Boolean);
  return (
    <section style={{ ...cardStyle(), padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: T.ink }}>{p.label || "A class"}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkMuted, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <FiMapPin size={12} aria-hidden /> {[p.hubName, p.curriculumName].filter(Boolean).join(" · ")}
          </p>
        </div>
        {(p.leftAt || p.movedTo) && (
          <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, background: T.tintBg, color: T.accent, fontSize: 11.5, fontWeight: 700 }}>
            <FiClock size={12} aria-hidden /> {p.leftAt ? `Left ${fmtDate(p.leftAt)}` : "Earlier"}{p.movedTo ? ` · now ${p.movedTo}` : ""}
          </span>
        )}
      </div>
      {p.certificates.map((c) => (
        <Row key={c.id} icon={FiAward} tone="#B87708" title={c.title} sub={`Certificate ${c.certificateNumber || ""} · ${fmtDate(c.issuedAt)}`.replace("  ", " ")}
          onOpen={navigate ? () => navigate(`/learner-portal/certificates/${c.id}`) : null} />
      ))}
      {p.courseReports.map((r) => (
        <Row key={r.id} icon={FiFileText} title={`${r.courseName} — final report`} sub={r.publishedAt ? `Published ${fmtDate(r.publishedAt)}` : null}
          onOpen={navigate ? () => navigate(`/learner-portal/reports/${r.id}`) : null} />
      ))}
      {facts.length > 0 && (
        <p style={{ margin: 0, fontSize: 12, color: T.inkMuted, display: "flex", alignItems: "center", gap: 6 }}>
          <FiCheckCircle size={13} aria-hidden /> Also kept: {facts.join(" and ")}.
        </p>
      )}
      {!p.certificates.length && !p.courseReports.length && !facts.length && (
        <p style={{ margin: 0, fontSize: 12, color: T.inkMuted }}>Nothing was marked or reported here yet.</p>
      )}
    </section>
  );
}

export default function EarlierProgrammes({ staffLearnerId, learnerId }) {
  const portalNavigate = usePortalNavigate();
  const navigate = staffLearnerId ? null : portalNavigate;
  const { data = [] } = useQuery({
    queryKey: ["learner-moves", "past", staffLearnerId || `mine:${learnerId || ""}`],
    queryFn: () => (staffLearnerId ? learnerMovesApi.past(staffLearnerId) : learnerMovesApi.myPast()),
    enabled: !!(staffLearnerId || learnerId),
    staleTime: 60 * 1000,
  });
  if (!data.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 18 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: T.ink }}>Earlier programmes</h3>
        <p style={{ margin: "3px 0 0", fontSize: 12.5, color: T.inkMuted }}>
          Classes from before. Everything earned there is kept on the record.
        </p>
      </div>
      {data.map((p) => <Programme key={p.classId} p={p} navigate={navigate} />)}
    </div>
  );
}
