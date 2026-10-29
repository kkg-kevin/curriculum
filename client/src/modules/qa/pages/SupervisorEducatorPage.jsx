import { Link, useParams } from "react-router-dom";
import { FiArrowLeft, FiMail, FiMapPin } from "react-icons/fi";
import { useQaEducators } from "../hooks/useQa";
import EducatorQaSection from "../components/EducatorQaSection";
import SchedulesTab from "../components/SchedulesTab";
import { QaStyles, ScoreBadge, T, card, font, hint } from "../shared";

// One of a supervisor's educators (/supervisor-portal/educators/:id): who they are and where they
// teach, their QA visits and reports, and their regular visits.
export default function SupervisorEducatorPage() {
  const { id } = useParams();
  const { data: educators = [], isLoading } = useQaEducators();
  const educator = educators.find((e) => e.id === id);

  if (isLoading) return <p style={{ ...hint, fontFamily: font }}>Loading…</p>;
  if (!educator) {
    return (
      <div style={{ fontFamily: font }}>
        <Link to="/supervisor-portal/educators" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: T.accentMid, textDecoration: "none" }}><FiArrowLeft size={14} /> My Educators</Link>
        <p style={{ marginTop: 14, color: "#B91C1C", fontSize: 14 }}>This educator isn&apos;t assigned to you.</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: font, display: "flex", flexDirection: "column", gap: 16, maxWidth: 1080 }}>
      <QaStyles />
      <Link to="/supervisor-portal/educators" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: T.accentMid, textDecoration: "none", alignSelf: "flex-start" }}><FiArrowLeft size={14} /> My Educators</Link>
      <section style={{ ...card, padding: "18px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        {educator.photo
          ? <img src={educator.photo} alt="" style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover" }} />
          : <div style={{ width: 60, height: 60, borderRadius: "50%", background: "linear-gradient(135deg, #25476a, #2e7db5)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 20 }}>{educator.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</div>}
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 900, color: T.ink }}>{educator.name}</h1>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 6, fontSize: 13, color: T.inkMuted }}>
            {educator.email && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FiMail size={13} />{educator.email}</span>}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FiMapPin size={13} />{educator.hubs.map((h) => h.name).join(", ") || "No hub yet"}</span>
          </div>
        </div>
        {educator.reports > 0 && (
          <div style={{ textAlign: "center" }}>
            <ScoreBadge score={educator.averageScore} size="lg" />
            <p style={{ margin: "4px 0 0", fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: T.inkMuted }}>Average · {educator.reports} {educator.reports === 1 ? "report" : "reports"}</p>
          </div>
        )}
      </section>

      <EducatorQaSection teacherId={id} />

      <div>
        <h2 style={{ margin: "4px 0 10px", fontSize: 15, fontWeight: 800, color: T.ink }}>Regular visits</h2>
        <SchedulesTab teacherId={id} />
      </div>
    </div>
  );
}
