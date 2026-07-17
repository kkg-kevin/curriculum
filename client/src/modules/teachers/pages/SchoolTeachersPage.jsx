import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { teacherCreatePath, teacherPath, classPath } from "../../../routes/portalPaths";
import { useSchoolQuery } from "../../schools/hooks/useSchool";
import { teacherApi } from "../services/teacherApi";
import { classApi } from "../../classes/services/classApi";

const ACCENT_DEEP = "#1a3550";
const ACCENT_MID  = "#2e7db5";
const ACCENT_LIGHT = "#38aae1";
const ACCENT = "#25476a";
const GRAD_FROM = "#1a3550";
const GRAD_TO   = "#38aae1";
const BORDER = "#E5E7EB";
const TINT_BG = "#e8f5fb";
const TINT_BORDER = "#a8d5ee";

const selectStyle = { padding: "8px 32px 8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", backgroundColor: "#F9FAFB", color: "#374151", outline: "none", cursor: "pointer", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" };

const STATUS_STYLES = {
  active:   { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee", label: "Active"   },
  inactive: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", label: "Inactive" },
  on_leave: { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A", label: "On Leave" },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.inactive;
  return (
    <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

function ChevronDown({ open }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function TeacherRow({ teacher, role }) {
  const navigate = useNavigate();
  const initials = `${teacher.firstName?.[0] ?? ""}${teacher.lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <div
      onClick={() => navigate(teacherPath(role, teacher.id, "view"))}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, cursor: "pointer", transition: "background-color 0.12s" }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
    >
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg, ${ACCENT_DEEP}, ${ACCENT_MID})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
        {initials || "?"}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{teacher.firstName} {teacher.lastName}</p>
        <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF" }}>{teacher.employeeId || "No ID"}</p>
      </div>
      <StatusBadge status={teacher.status} />
    </div>
  );
}

function ClassCard({ cls, teachers, role }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const count = teachers.length;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: "#fff", borderRadius: 16, overflow: "hidden",
        boxShadow: hovered ? "0 8px 24px rgba(37,71,106,0.12), 0 2px 6px rgba(0,0,0,0.05)" : "0 1px 4px rgba(0,0,0,0.06)",
        transition: "box-shadow 0.2s",
      }}
    >
      <div style={{ height: 4, background: `linear-gradient(90deg, ${ACCENT_DEEP}, ${ACCENT_MID}, ${ACCENT_LIGHT})` }} />
      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${ACCENT_DEEP}, ${ACCENT_MID})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
              {cls.gradeName?.[0]?.toUpperCase() || "G"}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>{cls.gradeName}</h3>
              <p style={{ margin: "1px 0 0", fontSize: 12, color: "#9CA3AF" }}>{cls.academicYear}</p>
            </div>
          </div>
          <span style={{ padding: "4px 11px", borderRadius: 20, fontSize: 12, fontWeight: 700, backgroundColor: count ? TINT_BG : "#F9FAFB", color: count ? ACCENT : "#9CA3AF", border: `1px solid ${count ? TINT_BORDER : BORDER}`, whiteSpace: "nowrap" }}>
            {count} class teacher{count !== 1 ? "s" : ""}
          </span>
        </div>

        {count === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${BORDER}`, backgroundColor: "#F9FAFB" }}>
            <span style={{ fontSize: 13, color: "#9CA3AF", fontStyle: "italic" }}>No class teacher assigned</span>
            <button
              type="button"
              onClick={() => navigate(classPath(role, cls.id, "edit"))}
              style={{ background: "none", border: "none", padding: 0, color: ACCENT, fontWeight: 700, fontSize: 12.5, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              Assign →
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${expanded ? TINT_BORDER : BORDER}`,
                backgroundColor: expanded ? TINT_BG : "#F9FAFB", color: ACCENT,
                fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer",
              }}
            >
              <span>Class Teacher{count !== 1 ? "s" : ""}</span>
              <ChevronDown open={expanded} />
            </button>
            {expanded && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: -4 }}>
                {teachers.map((t) => <TeacherRow key={t.id} teacher={t} role={role} />)}
                <button
                  type="button"
                  onClick={() => navigate(classPath(role, cls.id, "view"))}
                  style={{ marginTop: 4, background: "none", border: "none", padding: "4px 10px", color: "#6B7280", fontSize: 11.5, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", textAlign: "left" }}
                >
                  View class details →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SchoolTeachersPage() {
  const { schoolId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const backPath  = user?.role === "school" ? "/school-portal" : "/teachers";
  const backLabel = user?.role === "school" ? "Dashboard" : "Teachers";
  const [statusFilter, setStatusFilter] = useState("");

  const { data: school, isLoading: schoolLoading } = useSchoolQuery(schoolId);

  const { data: teachersData, isLoading: teachersLoading } = useQuery({
    queryKey: ["teachers", "bySchool", schoolId, statusFilter],
    queryFn: () => teacherApi.getAll({ schoolId, ...(statusFilter ? { status: statusFilter } : {}) }),
    enabled: !!schoolId,
  });

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["classes", "bySchool", schoolId],
    queryFn: () => classApi.getAll({ schoolId }),
    enabled: !!schoolId,
  });

  const teachers = teachersData?.data || [];
  const classes  = classesData?.data  || [];
  const teacherMap = useMemo(() => Object.fromEntries(teachers.map((t) => [t.id, t])), [teachers]);
  const activeCount = teachers.filter((t) => t.status === "active").length;

  const { teachersByClassId, notAssigned } = useMemo(() => {
    const byClass = new Map();
    const assignedIds = new Set();
    for (const cls of classes) {
      const t = cls.classTeacherId ? teacherMap[cls.classTeacherId] : null;
      if (t) {
        assignedIds.add(t.id);
        byClass.set(cls.id, [t]);
      } else {
        byClass.set(cls.id, []);
      }
    }
    const notAssigned = teachers.filter((t) => !assignedIds.has(t.id));
    return { teachersByClassId: byClass, notAssigned };
  }, [classes, teachers, teacherMap]);

  if (schoolLoading) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#6B7280" }}>Loading…</div>;
  }

  const isLoading = teachersLoading || classesLoading;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button type="button" onClick={() => navigate(backPath)}
          style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          ← {backLabel}
        </button>
        <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: "#111827", fontWeight: 600 }}>{school?.name || "School"}</span>
      </div>

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${GRAD_FROM} 0%, #25476a 40%, #2e7db5 75%, ${GRAD_TO} 100%)`, borderRadius: 20, padding: "28px 32px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#ffffff", flexShrink: 0 }}>
              {school?.name?.[0]?.toUpperCase() || "S"}
            </div>
            <div>
              <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.4px" }}>{school?.name}</h1>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
                {school?.address?.county ? `${school.address.county} County · ` : ""}Teachers by Class
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(teacherCreatePath(user?.role, schoolId))}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 22px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(254,177,57,0.35)", whiteSpace: "nowrap" }}
          >
            + Add Teacher
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Total Teachers", value: teachersLoading ? "—" : teachers.length,               icon: "👩‍🏫", bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
          { label: "Active",         value: teachersLoading ? "—" : activeCount,                    icon: "✅", bg: "#e8f5fb", color: "#38aae1", border: "#a8d5ee" },
          { label: "Inactive",       value: teachersLoading ? "—" : teachers.length - activeCount,   icon: "⏸️", bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
        ].map((stat) => (
          <div key={stat.label} style={{ backgroundColor: "#ffffff", borderRadius: 14, border: `1.5px solid ${stat.border}`, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, backgroundColor: stat.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{stat.icon}</div>
            <div>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</p>
              <p style={{ margin: "3px 0 0", fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: "12px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="on_leave">On Leave</option>
          <option value="inactive">Inactive</option>
        </select>
        {statusFilter && (
          <button type="button" onClick={() => setStatusFilter("")}
            style={{ padding: "7px 14px", backgroundColor: "transparent", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            ✕ Clear
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#9CA3AF" }}>
          {teachersLoading ? "Loading…" : `${teachers.length} teacher${teachers.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {isLoading ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Loading…</div>
      ) : classes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 24px", backgroundColor: "#ffffff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "linear-gradient(135deg, #FFF7ED, #FFEDD5)", border: "2px solid #FED7AA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 20px" }}>📚</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#111827" }}>No classes set up yet</h3>
          <p style={{ margin: 0, fontSize: 14, color: "#6B7280", lineHeight: 1.6 }}>Set up classes first, then assign teachers to them.</p>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {classes.map((cls) => (
              <ClassCard key={cls.id} cls={cls} teachers={teachersByClassId.get(cls.id) || []} role={user?.role} />
            ))}
          </div>

          {notAssigned.length > 0 && (
            <div style={{ marginTop: 20, backgroundColor: "#fff", border: `1.5px solid ${BORDER}`, borderRadius: 16, padding: "18px 20px" }}>
              <p style={{ margin: "0 0 12px", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: ACCENT_LIGHT }}>
                Not a Class Teacher ({notAssigned.length})
              </p>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "#9CA3AF" }}>
                Staff who aren't currently a homeroom class teacher for any class — this is normal for subject-only teachers.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 4 }}>
                {notAssigned.map((t) => <TeacherRow key={t.id} teacher={t} role={user?.role} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
