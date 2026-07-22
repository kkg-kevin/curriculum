import { useEffect, useMemo, useState } from "react";
import {
  AccessTime as AccessTimeOutlinedIcon,
  BarChart as BarChartOutlinedIcon,
  Cancel as CancelOutlinedIcon,
  CheckCircle as CheckCircleOutlineIcon,
  EventNote as EventNoteOutlinedIcon,
  Home as HomeOutlinedIcon,
} from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { learningHubApi as schoolApi } from "../../learning-hubs/services/learningHubApi";
import { classApi } from "../../classes/services/classApi";
import { learnerApi } from "../../learners/services/learnerApi";
import { useAttendanceByDateQuery, useAttendanceHistoryQuery } from "../../attendance/hooks/useAttendance";

const T = {
  accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1",
  tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB",
};
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

const STATUS_CONFIG = {
  present: { label: "Present", icon: <CheckCircleOutlineIcon fontSize="small" />, color: "#25476a", bg: "#e8f5fb", border: "#a8d5ee" },
  absent:  { label: "Absent",  icon: <CancelOutlinedIcon fontSize="small" />, color: "#EF4444", bg: "#FFF5F5", border: "#FECACA" },
  late:    { label: "Late",    icon: <AccessTimeOutlinedIcon fontSize="small" />, color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
  excused: { label: "Excused", icon: <EventNoteOutlinedIcon fontSize="small" />, color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB" },
};
const STATUS_ORDER = ["present", "absent", "late", "excused"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}
function formatDisplayDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

const selectStyle = {
  padding: "8px 32px 8px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13,
  fontFamily: "Inter, sans-serif", backgroundColor: "#fff", color: T.ink, outline: "none", cursor: "pointer",
  appearance: "none", maxWidth: "100%",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
};

function StatTile({ icon, num, label, color }) {
  return (
    <div style={{ ...cardStyle, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: T.tintBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: color || T.accent, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{num}</p>
        <p style={{ margin: "3px 0 0", fontSize: 11.5, color: T.inkMuted }}>{label}</p>
      </div>
    </div>
  );
}

function LearnerStatusRow({ learner, entry }) {
  const initials = `${learner.firstName?.[0] ?? ""}${learner.lastName?.[0] ?? ""}`.toUpperCase();
  const cfg = entry ? STATUS_CONFIG[entry.status] : null;
  return (
    <div style={{ padding: "12px 18px", borderBottom: "1px solid #F9FAFB", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #25476a, #2e7db5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
        {initials || "?"}
      </div>
      <div style={{ flex: 1, minWidth: 140 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.ink }}>{learner.firstName} {learner.lastName}</p>
        <p style={{ margin: "1px 0 0", fontSize: 11, color: T.inkFaint }}>{learner.admissionNumber || "No ID"}</p>
      </div>
      {cfg ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, backgroundColor: cfg.bg, border: `1.5px solid ${cfg.border}`, color: cfg.color, fontSize: 12, fontWeight: 700 }}>
          {cfg.icon} {cfg.label}
        </span>
      ) : (
        <span style={{ fontSize: 12, color: T.inkFaint, fontStyle: "italic" }}>Not marked</span>
      )}
      {entry?.notes && (
        <span style={{ width: "100%", marginLeft: 46, fontSize: 11.5, color: T.inkMuted }}>{entry.notes}</span>
      )}
    </div>
  );
}

function HistoryRow({ row }) {
  const rateColor = row.rate === null ? T.inkFaint : row.rate >= 90 ? T.accent : row.rate >= 75 ? "#B45309" : "#EF4444";
  const initials = `${row.learner?.firstName?.[0] ?? ""}${row.learner?.lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: "1px solid #F9FAFB", flexWrap: "wrap" }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, #25476a, #2e7db5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
        {initials || "?"}
      </div>
      <p style={{ margin: 0, flex: 1, minWidth: 120, fontSize: 13, fontWeight: 600, color: T.ink }}>
        {row.learner ? `${row.learner.firstName} ${row.learner.lastName}` : "Former learner"}
      </p>
      {STATUS_ORDER.map((s) => (
        <span key={s} style={{ width: 56, textAlign: "center", fontSize: 12.5, color: T.inkMuted }}>{row[s] || 0}</span>
      ))}
      <span style={{ width: 64, textAlign: "right", fontSize: 13, fontWeight: 800, color: rateColor }}>
        {row.rate === null ? "—" : `${row.rate}%`}
      </span>
    </div>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("byDate");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [historyFrom, setHistoryFrom] = useState(() => addDays(todayStr(), -30));
  const [historyTo, setHistoryTo] = useState(() => todayStr());

  const { data: schoolsData, isLoading: schoolLoading } = useQuery({
    queryKey: ["schools", "byEmail", user?.email],
    queryFn: () => schoolApi.getAll({ email: user.email }),
    enabled: !!user?.email,
  });
  const school = schoolsData?.data?.[0] || null;

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["classes", "bySchool", school?.id, ""],
    queryFn: () => classApi.getAll({ schoolId: school.id }),
    enabled: !!school?.id,
  });
  const classes = (classesData?.data || []).slice().sort((a, b) => a.gradeName.localeCompare(b.gradeName));

  useEffect(() => {
    if (!selectedClassId && classes.length > 0) setSelectedClassId(classes[0].id);
  }, [classes, selectedClassId]);

  const selectedClass = classes.find((c) => c.id === selectedClassId) || null;

  const { data: learnersData, isLoading: learnersLoading } = useQuery({
    queryKey: ["learners", "byClass", selectedClassId],
    queryFn: () => learnerApi.getAll({ classId: selectedClassId }),
    enabled: !!selectedClassId,
  });
  const learners = learnersData?.data || [];

  const { data: existingData, isLoading: existingLoading } = useAttendanceByDateQuery(tab === "byDate" ? selectedClassId : null, date);
  const entriesByLearner = useMemo(() => {
    const map = {};
    for (const r of existingData?.data || []) map[r.learnerId] = { status: r.status, notes: r.notes || "" };
    return map;
  }, [existingData]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
    for (const l of learners) {
      const status = entriesByLearner[l.id]?.status;
      if (status) c[status] = (c[status] || 0) + 1;
      else c.unmarked += 1;
    }
    return c;
  }, [learners, entriesByLearner]);
  const total = learners.length;
  const rate = total ? Math.round(((counts.present + counts.late) / total) * 100) : 0;
  const isToday = date === todayStr();

  const { data: historyData, isLoading: historyLoading } = useAttendanceHistoryQuery(
    tab === "history" ? selectedClassId : null,
    historyFrom,
    historyTo
  );
  const historyRows = useMemo(() => {
    const map = {};
    for (const l of learners) map[l.id] = { learner: l, present: 0, absent: 0, late: 0, excused: 0, total: 0 };
    for (const r of (historyData?.data || [])) {
      if (!map[r.learnerId]) map[r.learnerId] = { learner: null, present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      map[r.learnerId][r.status] = (map[r.learnerId][r.status] || 0) + 1;
      map[r.learnerId].total += 1;
    }
    return Object.values(map)
      .map((row) => ({ ...row, rate: row.total ? Math.round(((row.present + row.late) / row.total) * 100) : null }))
      .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101));
  }, [learners, historyData]);

  if (schoolLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }

  if (!school) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif" }}>
        <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: T.accent }}><HomeOutlinedIcon fontSize="large" /></div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No school profile linked yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Ask a platform admin to add this school using this same email address.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "24px clamp(16px, 5vw, 32px)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px 0", fontSize: "clamp(20px, 4vw, 24px)", fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>Attendance</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>View attendance records and history across {school.name}'s classes.</p>
        </div>
      </div>

      {classesLoading ? (
        <div style={{ padding: "40px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14 }}>Loading classes…</div>
      ) : classes.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No classes yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Set up classes first to see attendance here.</p>
        </div>
      ) : (
        <>
          <div style={{ ...cardStyle, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} style={selectStyle}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.gradeName} · {c.academicYear}</option>
              ))}
            </select>

            <div style={{ display: "inline-flex", padding: 4, backgroundColor: "#F9FAFB", borderRadius: 12, border: `1.5px solid ${T.border}`, gap: 4 }}>
              {[{ key: "byDate", label: "By Date" }, { key: "history", label: "History" }].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  style={{
                    padding: "7px 16px", borderRadius: 9, border: "none", fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer",
                    backgroundColor: tab === t.key ? T.accent : "transparent", color: tab === t.key ? "#fff" : T.inkMuted, transition: "all 0.15s",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {tab === "byDate" ? (
            <>
              <div style={{ ...cardStyle, padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setDate((d) => addDays(d, -1))} style={{ width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${T.border}`, backgroundColor: "#fff", color: T.inkMuted, cursor: "pointer", fontSize: 14 }}>‹</button>
                <div>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.ink }}>{formatDisplayDate(date)}</p>
                  {isToday && <p style={{ margin: "1px 0 0", fontSize: 11, color: T.accentLight, fontWeight: 700 }}>TODAY</p>}
                </div>
                <button type="button" onClick={() => setDate((d) => addDays(d, 1))} disabled={isToday} style={{ width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${T.border}`, backgroundColor: "#fff", color: isToday ? "#D1D5DB" : T.inkMuted, cursor: isToday ? "not-allowed" : "pointer", fontSize: 14 }}>›</button>
                <input
                  type="date"
                  value={date}
                  max={todayStr()}
                  onChange={(e) => setDate(e.target.value)}
                  style={{ padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 12.5, fontFamily: "Inter, sans-serif", outline: "none" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
                <StatTile icon={<CheckCircleOutlineIcon fontSize="small" />} num={counts.present} label="Present" color={STATUS_CONFIG.present.color} />
                <StatTile icon={<CancelOutlinedIcon fontSize="small" />} num={counts.absent} label="Absent" color={STATUS_CONFIG.absent.color} />
                <StatTile icon={<AccessTimeOutlinedIcon fontSize="small" />} num={counts.late} label="Late" color={STATUS_CONFIG.late.color} />
                <StatTile icon={<EventNoteOutlinedIcon fontSize="small" />} num={counts.excused} label="Excused" color={STATUS_CONFIG.excused.color} />
                <StatTile icon={<BarChartOutlinedIcon fontSize="small" />} num={`${rate}%`} label="Attendance Rate" />
              </div>

              <div style={{ ...cardStyle, overflow: "hidden" }}>
                {learnersLoading || existingLoading ? (
                  <div style={{ padding: 40, textAlign: "center", color: T.inkFaint, fontSize: 14 }}>Loading…</div>
                ) : learners.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: T.inkFaint, fontSize: 14 }}>No learners enrolled in this class yet.</div>
                ) : (
                  learners.map((l) => <LearnerStatusRow key={l.id} learner={l} entry={entriesByLearner[l.id]} />)
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ ...cardStyle, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <label style={{ fontSize: 12.5, color: T.inkMuted, display: "flex", alignItems: "center", gap: 6 }}>
                  From
                  <input type="date" value={historyFrom} max={historyTo} onChange={(e) => setHistoryFrom(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 12.5, fontFamily: "Inter, sans-serif", outline: "none" }} />
                </label>
                <label style={{ fontSize: 12.5, color: T.inkMuted, display: "flex", alignItems: "center", gap: 6 }}>
                  To
                  <input type="date" value={historyTo} min={historyFrom} max={todayStr()} onChange={(e) => setHistoryTo(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 12.5, fontFamily: "Inter, sans-serif", outline: "none" }} />
                </label>
                <span style={{ marginLeft: "auto", fontSize: 12, color: T.inkFaint }}>Lowest attendance rate shown first</span>
              </div>

              <div style={{ ...cardStyle, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <div style={{ minWidth: 520 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: `1.5px solid ${T.border}`, backgroundColor: "#FAFBFF" }}>
                      <div style={{ width: 30, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 120, fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.05em" }}>Learner</span>
                      {STATUS_ORDER.map((s) => (
                        <span key={s} style={{ width: 56, textAlign: "center", fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.05em" }}>{STATUS_CONFIG[s].label}</span>
                      ))}
                      <span style={{ width: 64, textAlign: "right", fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.05em" }}>Rate</span>
                    </div>
                    {learnersLoading || historyLoading ? (
                      <div style={{ padding: 40, textAlign: "center", color: T.inkFaint, fontSize: 14 }}>Loading history…</div>
                    ) : historyRows.length === 0 ? (
                      <div style={{ padding: 40, textAlign: "center", color: T.inkFaint, fontSize: 14 }}>No learners to show for this class.</div>
                    ) : (
                      historyRows.map((row) => <HistoryRow key={row.learner?.id || Math.random()} row={row} />)
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
