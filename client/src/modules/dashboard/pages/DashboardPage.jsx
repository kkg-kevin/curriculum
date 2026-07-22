import { useMemo } from "react";
import {
  Apartment as ApartmentIcon,
  Assessment as AssessmentIcon,
  Assignment as AssignmentIcon,
  AutoStories as AutoStoriesIcon,
  BarChart as BarChartIcon,
  Book as BookIcon,
  Class as ClassIcon,
  Dashboard as DashboardIcon,
  Groups as GroupsIcon,
  MenuBook as MenuBookIcon,
  PeopleAlt as PeopleAltIcon,
  Person as PersonIcon,
  School as SchoolIcon,
  SchoolOutlined as SchoolOutlinedIcon,
  TableChart as TableChartIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useCurriculaQuery } from "../../curriculum/hooks/useCurriculum";
import { useAllLearningHubsQuery } from "../../learning-hubs/hooks/useLearningHub";
import { useAllLearnersQuery } from "../../learners/hooks/useLearners";
import { useAllTeachersQuery } from "../../teachers/hooks/useTeacher";
import { useAllClassesQuery } from "../../classes/hooks/useClasses";

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

const TYPE_COLORS = {
  Core:           "#25476a",
  Complementary:  "#38aae1",
  Substitutional: "#feb139",
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
            color: accent,
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
  const periodCount  = curriculum.periods?.length  || 0;
  const classCount   = curriculum.classes?.length   || 0;
  const coursesCount = curriculum.coursesCount      || 0;
  const academicYear = curriculum.publishedAcademicYear || null;
  const typeColor    = TYPE_COLORS[curriculum.curriculumType] || "#374151";

  /* Same setup completion logic as the curriculum cards */
  const pct = (curriculum.curriculumType ? 25 : 0)
            + (periodCount  > 0 ? 25 : 0)
            + (classCount   > 0 ? 25 : 0)
            + (academicYear      ? 25 : 0);
  const isComplete = pct === 100;

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
        e.currentTarget.style.borderColor = "#a8d5ee";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(37,71,106,0.07)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#F0F4F8";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
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
        <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9CA3AF" }}>
          {academicYear ? academicYear + " · " : ""}{classCount} {classCount === 1 ? "class" : "classes"} · {coursesCount} {coursesCount === 1 ? "course" : "courses"}
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
        {curriculum.curriculumType && (
          <span
            style={{
              padding: "3px 9px",
              backgroundColor: typeColor + "12",
              color: typeColor,
              borderRadius: "6px",
              fontSize: "10px",
              fontWeight: "700",
              letterSpacing: "0.03em",
              border: `1px solid ${typeColor}22`,
              whiteSpace: "nowrap",
            }}
          >
            {curriculum.curriculumType}
          </span>
        )}
        <div style={{ width: "110px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
          <span style={{ fontSize: "10px", color: "#9CA3AF", fontWeight: "500" }}>Setup</span>
          <span style={{ fontSize: "10px", fontWeight: "700", color: isComplete ? "#feb139" : "#38aae1" }}>
            {pct}%
          </span>
        </div>
        <div style={{ height: "5px", backgroundColor: "#EEF2F7", borderRadius: "10px", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: isComplete
                ? "linear-gradient(90deg, #feb139, #f59e0b)"
                : "linear-gradient(90deg, #25476a, #38aae1)",
              borderRadius: "10px",
              transition: "width 0.4s ease",
            }}
          />
        </div>
        <p style={{ margin: "3px 0 0", fontSize: "10px", color: "#9CA3AF" }}>
          {isComplete ? "Ready to publish" : `${pct / 25}/4 steps done`}
        </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate(`/curriculum/${curriculum.id}/view`)}
        style={{
          padding: "6px 13px",
          backgroundColor: "#e8f5fb",
          color: "#38aae1",
          border: "1px solid #a8d5ee",
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

/* ── Recent item row (schools / learners / teachers / classes) ────────── */

function RecentRow({ avatar, primary, secondary, badge, badgeColor, badgeBg, badgeBorder, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "9px 12px",
        borderRadius: "10px",
        border: "1px solid #F3F4F6",
        cursor: "pointer",
        transition: "background-color 0.12s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F9FAFB")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: avatar.gradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: avatar.emoji ? 16 : 12,
          fontWeight: 700,
          color: "#fff",
          flexShrink: 0,
        }}
      >
        {avatar.emoji || avatar.initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {primary}
        </p>
        <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>{secondary}</p>
      </div>
      {badge && (
        <span style={{ padding: "2px 8px", borderRadius: "20px", fontSize: "10px", fontWeight: "700", backgroundColor: badgeBg, color: badgeColor, border: `1px solid ${badgeBorder}`, whiteSpace: "nowrap", flexShrink: 0 }}>
          {badge}
        </span>
      )}
    </div>
  );
}

/* ── Module setup tile ───────────────────────────────────────────────── */

function ModuleTile({ icon, label, description, count, accentColor, path, navigate, isLive }) {
  return (
    <div
      style={{
        padding: "14px",
        borderRadius: "12px",
        border: `1.5px solid ${isLive ? accentColor + "30" : "#E5E7EB"}`,
        backgroundColor: isLive ? accentColor + "06" : "#FAFAFA",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
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
            width: "34px",
            height: "34px",
            borderRadius: "10px",
            backgroundColor: accentColor + "18",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "16px",
          }}
        >
          {icon}
        </div>
        {isLive ? (
          <span style={{ padding: "2px 8px", backgroundColor: accentColor + "18", color: accentColor, borderRadius: "20px", fontSize: "11px", fontWeight: "700" }}>
            {count}
          </span>
        ) : (
          <span style={{ padding: "2px 8px", backgroundColor: "#F3F4F6", color: "#9CA3AF", borderRadius: "20px", fontSize: "10px", fontWeight: "600" }}>
            Empty
          </span>
        )}
      </div>
      <div>
        <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#111827" }}>{label}</p>
        <p style={{ margin: "2px 0 0", fontSize: "10px", color: "#9CA3AF", lineHeight: "1.4" }}>
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
        backgroundColor: primary ? "#feb139" : "#fff",
        border: primary ? "none" : "1.5px solid #E5E7EB",
        borderRadius: "10px",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "Inter, sans-serif",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = primary ? "#f0a800" : "#F8FAFF";
        if (!primary) e.currentTarget.style.borderColor = "#a8d5ee";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = primary ? "#feb139" : "#fff";
        if (!primary) e.currentTarget.style.borderColor = "#E5E7EB";
      }}
    >
      <span
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "9px",
          backgroundColor: primary ? "rgba(37,71,106,0.12)" : "#e8f5fb",
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
        <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: primary ? "#25476a" : "#111827" }}>
          {label}
        </p>
        <p style={{ margin: "1px 0 0", fontSize: "11px", color: primary ? "rgba(37,71,106,0.6)" : "#9CA3AF" }}>
          {description}
        </p>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: primary ? "rgba(37,71,106,0.5)" : "#D1D5DB", flexShrink: 0 }}>
        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/* ── Main page ───────────────────────────────────────────────────────── */

const STATUS_COLORS = {
  active:      { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
  inactive:    { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
  on_leave:    { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A" },
  transferred: { bg: "#dff2fb", color: "#38aae1", border: "#a8d5ee" },
  graduated:   { bg: "#fff8e6", color: "#feb139", border: "#fcd97a" },
};

export default function DashboardPage() {
  const navigate = useNavigate();

  const { data: curriculaData, isLoading: curriculaLoading } = useCurriculaQuery();
  const { data: schoolsData,   isLoading: schoolsLoading }   = useAllLearningHubsQuery({ hubType: "school" });
  const { data: learnersData,  isLoading: learnersLoading }  = useAllLearnersQuery();
  const { data: teachersData,  isLoading: teachersLoading }  = useAllTeachersQuery();
  const { data: classesData,   isLoading: classesLoading }   = useAllClassesQuery();

  const curricula = curriculaData?.data || [];
  const schools   = schoolsData?.data   || [];
  const learners  = learnersData?.data  || [];
  const teachers  = teachersData?.data  || [];
  const classes   = classesData?.data   || [];

  /* ── Counts ── */
  const totalCurricula = curricula.length;
  const totalSchools   = schools.length;
  const totalLearners  = learners.length;
  const totalTeachers  = teachers.length;
  const totalClasses   = classes.length;

  const activeSchools  = useMemo(() => schools.filter((s) => s.status === "active").length, [schools]);
  const activeLearners = useMemo(() => learners.filter((l) => l.status === "active").length, [learners]);
  const activeTeachers = useMemo(() => teachers.filter((t) => t.status === "active").length, [teachers]);
  const activeClasses  = useMemo(() => classes.filter((c) => c.status === "active").length, [classes]);

  /* ── Curriculum-derived stats ── */
  const totalCurriculumClasses = useMemo(() => curricula.reduce((s, c) => s + (c.classes?.length || 0), 0), [curricula]);
  const totalCurriculumPeriods = useMemo(() => curricula.reduce((s, c) => s + (c.periods?.length || 0), 0), [curricula]);
  const totalCourses           = useMemo(() => curricula.reduce((s, c) => s + (c.coursesCount    || 0), 0), [curricula]);
  const publishedCount         = useMemo(() => curricula.filter((c) => c.effectiveStatus === "published").length, [curricula]);
  const typesInUse             = useMemo(() => [...new Set(curricula.map((c) => c.curriculumType).filter(Boolean))], [curricula]);

  /* ── Recent items (last 4, sorted by creation date) ── */
  const recentSchools  = useMemo(() => [...schools].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 4), [schools]);
  const recentLearners = useMemo(() => [...learners].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 4), [learners]);
  const recentCurricula = useMemo(() => [...curricula].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)).slice(0, 5), [curricula]);

  const isLoading = curriculaLoading;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>

      {/* ── Welcome strip ──────────────────────────────────────────────── */}
      <div
        style={{
          borderRadius: "20px",
          background: "linear-gradient(135deg, #0A3880 0%, #25476a 50%, #2e7db5 100%)",
          padding: "28px 32px",
          marginBottom: "24px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20px", right: "140px", width: "100px", height: "100px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "20px", right: "260px", width: "50px", height: "50px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: "13px", color: "rgba(255,255,255,0.6)", fontWeight: "500" }}>
              {formatDay()}
            </p>
            <h1 style={{ margin: "0 0 6px", fontSize: "26px", fontWeight: "900", color: "#fff", letterSpacing: "-0.4px" }}>
              {getGreeting()}, Admin
            </h1>
            <p style={{ margin: 0, fontSize: "14px", color: "rgba(255,255,255,0.7)", lineHeight: "1.5" }}>
              {totalCurricula > 0
                ? `${totalCurricula} ${totalCurricula === 1 ? "curriculum" : "curricula"} · ${totalCourses} ${totalCourses === 1 ? "course" : "courses"} · ${totalLearners} ${totalLearners === 1 ? "learner" : "learners"} enrolled`
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
                color: "#25476a",
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
              onClick={() => navigate("/settings/learning-hubs/create")}
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
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
        <StatCard
          icon={<MenuBookIcon fontSize="small" />}
          label="Curricula"
          value={curriculaLoading ? "—" : totalCurricula}
          sub={curriculaLoading ? null : publishedCount > 0 ? `${publishedCount} published` : typesInUse.length > 0 ? typesInUse.join(", ") : "None published yet"}
          accent="#25476a"
          actionLabel="View all"
          onAction={() => navigate("/curriculum")}
          loading={curriculaLoading}
        />
        <StatCard
          icon={<SchoolIcon fontSize="small" />}
          label="Schools"
          value={schoolsLoading ? "—" : totalSchools}
          sub={schoolsLoading ? null : totalSchools === 0 ? "None added yet" : `${activeSchools} active`}
          accent="#38aae1"
          actionLabel={totalSchools === 0 ? "Get started" : "View all"}
          onAction={() => navigate("/learning-hubs")}
          loading={schoolsLoading}
        />
        <StatCard
          icon={<ApartmentIcon fontSize="small" />}
          label="Classes"
          value={classesLoading ? "—" : totalClasses}
          sub={classesLoading ? null : totalClasses === 0 ? "No classes yet" : `${activeClasses} active`}
          accent="#feb139"
          actionLabel={totalClasses === 0 ? "Get started" : "View all"}
          onAction={() => navigate("/classes")}
          loading={classesLoading}
        />
        <StatCard
          icon={<PeopleAltIcon fontSize="small" />}
          label="Learners"
          value={learnersLoading ? "—" : totalLearners}
          sub={learnersLoading ? null : totalLearners === 0 ? "Enrol learners to begin" : `${activeLearners} active`}
          accent="#38aae1"
          actionLabel={totalLearners === 0 ? "Get started" : "View all"}
          onAction={() => navigate("/learners")}
          loading={learnersLoading}
        />
        <StatCard
          icon={<PersonIcon fontSize="small" />}
          label="Teachers"
          value={teachersLoading ? "—" : totalTeachers}
          sub={teachersLoading ? null : totalTeachers === 0 ? "Add teachers to classes" : `${activeTeachers} active`}
          accent="#25476a"
          actionLabel={totalTeachers === 0 ? "Get started" : "View all"}
          onAction={() => navigate("/teachers")}
          loading={teachersLoading}
        />
      </div>

      {/* ── Main content: two columns ──────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(280px, 320px)", gap: "20px", alignItems: "start" }}>

        {/* ── LEFT column ──────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Curriculum overview */}
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "16px",
              border: "1.5px solid #E5E7EB",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}
          >
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
                <h2 style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>
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
                  padding: "6px 12px",
                  backgroundColor: "#e8f5fb",
                  color: "#38aae1",
                  border: "1px solid #a8d5ee",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "600",
                  fontFamily: "Inter, sans-serif",
                  cursor: "pointer",
                }}
              >
                View all
              </button>
            </div>

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
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "40px 20px", textAlign: "center" }}>
                  <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", display: "flex", alignItems: "center", justifyContent: "center", color: "#25476a" }}>
                    <MenuBookIcon fontSize="medium" />
                  </div>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#374151" }}>No curricula yet</p>
                  <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>Create your first curriculum to see it here.</p>
                  <button
                    type="button"
                    onClick={() => navigate("/curriculum/create")}
                    style={{ marginTop: "4px", padding: "8px 18px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
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

            {!isLoading && totalCurricula > 0 && (
              <div style={{ padding: "12px 20px", borderTop: "1px solid #F3F4F6", display: "flex", gap: "20px", backgroundColor: "#FAFBFF" }}>
                {[
                  { label: "Total Classes",  value: totalCurriculumClasses, color: "#25476a" },
                  { label: "Total Courses",  value: totalCourses,           color: "#38aae1" },
                  { label: "Total Periods",  value: totalCurriculumPeriods, color: "#25476a" },
                  { label: "Published",      value: publishedCount,         color: "#feb139" },
                ].map((s) => (
                  <div key={s.label} style={{ display: "flex", gap: "6px", alignItems: "baseline" }}>
                    <span style={{ fontSize: "15px", fontWeight: "800", color: s.color }}>{s.value}</span>
                    <span style={{ fontSize: "11px", color: "#9CA3AF", fontWeight: "500" }}>{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Schools */}
          {recentSchools.length > 0 && (
            <div
              style={{
                backgroundColor: "#fff",
                borderRadius: "16px",
                border: "1.5px solid #E5E7EB",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px", borderBottom: "1px solid #F3F4F6" }}>
                <h2 style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>Recent Schools</h2>
                <button type="button" onClick={() => navigate("/learning-hubs")} style={{ background: "none", border: "none", fontSize: "12px", color: "#38aae1", fontWeight: "600", cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0 }}>
                  View all →
                </button>
              </div>
              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {recentSchools.map((s) => {
                  const sc = STATUS_COLORS[s.status] || STATUS_COLORS.inactive;
                  return (
                    <RecentRow
                      key={s.id}
                      avatar={{ icon: <SchoolIcon fontSize="small" />, gradient: "linear-gradient(135deg, #38aae1, #25476a)" }}
                      primary={s.name}
                      secondary={s.code + (s.address?.county ? ` · ${s.address.county}` : "")}
                      badge={s.status}
                      badgeColor={sc.color}
                      badgeBg={sc.bg}
                      badgeBorder={sc.border}
                      onClick={() => navigate(`/learning-hubs/${s.id}/view`)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Learners */}
          {recentLearners.length > 0 && (
            <div
              style={{
                backgroundColor: "#fff",
                borderRadius: "16px",
                border: "1.5px solid #E5E7EB",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px", borderBottom: "1px solid #F3F4F6" }}>
                <h2 style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>Recent Learners</h2>
                <button type="button" onClick={() => navigate("/learners")} style={{ background: "none", border: "none", fontSize: "12px", color: "#38aae1", fontWeight: "600", cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0 }}>
                  View all →
                </button>
              </div>
              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {recentLearners.map((l) => {
                  const sc = STATUS_COLORS[l.status] || STATUS_COLORS.inactive;
                  return (
                    <RecentRow
                      key={l.id}
                      avatar={{ initials: (l.firstName?.[0] || "") + (l.lastName?.[0] || ""), gradient: "linear-gradient(135deg, #1a3550, #25476a)" }}
                      primary={`${l.firstName} ${l.lastName}`}
                      secondary={l.admissionNumber || l.id}
                      badge={l.status}
                      badgeColor={sc.color}
                      badgeBg={sc.bg}
                      badgeBorder={sc.border}
                      onClick={() => navigate(`/learners/${l.id}/view`)}
                    />
                  );
                })}
              </div>
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
              <h2 style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>Quick Actions</h2>
            </div>
            <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <QuickAction
                icon={<MenuBookIcon fontSize="small" />}
                label="New Curriculum"
                description="Create a new academic curriculum"
                onClick={() => navigate("/curriculum/create")}
                primary
              />
              <QuickAction
                icon={<SchoolIcon fontSize="small" />}
                label="Add School"
                description="Register a school to the system"
                onClick={() => navigate("/settings/learning-hubs/create")}
              />
              <QuickAction
                icon={<ApartmentIcon fontSize="small" />}
                label="Create Class"
                description="Open a new class for a school"
                onClick={() => navigate("/classes/create")}
              />
              <QuickAction
                icon={<PeopleAltIcon fontSize="small" />}
                label="Enrol Learner"
                description="Add a new learner to a class"
                onClick={() => navigate("/learners/create")}
              />
              <QuickAction
                icon={<PersonIcon fontSize="small" />}
                label="Add Teacher"
                description="Register a teacher profile"
                onClick={() => navigate("/teachers/create")}
              />
            </div>
          </div>

          {/* System setup */}
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
              <h2 style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>System Setup</h2>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9CA3AF" }}>
                Complete your setup to unlock all features
              </p>
            </div>
            <div style={{ padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <ModuleTile
                icon={<MenuBookIcon fontSize="small" />}
                label="Curriculum"
                description="Framework & structure"
                count={totalCurricula}
                accentColor="#25476a"
                path="/curriculum"
                navigate={navigate}
                isLive={totalCurricula > 0}
              />
              <ModuleTile
                icon={<SchoolIcon fontSize="small" />}
                label="Schools"
                description="Manage schools"
                count={totalSchools}
                accentColor="#38aae1"
                path="/learning-hubs"
                navigate={navigate}
                isLive={totalSchools > 0}
              />
              <ModuleTile
                icon={<ApartmentIcon fontSize="small" />}
                label="Classes"
                description="School classes"
                count={totalClasses}
                accentColor="#feb139"
                path="/classes"
                navigate={navigate}
                isLive={totalClasses > 0}
              />
              <ModuleTile
                icon={<PeopleAltIcon fontSize="small" />}
                label="Learners"
                description="Student enrolment"
                count={totalLearners}
                accentColor="#38aae1"
                path="/learners"
                navigate={navigate}
                isLive={totalLearners > 0}
              />
              <ModuleTile
                icon={<PersonIcon fontSize="small" />}
                label="Teachers"
                description="Staff profiles"
                count={totalTeachers}
                accentColor="#25476a"
                path="/teachers"
                navigate={navigate}
                isLive={totalTeachers > 0}
              />
              <ModuleTile
                icon={<BarChartIcon fontSize="small" />}
                label="Assessments"
                description="Coming soon"
                count={0}
                accentColor="#feb139"
                path="/assessments"
                navigate={navigate}
                isLive={false}
              />
            </div>
          </div>

        </div>
      </div>

      <div style={{ height: "32px" }} />
    </div>
  );
}
