import { useNavigate } from "react-router-dom";
import { useCurriculaQuery } from "../../curriculum/hooks/useCurriculum";
import { useAllSchoolsQuery } from "../../schools/hooks/useSchool";
import { useAllLearnersQuery } from "../../learners/hooks/useLearners";
import { useAllTeachersQuery } from "../../teachers/hooks/useTeacher";

/* ── Helpers ─────────────────────────────────────────────────────────── */

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const formatDay = () =>
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const FRAMEWORK_COLORS = {
  CBC:       "#1D4ED8",
  IGCSE:     "#0369A1",
  IB:        "#1E40AF",
  National:  "#0F766E",
  Cambridge: "#1E3A8A",
};

/* ── Skeleton ────────────────────────────────────────────────────────── */

function Sk({ w, h, r = "8px" }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, backgroundColor: "#EEF2F7", flexShrink: 0 }} />
  );
}

/* ── Stat card ───────────────────────────────────────────────────────── */

function StatCard({ icon, label, value, sub, accent, actionLabel, onAction, loading }) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: "16px",
        border: "1.5px solid #E5E7EB",
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        flex: "1 1 0",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "12px",
            backgroundColor: accent + "18",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "20px",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        {actionLabel && (
          <button
            type="button"
            onClick={onAction}
            style={{
              background: "none",
              border: "none",
              fontSize: "12px",
              color: accent,
              fontWeight: "600",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
              padding: 0,
            }}
          >
            {actionLabel} →
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <Sk w="60px" h="28px" r="6px" />
          <Sk w="80px" h="12px" r="4px" />
        </div>
      ) : (
        <div>
          <p style={{ margin: 0, fontSize: "28px", fontWeight: "800", color: "#0F172A", lineHeight: 1 }}>
            {value}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "13px", fontWeight: "600", color: "#6B7280" }}>
            {label}
          </p>
          {sub && (
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9CA3AF" }}>{sub}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Curriculum health row ───────────────────────────────────────────── */

function CurriculumRow({ curriculum, navigate }) {
  const periods = curriculum.periods || [];
  const structure = curriculum.structure || [];
  const configuredTerms = structure.filter((t) => (t.grades?.length || 0) > 0).length;
  const totalClasses = structure.reduce((s, t) => s + (t.grades?.length || 0), 0);
  const totalCourses = structure.reduce(
    (s, t) => s + (t.grades?.reduce((gs, g) => gs + (g.courses?.length || 0), 0) || 0),
    0
  );
  const pct = periods.length > 0 ? Math.round((configuredTerms / periods.length) * 100) : 0;
  const isComplete = pct === 100 && periods.length > 0;
  const fwColor = FRAMEWORK_COLORS[curriculum.framework] || "#374151";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "14px 16px",
        borderRadius: "12px",
        border: "1px solid #F0F4F8",
        backgroundColor: "#fff",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#BFDBFE";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(13,71,161,0.07)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#F0F4F8";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Framework badge */}
      <span
        style={{
          padding: "4px 10px",
          backgroundColor: fwColor + "12",
          color: fwColor,
          borderRadius: "8px",
          fontSize: "11px",
          fontWeight: "700",
          letterSpacing: "0.03em",
          flexShrink: 0,
          border: `1px solid ${fwColor}22`,
        }}
      >
        {curriculum.framework}
      </span>

      {/* Name + year */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            fontWeight: "700",
            color: "#111827",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {curriculum.name}
        </p>
        <p style={{ margin: "1px 0 0", fontSize: "11px", color: "#9CA3AF" }}>
          {curriculum.academicYear} · {totalClasses} classes · {totalCourses} courses
        </p>
      </div>

      {/* Progress bar + label */}
      <div style={{ width: "110px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
          <span style={{ fontSize: "10px", color: "#9CA3AF", fontWeight: "500" }}>Structure</span>
          <span style={{ fontSize: "10px", fontWeight: "700", color: isComplete ? "#15803D" : "#1D4ED8" }}>
            {pct}%
          </span>
        </div>
        <div style={{ height: "5px", backgroundColor: "#EEF2F7", borderRadius: "10px", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: isComplete
                ? "linear-gradient(90deg, #15803D, #22C55E)"
                : "linear-gradient(90deg, #0D47A1, #42A5F5)",
              borderRadius: "10px",
              transition: "width 0.4s ease",
            }}
          />
        </div>
        <p style={{ margin: "3px 0 0", fontSize: "10px", color: "#9CA3AF" }}>
          {configuredTerms}/{periods.length} terms configured
        </p>
      </div>

      {/* View button */}
      <button
        type="button"
        onClick={() => navigate(`/curriculum/${curriculum.id}/view`)}
        style={{
          padding: "6px 13px",
          backgroundColor: "#EFF6FF",
          color: "#1D4ED8",
          border: "1px solid #BFDBFE",
          borderRadius: "8px",
          fontSize: "12px",
          fontWeight: "600",
          fontFamily: "Inter, sans-serif",
          cursor: "pointer",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        View
      </button>
    </div>
  );
}

/* ── Module setup tile ───────────────────────────────────────────────── */

function ModuleTile({ icon, label, description, count, accentColor, path, navigate, isLive }) {
  return (
    <div
      style={{
        padding: "16px",
        borderRadius: "12px",
        border: `1.5px solid ${isLive ? accentColor + "30" : "#E5E7EB"}`,
        backgroundColor: isLive ? accentColor + "06" : "#FAFAFA",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
      onClick={() => navigate(path)}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = accentColor + "60";
        e.currentTarget.style.boxShadow = `0 2px 10px ${accentColor}14`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = isLive ? accentColor + "30" : "#E5E7EB";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            backgroundColor: accentColor + "18",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
          }}
        >
          {icon}
        </div>
        {isLive ? (
          <span
            style={{
              padding: "2px 8px",
              backgroundColor: accentColor + "18",
              color: accentColor,
              borderRadius: "20px",
              fontSize: "11px",
              fontWeight: "700",
            }}
          >
            {count}
          </span>
        ) : (
          <span
            style={{
              padding: "2px 8px",
              backgroundColor: "#F3F4F6",
              color: "#9CA3AF",
              borderRadius: "20px",
              fontSize: "10px",
              fontWeight: "600",
            }}
          >
            Not set up
          </span>
        )}
      </div>
      <div>
        <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#111827" }}>{label}</p>
        <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9CA3AF", lineHeight: "1.4" }}>
          {description}
        </p>
      </div>
    </div>
  );
}

/* ── Quick action button ─────────────────────────────────────────────── */

function QuickAction({ icon, label, description, onClick, primary }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 14px",
        backgroundColor: primary ? "#0D47A1" : "#fff",
        border: primary ? "none" : "1.5px solid #E5E7EB",
        borderRadius: "10px",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "Inter, sans-serif",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = primary ? "#0A3880" : "#F8FAFF";
        e.currentTarget.style.borderColor = primary ? "none" : "#BFDBFE";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = primary ? "#0D47A1" : "#fff";
        e.currentTarget.style.borderColor = primary ? "none" : "#E5E7EB";
      }}
    >
      <span
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "9px",
          backgroundColor: primary ? "rgba(255,255,255,0.15)" : "#EFF6FF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "16px",
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: primary ? "#fff" : "#111827" }}>
          {label}
        </p>
        <p style={{ margin: "1px 0 0", fontSize: "11px", color: primary ? "rgba(255,255,255,0.65)" : "#9CA3AF" }}>
          {description}
        </p>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: primary ? "rgba(255,255,255,0.6)" : "#D1D5DB", flexShrink: 0 }}>
        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/* ── Main page ───────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useCurriculaQuery();
  const curricula = data?.data || [];

  const { data: schoolsData, isLoading: schoolsLoading } = useAllSchoolsQuery();
  const { data: learnersData, isLoading: learnersLoading } = useAllLearnersQuery();
  const { data: teachersData, isLoading: teachersLoading } = useAllTeachersQuery();

  const schools  = schoolsData?.data  || [];
  const learners = learnersData?.data  || [];
  const teachers = teachersData?.data  || [];

  const totalSchools   = schools.length;
  const totalLearners  = learners.length;
  const totalTeachers  = teachers.length;

  const activeSchools  = schools.filter((s) => s.status === "active").length;
  const activeLearners = learners.filter((l) => l.status === "active").length;
  const activeTeachers = teachers.filter((t) => t.status === "active").length;

  /* ── Derived curriculum stats ── */
  const totalCurricula = curricula.length;
  const totalClasses = curricula.reduce(
    (s, c) => s + (c.structure?.reduce((ts, t) => ts + (t.grades?.length || 0), 0) || 0),
    0
  );
  const totalCourses = curricula.reduce(
    (s, c) =>
      s + (c.structure?.reduce((ts, t) => ts + (t.grades?.reduce((gs, g) => gs + (g.courses?.length || 0), 0) || 0), 0) || 0),
    0
  );
  const frameworks = [...new Set(curricula.map((c) => c.framework).filter(Boolean))];

  /* ── Recent curricula (up to 5, most recently updated) ── */
  const recentCurricula = [...curricula]
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, 5);

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>

      {/* ── Welcome strip ──────────────────────────────────────────────── */}
      <div
        style={{
          borderRadius: "20px",
          background: "linear-gradient(135deg, #0A3880 0%, #0D47A1 50%, #1565C0 100%)",
          padding: "28px 32px",
          marginBottom: "24px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20px", right: "140px", width: "100px", height: "100px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "20px", right: "260px", width: "50px", height: "50px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: "13px", color: "rgba(255,255,255,0.6)", fontWeight: "500" }}>
              {formatDay()}
            </p>
            <h1 style={{ margin: "0 0 6px", fontSize: "26px", fontWeight: "900", color: "#fff", letterSpacing: "-0.4px" }}>
              {getGreeting()}, Admin 👋
            </h1>
            <p style={{ margin: 0, fontSize: "14px", color: "rgba(255,255,255,0.7)", lineHeight: "1.5" }}>
              {totalCurricula > 0
                ? `You have ${totalCurricula} ${totalCurricula === 1 ? "curriculum" : "curricula"} across ${frameworks.length} ${frameworks.length === 1 ? "framework" : "frameworks"}.`
                : "Welcome to Digifunzi. Start by creating your first curriculum."}
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => navigate("/curriculum/create")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "10px 20px",
                backgroundColor: "#fff",
                color: "#0D47A1",
                border: "none",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: "700",
                fontFamily: "Inter, sans-serif",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              + New Curriculum
            </button>
            <button
              type="button"
              onClick={() => navigate("/schools")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "10px 20px",
                backgroundColor: "rgba(255,255,255,0.12)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: "600",
                fontFamily: "Inter, sans-serif",
                cursor: "pointer",
              }}
            >
              + Add School
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "14px", marginBottom: "24px", flexWrap: "wrap" }}>
        <StatCard
          icon="📋"
          label="Curricula"
          value={isLoading ? "—" : totalCurricula}
          sub={frameworks.length > 0 ? `${frameworks.join(", ")}` : "No frameworks yet"}
          accent="#0D47A1"
          actionLabel="View all"
          onAction={() => navigate("/curriculum")}
          loading={isLoading}
        />
        <StatCard
          icon="🏫"
          label="Schools"
          value={schoolsLoading ? "—" : totalSchools}
          sub={
            schoolsLoading ? null
            : totalSchools === 0 ? "No schools added yet"
            : `${activeSchools} active`
          }
          accent="#0369A1"
          actionLabel={totalSchools === 0 ? "Get started" : "View all"}
          onAction={() => navigate("/schools")}
          loading={schoolsLoading}
        />
        <StatCard
          icon="🎓"
          label="Learners"
          value={learnersLoading ? "—" : totalLearners}
          sub={
            learnersLoading ? null
            : totalLearners === 0 ? "Enrol learners to begin"
            : `${activeLearners} active`
          }
          accent="#1E40AF"
          actionLabel={totalLearners === 0 ? "Get started" : "View all"}
          onAction={() => navigate("/learners")}
          loading={learnersLoading}
        />
        <StatCard
          icon="👩‍🏫"
          label="Teachers"
          value={teachersLoading ? "—" : totalTeachers}
          sub={
            teachersLoading ? null
            : totalTeachers === 0 ? "Add teachers to classes"
            : `${activeTeachers} active`
          }
          accent="#0F766E"
          actionLabel={totalTeachers === 0 ? "Get started" : "View all"}
          onAction={() => navigate("/teachers")}
          loading={teachersLoading}
        />
      </div>

      {/* ── Main content: two columns ──────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(280px, 340px)", gap: "20px", alignItems: "start" }}>

        {/* ── LEFT: Curriculum health ──────────────────────────────────── */}
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "16px",
            border: "1.5px solid #E5E7EB",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "18px 20px 14px",
              borderBottom: "1px solid #F3F4F6",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#111827" }}>
                Curriculum Overview
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
                Structure completion across your curricula
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/curriculum")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "6px 12px",
                backgroundColor: "#EFF6FF",
                color: "#1D4ED8",
                border: "1px solid #BFDBFE",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "600",
                fontFamily: "Inter, sans-serif",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              View all
            </button>
          </div>

          {/* Curriculum rows */}
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {isLoading ? (
              [1, 2, 3].map((n) => (
                <div key={n} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", borderRadius: "12px", border: "1px solid #F0F4F8" }}>
                  <Sk w="52px" h="24px" r="6px" />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                    <Sk w="55%" h="13px" r="4px" />
                    <Sk w="35%" h="10px" r="4px" />
                  </div>
                  <Sk w="110px" h="36px" r="8px" />
                  <Sk w="52px" h="28px" r="8px" />
                </div>
              ))
            ) : recentCurricula.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                  padding: "40px 20px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "16px",
                    background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "26px",
                  }}
                >
                  📋
                </div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                  No curricula yet
                </p>
                <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>
                  Create your first curriculum to see it here.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/curriculum/create")}
                  style={{
                    marginTop: "4px",
                    padding: "8px 18px",
                    backgroundColor: "#0D47A1",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "600",
                    fontFamily: "Inter, sans-serif",
                    cursor: "pointer",
                  }}
                >
                  + Create Curriculum
                </button>
              </div>
            ) : (
              recentCurricula.map((c) => (
                <CurriculumRow key={c.id} curriculum={c} navigate={navigate} />
              ))
            )}
          </div>

          {/* Summary footer */}
          {!isLoading && totalCurricula > 0 && (
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid #F3F4F6",
                display: "flex",
                gap: "20px",
                backgroundColor: "#FAFBFF",
              }}
            >
              {[
                { label: "Total Classes", value: totalClasses, color: "#1D4ED8" },
                { label: "Total Courses", value: totalCourses, color: "#0369A1" },
                { label: "Frameworks", value: frameworks.length, color: "#1E40AF" },
              ].map((s) => (
                <div key={s.label} style={{ display: "flex", gap: "6px", alignItems: "baseline" }}>
                  <span style={{ fontSize: "15px", fontWeight: "800", color: s.color }}>{s.value}</span>
                  <span style={{ fontSize: "11px", color: "#9CA3AF", fontWeight: "500" }}>{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT column ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Quick actions */}
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "16px",
              border: "1.5px solid #E5E7EB",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid #F3F4F6" }}>
              <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>
                Quick Actions
              </h2>
            </div>
            <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <QuickAction
                icon="📋"
                label="New Curriculum"
                description="Create a new academic curriculum"
                onClick={() => navigate("/curriculum/create")}
                primary
              />
              <QuickAction
                icon="🏫"
                label="Add School"
                description="Register a school to the system"
                onClick={() => navigate("/schools")}
              />
              <QuickAction
                icon="🎓"
                label="Enrol Learner"
                description="Add a new learner to a class"
                onClick={() => navigate("/learners")}
              />
              <QuickAction
                icon="👩‍🏫"
                label="Add Teacher"
                description="Register a teacher profile"
                onClick={() => navigate("/teachers")}
              />
            </div>
          </div>

          {/* Module setup progress */}
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "16px",
              border: "1.5px solid #E5E7EB",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid #F3F4F6" }}>
              <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>
                System Setup
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9CA3AF" }}>
                Complete your setup to unlock all features
              </p>
            </div>
            <div style={{ padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <ModuleTile
                icon="📋"
                label="Curriculum"
                description="Academic framework and structure"
                count={totalCurricula}
                accentColor="#1D4ED8"
                path="/curriculum"
                navigate={navigate}
                isLive={totalCurricula > 0}
              />
              <ModuleTile
                icon="🏫"
                label="Schools"
                description="Register and manage schools"
                count={totalSchools}
                accentColor="#0369A1"
                path="/schools"
                navigate={navigate}
                isLive={totalSchools > 0}
              />
              <ModuleTile
                icon="🎓"
                label="Learners"
                description="Student profiles and enrolment"
                count={totalLearners}
                accentColor="#1E40AF"
                path="/learners"
                navigate={navigate}
                isLive={totalLearners > 0}
              />
              <ModuleTile
                icon="👩‍🏫"
                label="Teachers"
                description="Staff profiles and assignments"
                count={totalTeachers}
                accentColor="#0F766E"
                path="/teachers"
                navigate={navigate}
                isLive={totalTeachers > 0}
              />
            </div>
          </div>

        </div>
      </div>

      <div style={{ height: "32px" }} />
    </div>
  );
}
