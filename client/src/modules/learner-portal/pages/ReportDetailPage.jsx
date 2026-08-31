import { useState } from "react";
import { useNavigate, useParams, useOutletContext } from "react-router-dom";
import toast from "react-hot-toast";
import { FiAward } from "react-icons/fi";
import { Print as PrintIcon, Download as DownloadIcon } from "@mui/icons-material";
import { useReport } from "../../reports/hooks/useReports";
import { useCourseQuery } from "../../courses/hooks/useCourse";
import ReportDetailSections from "../../reports/components/ReportDetailSections";
import ReportPrintDocument from "../../reports/components/ReportPrintDocument";
import { downloadElementAsPdf } from "../../../utils/pdf";

const T = { accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1", tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB" };
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

// The branded document lives here for Print/Download only — kept out of normal flow so the
// on-screen page keeps its original look. It's positioned far off-screen (not display:none, which
// html2canvas can't capture) and only becomes visible under @media print.
const PRINT_DOC_ID = "learner-report-print-doc";
const offscreenStyle = { position: "fixed", left: "-10000px", top: 0, width: 820, pointerEvents: "none" };

function actionBtn(disabled) {
  return {
    display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px",
    borderRadius: 10, border: `1.5px solid ${T.border}`, background: "#fff",
    color: T.accent, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif",
    cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1,
  };
}

export default function ReportDetailPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  // The portal's already-resolved scope — the learner (name, photo, admission no.) and the hub
  // currently being viewed (name, logo, class). Threaded into the printable document so it can
  // carry the three marks (Digifunzi, hub, learner) without any fetch of its own.
  const { learner, selectedHub, cls } = useOutletContext();

  const { data: report, isLoading, isError } = useReport(reportId);
  // Only used as a fallback for reports generated before courseName was snapshotted into content.
  const { data: course } = useCourseQuery(report?.content?.courseName ? null : report?.courseId);

  const [downloading, setDownloading] = useState(false);

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }
  // Distinct from not-found — a network/server failure shouldn't tell a learner their report
  // doesn't exist when it does.
  if (isError) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#B91C1C" }}>Couldn't load this report — try refreshing the page.</div>;
  }
  if (!report) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#EF4444" }}>Report not found.</div>;
  }

  const content = report.content || {};
  const overall = content.overall || { totalScore: 0, maxScore: 0, percent: 0 };
  const assessments = content.assessments || [];

  const reportLabel = report.sessionId
    ? content.sessionName || "Session"
    : content.courseName || course?.name || "Course";
  const learnerLast = (learner?.lastName || "learner").replace(/\s+/g, "-");
  const filename = `${learnerLast}-${reportLabel.replace(/[^a-z0-9]+/gi, "-")}-report.pdf`.toLowerCase();
  const gradeName = selectedHub?.class?.gradeName || cls?.gradeName || null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadElementAsPdf(PRINT_DOC_ID, filename, { backgroundColor: "#ffffff" });
    } catch {
      toast.error("Couldn't generate the PDF — you can still use Print instead.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`
        /* The on-screen page is hidden when printing; only the branded document prints. */
        @media print {
          .lr-screen { display: none !important; }
          #${PRINT_DOC_ID} { position: static !important; left: auto !important; width: 100% !important; }
        }
      `}</style>

      <div className="lr-screen" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => navigate("/learner-portal/reports")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 20, color: T.inkMuted, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
          >
            ← My Reports
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" onClick={() => window.print()} style={actionBtn(false)}>
              <PrintIcon sx={{ fontSize: 16 }} /> Print
            </button>
            <button type="button" onClick={handleDownload} disabled={downloading} style={actionBtn(downloading)}>
              <DownloadIcon sx={{ fontSize: 16 }} /> {downloading ? "Preparing…" : "Download PDF"}
            </button>
          </div>
        </div>

        <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "24px 28px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 900, color: "#fff" }}>
              {report.sessionId ? `Session Report — ${content.sessionName || "Session"}` : (content.courseName || course?.name || "Course Report")}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
              Published {report.publishedAt ? new Date(report.publishedAt).toLocaleDateString("en-KE", { dateStyle: "medium" }) : ""}
            </p>
          </div>
        </div>

        <div style={{ ...cardStyle, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", color: "#059669", fontSize: 22, flexShrink: 0 }}><FiAward /></div>
          <div>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#059669" }}>{overall.totalScore} / {overall.maxScore}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.inkMuted }}>{overall.percent}% overall across {assessments.length} assessment{assessments.length === 1 ? "" : "s"}</p>
          </div>
        </div>

        {report.remarks && (
          <div style={{ ...cardStyle, padding: "16px 20px", backgroundColor: T.tintBg, border: `1.5px solid ${T.tintBorder}` }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>Educator Remarks</p>
            <p style={{ margin: 0, fontSize: 13.5, color: T.ink }}>{report.remarks}</p>
          </div>
        )}

        <ReportDetailSections content={content} defaultOpen />
      </div>

      {/* Off-screen branded document — the exact element Print and Download capture. */}
      <div id={PRINT_DOC_ID} style={offscreenStyle} aria-hidden="true">
        <ReportPrintDocument report={report} learner={learner} hub={selectedHub} gradeName={gradeName} />
      </div>
    </div>
  );
}
