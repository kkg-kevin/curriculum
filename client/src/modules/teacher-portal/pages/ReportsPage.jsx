import { useMemo } from "react";
import {
  CheckCircle as CheckCircleIcon,
  Description as DescriptionIcon,
  HourglassEmpty as HourglassEmptyIcon,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { classApi } from "../../classes/services/classApi";
import { useClassCourses } from "../../curriculum/hooks/useCurriculumVersion";
import { reportApi } from "../../reports/services/reportApi";
import { CourseReportCard, T, cardStyle, reportStats } from "../../reports/components/CourseReportCards";

// The course report cards (sessions, module reports, final report, every action on them) are shared
// with the admin and hub class page — reports/components/CourseReportCards.jsx (19 Nov 2026).
const reportPath = (id) => `/teacher-portal/reports/${id}`;

function KpiTile({ icon, num, label, sub }) {
  return (
    <div style={{ ...cardStyle, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: T.tintBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.accent, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{num}</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: T.inkMuted }}>{label}</p>
        {sub && <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.inkFaint }}>{sub}</p>}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { teacher, teacherLoading, selectedHub, selectedHubId } = useOutletContext();

  const { data: classesData, isLoading: classesLoading, isError: classesError } = useQuery({
    queryKey: ["classes", "byTeacherHub", teacher?.id, selectedHubId],
    queryFn:  () => classApi.getAll({ teacherId: teacher.id, schoolId: selectedHubId }),
    enabled:  !!teacher?.id && !!selectedHubId,
  });
  const myClasses = classesData?.data || [];

  // Each class's courses from its own curriculum (the Home Learning hub has none of its own).
  const { forClass } = useClassCourses(myClasses, selectedHub?.curriculumId);

  const classCoursePairs = useMemo(() => {
    const pairs = [];
    myClasses.forEach((cls) => {
      forClass(cls).forEach((course) => pairs.push({ cls, course }));
    });
    return pairs;
  }, [myClasses, forClass]);

  // One batched request per class (returning { [courseId]: rows }) rather than one per
  // class × course pair — a teacher with several classes each exposing several courses was
  // firing dozens of parallel requests just to paint this page.
  const courseIdsByClass = useMemo(() => {
    const map = new Map();
    classCoursePairs.forEach(({ cls, course }) => {
      if (!map.has(cls.id)) map.set(cls.id, []);
      map.get(cls.id).push(course.id);
    });
    return map;
  }, [classCoursePairs]);

  const classIdsWithCourses = [...courseIdsByClass.keys()];
  const readinessResults = useQueries({
    queries: classIdsWithCourses.map((classId) => {
      const courseIds = courseIdsByClass.get(classId);
      return {
        queryKey: ["reports", "readiness", "batch", classId, [...courseIds].sort().join(",")],
        queryFn:  () => reportApi.getReadinessBatch(classId, courseIds),
        enabled:  courseIds.length > 0,
      };
    }),
  });

  const readinessByClass = useMemo(() => {
    const map = new Map();
    classIdsWithCourses.forEach((classId, i) => map.set(classId, readinessResults[i]?.data?.data || {}));
    return map;
  }, [classIdsWithCourses, readinessResults]);

  const sections = classCoursePairs.map(({ cls, course }) => ({
    cls, course, rows: readinessByClass.get(cls.id)?.[course.id] || [],
  })).filter((s) => s.rows.length > 0);

  // Session reports sent, certificates issued, certificates that can be generated now.
  const stats = reportStats(sections);

  const isLoading = teacherLoading || (!!teacher && (classesLoading || readinessResults.some((r) => r.isLoading)));
  const isError = classesError || readinessResults.some((r) => r.isError);

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }
  // Distinct from the empty state below — a failed request otherwise renders as "no learners
  // eligible yet", which reads as a real (and wrong) answer rather than a problem to retry.
  if (isError) {
    return (
      <div style={{ ...cardStyle, padding: "16px 18px", margin: "8px 0", border: "1px solid #FECACA", backgroundColor: "#FEF2F2", color: "#B91C1C", fontSize: 13, fontFamily: "Inter, sans-serif" }}>
        Couldn't load report readiness — try refreshing the page.
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "28px 32px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>Course Reports</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", maxWidth: 620 }}>
            Each session's report goes to the learner and their family by itself once its work is marked. At the last session of a module — and of the course — generate the learners' certificates here.
          </p>
        </div>
      </div>

      <div className="tp-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <KpiTile icon={<DescriptionIcon fontSize="small" />} num={stats.sent} label="Session reports sent" sub="To learners and families" />
        <KpiTile icon={<HourglassEmptyIcon fontSize="small" />} num={stats.toGenerate} label="Certificates to generate" sub="Module or course has reached its last session" />
        <KpiTile icon={<CheckCircleIcon fontSize="small" />} num={stats.issued} label="Certificates issued" sub="Module and course certificates" />
      </div>


      {sections.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No learners eligible yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Reports appear here once your classes' courses have at least one attached assessment.</p>
        </div>
      ) : (
        sections.map(({ cls, course, rows }) => (
          <CourseReportCard key={`${cls.id}:${course.id}`} cls={cls} course={course} rows={rows} reportPath={reportPath} />
        ))
      )}
    </div>
  );
}
