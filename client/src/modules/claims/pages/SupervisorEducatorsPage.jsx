import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FiArrowRight, FiHome, FiMail, FiMapPin, FiSearch, FiUsers } from "react-icons/fi";
import { useSupervisorClaims } from "../hooks/useClaims";
import { T, cardStyle, formatDate, formatMoney } from "../shared";
import { Avatar } from "../components/supervisorParts";

// The educators a supervisor looks after, each with where their claims stand. Who is on this
// list is the admin's decision (the educator form's "Claims supervisor"). A supervisor can look
// after many schools: pick one to see only its educators; with all schools, educators are grouped
// under each school they work at (one at two schools shows under both).

const STATUS = {
  active: { label: "Active", bg: "#ECFDF5", color: "#047857" },
  on_leave: { label: "On leave", bg: "#FFFBEB", color: "#B45309" },
  inactive: { label: "Inactive", bg: "#F3F4F6", color: "#6B7280" },
};

function Figure({ label, value, tone }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: "9px 10px", borderRadius: 11, background: tone || "#F5F8FB", textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: 17, fontWeight: 900, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{value}</p>
      <p style={{ margin: "1px 0 0", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: T.inkMuted }}>{label}</p>
    </div>
  );
}

const NO_SCHOOL = "none";

function SchoolChip({ school }) {
  const Icon = school.isHomeLearning ? FiHome : FiMapPin;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "#F1F5F9", color: T.inkMuted, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      <Icon size={11} style={{ flexShrink: 0 }} /> {school.name}
    </span>
  );
}

export default function SupervisorEducatorsPage() {
  const { data, isLoading, isError, error } = useSupervisorClaims();
  const [search, setSearch] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const schools = useMemo(() => data?.schools || [], [data]);
  const picked = searchParams.get("school") || "all";
  const school = picked === "all" || picked === NO_SCHOOL || schools.some((s) => s.id === picked) ? picked : "all";
  const pickSchool = (id) => setSearchParams((prev) => { const next = new URLSearchParams(prev); if (id === "all") next.delete("school"); else next.set("school", id); return next; }, { replace: true });

  const claims = useMemo(() => data?.claims || [], [data]);
  const currency = claims[0]?.currency || "KES";

  // Each educator with their claims added up; those with something waiting come first.
  const educators = useMemo(() => {
    const stats = new Map();
    for (const claim of claims) {
      const entry = stats.get(claim.teacherId) || { waiting: 0, approved: 0, paid: 0, paidAmount: 0, declined: 0, last: null };
      if (claim.status === "pending_supervisor") entry.waiting += 1;
      else if (claim.status === "approved") entry.approved += 1;
      else if (claim.status === "paid") { entry.paid += 1; entry.paidAmount += claim.amount; }
      else if (claim.status === "rejected") entry.declined += 1;
      if (!entry.last || new Date(claim.createdAt) > new Date(entry.last)) entry.last = claim.createdAt;
      stats.set(claim.teacherId, entry);
    }
    const term = search.trim().toLowerCase();
    return (data?.educators || [])
      .map((educator) => ({ ...educator, ...(stats.get(educator.id) || { waiting: 0, approved: 0, paid: 0, paidAmount: 0, declined: 0, last: null }) }))
      .filter((educator) => !term || [educator.name, educator.email].some((text) => text?.toLowerCase().includes(term)))
      .filter((educator) => school === "all" || (school === NO_SCHOOL ? !educator.schools?.length : educator.schools?.some((s) => s.id === school)))
      .sort((a, b) => b.waiting - a.waiting || a.name.localeCompare(b.name));
  }, [data, claims, search, school]);

  // All schools: one section per school, its educators under it.
  const groups = useMemo(() => {
    if (school !== "all" || schools.length < 2) return null;
    const list = schools.map((s) => ({ ...s, members: educators.filter((e) => e.schools?.some((x) => x.id === s.id)) })).filter((g) => g.members.length);
    const without = educators.filter((e) => !e.schools?.length);
    if (without.length) list.push({ id: NO_SCHOOL, name: "No school yet", members: without });
    return list;
  }, [school, schools, educators]);
  const unplacedCount = useMemo(() => (data?.educators || []).filter((e) => !e.schools?.length).length, [data]);

  if (isLoading) return <p style={{ fontFamily: "Inter, sans-serif", color: T.inkMuted, fontSize: 14, padding: "60px 0", textAlign: "center" }}>Loading your educators…</p>;
  if (isError) {
    return (
      <div style={{ ...cardStyle, fontFamily: "Inter, sans-serif", padding: "40px 24px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#B91C1C" }}>Your educators couldn't be loaded</p>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: T.inkMuted }}>{error?.message}</p>
      </div>
    );
  }

  const total = data?.educators?.length || 0;

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: T.ink, letterSpacing: "-0.5px" }}>My Educators</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13.5, color: T.inkMuted }}>The {total === 1 ? "educator" : `${total} educators`} whose claims come to you. The admin decides who is on this list.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flex: "0 1 560px", justifyContent: "flex-end" }}>
          {schools.length > 1 && (
            <select value={school} onChange={(e) => pickSchool(e.target.value)} aria-label="School" style={{ flex: "0 1 260px", minWidth: 0, padding: "10px 12px", borderRadius: 11, border: `1.5px solid ${school !== "all" ? T.accent : T.border}`, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", color: T.ink, background: "#fff", cursor: "pointer" }}>
              <option value="all">All schools ({schools.length})</option>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.educators})</option>)}
              {unplacedCount > 0 && <option value={NO_SCHOOL}>No school yet ({unplacedCount})</option>}
            </select>
          )}
          {total > 3 && (
            <div style={{ position: "relative", flex: "0 1 280px" }}>
              <FiSearch size={15} color={T.inkFaint} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" aria-label="Search educators" style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 34px", borderRadius: 11, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff" }} />
            </div>
          )}
        </div>
      </div>

      {total === 0 ? (
        <div style={{ ...cardStyle, padding: "56px 24px", textAlign: "center" }}>
          <div style={{ width: 60, height: 60, margin: "0 auto 14px", borderRadius: 18, background: T.tintBg, color: T.accent, display: "grid", placeItems: "center" }}><FiUsers size={26} /></div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.ink }}>No educators are assigned to you yet</p>
          <p style={{ margin: "6px auto 0", maxWidth: 420, fontSize: 13, color: T.inkMuted, lineHeight: 1.6 }}>The admin assigns educators to a supervisor. Once they do, the educators show here and their claims come to you.</p>
        </div>
      ) : educators.length === 0 ? (
        <div style={{ ...cardStyle, padding: "40px 24px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.ink }}>{search.trim() ? `No educator matches "${search}"` : "No educators at this school"}</p>
        </div>
      ) : groups ? (
        groups.map((group) => (
          <section key={group.id} aria-label={group.name} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.ink }}>{group.name}</h2>
              <span style={{ fontSize: 12.5, color: T.inkMuted }}>
                {group.members.length} {group.members.length === 1 ? "educator" : "educators"}
                {group.members.some((e) => e.waiting) ? ` · ${group.members.reduce((n, e) => n + e.waiting, 0)} to review` : ""}
              </span>
              {group.id !== NO_SCHOOL && (
                <button type="button" onClick={() => pickSchool(group.id)} style={{ marginLeft: "auto", padding: 0, border: "none", background: "none", color: T.accentMid, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                  Only this school
                </button>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
              {group.members.map((educator) => renderCard(educator, group.id === NO_SCHOOL ? null : group.id))}
            </div>
          </section>
        ))
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {educators.map((educator) => renderCard(educator, school === "all" || school === NO_SCHOOL ? null : school))}
        </div>
      )}
    </div>
  );

  // One educator: who they are, the schools they work at, where their claims stand, and the way
  // to those claims — kept to `schoolId` when the page is narrowed to one school.
  function renderCard(educator, schoolId) {
            const status = STATUS[educator.status] || STATUS.active;
            return (
              <div key={educator.id} style={{ ...cardStyle, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar name={educator.name} photo={educator.photo} size={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{educator.name}</p>
                    <p style={{ margin: "2px 0 0", display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: T.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><FiMail size={11} style={{ flexShrink: 0 }} /> {educator.email || "No email"}</p>
                  </div>
                  <span style={{ padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: status.bg, color: status.color, whiteSpace: "nowrap" }}>{status.label}</span>
                </div>

                {educator.schools?.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: -4 }}>
                    {educator.schools.map((s) => <SchoolChip key={s.id} school={s} />)}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <Figure label="To review" value={educator.waiting} tone={educator.waiting ? "#FFF4DC" : undefined} />
                  <Figure label="To be paid" value={educator.approved} />
                  <Figure label="Paid" value={educator.paid} />
                  <Figure label="Declined" value={educator.declined} />
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: T.inkMuted }}>
                    {educator.last ? <>Paid so far <strong style={{ color: T.ink }}>{formatMoney(educator.paidAmount, currency)}</strong> · last claim {formatDate(educator.last)}</> : "No claims yet"}
                  </span>
                  <Link to={`/supervisor-portal/claims?educator=${educator.id}${schoolId ? `&school=${schoolId}` : ""}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 10, fontSize: 13, fontWeight: 800, textDecoration: "none", background: educator.waiting ? T.accent : "#F1F5F9", color: educator.waiting ? "#fff" : T.accent }}>
                    {educator.waiting ? "Review claims" : "View claims"} <FiArrowRight size={14} />
                  </Link>
                </div>
              </div>
            );
  }
}
