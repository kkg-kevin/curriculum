import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiInbox, FiPlus, FiSearch, FiShield, FiUsers } from "react-icons/fi";
import { useSupervisors } from "../../claims/hooks/useClaims";
import { usePermissions } from "../../../hooks/usePermissions";
import { T, cardStyle, formatDate } from "../../claims/shared";
import { Avatar } from "../../claims/components/supervisorParts";

/*
 * People → Supervisors (17 Nov 2026): the workspace's supervisors — accounts that look after a
 * group of educators (their claims, QA visits, training work, parent feedback and check-ins, in
 * their own portal). Each opens on its own page; "Add supervisor" is a page of its own too.
 * Creating and changing them is Claim approvals → Edit (and the owner); anyone who can view
 * Educators can look.
 */
const ROLE_LABEL = { teacher: "Educator", collaborator: "Staff", school: "Learning hub", learner: "Parent", affiliate: "Affiliate" };

export default function SupervisorsPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canManage = can("claims-approval", "edit");
  const { data: supervisors = [], isLoading, isError } = useSupervisors();
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const shown = supervisors.filter((s) => !q || `${s.name} ${s.email} ${s.jobTitle || ""}`.toLowerCase().includes(q));
  const educators = supervisors.reduce((n, s) => n + (s.educators || 0), 0);
  const waiting = supervisors.reduce((n, s) => n + (s.claimsWaiting || 0), 0);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 18 }}>
      <section style={{ borderRadius: 20, padding: "24px 28px", background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 45%, ${T.accentMid} 80%, ${T.accentLight} 100%)`, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", gap: 10 }}><FiShield size={22} /> Supervisors</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "rgba(255,255,255,0.82)", maxWidth: 680, lineHeight: 1.5 }}>
            People who look after a group of educators — they approve their claims, do their QA visits, mark their training work and follow their parent feedback and check-ins, in their own portal.
          </p>
        </div>
        {canManage && (
          <button type="button" onClick={() => navigate("/supervisors/new")} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 18px", borderRadius: 12, border: "none", background: T.gold, color: "#17304B", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
            <FiPlus size={16} /> Add supervisor
          </button>
        )}
      </section>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {[[FiShield, supervisors.length, "Supervisors"], [FiUsers, educators, "Educators supervised"], [FiInbox, waiting, "Claims waiting on them"]].map(([Icon, value, label]) => (
          <div key={label} style={{ ...cardStyle, flex: "1 1 180px", padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
            <span aria-hidden style={{ width: 38, height: 38, borderRadius: 11, background: T.tintBg, color: T.accent, display: "grid", placeItems: "center" }}><Icon size={18} /></span>
            <div><p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: T.ink }}>{value}</p><p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: T.inkMuted }}>{label}</p></div>
          </div>
        ))}
      </div>

      <section style={{ ...cardStyle, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
          <label style={{ position: "relative", display: "block", maxWidth: 360 }}>
            <FiSearch size={14} aria-hidden style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.inkFaint }} />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search supervisors…" aria-label="Search supervisors"
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px 9px 30px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13.5, fontFamily: "inherit" }} />
          </label>
        </div>
        {isLoading && <p style={{ margin: 0, padding: 18, fontSize: 13, color: T.inkMuted }}>Loading…</p>}
        {isError && <p style={{ margin: 0, padding: 18, fontSize: 13, color: "#B91C1C" }}>The supervisors couldn&apos;t be loaded.</p>}
        {!isLoading && !isError && shown.length === 0 && (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.ink }}>{supervisors.length ? "No supervisor matches" : "No supervisors yet"}</p>
            <p style={{ margin: "6px auto 0", maxWidth: 440, fontSize: 13, color: T.inkMuted, lineHeight: 1.6 }}>
              {supervisors.length ? "Try another search." : "Add a supervisor and choose the educators they'll look after. Their claims then go to them first."}
            </p>
          </div>
        )}
        {shown.map((s) => (
          <Link key={s.id} to={`/supervisors/${s.id}`} style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "14px 18px", borderTop: "1px solid #F3F4F6", textDecoration: "none", color: "inherit" }}>
            <Avatar name={s.name} photo={s.photo} size={42} />
            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: T.ink }}>
                {s.name}
                {(s.otherRoles || []).map((r) => <span key={r} style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 999, background: T.tintBg, color: T.accent, fontSize: 11, fontWeight: 800 }}>Also {ROLE_LABEL[r] || r}</span>)}
                {s.deactivated && <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 999, background: "#F3F4F6", color: "#6B7280", fontSize: 11, fontWeight: 800 }}>Deactivated</span>}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {[s.jobTitle, s.email, s.phone].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12.5, color: T.inkMuted }}>
              <span><strong style={{ color: T.ink, fontSize: 14 }}>{s.educators}</strong> educator{s.educators === 1 ? "" : "s"}</span>
              <span style={{ color: s.claimsWaiting ? "#B45309" : T.inkMuted }}><strong style={{ fontSize: 14 }}>{s.claimsWaiting || 0}</strong> claim{s.claimsWaiting === 1 ? "" : "s"} waiting</span>
              <span>{s.lastSignInAt ? `Signed in ${formatDate(s.lastSignInAt)}` : "Not signed in yet"}</span>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
