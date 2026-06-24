import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAllSchoolsQuery } from "../../schools/hooks/useSchool";
import { useAllTeachersQuery } from "../hooks/useTeacher";

const ACCENT = "#0D47A1";

const STATUS_STYLES = {
  active:   { bg: "#EFF6FF", color: "#1E3A8A", border: "#BFDBFE", label: "Active"   },
  inactive: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", label: "Inactive" },
  on_leave: { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A", label: "On Leave" },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.inactive;
  return (
    <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function TeacherInitials({ firstName, lastName, size = 34 }) {
  const text = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg, #0D47A1, #1565C0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
      {text || "?"}
    </div>
  );
}

function SchoolAvatar({ name, size = 42 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 12, background: "linear-gradient(135deg, #0D47A1, #1565C0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
      {name?.[0]?.toUpperCase() || "S"}
    </div>
  );
}

function TeacherRow({ teacher, navigate }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", backgroundColor: hovered ? "#EFF6FF" : "transparent", transition: "background-color 0.12s", borderBottom: "1px solid #F9FAFB" }}
    >
      <TeacherInitials firstName={teacher.firstName} lastName={teacher.lastName} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {teacher.firstName} {teacher.lastName}
        </p>
        <p style={{ margin: "1px 0 0", fontSize: 11, color: "#9CA3AF" }}>
          {teacher.employeeId || "No ID"}{teacher.email ? ` · ${teacher.email}` : ""}
        </p>
      </div>
      <StatusBadge status={teacher.status} />
      <button
        type="button"
        onClick={() => navigate(`/teachers/${teacher.id}/view`)}
        style={{ padding: "5px 12px", backgroundColor: "#EFF6FF", color: ACCENT, border: "1px solid #BFDBFE", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
      >
        View →
      </button>
    </div>
  );
}

function SchoolAccordion({ school, teachers, navigate, isOpen, onToggle }) {
  const count       = teachers.length;
  const activeCount = teachers.filter((t) => t.status === "active").length;

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 16, border: `1.5px solid ${isOpen ? "#BFDBFE" : "#E5E7EB"}`, overflow: "hidden", boxShadow: isOpen ? "0 2px 12px rgba(13,71,161,0.07)" : "0 1px 4px rgba(0,0,0,0.04)", transition: "border-color 0.2s, box-shadow 0.2s" }}>

      {/* Accordion header */}
      <div
        onClick={onToggle}
        style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", cursor: "pointer", backgroundColor: isOpen ? "#EFF6FF" : "#fff", transition: "background-color 0.15s", userSelect: "none" }}
      >
        <SchoolAvatar name={school.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {school.name}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9CA3AF" }}>
            {school.address?.county ? `${school.address.county} County` : "No location set"}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, backgroundColor: count > 0 ? "#EFF6FF" : "#F9FAFB", color: count > 0 ? ACCENT : "#9CA3AF", border: `1px solid ${count > 0 ? "#BFDBFE" : "#E5E7EB"}` }}>
            {count} {count === 1 ? "teacher" : "teachers"}
          </span>
          {count > 0 && (
            <span style={{ fontSize: 11, color: "#9CA3AF", whiteSpace: "nowrap" }}>{activeCount} active</span>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate(`/teachers/create?schoolId=${school.id}`); }}
            style={{ padding: "6px 14px", backgroundColor: ACCENT, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            + Add
          </button>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ color: "#9CA3AF", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Accordion body */}
      {isOpen && (
        <div style={{ borderTop: "1px solid #F3F4F6" }}>
          {teachers.length === 0 ? (
            <div style={{ padding: "36px 24px", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #EFF6FF, #BFDBFE)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 12px" }}>👩‍🏫</div>
              <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "#374151" }}>No teachers added yet</p>
              <p style={{ margin: "0 0 16px", fontSize: 12, color: "#9CA3AF" }}>Add the first teacher for {school.name}</p>
              <button
                type="button"
                onClick={() => navigate(`/teachers/create?schoolId=${school.id}`)}
                style={{ padding: "8px 18px", backgroundColor: ACCENT, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
              >
                + Add Teacher
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", padding: "7px 18px", backgroundColor: "#FAFAFA", borderBottom: "1px solid #F3F4F6", gap: 12 }}>
                <div style={{ width: 34, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>Teacher</span>
                <span style={{ width: 90, fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Status</span>
                <span style={{ width: 70 }} />
              </div>
              {teachers.map((t) => (
                <TeacherRow key={t.id} teacher={t} navigate={navigate} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB", padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: "#F3F4F6", flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
        <div style={{ height: 14, width: "35%", backgroundColor: "#F3F4F6", borderRadius: 6 }} />
        <div style={{ height: 11, width: "22%", backgroundColor: "#F9FAFB", borderRadius: 5 }} />
      </div>
      <div style={{ width: 80, height: 24, backgroundColor: "#F9FAFB", borderRadius: 20 }} />
    </div>
  );
}

export default function TeachersPage() {
  const navigate = useNavigate();
  const { data: schoolsData,  isLoading: schoolsLoading  } = useAllSchoolsQuery();
  const { data: teachersData, isLoading: teachersLoading } = useAllTeachersQuery();
  const [openIds, setOpenIds] = useState(new Set());

  const schools  = schoolsData?.data  || [];
  const teachers = teachersData?.data || [];

  const teachersBySchool = useMemo(() => {
    const map = {};
    for (const t of teachers) {
      if (!map[t.schoolId]) map[t.schoolId] = [];
      map[t.schoolId].push(t);
    }
    return map;
  }, [teachers]);

  const toggle = (id) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const isLoading = schoolsLoading || teachersLoading;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Hero strip */}
      <div style={{ background: "linear-gradient(135deg, #0D2E6E 0%, #0D47A1 40%, #1565C0 75%, #1976D2 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "16px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20px", right: "120px", width: "100px", height: "100px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", position: "relative" }}>
          <div>
            <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
              Teachers
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.5", maxWidth: "480px" }}>
              Add and manage teachers across your schools. Assign teachers to classes and track their status.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/teachers/create")}
            style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "11px 22px", backgroundColor: "#ffffff", color: "#0D47A1", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", whiteSpace: "nowrap" }}
          >
            <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
            Add Teacher
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map((n) => <SkeletonRow key={n} />)}
        </div>
      ) : schools.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 6 }}>No schools found</p>
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>Add a school first, then assign teachers to it.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {schools.map((school) => (
            <SchoolAccordion
              key={school.id}
              school={school}
              teachers={teachersBySchool[school.id] || []}
              navigate={navigate}
              isOpen={openIds.has(school.id)}
              onToggle={() => toggle(school.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
