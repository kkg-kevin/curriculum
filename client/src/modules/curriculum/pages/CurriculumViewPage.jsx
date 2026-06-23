import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCurriculumQuery } from "../hooks/useCurriculum";
import { useCurriculumVersions } from "../hooks/useCurriculumVersion";
import { useAcademicYears } from "../hooks/useAcademicYear";
import { schoolApi } from "../../schools/services/schoolApi";

/* ── Helpers ──────────────────────────────────────────────────────────── */

const cycleLabel = (model) =>
  model === "semesters" ? "Semesters" : model === "terms" ? "Terms" : "Periods";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function resolvePeriodDates(periodName, activeYear, curriculumPeriods) {
  if (activeYear?.periods) {
    const p = activeYear.periods.find((ap) => ap.name.trim() === periodName?.trim());
    if (p) return p;
  }
  const p = (curriculumPeriods || []).find((cp) => cp.name?.trim() === periodName?.trim());
  if (!p) return null;
  return {
    ...p,
    breakStartDate: p.breakStartDate || p.midTermBreakStartDate || "",
    breakEndDate:   p.breakEndDate   || p.midTermBreakEndDate   || "",
  };
}

const FRAMEWORK_COLORS = {
  CBC:       { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  IGCSE:     { bg: "#DBEAFE", color: "#1565C0", border: "#93C5FD" },
  IB:        { bg: "#EFF6FF", color: "#1E40AF", border: "#BFDBFE" },
  National:  { bg: "#E0F2FE", color: "#0369A1", border: "#BAE6FD" },
  Cambridge: { bg: "#DBEAFE", color: "#1E3A8A", border: "#93C5FD" },
  American:  { bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" },
  Custom:    { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
};

const STATUS_CONFIG = {
  active:   { bg: "#ECFDF5", color: "#065F46", border: "#A7F3D0", dot: "#16A34A", label: "Active"   },
  draft:    { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A", dot: "#D97706", label: "Draft"    },
  inactive: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", dot: "#9CA3AF", label: "Inactive" },
};

const COURSE_SHADES = [
  { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  { bg: "#DBEAFE", color: "#1565C0", border: "#93C5FD" },
  { bg: "#E0F2FE", color: "#0369A1", border: "#BAE6FD" },
  { bg: "#F0F7FF", color: "#1E40AF", border: "#C7D9F8" },
];

/* ── CSS ─────────────────────────────────────────────────────────────── */

const CSS = `
  @keyframes cvp-spin { to { transform: rotate(360deg); } }
  @keyframes cvp-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

  .cvp-period-tabs {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    padding: 16px 20px;
    border-bottom: 1px solid #F3F4F6;
    background: #FAFBFF;
  }

  .cvp-tab {
    padding: 7px 16px;
    border-radius: 20px;
    border: 1.5px solid #E5E7EB;
    background: #fff;
    font-size: 13px;
    font-weight: 600;
    font-family: Inter, sans-serif;
    color: #6B7280;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .cvp-tab:hover { border-color: #93C5FD; color: #1D4ED8; background: #F0F7FF; }
  .cvp-tab.active {
    border-color: #0D47A1;
    background: #0D47A1;
    color: #fff;
  }

  .cvp-class-row {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 14px 0;
    border-bottom: 1px solid #F3F4F6;
  }
  .cvp-class-row:last-child { border-bottom: none; }

  .cvp-class-name {
    min-width: 120px;
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 700;
    color: #374151;
    padding-top: 3px;
  }

  .cvp-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    flex: 1;
  }

  .cvp-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 11px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }

  .cvp-chip-code {
    font-size: 10px;
    font-weight: 700;
    opacity: 0.7;
    padding: 1px 6px;
    border-radius: 10px;
    background: rgba(0,0,0,0.08);
  }

  .cvp-no-courses {
    font-size: 12px;
    color: #9CA3AF;
    font-style: italic;
    padding: 4px 0;
  }

  .cvp-period-content {
    animation: cvp-fade 0.2s ease;
  }

  @media (max-width: 640px) {
    .cvp-class-row { flex-direction: column; gap: 8px; }
    .cvp-class-name { min-width: unset; }
  }
`;

/* ── Small atoms ─────────────────────────────────────────────────────── */

function Chip({ course, index }) {
  const shade = COURSE_SHADES[index % COURSE_SHADES.length];
  return (
    <span className="cvp-chip" style={{ backgroundColor: shade.bg, color: shade.color, border: `1px solid ${shade.border}` }}>
      {course.name}
      {course.code && <span className="cvp-chip-code">{course.code}</span>}
    </span>
  );
}

function VersionBadge({ version }) {
  if (!version) return null;
  const sc = STATUS_CONFIG[version.status] || STATUS_CONFIG.inactive;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: "6px",
        padding: "4px 12px", borderRadius: "20px",
        backgroundColor: "#0D47A1", color: "#fff",
        fontSize: "12px", fontWeight: "700",
      }}>
        Version {version.versionNumber}
      </span>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: "5px",
        padding: "4px 11px", borderRadius: "20px",
        backgroundColor: sc.bg, color: sc.color,
        border: `1px solid ${sc.border}`,
        fontSize: "11px", fontWeight: "700",
      }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: sc.dot }} />
        {sc.label}
      </span>
    </div>
  );
}

/* ── Loading state ────────────────────────────────────────────────────── */

function LoadingState() {
  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`@keyframes cvp-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "400px", gap: "14px", color: "#6B7280", fontSize: "14px" }}>
        <span style={{ width: "28px", height: "28px", border: "3px solid #E5E7EB", borderTopColor: "#0D47A1", borderRadius: "50%", display: "inline-block", animation: "cvp-spin 0.7s linear infinite" }} />
        Loading curriculum…
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function CurriculumViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: curriculum, isLoading: currLoading, isError } = useCurriculumQuery(id);
  const { data: vData, isLoading: vLoading } = useCurriculumVersions(id);
  const { data: yearData } = useAcademicYears(id);

  const { data: schoolsData } = useQuery({
    queryKey: ["schools", "byCurriculum", id],
    queryFn:  () => schoolApi.getAll({ curriculumId: id }),
    enabled:  !!id,
  });

  const [activePeriod, setActivePeriod] = useState(0);

  if (currLoading || vLoading) return <LoadingState />;

  if (isError || !curriculum) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "14px" }}>
          <span style={{ fontSize: "24px" }}>⚠️</span>
          <div>
            <p style={{ margin: "0 0 4px 0", fontWeight: "700", color: "#DC2626", fontSize: "14px" }}>Could not load curriculum</p>
            <p style={{ margin: 0, fontSize: "13px", color: "#EF4444" }}>The curriculum may not exist or there was a network error.</p>
          </div>
        </div>
      </div>
    );
  }

  const assignedSchools  = schoolsData?.data || [];
  const current          = vData?.current;
  const history          = vData?.history || [];
  const content          = current?.content || [];
  const periods          = curriculum.periods || [];
  const classes          = curriculum.classes || [];
  const model            = curriculum.academicCycleModel || "terms";
  const fwColors         = FRAMEWORK_COLORS[curriculum.framework] || FRAMEWORK_COLORS.Custom;
  const activeYear       = yearData?.current || null;
  const curriculumType   = curriculum.curriculumType || null;

  /* Stats derived from version content */
  const totalCourses = content.reduce(
    (s, p) => s + (p.classes || []).reduce((cs, cls) => cs + (cls.courses?.length || 0), 0),
    0,
  );

  /* Active period content */
  const safeIdx          = Math.min(activePeriod, Math.max(content.length - 1, 0));
  const activePeriodData = content[safeIdx];

  /* Academic-year period tabs (used when no version exists yet) */
  const yearPeriods  = activeYear?.periods || [];
  const yearSafeIdx  = Math.min(activePeriod, Math.max(yearPeriods.length - 1, 0));

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{CSS}</style>

      {/* ── Breadcrumb / back ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
        <button
          type="button"
          onClick={() => navigate("/curriculum")}
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "7px 14px", backgroundColor: "#ffffff", color: "#374151",
            border: "1.5px solid #E5E7EB", borderRadius: "9px",
            fontSize: "13px", fontWeight: "500", fontFamily: "Inter, sans-serif", cursor: "pointer",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All Curricula
        </button>
        <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
        <span style={{ fontSize: "13px", color: "#6B7280", maxWidth: "220px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {curriculum.name}
        </span>
      </div>

      {/* ── Hero header card ──────────────────────────────────────────── */}
      <div style={{
        backgroundColor: "#ffffff", borderRadius: "20px",
        boxShadow: "0 4px 20px rgba(13,71,161,0.10), 0 1px 4px rgba(0,0,0,0.05)",
        overflow: "hidden", marginBottom: "20px",
      }}>
        {/* Gradient banner */}
        <div style={{
          background: "linear-gradient(135deg, #0A3880 0%, #0D47A1 40%, #1565C0 70%, #1976D2 100%)",
          padding: "24px 28px 28px", position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: "-30px", right: "-30px", width: "160px", height: "160px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)" }} />
          <div style={{ position: "absolute", bottom: "-10px", right: "100px", width: "80px", height: "80px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.06)" }} />

          {/* Top row: framework + type badges + action buttons */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "14px", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{
                padding: "4px 13px", borderRadius: "20px",
                backgroundColor: "rgba(255,255,255,0.18)", color: "#ffffff",
                border: "1px solid rgba(255,255,255,0.25)",
                fontSize: "11px", fontWeight: "700", letterSpacing: "0.04em",
              }}>
                {curriculum.framework || "No Framework"}
              </span>
              {curriculumType && (
                <span style={{
                  padding: "4px 13px", borderRadius: "20px",
                  backgroundColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.95)",
                  border: "1px solid rgba(255,255,255,0.20)",
                  fontSize: "11px", fontWeight: "600", letterSpacing: "0.03em",
                }}>
                  {curriculumType}
                </span>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              <button type="button" onClick={() => navigate(`/curriculum/${id}/edit`)}
                style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 13px", backgroundColor: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "8px", fontSize: "12px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                ✏ Edit Details
              </button>
              <button type="button" onClick={() => navigate(`/curriculum/${id}/structure`)}
                style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 13px", backgroundColor: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "8px", fontSize: "12px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                🏗 Structure
              </button>
              <button type="button" onClick={() => navigate(`/curriculum/${id}/versions`)}
                style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 13px", backgroundColor: "rgba(255,255,255,0.95)", color: "#0D47A1", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                🗂 Version Control
              </button>
            </div>
          </div>

          {/* Name */}
          <h1 style={{ margin: "0 0 4px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px", lineHeight: 1.2, position: "relative" }}>
            {curriculum.name}
          </h1>
          <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "rgba(255,255,255,0.72)", fontWeight: "500", position: "relative" }}>
            {[curriculum.code, curriculum.academicYear, cycleLabel(model)].filter(Boolean).join("  ·  ")}
          </p>
          {curriculum.description && (
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.6", maxWidth: "560px", position: "relative", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {curriculum.description}
            </p>
          )}
        </div>

        {/* Stats bar */}
        <div style={{ padding: "18px 28px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {[
            { label: cycleLabel(model), value: periods.length, icon: "📆", bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
            { label: "Classes",         value: classes.length,  icon: "🎓", bg: "#DBEAFE", color: "#1565C0", border: "#93C5FD" },
            { label: "Total Courses",   value: totalCourses,    icon: "📚", bg: "#E0F2FE", color: "#0369A1", border: "#BAE6FD" },
            { label: "Versions",        value: history.length + (current ? 1 : 0), icon: "🗂", bg: "#F0F7FF", color: "#1E40AF", border: "#C7D9F8" },
          ].map((stat) => (
            <div key={stat.label} style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "11px 16px", backgroundColor: stat.bg, border: `1px solid ${stat.border}`,
              borderRadius: "12px", flex: "1 0 100px", minWidth: "90px",
            }}>
              <span style={{ fontSize: "18px", flexShrink: 0 }}>{stat.icon}</span>
              <div>
                <p style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: stat.color, lineHeight: 1 }}>{stat.value}</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "10px", fontWeight: "700", color: stat.color, opacity: 0.65, textTransform: "uppercase", letterSpacing: "0.06em" }}>{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Version Content Section ───────────────────────────────────── */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden", marginBottom: "20px" }}>

        {/* Section header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6" }}>
          {/* Year info strip — shows for full academic-year records AND for curricula
              that only have an academicYear string (legacy / no record yet) */}
          {(activeYear || curriculum.academicYear) && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", padding: "8px 12px", backgroundColor: "#F8FAFF", border: "1px solid #E8F0FE", borderRadius: "10px", flexWrap: "wrap" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0D47A1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#0D47A1" }}>
                {activeYear?.label || curriculum.academicYear}
              </span>
              {activeYear && (activeYear.startDate || activeYear.endDate) && (
                <span style={{ fontSize: "11px", color: "#6B7280" }}>
                  {fmtDate(activeYear.startDate)} – {fmtDate(activeYear.endDate)}
                </span>
              )}
              {activeYear && (() => {
                const sc = STATUS_CONFIG[activeYear.status] || STATUS_CONFIG.inactive;
                return (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "20px", backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, fontSize: "10px", fontWeight: "700" }}>
                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: sc.dot }} />
                    {sc.label}
                  </span>
                );
              })()}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>Course Assignments</h2>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9CA3AF" }}>
                {current ? "Courses assigned per class for each period" : "No version created yet"}
              </p>
            </div>
            {current && <VersionBadge version={current} />}
          </div>
        </div>

        {!current ? (
          /* ── No version state ──────────────────────────────────────────
             If academic year is configured, show its period tabs so the
             user can click a term and see the dates right away. */
          yearPeriods.length > 0 ? (
            <>
              <div className="cvp-period-tabs">
                {yearPeriods.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`cvp-tab${yearSafeIdx === i ? " active" : ""}`}
                    onClick={() => setActivePeriod(i)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              <div className="cvp-period-content" style={{ padding: "4px 20px 20px" }}>
                {/* Term date strip for the selected academic-year period */}
                {(() => {
                  const sel = yearPeriods[yearSafeIdx];
                  if (!sel || (!sel.startDate && !sel.endDate)) return null;
                  return (
                    <div style={{ margin: "12px 0 16px", padding: "10px 14px", backgroundColor: "#F0F7FF", border: "1.5px solid #DBEAFE", borderRadius: "10px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "10px", fontWeight: "700", color: "#0D47A1", textTransform: "uppercase", letterSpacing: "0.06em" }}>Dates</span>
                        <span style={{ fontSize: "12px", fontWeight: "600", color: "#1D4ED8" }}>
                          {fmtDate(sel.startDate)} → {fmtDate(sel.endDate)}
                        </span>
                      </div>
                      {(sel.breakStartDate || sel.breakEndDate) && (
                        <>
                          <div style={{ width: "1px", height: "14px", backgroundColor: "#BFDBFE", flexShrink: 0 }} />
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "10px", fontWeight: "700", color: "#C2410C", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>Mid-term Break</span>
                            <span style={{ fontSize: "12px", fontWeight: "600", color: "#92400E" }}>
                              {fmtDate(sel.breakStartDate)} → {fmtDate(sel.breakEndDate)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* No-courses prompt */}
                <div style={{ padding: "24px", textAlign: "center", backgroundColor: "#FAFAFA", borderRadius: "12px", border: "1.5px dashed #E5E7EB" }}>
                  <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#6B7280", lineHeight: "1.5" }}>
                    No course assignments yet. Go to Version Control to assign courses to each class per term.
                  </p>
                  <button type="button" onClick={() => navigate(`/curriculum/${id}/versions`)}
                    style={{ padding: "9px 20px", backgroundColor: "#0D47A1", color: "#fff", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                    Open Version Control →
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* No academic year configured yet */
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "16px", background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)", border: "2px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", margin: "0 auto 16px" }}>
                🗂
              </div>
              <h3 style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#111827" }}>No Version Created Yet</h3>
              <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#6B7280", lineHeight: "1.6", maxWidth: "340px", marginLeft: "auto", marginRight: "auto" }}>
                Go to Version Control to assign courses to each class per period, then save as a version.
              </p>
              <button type="button" onClick={() => navigate(`/curriculum/${id}/versions`)}
                style={{ padding: "10px 22px", backgroundColor: "#0D47A1", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                Open Version Control →
              </button>
            </div>
          )
        ) : content.length === 0 ? (
          <div style={{ padding: "32px 24px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>This version has no period content yet.</p>
          </div>
        ) : (
          <>
            {/* Period tabs */}
            <div className="cvp-period-tabs">
              {content.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  className={`cvp-tab${safeIdx === i ? " active" : ""}`}
                  onClick={() => setActivePeriod(i)}
                >
                  {p.periodName}
                </button>
              ))}
            </div>

            {/* Class / course content */}
            {activePeriodData && (
              <div className="cvp-period-content" style={{ padding: "4px 20px 20px" }}>
                {/* Term date strip — shown when this period has dates configured.
                    Falls back to curriculum.periods for curricula without an academic-year record. */}
                {(() => {
                  const pDates = resolvePeriodDates(activePeriodData?.periodName, activeYear, periods);
                  if (!pDates || (!pDates.startDate && !pDates.endDate)) return null;
                  return (
                    <div style={{ margin: "12px 0 16px", padding: "10px 14px", backgroundColor: "#F0F7FF", border: "1.5px solid #DBEAFE", borderRadius: "10px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "10px", fontWeight: "700", color: "#0D47A1", textTransform: "uppercase", letterSpacing: "0.06em" }}>Dates</span>
                        <span style={{ fontSize: "12px", fontWeight: "600", color: "#1D4ED8" }}>
                          {fmtDate(pDates.startDate)} → {fmtDate(pDates.endDate)}
                        </span>
                      </div>
                      {(pDates.breakStartDate || pDates.breakEndDate) && (
                        <>
                          <div style={{ width: "1px", height: "14px", backgroundColor: "#BFDBFE", flexShrink: 0 }} />
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "10px", fontWeight: "700", color: "#C2410C", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>Mid-term Break</span>
                            <span style={{ fontSize: "12px", fontWeight: "600", color: "#92400E" }}>
                              {fmtDate(pDates.breakStartDate)} → {fmtDate(pDates.breakEndDate)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}

                {(activePeriodData.classes || []).length === 0 ? (
                  <div style={{ padding: "32px", textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>No classes for this period.</p>
                  </div>
                ) : (
                  (activePeriodData.classes || []).map((cls) => (
                    <div key={cls.className} className="cvp-class-row">
                      <span className="cvp-class-name">{cls.className}</span>
                      <div className="cvp-chips">
                        {(cls.courses || []).length === 0 ? (
                          <span className="cvp-no-courses">No courses assigned</span>
                        ) : (
                          (cls.courses || []).map((course, ci) => (
                            <Chip key={course.id} course={course} index={ci} />
                          ))
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Schools Using This Curriculum ─────────────────────────────── */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden", marginBottom: "20px" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>Schools Using This Curriculum</h2>
          <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>
            {assignedSchools.length}
          </span>
        </div>
        <div style={{ padding: "16px 20px" }}>
          {assignedSchools.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "#9CA3AF" }}>
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>🏫</div>
              <p style={{ margin: 0, fontSize: "13px" }}>No schools have been assigned this curriculum yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {assignedSchools.map((s) => (
                <div
                  key={s.id}
                  onClick={() => navigate(`/schools/${s.id}/view`)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "10px", border: "1px solid #E5E7EB", cursor: "pointer", transition: "background-color 0.12s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F9FAFB"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "20px" }}>🏫</span>
                    <div>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#111827" }}>{s.name}</p>
                      <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>
                        {s.code}{s.address?.county ? ` · ${s.address.county}` : ""}
                      </p>
                    </div>
                  </div>
                  <span style={{
                    padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: "700",
                    backgroundColor: s.status === "active" ? "#ECFDF5" : "#F9FAFB",
                    color: s.status === "active" ? "#065F46" : "#6B7280",
                    border: `1px solid ${s.status === "active" ? "#A7F3D0" : "#E5E7EB"}`,
                  }}>
                    {s.status === "active" ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Version History link ──────────────────────────────────────── */}
      {(history.length > 0 || current) && (
        <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden", marginBottom: "20px" }}>
          <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>Version History</h2>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9CA3AF" }}>
                {history.length + (current ? 1 : 0)} version{(history.length + (current ? 1 : 0)) !== 1 ? "s" : ""} recorded
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/curriculum/${id}/versions`)}
              style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "8px 16px", backgroundColor: "#EFF6FF", color: "#0D47A1",
                border: "1.5px solid #BFDBFE", borderRadius: "9px",
                fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer",
              }}
            >
              View All Versions →
            </button>
          </div>

          {/* Quick list of versions */}
          <div style={{ padding: "0 20px 16px" }}>
            {[current, ...history].filter(Boolean).map((v) => {
              const sc = STATUS_CONFIG[v.status] || STATUS_CONFIG.inactive;
              return (
                <div key={v.id} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "10px 0", borderTop: "1px solid #F3F4F6",
                }}>
                  <span style={{
                    width: "30px", height: "30px", borderRadius: "8px", flexShrink: 0,
                    backgroundColor: v.isCurrent ? "#0D47A1" : "#F3F4F6",
                    color: v.isCurrent ? "#fff" : "#6B7280",
                    fontSize: "11px", fontWeight: "800",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>
                    v{v.versionNumber}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#111827" }}>
                      Version {v.versionNumber}
                      {v.isCurrent && <span style={{ marginLeft: "6px", fontSize: "10px", color: "#0D47A1", fontWeight: "700" }}>· CURRENT</span>}
                    </p>
                    <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>
                      {new Date(v.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <span style={{
                    padding: "2px 9px", borderRadius: "20px", fontSize: "10px", fontWeight: "700",
                    backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                    textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>
                    {sc.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ height: "32px" }} />
    </div>
  );
}
