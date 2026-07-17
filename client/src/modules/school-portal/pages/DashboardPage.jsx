import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { locationApi as schoolApi } from "../../locations/services/locationApi";
import { classApi } from "../../classes/services/classApi";
import { teacherApi } from "../../teachers/services/teacherApi";
import { learnerApi } from "../../learners/services/learnerApi";
import { useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";
import { useCurriculumCoursesByGrade } from "../../curriculum/hooks/useCurriculumVersion";
import { teacherCreatePath, learnerCreatePath, classesListPath, classPath, teachersListPath, learnersListPath, courseCatalogPath } from "../../../routes/portalPaths";

const T = {
  accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1",
  cta: "#feb139", tintBg: "#e8f5fb", tintBorder: "#a8d5ee",
  ink: "#111827", inkSoft: "#374151", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB",
  good: "#059669", goodBg: "#ECFDF5", goodBorder: "#A7F3D0",
  warn: "#92400E", warnBg: "#FFFBEB", warnBorder: "#FCD34D",
};

const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

function joinNatural(items) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function timeAgo(dateStr) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString();
}

function AttentionItem({ icon, text, actionLabel, onAction }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", backgroundColor: T.warnBg, border: `1px solid ${T.warnBorder}`, borderRadius: 10, fontSize: 13 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 10, color: T.inkSoft }}>
        <span style={{ fontSize: 15 }}>{icon}</span> {text}
      </span>
      <button type="button" onClick={onAction} style={{ background: "none", border: "none", padding: 0, color: T.accent, fontWeight: 700, fontSize: 12.5, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}>
        {actionLabel} →
      </button>
    </div>
  );
}

function KpiCard({ icon, num, label, sub, meterPct, warnMeter, onClick }) {
  return (
    <div onClick={onClick} style={{ ...cardStyle, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10, cursor: onClick ? "pointer" : "default" }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, backgroundColor: T.tintBg }}>{icon}</div>
      <div>
        <p style={{ margin: 0, fontSize: 30, fontWeight: 800, color: T.ink, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{num}</p>
        <p style={{ margin: "4px 0 0", fontSize: 12.5, fontWeight: 600, color: T.inkMuted }}>{label}</p>
        <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.inkFaint }}>{sub}</p>
      </div>
      {meterPct != null && (
        <div style={{ height: 5, borderRadius: 3, backgroundColor: T.border, overflow: "hidden", marginTop: 2 }}>
          <div style={{ height: "100%", borderRadius: 3, width: `${meterPct}%`, backgroundColor: warnMeter ? T.cta : T.accentLight }} />
        </div>
      )}
    </div>
  );
}

function ActionButton({ primary, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 11,
        fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer",
        border: `1.5px solid ${primary ? T.cta : T.tintBorder}`,
        backgroundColor: primary ? T.cta : T.tintBg,
        color: primary ? T.accent : T.accent,
      }}
    >
      {children}
    </button>
  );
}

// Single-hue, length-encoded magnitude bar (matches KpiCard's meter and ClassViewPage's
// CapacityRow elsewhere in this app) — thin, rounded, with a direct value label rather than
// a bare boolean fill, since "how many" is more useful here than "any at all."
function MagnitudeBar({ label, value, max, valueLabel, color = T.accentLight }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 92, flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: T.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: T.border, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 4, width: `${pct}%`, backgroundColor: color, transition: "width 0.2s" }} />
      </div>
      <span style={{ width: 64, flexShrink: 0, textAlign: "right", fontSize: 12, fontWeight: 700, color: T.inkMuted, fontVariantNumeric: "tabular-nums" }}>{valueLabel}</span>
    </div>
  );
}

function StatusChip({ good, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: good ? T.goodBg : T.warnBg, color: good ? T.good : T.warn, border: `1px solid ${good ? T.goodBorder : T.warnBorder}` }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "currentColor" }} />
      {children}
    </span>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: schoolsData, isLoading: schoolLoading } = useQuery({
    queryKey: ["schools", "byEmail", user?.email],
    queryFn: () => schoolApi.getAll({ email: user.email }),
    enabled: !!user?.email,
  });
  const school = schoolsData?.data?.[0] || null;

  const { data: curriculum } = useCurriculumQuery(school?.curriculumId);
  // Trailing "" mirrors the unfiltered default of the statusFilter state on the list pages
  // (SchoolClassesPage/SchoolTeachersPage/SchoolLearnersPage), so navigating between here and
  // there reuses the same cache entry instead of re-fetching.
  const { data: classesData }  = useQuery({ queryKey: ["classes", "bySchool", school?.id, ""],  queryFn: () => classApi.getAll({ schoolId: school.id }),  enabled: !!school?.id });
  const { data: teachersData } = useQuery({ queryKey: ["teachers", "bySchool", school?.id, ""], queryFn: () => teacherApi.getAll({ schoolId: school.id }), enabled: !!school?.id });
  const { data: learnersData } = useQuery({ queryKey: ["learners", "bySchool", school?.id, ""], queryFn: () => learnerApi.getAll({ schoolId: school.id }), enabled: !!school?.id });

  const classes  = classesData?.data  || [];
  const teachers = teachersData?.data || [];
  const learners = learnersData?.data || [];

  const gradeNames = [...new Set(classes.map((c) => c.gradeName))];
  const { data: coursesByGrade } = useCurriculumCoursesByGrade(school?.curriculumId, gradeNames);

  const teachersMap = teachers.reduce((m, t) => { m[t.id] = t; return m; }, {});
  const classesMap  = classes.reduce((m, c) => { m[c.id] = c; return m; }, {});

  const classesWithTeacher = classes.filter((c) => !!c.classTeacherId);
  const classesWithoutTeacher = classes.filter((c) => !c.classTeacherId);
  const gradesWithoutCourses = gradeNames.filter((g) => (coursesByGrade?.get(g) || []).length === 0);
  const classesWithCourseCount = gradeNames.length - gradesWithoutCourses.length;
  const activeTeachers = teachers.filter((t) => t.status === "active");
  const learnersMissingGuardianEmail = learners.filter((l) => !l.guardianEmail);

  const totalCapacity = classes.reduce((sum, c) => sum + (c.capacity || 0), 0);

  const recentActivity = [
    ...teachers.map((t) => ({ id: `t-${t.id}`, initials: `${t.firstName?.[0] || ""}${t.lastName?.[0] || ""}`.toUpperCase(), name: `${t.firstName} ${t.lastName}`, sub: "Teacher added", createdAt: t.createdAt })),
    ...learners.map((l) => ({ id: `l-${l.id}`, initials: `${l.firstName?.[0] || ""}${l.lastName?.[0] || ""}`.toUpperCase(), name: `${l.firstName} ${l.lastName}`, sub: `Enrolled — ${classesMap[l.classId]?.gradeName || "No class"}`, createdAt: l.createdAt })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

  if (!schoolLoading && !school) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif" }}>
        <div style={{ textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>🏫</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No school profile linked yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280", lineHeight: 1.6, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
            Your account ({user?.email}) isn't linked to a school yet. Ask a platform admin to add this school using
            this same email address as its contact email.
          </p>
        </div>
      </div>
    );
  }

  if (schoolLoading || !school) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "28px 32px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
              {school.name?.[0]?.toUpperCase() || "S"}
            </div>
            <div>
              <h1 style={{ margin: "0 0 6px", fontSize: 25, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>{school.name}</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, color: "rgba(255,255,255,0.78)" }}>
                <span>{school.code}{school.address?.county ? ` · ${school.address.county} County` : ""}</span>
                {curriculum && <><span style={{ opacity: 0.5 }}>·</span><span>{curriculum.name}</span></>}
                {curriculum?.publishedAcademicYear && <><span style={{ opacity: 0.5 }}>·</span><span>{curriculum.publishedAcademicYear}</span></>}
              </div>
            </div>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: "rgba(255,255,255,0.16)", color: "#fff" }}>
            {school.status === "active" && <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#5EEAD4" }} />}
            {school.status === "active" ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      {/* Needs Attention */}
      {(classesWithoutTeacher.length > 0 || gradesWithoutCourses.length > 0 || learnersMissingGuardianEmail.length > 0) && (
        <div style={{ ...cardStyle, border: `1.5px solid ${T.warnBorder}`, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 15 }}>⚠️</span>
            <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.warn }}>Needs Attention</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {classesWithoutTeacher.length > 0 && (
              <AttentionItem
                icon="👩‍🏫"
                text={`${joinNatural(classesWithoutTeacher.map((c) => c.gradeName))} ${classesWithoutTeacher.length === 1 ? "has" : "have"} no class teacher assigned`}
                actionLabel="Assign"
                onAction={() => navigate(classesListPath("school", school.id))}
              />
            )}
            {gradesWithoutCourses.length > 0 && (
              <AttentionItem
                icon="📚"
                text={`${joinNatural(gradesWithoutCourses)} ${gradesWithoutCourses.length === 1 ? "has" : "have"} no courses from the curriculum yet`}
                actionLabel="Review"
                onAction={() => navigate(classesListPath("school", school.id))}
              />
            )}
            {learnersMissingGuardianEmail.length > 0 && (
              <AttentionItem
                icon="✉️"
                text={`${learnersMissingGuardianEmail.length} learner${learnersMissingGuardianEmail.length === 1 ? "" : "s"} missing a guardian email — they won't be able to access the learner portal`}
                actionLabel="Review"
                onAction={() => navigate(learnersListPath("school", school.id))}
              />
            )}
          </div>
        </div>
      )}

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <KpiCard
          icon="📚" num={classes.length} label="Classes"
          sub={classes.length === 0 ? "None set up yet" : `${classesWithTeacher.length} of ${classes.length} has a teacher`}
          meterPct={classes.length ? (classesWithTeacher.length / classes.length) * 100 : null}
          warnMeter={classesWithTeacher.length < classes.length}
          onClick={() => navigate(classesListPath("school", school.id))}
        />
        <KpiCard
          icon="👩‍🏫" num={teachers.length} label="Teachers"
          sub={teachers.length === 0 ? "None added yet" : `${activeTeachers.length} active`}
          meterPct={teachers.length ? (activeTeachers.length / teachers.length) * 100 : null}
          warnMeter={false}
          onClick={() => navigate(teachersListPath("school", school.id))}
        />
        <KpiCard
          icon="🎓" num={learners.length} label="Learners"
          sub={totalCapacity > 0 ? `${Math.min(100, Math.round((learners.length / totalCapacity) * 100))}% of total capacity` : `Enrolled across ${classes.length} class${classes.length === 1 ? "" : "es"}`}
          meterPct={totalCapacity > 0 ? Math.min(100, (learners.length / totalCapacity) * 100) : null}
          warnMeter={totalCapacity > 0 && learners.length >= totalCapacity}
          onClick={() => navigate(learnersListPath("school", school.id))}
        />
        <KpiCard
          icon="🧩" num={`${classesWithCourseCount} / ${gradeNames.length || 0}`} label="Curriculum Coverage"
          sub="Classes with courses assigned"
          meterPct={gradeNames.length ? (classesWithCourseCount / gradeNames.length) * 100 : null}
          warnMeter={classesWithCourseCount < gradeNames.length}
          onClick={() => navigate(classesListPath("school", school.id))}
        />
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <ActionButton primary onClick={() => navigate(teacherCreatePath("school", school.id))}>＋ Add Teacher</ActionButton>
        <ActionButton primary onClick={() => navigate(learnerCreatePath("school", school.id))}>＋ Enroll Learner</ActionButton>
        <ActionButton onClick={() => navigate(classesListPath("school", school.id))}>📅 Set Up Year</ActionButton>
        <ActionButton onClick={() => navigate(courseCatalogPath("school"))}>📘 Browse Curriculum</ActionButton>
      </div>

      {/* Two column: classes breakdown + recent activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1.65fr 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ ...cardStyle, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.accentLight }}>Classes</p>
            <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: T.tintBg, color: T.accent, border: `1px solid ${T.tintBorder}` }}>
              {classes.length} class{classes.length === 1 ? "" : "es"}
            </span>
          </div>
          {classes.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: T.inkFaint, textAlign: "center", padding: "24px 0" }}>No classes set up yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Grade", "Class Teacher", "Learners", "Courses", "Status"].map((h) => (
                      <th key={h} style={{ textAlign: "left", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.inkFaint, padding: "0 10px 8px", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classes.map((c) => {
                    const teacher = c.classTeacherId ? teachersMap[c.classTeacherId] : null;
                    const courseCount = (coursesByGrade?.get(c.gradeName) || []).length;
                    const isSetUp = !!teacher && courseCount > 0;
                    return (
                      <tr key={c.id} onClick={() => navigate(classPath("school", c.id, "view"))} style={{ cursor: "pointer" }}>
                        <td style={{ padding: "11px 10px", borderBottom: `1px solid ${T.border}` }}>
                          <span style={{ fontWeight: 700, color: T.ink }}>{c.gradeName}</span>
                          <span style={{ display: "block", fontWeight: 400, color: T.inkFaint, fontSize: 11.5 }}>{c.academicYear}</span>
                        </td>
                        <td style={{ padding: "11px 10px", borderBottom: `1px solid ${T.border}`, color: teacher ? T.inkSoft : T.inkFaint, fontStyle: teacher ? "normal" : "italic" }}>
                          {teacher ? `${teacher.firstName} ${teacher.lastName}` : "Unassigned"}
                        </td>
                        <td style={{ padding: "11px 10px", borderBottom: `1px solid ${T.border}`, fontVariantNumeric: "tabular-nums" }}>
                          {c.learnerCount ?? 0} · {c.capacity ? c.capacity : "unlimited"}
                        </td>
                        <td style={{ padding: "11px 10px", borderBottom: `1px solid ${T.border}`, color: courseCount === 0 ? T.inkFaint : T.inkSoft }}>
                          {courseCount === 0 ? "No courses" : `${courseCount} course${courseCount === 1 ? "" : "s"}`}
                        </td>
                        <td style={{ padding: "11px 10px", borderBottom: `1px solid ${T.border}` }}>
                          <StatusChip good={isSetUp}>{isSetUp ? "Set up" : "Needs setup"}</StatusChip>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ ...cardStyle, padding: "20px 22px" }}>
          <p style={{ margin: "0 0 14px", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.accentLight }}>Recent Activity</p>
          {recentActivity.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: T.inkFaint, textAlign: "center", padding: "16px 0" }}>Nothing yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {recentActivity.map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 4px" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", background: `linear-gradient(135deg, ${T.accentDeep}, ${T.accentMid})` }}>
                    {a.initials || "?"}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 12.5 }}><span style={{ fontWeight: 700, color: T.ink }}>{a.name}</span> {a.sub.startsWith("Enrolled") ? `— ${a.sub.replace("Enrolled — ", "enrolled — ")}` : `— ${a.sub}`}</p>
                    <p style={{ margin: "1px 0 0", fontSize: 11, color: T.inkFaint }}>{timeAgo(a.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grade Overview: enrollment + curriculum coverage, side by side per grade */}
      {gradeNames.length > 0 && (
        <div style={{ ...cardStyle, padding: "20px 22px" }}>
          <p style={{ margin: "0 0 16px", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.accentLight }}>Grade Overview</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px 32px" }}>
            {gradeNames.map((g) => {
              const gradeClasses = classes.filter((c) => c.gradeName === g);
              const enrolled = gradeClasses.reduce((sum, c) => sum + (c.learnerCount || 0), 0);
              const capacity = gradeClasses.reduce((sum, c) => sum + (c.capacity || 0), 0);
              const courseCount = (coursesByGrade?.get(g) || []).length;
              const maxCourses = Math.max(1, ...gradeNames.map((gg) => (coursesByGrade?.get(gg) || []).length));
              return (
                <div key={g} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <MagnitudeBar
                    label={g}
                    value={enrolled}
                    max={capacity || Math.max(1, enrolled)}
                    valueLabel={capacity ? `${enrolled}/${capacity}` : `${enrolled}`}
                    color={capacity && enrolled >= capacity ? T.cta : T.accentLight}
                  />
                  <MagnitudeBar
                    label="Courses"
                    value={courseCount}
                    max={maxCourses}
                    valueLabel={`${courseCount}`}
                    color={courseCount === 0 ? T.warn : T.good}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
