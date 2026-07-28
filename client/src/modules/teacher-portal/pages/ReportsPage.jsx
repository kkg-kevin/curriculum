import { useMemo, useState } from "react";
import {
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Description as DescriptionIcon,
  HourglassEmpty as HourglassEmptyIcon,
  Visibility as VisibilityIcon,
} from "@mui/icons-material";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { classApi } from "../../classes/services/classApi";
import { useCurriculumCoursesByGrade } from "../../curriculum/hooks/useCurriculumVersion";
import { reportApi } from "../../reports/services/reportApi";
import { useGenerateReport } from "../../reports/hooks/useReports";

const T = {
  accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1",
  tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB",
};
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

const STATUS_CONFIG = {
  not_ready: { label: "Not Ready", bg: "#F9FAFB", color: T.inkMuted, border: T.border },
  ready:     { label: "Ready to Generate", bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" },
  draft:     { label: "Draft", bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA" },
  published: { label: "Published", bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
};

function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.not_ready;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: s.bg, color: s.color, border: `1.5px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

function rowStatus(row) {
  if (row.report?.status === "published") return "published";
  if (row.report?.status === "draft") return "draft";
  return row.ready ? "ready" : "not_ready";
}

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

function ReportRow({ row, cls, course, onGenerate, isGenerating, navigate }) {
  const status = rowStatus(row);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: `1px solid #F9FAFB` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 700, color: T.ink }}>{row.learner.firstName} {row.learner.lastName}</p>
        <p style={{ margin: 0, fontSize: 11.5, color: T.inkFaint }}>{course.name} · {row.gradedCount}/{row.requiredCount} assessments graded</p>
      </div>
      <StatusBadge status={status} />
      {status === "ready" && (
        <button
          type="button"
          onClick={() => onGenerate({ learnerId: row.learner.id, courseId: course.id, classId: cls.id })}
          disabled={isGenerating}
          style={{ padding: "6px 14px", backgroundColor: isGenerating ? "#F9FAFB" : "#feb139", color: "#25476a", border: "none", borderRadius: 20, fontSize: 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: isGenerating ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
        >
          Generate
        </button>
      )}
      {(status === "draft" || status === "published") && (
        <button
          type="button"
          onClick={() => navigate(`/teacher-portal/reports/${row.report.id}`)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", backgroundColor: T.tintBg, color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 20, fontSize: 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          <VisibilityIcon sx={{ fontSize: 13 }} /> {status === "draft" ? "Review" : "View"}
        </button>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const { teacher, teacherLoading, selectedHub, selectedHubId } = useOutletContext();

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["classes", "byTeacherHub", teacher?.id, selectedHubId],
    queryFn:  () => classApi.getAll({ classTeacherId: teacher.id, schoolId: selectedHubId }),
    enabled:  !!teacher?.id && !!selectedHubId,
  });
  const myClasses = classesData?.data || [];
  const gradeIds = [...new Set(myClasses.map((c) => c.gradeId))];

  const { data: coursesByGrade } = useCurriculumCoursesByGrade(selectedHub?.curriculumId, gradeIds);

  const classCoursePairs = useMemo(() => {
    const pairs = [];
    myClasses.forEach((cls) => {
      (coursesByGrade?.get(cls.gradeId) || []).forEach((course) => pairs.push({ cls, course }));
    });
    return pairs;
  }, [myClasses, coursesByGrade]);

  const readinessResults = useQueries({
    queries: classCoursePairs.map(({ cls, course }) => ({
      queryKey: ["reports", "readiness", cls.id, course.id],
      queryFn:  () => reportApi.getReadiness(cls.id, course.id),
      enabled:  !!cls.id && !!course.id,
    })),
  });

  const sections = classCoursePairs.map(({ cls, course }, index) => ({
    cls, course, rows: readinessResults[index]?.data?.data || [],
  })).filter((s) => s.rows.length > 0);

  const allRows = sections.flatMap((s) => s.rows.map((r) => ({ ...r, cls: s.cls, course: s.course })));
  const readyCount = allRows.filter((r) => rowStatus(r) === "ready").length;
  const draftCount = allRows.filter((r) => rowStatus(r) === "draft").length;
  const publishedCount = allRows.filter((r) => rowStatus(r) === "published").length;

  const { mutate: generateReport, isPending: generating, variables: generatingVars } = useGenerateReport();
  const isGeneratingRow = (row) => generating && generatingVars?.learnerId === row.learner.id && generatingVars?.courseId === row.course.id;

  const handleGenerate = (payload) => {
    generateReport(payload, { onSuccess: (report) => navigate(`/teacher-portal/reports/${report.id}`) });
  };

  const isLoading = teacherLoading || (!!teacher && (classesLoading || readinessResults.some((r) => r.isLoading)));

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "28px 32px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>Course Reports</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", maxWidth: 620 }}>
            Once every assessment in a course is graded for a learner, generate their report card here, add remarks, then publish it for the learner and guardian to see.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <KpiTile icon={<HourglassEmptyIcon fontSize="small" />} num={readyCount} label="Ready to generate" sub="Every assessment graded" />
        <KpiTile icon={<DescriptionIcon fontSize="small" />} num={draftCount} label="Drafts" sub="Awaiting your review" />
        <KpiTile icon={<CheckCircleIcon fontSize="small" />} num={publishedCount} label="Published" sub="Visible to learner & guardian" />
      </div>

      {sections.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No learners eligible yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Reports appear here once your classes' courses have at least one attached assessment.</p>
        </div>
      ) : (
        sections.map(({ cls, course, rows }) => (
          <div key={`${cls.id}:${course.id}`} style={{ ...cardStyle, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
              <AssignmentIcon sx={{ fontSize: 18, color: T.accentLight }} />
              <div>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.ink }}>{course.name}</p>
                <p style={{ margin: 0, fontSize: 11.5, color: T.inkFaint }}>{cls.gradeName || cls.name}</p>
              </div>
            </div>
            {rows.map((row) => (
              <ReportRow
                key={row.learner.id}
                row={row}
                cls={cls}
                course={course}
                onGenerate={handleGenerate}
                isGenerating={isGeneratingRow(row)}
                navigate={navigate}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
