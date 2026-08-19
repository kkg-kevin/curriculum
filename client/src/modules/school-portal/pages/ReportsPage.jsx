import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Assessment as AssessmentIcon,
  CheckCircle as CheckCircleIcon,
  EventAvailable as EventAvailableIcon,
  Groups as GroupsIcon,
} from "@mui/icons-material";
import { useHubAnalytics } from "../../reports/hooks/useReports";
import { classPath } from "../../../routes/portalPaths";

const T = {
  accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1",
  ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB",
};
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

// Categorical slots 1 & 2 from the validated palette (blue/orange) — worst-pair CVD ΔE 24.7
// (protan) / normal-vision ΔE 33.6, both well clear of the 8/15 targets. Kept as named
// constants rather than inline hex so the two places identity shows up (legend dot, bar +
// direct-label) can never drift apart.
const MALE_COLOR = "#2a78d6";
const FEMALE_COLOR = "#eb6834";

function KpiTile({ icon, num, label, sub }) {
  return (
    <div style={{ ...cardStyle, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: "#e8f5fb", display: "flex", alignItems: "center", justifyContent: "center", color: T.accent, flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.accent, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{num}</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: T.inkMuted }}>{label}</p>
        {sub && <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.inkFaint }}>{sub}</p>}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, empty, children }) {
  return (
    <div style={{ ...cardStyle, padding: "18px 20px" }}>
      <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.accentLight }}>{title}</p>
      {subtitle && <p style={{ margin: "2px 0 12px", fontSize: 12, color: T.inkFaint }}>{subtitle}</p>}
      {empty ? (
        <div style={{ padding: "36px 0", textAlign: "center", fontSize: 12.5, color: T.inkFaint }}>{empty}</div>
      ) : children}
    </div>
  );
}

// One-line, self-contained tooltip — matches the chart's own single-series color instead of
// Recharts' default box, which reads as an unstyled foreign element in this app's cards.
function ChartTooltip({ active, payload, label, valueSuffix = "%" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ backgroundColor: T.accentDeep, color: "#fff", padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
      {label}: {payload[0].value}{valueSuffix}
    </div>
  );
}

const GENDER_FILTERS = [
  { value: "all",    label: "All" },
  { value: "male",   label: "Male" },
  { value: "female", label: "Female" },
];

// A small filled circle carries series identity in the legend — never the legend *text* itself,
// which stays in ink so it reads as a label, not a data mark.
function LegendDot({ color }) {
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />;
}

// Numbers only, no bar — each value sits in its own pill, and whichever one leads for this row
// gets a light tint of its own color so "who's ahead" still reads at a glance without a track/
// fill element. A tie (or either side missing data) leaves both pills neutral.
function GenderComparisonRow({ label, icon, male, female, suffix = "%", isLast = false }) {
  const fmt = (v) => (v != null ? `${v}${suffix}` : "—");
  const leader = male != null && female != null && male !== female ? (male > female ? "male" : "female") : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: isLast ? "none" : `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", color: T.inkFaint }}>{icon}</span>
        <span style={{ fontSize: 12.5, color: T.ink, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, backgroundColor: leader === "male" ? `${MALE_COLOR}14` : "transparent" }}>
        <LegendDot color={MALE_COLOR} />
        <span style={{ fontSize: 15, fontWeight: 800, color: MALE_COLOR, fontVariantNumeric: "tabular-nums" }}>{fmt(male)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, backgroundColor: leader === "female" ? `${FEMALE_COLOR}14` : "transparent" }}>
        <LegendDot color={FEMALE_COLOR} />
        <span style={{ fontSize: 15, fontWeight: 800, color: FEMALE_COLOR, fontVariantNumeric: "tabular-nums" }}>{fmt(female)}</span>
      </div>
    </div>
  );
}

function GenderComparisonCard({ male, female }) {
  if (!male || !female) return null;
  const noData = male.activeLearnerCount === 0 && female.activeLearnerCount === 0;
  return (
    <div style={{ ...cardStyle, padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: noData ? 0 : 4 }}>
        <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.accentLight }}>Gender comparison</p>
        <div style={{ display: "flex", gap: 14 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: T.inkMuted }}><LegendDot color={MALE_COLOR} /> Male</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: T.inkMuted }}><LegendDot color={FEMALE_COLOR} /> Female</span>
        </div>
      </div>
      {noData ? (
        <p style={{ margin: "10px 0 0", fontSize: 12.5, color: T.inkFaint }}>No learners with a gender on file yet.</p>
      ) : (
        <div>
          <GenderComparisonRow label="Active learners" icon={<GroupsIcon fontSize="inherit" style={{ fontSize: 15 }} />} male={male.activeLearnerCount} female={female.activeLearnerCount} suffix="" />
          <GenderComparisonRow label="Average score" icon={<AssessmentIcon fontSize="inherit" style={{ fontSize: 15 }} />} male={male.averageScore} female={female.averageScore} />
          <GenderComparisonRow label="Attendance rate" icon={<EventAvailableIcon fontSize="inherit" style={{ fontSize: 15 }} />} male={male.attendanceRate} female={female.attendanceRate} isLast />
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const { school, hubsLoading: schoolLoading } = useOutletContext();
  const [genderFilter, setGenderFilter] = useState("all");

  // All three fetched together (React Query dedupes/parallelizes) rather than only the selected
  // one — male/female are needed simultaneously for the always-visible GenderComparisonCard below,
  // and reusing them for the main dashboard when the filter itself picks one avoids a 4th call.
  const { data: allAnalytics, isLoading: allLoading, isError: allError } = useHubAnalytics(school?.id, 30, null);
  const { data: maleAnalytics, isLoading: maleLoading } = useHubAnalytics(school?.id, 30, "male");
  const { data: femaleAnalytics, isLoading: femaleLoading } = useHubAnalytics(school?.id, 30, "female");

  const analytics = genderFilter === "male" ? maleAnalytics : genderFilter === "female" ? femaleAnalytics : allAnalytics;
  const isError = allError;

  const isLoading = schoolLoading || (!!school && (allLoading || maleLoading || femaleLoading));

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }

  if (!school) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No school profile linked yet</h3>
        <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Ask a platform admin to link your account to a school first.</p>
      </div>
    );
  }

  if (isError || !analytics) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", ...cardStyle, padding: "16px 18px", border: "1px solid #FECACA", backgroundColor: "#FEF2F2", color: "#B91C1C", fontSize: 13 }}>
        Couldn't load analytics — try refreshing the page.
      </div>
    );
  }

  const noClasses = analytics.classCount === 0;
  const noReportsYet = analytics.reportStats.published + analytics.reportStats.draft === 0;

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "28px 32px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>Reports & Analytics</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", maxWidth: 620 }}>
            Academic performance across every class at {school.name} — scores, competency attainment, attendance and report completion, drawn from published course reports and attendance records.
          </p>
        </div>
      </div>

      {noClasses ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No classes set up yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Analytics will appear here once classes, learners and reports exist.</p>
        </div>
      ) : (
        <>
          <div style={{ ...cardStyle, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.inkMuted }}>Gender</span>
            <div style={{ display: "inline-flex", backgroundColor: "#F3F4F6", borderRadius: 10, padding: 3, gap: 2 }}>
              {GENDER_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setGenderFilter(f.value)}
                  style={{
                    padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif",
                    backgroundColor: genderFilter === f.value ? "#fff" : "transparent",
                    color: genderFilter === f.value ? T.accent : T.inkMuted,
                    boxShadow: genderFilter === f.value ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {genderFilter !== "all" && (
              <span style={{ fontSize: 11.5, color: T.inkFaint }}>Every figure below is scoped to {genderFilter} learners only.</span>
            )}
          </div>

          <GenderComparisonCard male={maleAnalytics} female={femaleAnalytics} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <KpiTile icon={<GroupsIcon fontSize="small" />} num={analytics.activeLearnerCount} label="Active learners" sub={`Across ${analytics.classCount} class${analytics.classCount === 1 ? "" : "es"}`} />
            <KpiTile icon={<AssessmentIcon fontSize="small" />} num={analytics.averageScore != null ? `${analytics.averageScore}%` : "—"} label="Average score" sub="From published course reports" />
            <KpiTile icon={<EventAvailableIcon fontSize="small" />} num={analytics.attendanceRate != null ? `${analytics.attendanceRate}%` : "—"} label="Attendance rate" sub="Last 30 days" />
            <KpiTile icon={<CheckCircleIcon fontSize="small" />} num={analytics.reportStats.published} label="Reports published" sub={`${analytics.reportStats.draft} draft${analytics.reportStats.draft === 1 ? "" : "s"} awaiting review`} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
            <ChartCard title="Average score by course" empty={noReportsYet ? "No published reports yet." : (analytics.scoreByCourse.length === 0 ? "No scored courses yet." : null)}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analytics.scoreByCourse} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={T.border} strokeDasharray="0" />
                  <XAxis dataKey="courseName" tick={{ fontSize: 11, fill: T.inkMuted }} axisLine={{ stroke: T.border }} tickLine={false} interval={0} angle={-15} textAnchor="end" height={46} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: T.inkFaint }} axisLine={false} tickLine={false} width={42} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(56,170,225,0.08)" }} />
                  <Bar dataKey="averagePercent" fill={T.accentLight} radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Competency attainment" subtitle="Average score across every graded competency" empty={noReportsYet ? "No published reports yet." : (analytics.competencyScores.length === 0 ? "No competency data yet." : null)}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analytics.competencyScores} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={T.border} strokeDasharray="0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: T.inkMuted }} axisLine={{ stroke: T.border }} tickLine={false} interval={0} angle={-15} textAnchor="end" height={46} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: T.inkFaint }} axisLine={false} tickLine={false} width={42} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(37,71,106,0.06)" }} />
                  <Bar dataKey="averageScore" fill={T.accentMid} radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Attendance trend" subtitle="Weekly attendance rate, last 30 days" empty={analytics.attendanceTrend.length === 0 ? "No attendance recorded in this window." : null}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={analytics.attendanceTrend} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={T.border} strokeDasharray="0" />
                  <XAxis dataKey="weekStart" tick={{ fontSize: 11, fill: T.inkMuted }} axisLine={{ stroke: T.border }} tickLine={false} tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: T.inkFaint }} axisLine={false} tickLine={false} width={42} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="rate" stroke={T.accent} strokeWidth={2} dot={{ r: 4, fill: T.accent, stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div style={{ ...cardStyle, padding: "20px 22px" }}>
            <p style={{ margin: "0 0 14px", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.accentLight }}>Class breakdown</p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Class", "Learners", "Avg. score", "Attendance", "Reports"].map((h) => (
                      <th key={h} style={{ textAlign: "left", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.inkFaint, padding: "0 10px 8px", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analytics.classBreakdown.map((c) => (
                    <tr key={c.classId} onClick={() => navigate(classPath("school", c.classId, "view"))} style={{ cursor: "pointer" }}>
                      <td style={{ padding: "11px 10px", borderBottom: `1px solid ${T.border}`, fontWeight: 700, color: T.ink }}>{c.name}</td>
                      <td style={{ padding: "11px 10px", borderBottom: `1px solid ${T.border}`, fontVariantNumeric: "tabular-nums" }}>{c.learnerCount}</td>
                      <td style={{ padding: "11px 10px", borderBottom: `1px solid ${T.border}`, fontVariantNumeric: "tabular-nums" }}>{c.averageScore != null ? `${c.averageScore}%` : "—"}</td>
                      <td style={{ padding: "11px 10px", borderBottom: `1px solid ${T.border}`, fontVariantNumeric: "tabular-nums" }}>{c.attendanceRate != null ? `${c.attendanceRate}%` : "—"}</td>
                      <td style={{ padding: "11px 10px", borderBottom: `1px solid ${T.border}`, color: T.inkMuted }}>{c.publishedCount} published{c.draftCount > 0 ? ` · ${c.draftCount} draft` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
