import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FiAlertCircle, FiAward, FiBookOpen, FiCheckCircle, FiClipboard, FiClock, FiTrendingUp, FiUser, FiUserCheck } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { learnerApi } from "../../learners/services/learnerApi";
import { teacherApi } from "../../teachers/services/teacherApi";
import { useLearnerHubsQuery } from "../../learners/hooks/useLearners";
import { useCurriculumCurrentCourses } from "../../curriculum/hooks/useCurriculumVersion";
import { useIssuedForLearner } from "../../assessments/hooks/useAssessmentSubmission";
import { summarizeCoursesProgress } from "../utils/progressStorage";
import Avatar from "../components/Avatar";
import SideRail from "../components/SideRail";

const T = {
  accent: "#25476a",
  accentDeep: "#1a3550",
  accentMid: "#2e7db5",
  accentLight: "#38aae1",
  tintBg: "#e8f5fb",
  tintBorder: "#a8d5ee",
  ink: "#111827",
  inkMuted: "#6B7280",
  inkFaint: "#9CA3AF",
  border: "#E5E7EB",
};

function cardStyle(extra = {}) {
  return { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: `1px solid ${T.border}`, ...extra };
}

function sectionHeaderStyle() {
  return { margin: 0, fontSize: 11, fontWeight: 700, color: T.accentLight, textTransform: "uppercase", letterSpacing: "0.07em" };
}

function HeroPill({ icon, value, label, highlight }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 14,
        backgroundColor: highlight ? "rgba(254,177,57,0.18)" : "rgba(255,255,255,0.12)",
        border: `1px solid ${highlight ? "rgba(254,177,57,0.4)" : "rgba(255,255,255,0.22)"}`,
        backdropFilter: "blur(6px)",
      }}
    >
      <span style={{ color: highlight ? "#feb139" : "rgba(255,255,255,0.85)", display: "flex" }}>{icon}</span>
      <div>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>{value}</p>
        <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.75)" }}>{label}</p>
      </div>
    </div>
  );
}

const NAV_TILES = [
  { label: "My Courses",  desc: "Browse your course list", icon: <FiBookOpen />,  path: "/learner-portal/courses" },
  { label: "Assessments", desc: "See what's due",          icon: <FiClipboard />, path: "/learner-portal/assessments" },
  { label: "Progress",    desc: "Track course status",     icon: <FiTrendingUp />, path: "/learner-portal/progress" },
  { label: "Profile",     desc: "Your full record",        icon: <FiUser />,       path: "/learner-portal/profile" },
];

function formatDueDate(dateStr) {
  if (!dateStr) return null;
  const due = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.setHours(0, 0, 0, 0) - today) / 86400000);
  const label = due.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
  if (diffDays < 0) return { label: `Overdue · ${label}`, overdue: true };
  if (diffDays === 0) return { label: `Due today`, overdue: false };
  if (diffDays === 1) return { label: `Due tomorrow`, overdue: false };
  return { label: `Due ${label}`, overdue: false };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: learnersData, isLoading: learnerLoading } = useQuery({
    queryKey: ["learners", "byGuardianEmail", user?.email],
    queryFn: () => learnerApi.getAll({ guardianEmail: user.email }),
    enabled: !!user?.email,
  });
  const learner = learnersData?.data?.[0] || null;

  // A learner can be enrolled at several hubs now — the first active enrollment is used as
  // the "current" context here, same default used on ProfilePage/MyCoursesPage.
  const { data: hubs = [], isLoading: hubsLoading } = useLearnerHubsQuery(learner?.id);
  const primary = hubs.find((h) => h.status === "active") || hubs[0] || null;
  const cls = primary?.class || null;
  const school = primary || null;

  const { data: courses = [] } = useCurriculumCurrentCourses(cls?.curriculumId, cls?.gradeName);
  const progressSummary = useMemo(() => summarizeCoursesProgress(user?.email, courses), [user?.email, courses]);

  const { data: issuedData, isLoading: assessmentsLoading } = useIssuedForLearner();
  const issuedRows = issuedData?.data || [];

  const pendingRows = useMemo(
    () => issuedRows
      .filter((r) => r.submission.status === "not_started" || r.submission.status === "in_progress")
      .sort((a, b) => (a.issue.dueDate || "9999").localeCompare(b.issue.dueDate || "9999")),
    [issuedRows]
  );
  const recentlyGraded = useMemo(
    () => issuedRows
      .filter((r) => r.submission.status === "graded")
      .sort((a, b) => (b.submission.updatedAt || "").localeCompare(a.submission.updatedAt || ""))
      .slice(0, 3),
    [issuedRows]
  );

  const continueCourse = useMemo(
    () => progressSummary.courses.find((c) => c.percent > 0 && c.percent < 100) || progressSummary.courses[0] || null,
    [progressSummary.courses]
  );

  // "My Teachers & Mentors" resolves each hub's class teacher — real data via a small join,
  // not a fabricated mentor list. Hubs with no class teacher assigned are simply omitted.
  const teacherIds = useMemo(
    () => [...new Set(hubs.map((h) => h.class?.classTeacherId).filter(Boolean))],
    [hubs]
  );
  const { data: mentorTeachers = [], isLoading: mentorTeachersLoading } = useQuery({
    queryKey: ["learner-profile-mentor-teachers", teacherIds],
    queryFn: () => Promise.all(teacherIds.map((id) => teacherApi.getById(id))),
    enabled: teacherIds.length > 0,
  });
  const mentors = useMemo(
    () => hubs
      .filter((h) => h.class?.classTeacherId)
      .map((h) => {
        const teacher = mentorTeachers.find((t) => t.id === h.class.classTeacherId);
        return teacher ? { teacher, hubName: h.name } : null;
      })
      .filter(Boolean),
    [hubs, mentorTeachers]
  );

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "28px 32px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {learner && <Avatar firstName={learner.firstName} lastName={learner.lastName} size={64} borderColor="rgba(255,255,255,0.3)" />}
            <div>
              <h1 style={{ margin: "0 0 6px 0", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
                Welcome back{learner?.firstName ? `, ${learner.firstName}` : ""}
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", maxWidth: 560 }}>
                {cls ? `${cls.gradeName} · ${school?.name || "…"}` : "Here's an overview of your learning."}
              </p>
            </div>
          </div>

          {learner && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <HeroPill icon={<FiTrendingUp size={18} />} value={`${progressSummary.percent}%`} label="Course completion" />
              <HeroPill icon={<FiCheckCircle size={18} />} value={progressSummary.completed} label="Courses completed" />
              <HeroPill icon={<FiClipboard size={18} />} value={pendingRows.length} label="Assessments pending" highlight={pendingRows.length > 0} />
            </div>
          )}
        </div>
      </div>

      {learnerLoading ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14 }}>Loading…</div>
      ) : !learner ? (
        <div style={{ textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: `1.5px solid ${T.border}` }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px", color: T.accent }}><FiUserCheck /></div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No learner profile linked yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted, lineHeight: 1.6, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>
            Your account ({user?.email}) isn't linked to a learner profile yet. Ask your school to record this same
            email address as the guardian email on your learner record.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          {/* Main column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 2, minWidth: 340 }}>
            {/* Continue Learning — the primary call to action, given more visual weight */}
            <div
              onClick={() => continueCourse && navigate(`/learner-portal/courses/${continueCourse.id}`)}
              style={{ ...cardStyle(), overflow: "hidden", display: "flex", cursor: continueCourse ? "pointer" : "default", minHeight: 140 }}
            >
              {!continueCourse ? (
                <div style={{ padding: 24 }}>
                  <h2 style={{ ...sectionHeaderStyle(), marginBottom: 10 }}>Continue Learning</h2>
                  <p style={{ margin: 0, fontSize: 13, color: T.inkFaint }}>Your teacher will add courses once your class is assigned a curriculum.</p>
                </div>
              ) : (
                <>
                  <div style={{ width: 160, flexShrink: 0, backgroundColor: T.tintBg, backgroundImage: continueCourse.coverImage ? `url(${continueCourse.coverImage})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }} />
                  <div style={{ padding: 22, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
                    <h2 style={sectionHeaderStyle()}>Continue Learning</h2>
                    <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.ink }}>{continueCourse.name}</p>
                    <div style={{ height: 8, borderRadius: 5, backgroundColor: "#F3F4F6", overflow: "hidden", maxWidth: 420 }}>
                      <div style={{ width: `${continueCourse.percent}%`, height: "100%", backgroundColor: T.accentMid }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 12.5, color: T.inkMuted }}>{continueCourse.percent}% complete</span>
                      <span style={{ padding: "5px 14px", borderRadius: 999, backgroundColor: T.accent, color: "#fff", fontSize: 12, fontWeight: 700 }}>
                        {continueCourse.percent > 0 ? "Resume" : "Start"}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Needs Your Attention */}
            <div style={{ ...cardStyle(), padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h2 style={sectionHeaderStyle()}>Needs Your Attention</h2>
                {pendingRows.length > 0 && (
                  <button type="button" onClick={() => navigate("/learner-portal/assessments")} style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>View all</button>
                )}
              </div>
              {assessmentsLoading ? (
                <p style={{ margin: 0, fontSize: 13, color: T.inkFaint }}>Loading…</p>
              ) : pendingRows.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: T.inkFaint }}>Nothing pending — you're all caught up.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {pendingRows.slice(0, 4).map(({ issue, assessment }) => {
                    const due = formatDueDate(issue.dueDate);
                    return (
                      <div
                        key={issue.id}
                        onClick={() => navigate(`/learner-portal/assessments/${issue.id}`)}
                        style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "10px 8px", borderRadius: 10, borderLeft: `3px solid ${due?.overdue ? "#DC2626" : T.accentMid}` }}
                      >
                        <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: due?.overdue ? "#FEF2F2" : T.tintBg, display: "flex", alignItems: "center", justifyContent: "center", color: due?.overdue ? "#DC2626" : T.accent, flexShrink: 0 }}>
                          {due?.overdue ? <FiAlertCircle size={16} /> : <FiClock size={16} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{assessment.name}</p>
                          {due && <p style={{ margin: 0, fontSize: 11.5, color: due.overdue ? "#DC2626" : T.inkMuted, fontWeight: due.overdue ? 700 : 400 }}>{due.label}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Links */}
            <div style={{ ...cardStyle(), padding: 20 }}>
              <h2 style={{ ...sectionHeaderStyle(), marginBottom: 14 }}>Quick Links</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                {NAV_TILES.map((t) => (
                  <div
                    key={t.label}
                    onClick={() => navigate(t.path)}
                    style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: T.tintBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, color: T.accent }}>{t.icon}</div>
                    <div>
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.ink }}>{t.label}</p>
                      <p style={{ margin: "1px 0 0", fontSize: 11.5, color: T.inkMuted }}>{t.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right rail */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minWidth: 280 }}>
            <SideRail hubs={hubs} mentors={mentors} hubsLoading={hubsLoading} mentorsLoading={teacherIds.length > 0 && mentorTeachersLoading} />

            <div style={{ ...cardStyle(), padding: 18 }}>
              <h2 style={{ ...sectionHeaderStyle(), marginBottom: 14 }}>Recently Graded</h2>
              {assessmentsLoading ? (
                <p style={{ margin: 0, fontSize: 12.5, color: T.inkFaint }}>Loading…</p>
              ) : recentlyGraded.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12.5, color: T.inkFaint }}>No feedback yet — graded work will show up here.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {recentlyGraded.map(({ issue, assessment, submission }) => (
                    <div key={issue.id} onClick={() => navigate(`/learner-portal/assessments/${issue.id}`)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", color: "#059669", flexShrink: 0 }}><FiAward size={15} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{assessment.name}</p>
                        <p style={{ margin: 0, fontSize: 11.5, color: T.inkMuted }}>{submission.totalScore}/{submission.maxScore} · {Math.round((submission.totalScore / (submission.maxScore || 1)) * 100)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
