import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiAward, FiBookOpen, FiEdit3, FiSearch, FiUser } from "react-icons/fi";
import Avatar from "../../../components/ui/Avatar";
import { useTotLearners } from "../hooks/useTot";

// Learners → TOT learners: the workspace's educators in training, as learners — each opens on the
// learner page, the same profile admins see for any learner (their training's courses, assessments,
// reports and certificates). Their educator record is one click away. They sign in to their
// training as "TOT learner" (a sign-in of its own, apart from the teacher portal).

const T = { ink: "#111827", muted: "#6B7280", faint: "#9CA3AF", border: "#E5E7EB", accent: "#25476a", mid: "#2e7db5", tint: "#e8f5fb", tintBorder: "#a8d5ee" };

const pill = (bg, color, border) => ({ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: bg, color, border: `1px solid ${border}`, whiteSpace: "nowrap" });

function StatusPills({ row }) {
  const educatorStatus = row.educator?.status;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
      {educatorStatus === "in_training" && <span style={pill("#dff2fb", "#1f6f99", "#a8d5ee")}>In training</span>}
      {educatorStatus === "active" && <span style={pill("#ECFDF5", "#047857", "#A7F3D0")}>Also teaching</span>}
      {educatorStatus === "inactive" && <span style={pill("#F3F4F6", "#6B7280", "#E5E7EB")}>Educator inactive</span>}
      {row.accountStatus === "pending_payment" && <span style={pill("#FFFBEB", "#B45309", "#FDE68A")}>Awaiting payment</span>}
      {row.accountStatus === "inactive" && <span style={pill("#FEF2F2", "#B91C1C", "#FECACA")}>Learner inactive</span>}
    </span>
  );
}

export default function TotLearnersPanel() {
  const navigate = useNavigate();
  const { data: rows = [], isLoading, isError } = useTotLearners();
  const [search, setSearch] = useState("");

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => [r.firstName, r.lastName, r.educator?.email, r.educator?.phone, r.educator?.supervisorName, ...r.classes.flatMap((c) => [c.curriculumName, c.className, c.hubName])]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(term)));
  }, [rows, search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: "Inter, sans-serif" }}>
      <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: "12px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 240px", minWidth: 0, padding: "7px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: "#F9FAFB" }}>
          <FiSearch size={14} color={T.faint} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, class, hub or supervisor…"
            aria-label="Search TOT learners"
            style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#374151", width: "100%", minWidth: 0 }}
          />
        </label>
        <span style={{ marginLeft: "auto", fontSize: 13, color: T.faint }}>
          {isLoading ? "Loading…" : `${shown.length} TOT learner${shown.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {isError ? (
        <div style={{ padding: "40px 20px", textAlign: "center", background: "#fff", borderRadius: 16, color: "#B91C1C", fontSize: 13.5 }}>Couldn&apos;t load the TOT learners. Please try again.</div>
      ) : isLoading ? null : shown.length === 0 ? (
        <div style={{ textAlign: "center", padding: "56px 20px", background: "#fff", borderRadius: 16, border: `1.5px solid ${T.border}` }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: T.tint, display: "grid", placeItems: "center", margin: "0 auto 14px", color: T.accent }}><FiBookOpen size={24} /></div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#374151" }}>{search ? "No TOT learners match this search" : "No TOT learners yet"}</p>
          <p style={{ margin: "6px auto 0", fontSize: 13, color: T.faint, maxWidth: 440, lineHeight: 1.6 }}>
            {search ? "Try a different name." : "Educators show here once they're in training — enrolled from their educator page (Training (TOT)) or signed up for a TOT bootcamp on the website."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))", gap: 14 }}>
          {shown.map((row) => (
            <div
              key={row.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/learners/${row.id}`)}
              onKeyDown={(e) => { if (e.key === "Enter") navigate(`/learners/${row.id}`); }}
              style={{ background: "#fff", borderRadius: 16, border: `1.5px solid ${T.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12, cursor: "pointer", minWidth: 0 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <Avatar firstName={row.firstName} lastName={row.lastName} photo={row.photo} size={44} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.ink, overflowWrap: "anywhere" }}>{[row.firstName, row.lastName].filter(Boolean).join(" ")}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: T.muted, overflowWrap: "anywhere" }}>{row.educator?.email || row.educator?.phone || "—"}</p>
                </div>
              </div>

              <StatusPills row={row} />

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {row.classes.length === 0 ? (
                  <span style={{ fontSize: 12, color: T.faint }}>Not in a TOT class</span>
                ) : row.classes.map((c) => (
                  <span key={c.classId} style={pill(c.status === "active" ? T.tint : "#F3F4F6", c.status === "active" ? T.accent : T.muted, c.status === "active" ? T.tintBorder : T.border)}>
                    {c.curriculumName} · {c.className} — {c.hubName}{c.status === "active" ? "" : " · withdrawn"}
                  </span>
                ))}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 12.5, color: T.muted }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FiUser size={13} /> {row.educator?.supervisorName ? `Supervisor: ${row.educator.supervisorName}` : "No supervisor yet"}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FiAward size={13} color="#16A34A" /> {row.certificates} certificate{row.certificates === 1 ? "" : "s"}</span>
                {row.toMark > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#B45309", fontWeight: 700 }}><FiEdit3 size={13} /> {row.toMark} to mark</span>}
              </div>

              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", borderTop: "1px solid #F3F4F6", paddingTop: 10 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: T.mid }}>Learner profile →</span>
                {row.educator && (
                  <Link to={`/teachers/${row.educator.id}/view`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 12.5, fontWeight: 700, color: T.accent, textDecoration: "none" }}>
                    Educator page →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
