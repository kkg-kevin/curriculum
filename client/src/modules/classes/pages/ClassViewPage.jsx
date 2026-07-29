import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiStar } from "react-icons/fi";
import { useClassQuery, useDeleteClass, useClassCourseTeachers, useAssignCourseTeacher, useUnassignCourseTeacher, useSetPrimaryCourseTeacher } from "../hooks/useClasses";
import { useAllLearningHubsQuery, useHubTeachersQuery } from "../../learning-hubs/hooks/useLearningHub";
import { useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";
import { useCurriculumCurrentCourses } from "../../curriculum/hooks/useCurriculumVersion";
import { useQuery } from "@tanstack/react-query";
import { learnerApi } from "../../learners/services/learnerApi";
import { useAuth } from "../../../context/AuthContext";
import { classesListPath, classPath, learnerPath, learnerCreatePath } from "../../../routes/portalPaths";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import { formatClassName } from "../utils/classDisplay";

function DetailRow({ label, value, empty = "—" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>{value || empty}</span>
    </div>
  );
}

// One course chip's educator badges + inline assign control — a course can have more than one
// co-teacher (full access), replacing the old single Class.classTeacherId, but exactly one of
// them is flagged primary — the educator of record shown first with a filled star; the rest are
// secondary co-teachers with a hollow star to promote themselves into that spot.
function CourseEducatorRow({ classId, course, links, hubTeachers, onAssign, onUnassign, onSetPrimary, isAssigning, isSettingPrimary }) {
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const assignedIds = new Set(links.map((l) => l.teacherId));
  const available = (hubTeachers || []).filter((t) => !assignedIds.has(t.id));
  const sortedLinks = [...links].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));

  return (
    <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#111827" }}>{course.name}</p>
      {sortedLinks.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {sortedLinks.map((l) => (
            <span
              key={l.teacherId}
              title={l.isPrimary ? "Primary — currently teaching" : "Secondary co-teacher"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 600,
                backgroundColor: l.isPrimary ? "#25476a" : "#e8f5fb",
                border: `1px solid ${l.isPrimary ? "#25476a" : "#a8d5ee"}`,
                color: l.isPrimary ? "#ffffff" : "#25476a",
              }}
            >
              {sortedLinks.length > 1 && (
                <button
                  type="button"
                  disabled={l.isPrimary || isSettingPrimary}
                  onClick={() => onSetPrimary(course.id, l.teacherId)}
                  style={{ display: "flex", background: "none", border: "none", padding: 0, color: "inherit", cursor: l.isPrimary ? "default" : "pointer" }}
                  title={l.isPrimary ? "Primary — currently teaching" : "Make primary"}
                >
                  <FiStar size={12} strokeWidth={2} fill={l.isPrimary ? "currentColor" : "none"} />
                </button>
              )}
              {l.teacher.firstName} {l.teacher.lastName}
              <button type="button" onClick={() => onUnassign(course.id, l.teacherId)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }} title="Unassign">×</button>
            </span>
          ))}
        </div>
      )}
      {available.length > 0 && (
        <div style={{ display: "flex", gap: 6 }}>
          <select
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            style={{ flex: 1, padding: "6px 8px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12, fontFamily: "Inter, sans-serif", color: "#374151", backgroundColor: "#F9FAFB" }}
          >
            <option value="">+ Assign educator…</option>
            {available.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
          </select>
          <button
            type="button"
            disabled={!selectedTeacherId || isAssigning}
            onClick={() => { onAssign(course.id, selectedTeacherId); setSelectedTeacherId(""); }}
            style={{ padding: "6px 12px", backgroundColor: !selectedTeacherId || isAssigning ? "#b8d9ee" : "#25476a", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: !selectedTeacherId || isAssigning ? "not-allowed" : "pointer" }}
          >
            Assign
          </button>
        </div>
      )}
    </div>
  );
}

function CapacityRow({ enrolled, capacity }) {
  if (!capacity) {
    return <DetailRow label="Capacity" value={`${enrolled} enrolled · Unlimited`} />;
  }
  const pct = Math.min(100, Math.round((enrolled / capacity) * 100));
  const color = enrolled >= capacity ? "#EF4444" : pct >= 80 ? "#feb139" : "#38aae1";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Capacity</span>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>{enrolled} / {capacity} enrolled</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, backgroundColor: "#F3F4F6", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 4, backgroundColor: color, transition: "width 0.2s" }} />
      </div>
    </div>
  );
}

export default function ClassViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: cls, isLoading } = useClassQuery(id);
  const { mutate: deleteClass } = useDeleteClass();
  const { data: schoolsData } = useAllLearningHubsQuery({ hubType: "school" });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: curriculum }   = useCurriculumQuery(cls?.curriculumId);

  // What this class inherited from the curriculum — courses currently assigned to its grade,
  // across every period (there's no reliable "current term" signal, see getCurrentCourses).
  const { data: classCourses, isLoading: coursesLoading } = useCurriculumCurrentCourses(cls?.curriculumId, cls?.gradeId);

  const { data: hubTeachers } = useHubTeachersQuery(cls?.schoolId);

  // Which educator(s) teach each of this class's courses — replaces the old single
  // Class.classTeacherId, a class can now have a different set of educators per course.
  const { data: courseTeacherLinks = [] } = useClassCourseTeachers(cls?.id);
  const { mutate: assignCourseTeacher, isPending: isAssigning } = useAssignCourseTeacher();
  const { mutate: unassignCourseTeacher } = useUnassignCourseTeacher();
  const { mutate: setPrimaryCourseTeacher, isPending: isSettingPrimary } = useSetPrimaryCourseTeacher();

  const { data: learnersData } = useQuery({
    queryKey: ["learners", "byClass", cls?.id],
    queryFn: () => learnerApi.getAll({ classId: cls.id }),
    enabled: !!cls?.id,
  });
  const classLearners = learnersData?.data || [];

  if (isLoading) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#6B7280" }}>Loading…</div>;
  }
  if (!cls) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#EF4444" }}>Class not found.</div>;
  }

  const schoolsMap = (schoolsData?.data || []).reduce((m, s) => { m[s.id] = s; return m; }, {});

  const school = schoolsMap[cls.schoolId];
  const linksByCourseId = (classCourses || []).reduce((m, c) => {
    m[c.id] = courseTeacherLinks.filter((l) => l.courseId === c.id);
    return m;
  }, {});

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <button type="button" onClick={() => navigate(classesListPath(user?.role, cls.schoolId))} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          ← Classes
        </button>
        <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
        {school && (
          <>
            <button type="button" onClick={() => navigate(classesListPath(user?.role, cls.schoolId))} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              {school.name}
            </button>
            <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
          </>
        )}
        <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{formatClassName(cls)}</span>
      </div>

      {/* Header card */}
      <div style={{ background: `linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)`, borderRadius: 20, padding: "28px 32px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>🏫</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 900, color: "#ffffff" }}>{formatClassName(cls)}</h1>
                {cls.tag && (
                  <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, backgroundColor: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#ffffff" }}>
                    {cls.tag}
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.72)" }}>Academic Year {cls.academicYear} · {cls.status === "active" ? "Active" : "Inactive"}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => navigate(classPath(user?.role, id, "edit"))}
              style={{ padding: "10px 20px", backgroundColor: "rgba(255,255,255,0.15)", color: "#ffffff", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              style={{ padding: "10px 20px", backgroundColor: "rgba(239,68,68,0.2)", color: "#FCA5A5", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Class Info</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DetailRow label="School"        value={school?.name} />
            <DetailRow label="Curriculum"    value={curriculum?.name} />
            <DetailRow label="Grade"         value={cls.gradeName} />
            <DetailRow label="Stream"        value={cls.streamName} empty="Not set" />
            <DetailRow label="Academic Year" value={cls.academicYear} />
            <DetailRow label="Tag"           value={cls.tag} empty="Not set" />
            <CapacityRow enrolled={classLearners.length} capacity={cls.capacity} />
            <DetailRow label="Status"        value={cls.status === "active" ? "Active" : "Inactive"} />
          </div>
        </div>

        {/* Courses this class inherited from the curriculum, with per-course educator assignment */}
        <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Courses & Educators</h3>
            {!coursesLoading && (
              <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: "#e8f5fb", color: "#25476a", border: "1px solid #a8d5ee" }}>{classCourses?.length || 0}</span>
            )}
          </div>
          {!cls.curriculumId ? (
            <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>No curriculum assigned to this class's school yet.</p>
          ) : coursesLoading ? (
            <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>Loading…</p>
          ) : !classCourses?.length ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#9CA3AF" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📚</div>
              <p style={{ margin: 0, fontSize: 13 }}>No courses assigned to {cls.gradeName} yet in this curriculum.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {classCourses.map((c) => (
                <CourseEducatorRow
                  key={c.id}
                  classId={cls.id}
                  course={c}
                  links={linksByCourseId[c.id] || []}
                  hubTeachers={hubTeachers}
                  isAssigning={isAssigning}
                  isSettingPrimary={isSettingPrimary}
                  onAssign={(courseId, teacherId) => assignCourseTeacher({ classId: cls.id, courseId, teacherId })}
                  onUnassign={(courseId, teacherId) => unassignCourseTeacher({ classId: cls.id, courseId, teacherId })}
                  onSetPrimary={(courseId, teacherId) => setPrimaryCourseTeacher({ classId: cls.id, courseId, teacherId })}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Learners in this class */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Learners</h3>
            <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: "#e8f5fb", color: "#25476a", border: "1px solid #a8d5ee" }}>{classLearners.length}</span>
          </div>
          {classLearners.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#9CA3AF" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🎒</div>
              <p style={{ margin: "0 0 12px", fontSize: 13 }}>No learners enrolled in this class yet.</p>
              <button type="button" onClick={() => navigate(learnerCreatePath(user?.role, cls.schoolId))} style={{ padding: "8px 16px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Enroll Learner</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {classLearners.slice(0, 8).map((l) => (
                <div key={l.id} onClick={() => navigate(learnerPath(user?.role, l.id, "view"))}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 10, border: "1px solid #E5E7EB", cursor: "pointer", transition: "background-color 0.12s" }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, #1a3550, #25476a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                      {(l.firstName?.[0] || "") + (l.lastName?.[0] || "")}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#111827" }}>{l.firstName} {l.lastName}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF" }}>{l.admissionNumber}</p>
                    </div>
                  </div>
                </div>
              ))}
              {classLearners.length > 8 && (
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>+{classLearners.length - 8} more</p>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete Class"
        message={`"${formatClassName(cls)} — ${cls.academicYear}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          setConfirmDelete(false);
          deleteClass(id, { onSuccess: () => navigate(classesListPath(user?.role, cls.schoolId)) });
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
