import { useState } from "react";
import { FiAlertTriangle, FiAward, FiBookOpen, FiCalendar, FiChevronDown, FiChevronUp, FiHome, FiMail, FiPhone, FiShield, FiTarget, FiTrendingUp } from "react-icons/fi";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTeacherQuery, useUpdateTeacherStatus, useTeacherHubsQuery, useLinkTeacherHub, useUnlinkTeacherHub, useTeacherAvailability } from "../hooks/useTeacher";
import WeeklyAvailabilityGrid from "../components/WeeklyAvailabilityGrid";
import { useAllLearningHubsQuery } from "../../learning-hubs/hooks/useLearningHub";
import { learningHubApi } from "../../learning-hubs/services/learningHubApi";
import { LEARNING_HUB_TYPES } from "../../learning-hubs/schemas/learningHub.schema";
import { EMPLOYMENT_TYPES, TEACHER_LEVELS, PAY_RATE_TYPES } from "../schemas/teacher.schema";
import { classApi } from "../../classes/services/classApi";
import { useClassQuery, useClassCourseTeachers, useAssignCourseTeacher, useUnassignCourseTeacher, useTeacherCourseAssignments } from "../../classes/hooks/useClasses";
import { useCurriculumCurrentCourses } from "../../curriculum/hooks/useCurriculumVersion";
import { useAuth } from "../../../context/AuthContext";
import { teachersListPath, teacherPath, classPath, classCreatePath, schoolViewPath } from "../../../routes/portalPaths";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import EducatorQaSection from "../../qa/components/EducatorQaSection";
import TotTrainingCard from "../../tot/components/TotTrainingCard";
import ParentFeedbackSection from "../../mentor-reviews/components/ParentFeedbackSection";
import { useEducatorProfile } from "../../educator-profiles/hooks/useEducatorProfile";
import { OverviewPanel, ProfileKpis, QualityPanel, TeachingPanel } from "../../educator-profiles/components/PerformanceProfile";
import PublishingCard from "../../educator-profiles/components/PublishingCard";
import StandardsCard from "../../mentor-standards/StandardsCard";
import { Tabs } from "../../../components/ui/TabBar";
import { usePermissions } from "../../../hooks/usePermissions";
import RecordStamp from "../../activity/components/RecordStamp";
import RemovePersonDialog from "../../removals/components/RemovePersonDialog";

const ACCENT = "#25476a";

// One class this teacher is assigned to at least one course in — shows each course they teach
// there, with its own Unassign button (equal-peer educators, so unassigning is per course).
function MyClassGroup({ classId, courseIds, teacherId, canManage }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: cls } = useClassQuery(classId);
  const { data: courses = [] } = useCurriculumCurrentCourses(cls?.curriculumId, cls?.gradeId);
  const { mutate: unassign } = useUnassignCourseTeacher();
  const courseNameById = Object.fromEntries(courses.map((c) => [c.id, c.name]));

  if (!cls) return null;

  return (
    <div style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid #E5E7EB", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div onClick={() => navigate(classPath(user?.role, cls.id, "view"))} style={{ cursor: "pointer", minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>{cls.gradeName}</p>
          <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF" }}>Academic Year {cls.academicYear}</p>
        </div>
        <span style={{ padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: cls.status === "active" ? "#e8f5fb" : "#F9FAFB", color: cls.status === "active" ? "#25476a" : "#6B7280", border: `1px solid ${cls.status === "active" ? "#a8d5ee" : "#E5E7EB"}`, flexShrink: 0 }}>
          {cls.status === "active" ? "Active" : "Inactive"}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {courseIds.map((courseId) => (
          <span key={courseId} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 600, backgroundColor: "#e8f5fb", border: "1px solid #a8d5ee", color: "#25476a" }}>
            {courseNameById[courseId] || "Course"}
            {canManage && (
              <button type="button" onClick={() => unassign({ classId, courseId, teacherId })} style={{ background: "none", border: "none", color: "#25476a", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }} title="Unassign">×</button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// Assigns this teacher to a course within a class — scoped to hubs this teacher is already
// linked to (you can't teach a class at a hub you're not even part of). A course can have more
// than one co-equal educator, so "linking" here is hub → class → course → assign, one step
// deeper than the old single-class-teacher picker.
function AssignCourseControl({ teacherId, hubs, qualifiedCourseIds }) {
  const [selectedHubId, setSelectedHubId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const { mutate: assign, isPending } = useAssignCourseTeacher();

  const { data: classesData } = useQuery({
    queryKey: ["classes", "bySchool", selectedHubId],
    queryFn:  () => classApi.getAll({ schoolId: selectedHubId }),
    enabled:  !!selectedHubId,
  });
  const classes = classesData?.data || [];
  const selectedClass = classes.find((c) => c.id === selectedClassId) || null;

  const { data: courses = [] } = useCurriculumCurrentCourses(selectedClass?.curriculumId, selectedClass?.gradeId);
  const { data: existingLinks = [] } = useClassCourseTeachers(selectedClassId);
  // An empty/unset qualifiedCourseIds means unrestricted (see teacher.validation.js) — mirrors
  // the server-side gate in class.controller.js's assignCourseTeacher and ClassViewPage.jsx's
  // own picker, so this dropdown never offers a course the server would reject.
  const availableCourses = courses.filter((c) =>
    !existingLinks.some((l) => l.courseId === c.id && l.teacherId === teacherId) &&
    (!qualifiedCourseIds?.length || qualifiedCourseIds.includes(c.id))
  );

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #F3F4F6", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select
          value={selectedHubId}
          onChange={(e) => { setSelectedHubId(e.target.value); setSelectedClassId(""); setSelectedCourseId(""); }}
          style={{ flex: 1, minWidth: 110, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#374151" }}
        >
          <option value="">Pick a hub…</option>
          {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <select
          value={selectedClassId}
          onChange={(e) => { setSelectedClassId(e.target.value); setSelectedCourseId(""); }}
          disabled={!selectedHubId}
          style={{ flex: 1, minWidth: 120, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#374151", opacity: selectedHubId ? 1 : 0.5 }}
        >
          <option value="">Pick a class…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.gradeName} · {c.academicYear}</option>)}
        </select>
        <select
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
          disabled={!selectedClassId}
          style={{ flex: 1, minWidth: 120, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#374151", opacity: selectedClassId ? 1 : 0.5 }}
        >
          <option value="">Pick a course…</option>
          {availableCourses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button
          type="button"
          disabled={!selectedCourseId || isPending}
          onClick={() => {
            assign({ classId: selectedClassId, courseId: selectedCourseId, teacherId });
            setSelectedCourseId("");
          }}
          style={{ padding: "8px 16px", backgroundColor: !selectedCourseId || isPending ? "#b8d9ee" : ACCENT, color: "#ffffff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: !selectedCourseId || isPending ? "not-allowed" : "pointer", flexShrink: 0 }}
        >
          Assign
        </button>
      </div>
      {selectedClassId && availableCourses.length === 0 && (
        <span style={{ fontSize: 12, color: "#9CA3AF" }}>Already assigned to every course in this class.</span>
      )}
      {selectedHubId && classes.length === 0 && (
        <span style={{ fontSize: 12, color: "#9CA3AF" }}>No classes at this hub.</span>
      )}
    </div>
  );
}

const HUB_TYPE_LABELS = Object.fromEntries(LEARNING_HUB_TYPES.map((t) => [t.value, t.label]));
const EMPLOYMENT_TYPE_LABELS = Object.fromEntries(EMPLOYMENT_TYPES.map((t) => [t.value, t.label]));
const TEACHER_LEVEL_LABELS = Object.fromEntries(TEACHER_LEVELS.map((t) => [t.value, t.label]));
const PAY_RATE_LABELS = Object.fromEntries(PAY_RATE_TYPES.map((t) => [t.value, t.label]));

const STATUS_STYLES = {
  active:   { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
  inactive: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
  on_leave: { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A" },
  in_training: { bg: "#dff2fb", color: "#1f6f99", border: "#a8d5ee" },
  removed: { bg: "#F3F4F6", color: "#4B5563", border: "#E5E7EB" },
};
const STATUS_LABELS = { active: "Active", inactive: "Inactive", on_leave: "On Leave", in_training: "In training", removed: "Removed" };

function Avatar({ firstName, lastName, photo, size = 64 }) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  if (photo) {
    return (
      <img
        src={photo}
        alt={`${firstName || ""} ${lastName || ""}`.trim()}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(255,255,255,0.3)", flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: "linear-gradient(135deg, #25476a, #2e7db5)",
        border: "3px solid rgba(255,255,255,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.34, fontWeight: "700", color: "#ffffff",
        flexShrink: 0, letterSpacing: "0.02em",
      }}
    >
      {initials || "?"}
    </div>
  );
}

function Section({ title, action, children }) {
  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</h2>
        {action}
      </div>
      <div style={{ padding: "18px 20px" }}>{children}</div>
    </div>
  );
}

// The weekly availability calendar is tall — folded until asked for.
function AvailabilitySection({ slots }) {
  const [open, setOpen] = useState(false);
  const days = new Set(slots.map((x) => x.dayOfWeek)).size;
  return (
    <Section
      title="Availability"
      action={slots.length > 0 && (
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "#2e7db5", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0 }}>
          {open ? <FiChevronUp /> : <FiChevronDown />} {open ? "Hide the week" : "Show the week"}
        </button>
      )}
    >
      {slots.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>They haven&apos;t set their availability yet.</p>
        : open ? <WeeklyAvailabilityGrid slots={slots} />
          : <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>Available on {days} day{days === 1 ? "" : "s"} a week, in {slots.length} time window{slots.length === 1 ? "" : "s"}.</p>}
    </Section>
  );
}

function DetailRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
      <span style={{ color: "#9CA3AF", flexShrink: 0, marginTop: "1px" }}>{icon}</span>
      <div>
        <p style={{ margin: "0 0 1px", fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
        <p style={{ margin: 0, fontSize: "14px", color: "#111827" }}>{value}</p>
      </div>
    </div>
  );
}

export default function TeacherViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isSchool = user?.role === "school";

  const { can } = usePermissions();
  const [params, setParams] = useSearchParams();
  const { data: teacher, isLoading, isError } = useTeacherQuery(id);
  // Their performance profile (figures, standards, publishing) — admins, staff with Educators, the hub.
  const staff = user?.role === "admin" || user?.role === "collaborator";
  const profileAllowed = isSchool || (staff && can("teachers", "view"));
  const { data: profile } = useEducatorProfile(id, { enabled: profileAllowed });
  const { data: hubs = [] } = useTeacherHubsQuery(id);
  const { data: availabilitySlots = [] } = useTeacherAvailability(id);
  const { mutate: updateTeacherStatus, isPending: statusPending } = useUpdateTeacherStatus();
  const { mutate: linkHub, isPending: isLinking } = useLinkTeacherHub();
  const { mutate: unlinkHub } = useUnlinkTeacherHub();

  const { data: ownSchoolData } = useQuery({
    queryKey: ["learningHubs", "byEmail", user?.email],
    queryFn:  () => learningHubApi.getAll({ email: user.email }),
    enabled:  isSchool && !!user?.email,
  });
  const ownSchoolId = ownSchoolData?.data?.[0]?.id;

  const { data: allHubsData } = useAllLearningHubsQuery({ status: "active" });
  const availableHubs = (allHubsData?.data || []).filter((h) => !hubs.some((linked) => linked.id === h.id));
  const [selectedHubToAdd, setSelectedHubToAdd] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmStatusToggle, setConfirmStatusToggle] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState(null);

  // Every (class, course) link for this teacher, grouped by class — replaces the old
  // classTeacherId-based "my classes" query, since a teacher's classes are now derived from
  // course-educator links rather than a single field.
  const { data: courseAssignments = [] } = useTeacherCourseAssignments(id);
  const myClassGroups = Object.values(
    courseAssignments.reduce((acc, l) => {
      if (!acc[l.classId]) acc[l.classId] = { classId: l.classId, courseIds: [] };
      acc[l.classId].courseIds.push(l.courseId);
      return acc;
    }, {})
  );

  if (isLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: "#9CA3AF", fontSize: "14px" }}>
        Loading teacher…
      </div>
    );
  }

  if (isError || !teacher) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px", display: "flex", alignItems: "center", gap: 8 }}>
        <FiAlertTriangle size={15} /> Teacher not found.
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[teacher.status] || STATUS_STYLES.inactive;
  // A website TOT sign-up waits "in training" until made active (then it can be given classes).
  const inTraining = teacher.status === "in_training";
  const willActivate = teacher.status === "inactive" || inTraining;
  // Removed (modules/removals/): kept only for the history that names them — read only.
  const removed = teacher.status === "removed";

  // The page's tabs (?tab=): what's there depends on what this viewer can see.
  const hubView = profile?.view === "hub";
  const TABS = [
    profile && { key: "overview", label: "Overview", icon: FiTrendingUp },
    profile?.standards && !hubView && { key: "standards", label: "Standards", icon: FiTarget },
    { key: "quality", label: "Quality & feedback", icon: FiShield },
    { key: "teaching", label: "Teaching", icon: FiBookOpen },
    { key: "training", label: "Training", icon: FiAward },
  ].filter(Boolean);
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : TABS[0].key;
  const setTab = (key) => {
    const next = new URLSearchParams(params);
    if (key === TABS[0].key) next.delete("tab"); else next.set("tab", key);
    setParams(next, { replace: true });
  };
  const fmtDay = (d) => (d ? new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }) : "—");
  const heroBtn = { padding: "9px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer" };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Header: who they are, how to reach them, the actions */}
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "24px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px" }}>
            <button type="button" onClick={() => navigate(teachersListPath(isSchool ? "school" : "admin", ownSchoolId))} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0 }}>
              Educators
            </button>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>/</span>
            <span style={{ color: "rgba(255,255,255,0.92)", fontSize: "13px", fontWeight: "500" }}>{teacher.firstName} {teacher.lastName}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "18px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: 0, flex: "1 1 340px" }}>
              <Avatar firstName={teacher.firstName} lastName={teacher.lastName} photo={teacher.photo} size={68} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.3px" }}>{teacher.firstName} {teacher.lastName}</h1>
                  <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }}>
                    {STATUS_LABELS[teacher.status] ?? teacher.status}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 7, fontSize: 13, color: "rgba(255,255,255,0.82)" }}>
                  {teacher.email && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, overflowWrap: "anywhere" }}><FiMail size={13} /> {teacher.email}</span>}
                  {teacher.phone && <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FiPhone size={13} /> {teacher.phone}</span>}
                  {hubs.length > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FiHome size={13} /> {hubs.map((h) => h.name).join(" · ")}</span>}
                </div>
              </div>
            </div>

            {!removed && <div style={{ display: "flex", gap: "8px", flexShrink: 0, flexWrap: "wrap" }}>
              <button type="button" onClick={() => navigate(teacherPath(user?.role, id, "edit"))} style={{ ...heroBtn, backgroundColor: "#feb139", color: "#25476a", border: "none", boxShadow: "0 2px 8px rgba(254,177,57,0.35)" }}>
                Edit educator
              </button>
              {(isAdmin || isSchool) && (
                <button type="button" onClick={() => setConfirmStatusToggle(true)} disabled={statusPending} style={{ ...heroBtn, backgroundColor: "rgba(255,255,255,0.14)", color: "#ffffff", border: "1.5px solid rgba(255,255,255,0.35)", cursor: statusPending ? "not-allowed" : "pointer" }}>
                  {inTraining ? "Make active" : willActivate ? "Activate" : "Deactivate"}
                </button>
              )}
              <button type="button" onClick={() => setConfirmDelete(true)} style={{ ...heroBtn, backgroundColor: "transparent", color: "#FECACA", border: "1.5px solid rgba(254,202,202,0.45)" }}>
                {isSchool ? "Remove from hub" : "Remove"}
              </button>
            </div>}
          </div>
        </div>
      </div>

      {removed && (
        <div role="status" style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 16px", borderRadius: 14, background: "#F3F4F6", border: "1px solid #E5E7EB", color: "#374151", fontSize: 13.5, lineHeight: 1.5 }}>
          <FiAlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <div>
            <strong>Removed{teacher.removedAt ? ` on ${fmtDay(teacher.removedAt)}` : ""}.</strong> This record is kept only for their history — claims, QA reports, parent reviews and the work they marked still show their name. It can't be changed.
          </div>
        </div>
      )}

      {/* Who created it, who changed it last (admin side only — modules/activity). */}
      <RecordStamp type="teachers" id={id} />
      {/* The figures that matter — each opens its tab */}
      {profile && <ProfileKpis profile={profile} onOpen={(key) => (TABS.some((t) => t.key === key) ? setTab(key) : null)} />}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        {/* Main column: one tab at a time */}
        <div style={{ flex: "1 1 620px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* On a phone the tabs wrap onto a second line rather than scroll out of sight. */}
          <div className="pp-tabs"><style>{"@media (max-width: 640px) { .pp-tabs .ui-tab-scroll { flex-wrap: wrap; overflow-x: visible !important; width: 100% !important; } }"}</style><Tabs label="Educator" tabs={TABS} value={tab} onChange={setTab} /></div>

          {tab === "overview" && profile && <OverviewPanel profile={profile} teacherId={id} onOpen={setTab} />}

          {tab === "standards" && profile?.standards && <StandardsCard standing={profile.standards} />}

          {tab === "quality" && (
            <>
              {profile && <QualityPanel profile={profile} showVisits={false} />}
              {/* Every visit — plan one, set up regular visits, open a report. */}
              <EducatorQaSection teacherId={id} />
              {/* Every review, named (admins and staff); averages for the hub. */}
              <ParentFeedbackSection teacherId={id} />
            </>
          )}

          {tab === "teaching" && (
            <>
              <Section title="Classes">
                {myClassGroups.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "12px 0" }}>
                    <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#9CA3AF" }}>Not assigned to any course in a class yet.</p>
                    {hubs.length === 1 && (
                      <button type="button" onClick={() => navigate(classCreatePath(user?.role, hubs[0].id))} style={{ background: "none", border: "none", color: "#25476a", fontWeight: "600", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "13px", padding: 0 }}>Create a class →</button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {myClassGroups.map((g) => (
                      <MyClassGroup key={g.classId} classId={g.classId} courseIds={g.courseIds} teacherId={id} canManage={isAdmin || isSchool} />
                    ))}
                  </div>
                )}
                {(isAdmin || isSchool) && hubs.length > 0 && <AssignCourseControl teacherId={id} hubs={hubs} qualifiedCourseIds={teacher.qualifiedCourseIds} />}
              </Section>
              {profile && <TeachingPanel profile={profile} />}
              <AvailabilitySection slots={availabilitySlots} />
            </>
          )}

          {tab === "training" && <TotTrainingCard teacherId={id} teacher={teacher} />}
        </div>

        {/* Side column: the same on every tab */}
        <div style={{ flex: "1 1 300px", maxWidth: 400, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Their public profile: publishing, the share link, families asking for them (admins, supervisor). */}
          {profile?.view === "manager" && <PublishingCard profile={profile} teacherId={id} canPublish={user?.role === "admin" || (user?.role === "collaborator" && can("teachers", "edit"))} />}

          <Section title="Learning hubs">
            {hubs.length === 0 ? (
              <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>Not assigned to any learning hub yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {hubs.map((hub) => (
                  <div key={hub.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "10px", backgroundColor: "#e8f5fb", border: "1px solid #a8d5ee" }}>
                    <span onClick={() => navigate(schoolViewPath(user?.role, hub.id))} style={{ display: "flex", color: "#25476a", flexShrink: 0, cursor: "pointer" }}><FiHome size={18} /></span>
                    <div onClick={() => navigate(schoolViewPath(user?.role, hub.id))} style={{ minWidth: 0, flex: 1, cursor: "pointer" }}>
                      <p style={{ margin: "0 0 1px", fontSize: "13.5px", fontWeight: "700", color: "#25476a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hub.name}</p>
                      <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{HUB_TYPE_LABELS[hub.hubType] || hub.hubType}{hub.address?.county ? ` · ${hub.address.county}` : ""}</p>
                    </div>
                    <button type="button" onClick={() => setUnlinkTarget(hub)} style={{ background: "none", border: "none", color: "#B91C1C", fontSize: "12px", fontWeight: "700", cursor: "pointer", fontFamily: "Inter, sans-serif", flexShrink: 0 }}>
                      Unlink
                    </button>
                  </div>
                ))}
              </div>
            )}
            {isAdmin && (
              <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #F3F4F6", display: "flex", gap: "8px" }}>
                <select value={selectedHubToAdd} onChange={(e) => setSelectedHubToAdd(e.target.value)} aria-label="Hub to add" style={{ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: "8px", border: "1.5px solid #E5E7EB", fontSize: "13px", fontFamily: "Inter, sans-serif", color: "#374151" }}>
                  <option value="">Add to a hub…</option>
                  {availableHubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
                <button
                  type="button"
                  disabled={!selectedHubToAdd || isLinking}
                  onClick={() => { linkHub({ teacherId: id, hubId: selectedHubToAdd }); setSelectedHubToAdd(""); }}
                  style={{ padding: "8px 16px", backgroundColor: !selectedHubToAdd || isLinking ? "#b8d9ee" : "#25476a", color: "#ffffff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: !selectedHubToAdd || isLinking ? "not-allowed" : "pointer", flexShrink: 0 }}
                >
                  Add
                </button>
              </div>
            )}
          </Section>

          {/* Contact, employment and the record — one card */}
          <Section title="Details" action={<button type="button" onClick={() => navigate(teacherPath(user?.role, id, "edit"))} style={{ background: "none", border: "none", color: "#2e7db5", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0 }}>Edit</button>}>
            <div style={{ display: "flex", flexDirection: "column", gap: "13px" }}>
              <DetailRow icon={<FiMail size={14} />} label="Email" value={teacher.email || "—"} />
              <DetailRow icon={<FiPhone size={14} />} label="Phone" value={teacher.phone || "—"} />
              <DetailRow label="Employment" value={EMPLOYMENT_TYPE_LABELS[teacher.employmentType || "part_time"]} />
              <DetailRow
                label="Paid"
                value={teacher.employmentType === "full_time" ? "Outside the portal, no claims" : (teacher.payRateTypes?.length ? teacher.payRateTypes : ["session"]).map((t) => PAY_RATE_LABELS[t] || t).join(", ")}
              />
              {teacher.teacherLevel && <DetailRow label="Educator level" value={TEACHER_LEVEL_LABELS[teacher.teacherLevel]} />}
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid #F3F4F6" }}>
                <DetailRow icon={<FiCalendar size={14} />} label="Added" value={fmtDay(teacher.createdAt)} />
                <DetailRow label="Last updated" value={fmtDay(teacher.updatedAt)} />
              </div>
            </div>
          </Section>
        </div>
      </div>

      <RemovePersonDialog
        open={confirmDelete && !isSchool}
        kind="teacher"
        id={id}
        name={`${teacher.firstName} ${teacher.lastName}`.trim()}
        onClose={() => setConfirmDelete(false)}
        onRemoved={() => { setConfirmDelete(false); navigate(teachersListPath("admin")); }}
      />

      {/* A hub only takes the educator off its own hub; admins remove them with RemovePersonDialog above. */}
      <ConfirmDialog
        isOpen={confirmDelete && isSchool}
        title="Remove from Hub"
        message={`"${teacher.firstName} ${teacher.lastName}" will be removed from this hub. Their account and any other hub assignments are unaffected.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          setConfirmDelete(false);
          unlinkHub({ teacherId: id, hubId: ownSchoolId }, { onSuccess: () => navigate(teachersListPath("school", ownSchoolId)) });
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        isOpen={confirmStatusToggle}
        title={inTraining ? "Make Educator Active" : willActivate ? "Activate Educator Account" : "Deactivate Educator Account"}
        message={
          inTraining
            ? `"${teacher.firstName} ${teacher.lastName}" joined through a TOT bootcamp and is still in training. Made active, they can be given classes and Home Learning families. Their training carries on as before.`
            : willActivate
            ? `"${teacher.firstName} ${teacher.lastName}" will be marked active again and regain portal access.`
            : `"${teacher.firstName} ${teacher.lastName}" will be marked inactive and lose teacher-portal access immediately. Their record, hub assignments, and class history are kept.`
        }
        confirmLabel={inTraining ? "Make active" : willActivate ? "Activate" : "Deactivate"}
        cancelLabel="Cancel"
        variant={willActivate ? "default" : "danger"}
        onConfirm={() => {
          setConfirmStatusToggle(false);
          updateTeacherStatus({ id, status: willActivate ? "active" : "inactive" });
        }}
        onCancel={() => setConfirmStatusToggle(false)}
      />

      <ConfirmDialog
        isOpen={!!unlinkTarget}
        title="Unlink Learning Hub"
        message={`"${teacher.firstName} ${teacher.lastName}" will no longer be assigned to "${unlinkTarget?.name}". Their account and any other hub assignments are unaffected.`}
        confirmLabel="Unlink"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          unlinkHub({ teacherId: id, hubId: unlinkTarget.id });
          setUnlinkTarget(null);
        }}
        onCancel={() => setUnlinkTarget(null)}
      />
    </div>
  );
}
