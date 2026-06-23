import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAllSchoolsQuery } from "../../schools/hooks/useSchool";
import { useAllLearnersQuery } from "../hooks/useLearners";
import { useAllClassesQuery } from "../../classes/hooks/useClasses";

const ACCENT = "#BE185D";

const STATUS_STYLES = {
  active:      { bg: "#FDF2F8", color: "#831843", border: "#FBCFE8", label: "Active"      },
  inactive:    { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", label: "Inactive"    },
  transferred: { bg: "#EFF6FF", color: "#1E40AF", border: "#BFDBFE", label: "Transferred" },
  graduated:   { bg: "#F0FDF4", color: "#065F46", border: "#BBF7D0", label: "Graduated"   },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.inactive;
  return (
    <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function LearnerInitials({ firstName, lastName, size = 34 }) {
  const text = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg, #831843, #BE185D)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
      {text || "?"}
    </div>
  );
}

function SchoolAvatar({ name, size = 42 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 12, background: "linear-gradient(135deg, #831843, #BE185D)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
      {name?.[0]?.toUpperCase() || "S"}
    </div>
  );
}

function LearnerRow({ learner, classMap, navigate }) {
  const [hovered, setHovered] = useState(false);
  const gradeName = classMap[learner.classId]?.gradeName || "—";
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", backgroundColor: hovered ? "#FFF8FB" : "transparent", transition: "background-color 0.12s", borderBottom: "1px solid #F9FAFB" }}
    >
      <LearnerInitials firstName={learner.firstName} lastName={learner.lastName} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {learner.firstName} {learner.lastName}
        </p>
        <p style={{ margin: "1px 0 0", fontSize: 11, color: "#9CA3AF" }}>
          {learner.admissionNumber || "No ID"} · {gradeName}
        </p>
      </div>
      <StatusBadge status={learner.status} />
      <button
        type="button"
        onClick={() => navigate(`/learners/${learner.id}/view`)}
        style={{ padding: "5px 12px", backgroundColor: "#FDF2F8", color: ACCENT, border: "1px solid #FBCFE8", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
      >
        View →
      </button>
    </div>
  );
}

function SchoolAccordion({ school, learners, classMap, navigate, isOpen, onToggle }) {
  const count       = learners.length;
  const activeCount = learners.filter((l) => l.status === "active").length;

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 16, border: `1.5px solid ${isOpen ? "#FBCFE8" : "#E5E7EB"}`, overflow: "hidden", boxShadow: isOpen ? "0 2px 12px rgba(190,24,93,0.07)" : "0 1px 4px rgba(0,0,0,0.04)", transition: "border-color 0.2s, box-shadow 0.2s" }}>

      {/* Accordion header */}
      <div
        onClick={onToggle}
        style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", cursor: "pointer", backgroundColor: isOpen ? "#FFF8FB" : "#fff", transition: "background-color 0.15s", userSelect: "none" }}
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
          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, backgroundColor: count > 0 ? "#FDF2F8" : "#F9FAFB", color: count > 0 ? ACCENT : "#9CA3AF", border: `1px solid ${count > 0 ? "#FBCFE8" : "#E5E7EB"}` }}>
            {count} {count === 1 ? "learner" : "learners"}
          </span>
          {count > 0 && (
            <span style={{ fontSize: 11, color: "#9CA3AF", whiteSpace: "nowrap" }}>{activeCount} active</span>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate(`/learners/create?schoolId=${school.id}`); }}
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
          {learners.length === 0 ? (
            <div style={{ padding: "36px 24px", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #FDF2F8, #FBCFE8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 12px" }}>🎓</div>
              <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "#374151" }}>No learners enrolled yet</p>
              <p style={{ margin: "0 0 16px", fontSize: 12, color: "#9CA3AF" }}>Enrol the first learner for {school.name}</p>
              <button
                type="button"
                onClick={() => navigate(`/learners/create?schoolId=${school.id}`)}
                style={{ padding: "8px 18px", backgroundColor: ACCENT, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
              >
                + Enrol Learner
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", padding: "7px 18px", backgroundColor: "#FAFAFA", borderBottom: "1px solid #F3F4F6", gap: 12 }}>
                <div style={{ width: 34, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>Learner</span>
                <span style={{ width: 90, fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Status</span>
                <span style={{ width: 70 }} />
              </div>
              {learners.map((l) => (
                <LearnerRow key={l.id} learner={l} classMap={classMap} navigate={navigate} />
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

export default function LearnersPage() {
  const navigate = useNavigate();
  const { data: schoolsData,  isLoading: schoolsLoading  } = useAllSchoolsQuery();
  const { data: learnersData, isLoading: learnersLoading } = useAllLearnersQuery();
  const { data: classesData }                              = useAllClassesQuery();
  const [openIds, setOpenIds] = useState(new Set());

  const schools  = schoolsData?.data  || [];
  const learners = learnersData?.data || [];
  const classes  = classesData?.data  || [];

  const classMap = useMemo(
    () => Object.fromEntries(classes.map((c) => [c.id, c])),
    [classes]
  );

  const learnersBySchool = useMemo(() => {
    const map = {};
    for (const l of learners) {
      if (!map[l.schoolId]) map[l.schoolId] = [];
      map[l.schoolId].push(l);
    }
    return map;
  }, [learners]);

  const toggle = (id) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const isLoading = schoolsLoading || learnersLoading;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" }}>Learners</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
            {isLoading ? "Loading…" : `${learners.length} learner${learners.length !== 1 ? "s" : ""} across ${schools.length} school${schools.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/learners/create")}
          style={{ padding: "10px 20px", backgroundColor: ACCENT, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", boxShadow: "0 2px 8px rgba(190,24,93,0.25)" }}
        >
          + Enrol Learner
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map((n) => <SkeletonRow key={n} />)}
        </div>
      ) : schools.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 6 }}>No schools found</p>
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>Add a school first, then enrol learners under it.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {schools.map((school) => (
            <SchoolAccordion
              key={school.id}
              school={school}
              learners={learnersBySchool[school.id] || []}
              classMap={classMap}
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
