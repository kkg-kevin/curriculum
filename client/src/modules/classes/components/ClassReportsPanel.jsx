import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { reportApi } from "../../reports/services/reportApi";
import { CourseReportCard, NeedsPublishingSection, flattenReportRows, rowStatus } from "../../reports/components/CourseReportCards";
import { learnerReportPath } from "../../../routes/portalPaths";

/*
 * Learner reports & certificates for one class (19 Nov 2026) — the admin and hub class page. The
 * same cards educators use on their Reports page (sessions, module reports, the final report, File
 * as not handed in, Generate / Publish, one by one or the whole class), so learners get their
 * reports and certificates even when their educator can't (no login, suspended, left).
 * Collapsed until opened: it builds every learner's readiness for every course.
 */
export default function ClassReportsPanel({ cls, courses = [] }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const courseIds = courses.map((c) => c.id);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["reports", "readiness", "batch", cls.id, [...courseIds].sort().join(",")],
    queryFn: () => reportApi.getReadinessBatch(cls.id, courseIds),
    enabled: open && courseIds.length > 0,
  });
  const byCourse = data?.data || {};
  const sections = courses.map((course) => ({ cls, course, rows: byCourse[course.id] || [] })).filter((s) => s.rows.length > 0);
  const all = flattenReportRows(sections);
  const drafts = all.filter((r) => rowStatus(r) === "draft");
  const reportPath = (id) => learnerReportPath(user?.role, id);

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden", fontFamily: "Inter, sans-serif" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "20px 28px", border: 0, background: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Learner reports &amp; certificates</span>
          <span style={{ display: "block", fontSize: 12.5, color: "#6B7280", marginTop: 3 }}>Module and final course reports for this class — publishing one issues the learner's certificate.</span>
        </span>
        {open ? <FiChevronDown size={18} color="#6B7280" /> : <FiChevronRight size={18} color="#6B7280" />}
      </button>
      {open && (
        <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {!courseIds.length ? <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>This class has no courses yet.</p>
            : isLoading ? <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>Working out every learner's reports…</p>
              : isError ? <p style={{ margin: 0, fontSize: 13, color: "#B91C1C" }}>Couldn't load the reports — try again.</p>
                : sections.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>No learners or nothing to assess in this class's courses yet.</p>
                  : <>
                    <NeedsPublishingSection rows={drafts} reportPath={reportPath} />
                    {sections.map(({ course, rows }) => <CourseReportCard key={course.id} cls={cls} course={course} rows={rows} reportPath={reportPath} showClass={false} />)}
                  </>}
        </div>
      )}
    </div>
  );
}
