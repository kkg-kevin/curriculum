import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { schoolApi } from "../../schools/services/schoolApi";
import { classApi } from "../../classes/services/classApi";
import { teacherApi } from "../../teachers/services/teacherApi";
import { useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";
import { useCurriculumCoursesByGrade } from "../../curriculum/hooks/useCurriculumVersion";
import { courseHomePath } from "../../../routes/portalPaths";
import CourseCatalogGrid from "../../courses/components/CourseCatalogGrid";

const T = {
  accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1",
  ink: "#111827", inkSoft: "#374151", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB",
  tintBg: "#e8f5fb", tintBorder: "#a8d5ee",
};

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function ChevronDown({ open }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function GradeCard({ gradeName, classesForGrade, courses, teachersMap, onViewAll }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const totalLearners = classesForGrade.reduce((sum, c) => sum + (c.learnerCount || 0), 0);
  const teacherNames = [...new Set(
    classesForGrade.map((c) => c.classTeacherId ? teachersMap[c.classTeacherId] : null).filter(Boolean)
      .map((t) => `${t.firstName} ${t.lastName}`)
  )];
  const courseCount = courses.length;

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
      <div style={{ height: 4, background: `linear-gradient(90deg, ${T.accentDeep}, ${T.accentMid}, ${T.accentLight})` }} />
      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${T.accentDeep}, ${T.accentMid})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
              {gradeName?.[0]?.toUpperCase() || "G"}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.ink }}>{gradeName}</h3>
              <p style={{ margin: "1px 0 0", fontSize: 12, color: T.inkFaint }}>
                {classesForGrade.length} class{classesForGrade.length !== 1 ? "es" : ""}
              </p>
            </div>
          </div>
          <span style={{ padding: "4px 11px", borderRadius: 20, fontSize: 12, fontWeight: 700, backgroundColor: courseCount ? T.tintBg : "#F9FAFB", color: courseCount ? T.accent : T.inkFaint, border: `1px solid ${courseCount ? T.tintBorder : T.border}`, whiteSpace: "nowrap" }}>
            {courseCount} course{courseCount !== 1 ? "s" : ""}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: `1px solid #F3F4F6`, paddingTop: 10, fontSize: 13, color: T.inkMuted }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>🎓</span>
            <span>{totalLearners} learner{totalLearners !== 1 ? "s" : ""}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>👩‍🏫</span>
            {teacherNames.length ? (
              <span>{teacherNames.join(", ")}</span>
            ) : (
              <span style={{ color: T.inkFaint, fontStyle: "italic" }}>No class teacher</span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          disabled={courseCount === 0}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${expanded ? T.tintBorder : T.border}`,
            backgroundColor: expanded ? T.tintBg : "#F9FAFB", color: courseCount === 0 ? T.inkFaint : T.accent,
            fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif",
            cursor: courseCount === 0 ? "default" : "pointer",
          }}
        >
          <span>{courseCount === 0 ? "No courses yet" : "Courses"}</span>
          {courseCount > 0 && <ChevronDown open={expanded} />}
        </button>

        {expanded && courseCount > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: -4 }}>
            {courses.map((c) => (
              <div
                key={c.id}
                onClick={() => navigate(courseHomePath("school", c.id))}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, cursor: "pointer", transition: "background-color 0.12s" }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, overflow: "hidden", backgroundColor: T.tintBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
                  {c.coverImage ? <img src={c.coverImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "📚"}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                  {c.description && (
                    <p style={{ margin: 0, fontSize: 11, color: T.inkFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stripHtml(c.description)}</p>
                  )}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.accentLight, flexShrink: 0 }}>Open →</span>
              </div>
            ))}
            <button
              type="button"
              onClick={onViewAll}
              style={{ marginTop: 4, background: "none", border: "none", padding: "4px 10px", color: T.inkMuted, fontSize: 11.5, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", textAlign: "left" }}
            >
              View as full catalog →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CurriculumPage() {
  const { user } = useAuth();
  const [selectedGrade, setSelectedGrade] = useState(null);

  const { data: schoolsData, isLoading: schoolLoading } = useQuery({
    queryKey: ["schools", "byEmail", user?.email],
    queryFn: () => schoolApi.getAll({ email: user.email }),
    enabled: !!user?.email,
  });
  const school = schoolsData?.data?.[0] || null;

  const { data: curriculum } = useCurriculumQuery(school?.curriculumId);

  // Trailing "" mirrors the unfiltered default of the statusFilter state on the list pages, so
  // navigating between here and there reuses the same cache entry instead of re-fetching.
  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["classes", "bySchool", school?.id, ""],
    queryFn: () => classApi.getAll({ schoolId: school.id }),
    enabled: !!school?.id,
  });
  const classes = classesData?.data || [];
  const gradeNames = [...new Set(classes.map((c) => c.gradeName))];

  const { data: teachersData } = useQuery({
    queryKey: ["teachers", "bySchool", school?.id, ""],
    queryFn: () => teacherApi.getAll({ schoolId: school.id }),
    enabled: !!school?.id,
  });
  const teachersMap = (teachersData?.data || []).reduce((m, t) => { m[t.id] = t; return m; }, {});

  const { data: coursesByGrade, isLoading: coursesLoading } = useCurriculumCoursesByGrade(school?.curriculumId, gradeNames);

  const isLoading = schoolLoading || (!!school && classesLoading);

  const heroSubtitle = selectedGrade
    ? `${selectedGrade} · ${(coursesByGrade?.get(selectedGrade) || []).length} course${(coursesByGrade?.get(selectedGrade) || []).length !== 1 ? "s" : ""}`
    : curriculum
      ? `${curriculum.name}${curriculum.publishedAcademicYear ? ` · ${curriculum.publishedAcademicYear}` : ""}`
      : "Browse the curriculum content assigned to your school.";

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          {selectedGrade && (
            <button
              type="button"
              onClick={() => setSelectedGrade(null)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "6px 14px", backgroundColor: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 20, color: "#fff", fontSize: 12.5, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              ← All Grades
            </button>
          )}
          <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px" }}>
            {selectedGrade || "Curriculum"}
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", maxWidth: "560px" }}>
            {heroSubtitle}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Loading…</div>
      ) : !school ? (
        <div style={{ textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No school profile linked yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>
            Your account ({user?.email}) isn't linked to a school yet. Ask a platform admin to add this school using
            this same email address as its contact email.
          </p>
        </div>
      ) : !school.curriculumId ? (
        <div style={{ textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No curriculum assigned yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>Ask a platform admin to assign a curriculum to your school.</p>
        </div>
      ) : gradeNames.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No classes set up yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>Curriculum content follows your school's classes — set up a class to see its grades and courses here.</p>
        </div>
      ) : coursesLoading ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Loading…</div>
      ) : selectedGrade ? (
        <CourseCatalogGrid role="school" courses={coursesByGrade?.get(selectedGrade) || []} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {gradeNames.map((gradeName) => (
            <GradeCard
              key={gradeName}
              gradeName={gradeName}
              classesForGrade={classes.filter((c) => c.gradeName === gradeName)}
              courses={coursesByGrade?.get(gradeName) || []}
              teachersMap={teachersMap}
              onViewAll={() => setSelectedGrade(gradeName)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
