import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { teacherApi } from "../../teachers/services/teacherApi";
import { classApi } from "../../classes/services/classApi";
import { learnerApi } from "../../learners/services/learnerApi";
import { useAttendanceByDateQuery, useAttendanceHistoryQuery, useMarkAttendance } from "../../attendance/hooks/useAttendance";

const ACCENT = "#25476a";
const T = {
  accent: ACCENT, accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1",
  tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB",
};
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

const STATUS_CONFIG = {
  present: { label: "Present", icon: "✅", color: "#25476a", bg: "#e8f5fb", border: "#a8d5ee" },
  absent:  { label: "Absent",  icon: "❌", color: "#EF4444", bg: "#FFF5F5", border: "#FECACA" },
  late:    { label: "Late",    icon: "⏰", color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
  excused: { label: "Excused", icon: "📝", color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB" },
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

function StatusSegmented({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {STATUS_ORDER.map((s) => {
        const cfg = STATUS_CONFIG[s];
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            title={cfg.label}
            style={{
              padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${active ? cfg.border : T.border}`,
              backgroundColor: active ? cfg.bg : "#fff", color: active ? cfg.color : T.inkFaint,
              fontSize: 12, fontWeight: active ? 700 : 500, fontFamily: "Inter, sans-serif", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", transition: "all 0.12s",
            }}
          >
            <span>{cfg.icon}</span>
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
}

function LearnerMarkRow({ learner, entry, onStatusChange, onNotesChange }) {
  const initials = `${learner.firstName?.[0] ?? ""}${learner.lastName?.[0] ?? ""}`.toUpperCase();
  const status = entry?.status || "present";
  return (
    <div style={{ padding: "14px 18px", borderBottom: "1px solid #F9FAFB", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #25476a, #2e7db5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
          {initials || "?"}
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.ink }}>{learner.firstName} {learner.lastName}</p>
          <p style={{ margin: "1px 0 0", fontSize: 11, color: T.inkFaint }}>{learner.admissionNumber || "No ID"}</p>
        </div>
        <StatusSegmented value={status} onChange={(s) => onStatusChange(learner.id, s)} />
      </div>
      {status !== "present" && (
        <input
          type="text"
          value={entry?.notes || ""}
          onChange={(e) => onNotesChange(learner.id, e.target.value)}
          placeholder={`Reason (optional) — e.g. ${status === "absent" ? "sick, family emergency" : status === "late" ? "traffic, overslept" : "appointment"}`}
          style={{ marginLeft: 46, padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 12.5, fontFamily: "Inter, sans-serif", outline: "none", backgroundColor: "#F9FAFB" }}
        />
      )}
    </div>
  );
}

function HistoryRow({ row }) {
  const rateColor = row.rate === null ? T.inkFaint : row.rate >= 90 ? T.accent : row.rate >= 75 ? "#B45309" : "#EF4444";
  const initials = `${row.learner?.firstName?.[0] ?? ""}${row.learner?.lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: "1px solid #F9FAFB" }}>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [tab, setTab] = useState("mark");
  const [date, setDate] = useState(todayStr());
  const [draft, setDraft] = useState({});
  const [historyFrom, setHistoryFrom] = useState(() => addDays(todayStr(), -30));
  const [historyTo, setHistoryTo] = useState(() => todayStr());

  const { data: teachersData, isLoading: teacherLoading } = useQuery({
    queryKey: ["teachers", "byEmail", user?.email],
    queryFn: () => teacherApi.getAll({ email: user.email }),
    enabled: !!user?.email,
  });
  const teacher = teachersData?.data?.[0] || null;

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["classes", "bySchool", teacher?.schoolId],
    queryFn: () => classApi.getAll({ schoolId: teacher.schoolId }),
    enabled: !!teacher?.schoolId,
  });
  const myClasses = (classesData?.data || []).filter((c) => c.classTeacherId === teacher?.id);

  const classIdParam = searchParams.get("classId");
  const selectedClassId = (classIdParam && myClasses.some((c) => c.id === classIdParam)) ? classIdParam : myClasses[0]?.id;
  const selectedClass = myClasses.find((c) => c.id === selectedClassId) || null;

  const switchClass = (id) => setSearchParams({ classId: id });

  const { data: learnersData, isLoading: learnersLoading } = useQuery({
    queryKey: ["learners", "byClass", selectedClassId],
    queryFn: () => learnerApi.getAll({ classId: selectedClassId }),
    enabled: !!selectedClassId,
  });
  const learners = learnersData?.data || [];

  const { data: existingData, isLoading: existingLoading } = useAttendanceByDateQuery(selectedClassId, date);

  useEffect(() => {
    const map = {};
    for (const r of existingData?.data || []) map[r.learnerId] = { status: r.status, notes: r.notes || "" };
    setDraft(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, date, existingData]);

  const setLearnerStatus = (learnerId, status) =>
    setDraft((d) => ({ ...d, [learnerId]: { status, notes: status === "present" ? "" : (d[learnerId]?.notes || "") } }));
  const setLearnerNotes = (learnerId, notes) =>
    setDraft((d) => ({ ...d, [learnerId]: { status: d[learnerId]?.status || "present", notes } }));

  const { mutate: markAttendance, isPending: saving } = useMarkAttendance();

  const handleSave = () => {
    const records = learners.map((l) => ({
      learnerId: l.id,
      status: draft[l.id]?.status || "present",
      notes: draft[l.id]?.notes || "",
    }));
    markAttendance({ classId: selectedClassId, date, records });
  };

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const l of learners) {
      const status = draft[l.id]?.status || "present";
      c[status] = (c[status] || 0) + 1;
    }
    return c;
  }, [learners, draft]);
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

  const isLoading = teacherLoading || (!!teacher && classesLoading);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "28px 32px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px 0", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>Attendance</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
            {selectedClass ? `${selectedClass.gradeName} · Academic Year ${selectedClass.academicYear}` : "Mark daily attendance and review history for your classes."}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14 }}>Loading…</div>
      ) : !teacher ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>👩‍🏫</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No teacher profile linked yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Ask your school admin to add you as a teacher using this same email address.</p>
        </div>
      ) : myClasses.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>📋</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No classes assigned yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>You're not currently set as the class teacher for any class.</p>
        </div>
      ) : (
        <>
          {myClasses.length > 1 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {myClasses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => switchClass(c.id)}
                  style={{
                    padding: "8px 16px", borderRadius: 20, border: `1.5px solid ${c.id === selectedClassId ? T.accent : T.border}`,
                    backgroundColor: c.id === selectedClassId ? T.accent : "#fff", color: c.id === selectedClassId ? "#fff" : T.inkMuted,
                    fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer",
                  }}
                >
                  {c.gradeName}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "inline-flex", padding: 4, backgroundColor: "#fff", borderRadius: 12, border: `1.5px solid ${T.border}`, gap: 4, alignSelf: "flex-start" }}>
            {[{ key: "mark", label: "Mark Attendance" }, { key: "history", label: "History" }].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  padding: "8px 18px", borderRadius: 9, border: "none", fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer",
                  backgroundColor: tab === t.key ? T.accent : "transparent", color: tab === t.key ? "#fff" : T.inkMuted, transition: "all 0.15s",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "mark" ? (
            <>
              <div style={{ ...cardStyle, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || learners.length === 0}
                  style={{ padding: "10px 22px", backgroundColor: saving ? "#b8d9ee" : T.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: saving ? "not-allowed" : "pointer" }}
                >
                  {saving ? "Saving…" : "Save Attendance"}
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                <StatTile icon="✅" num={counts.present} label="Present" color={STATUS_CONFIG.present.color} />
                <StatTile icon="❌" num={counts.absent} label="Absent" color={STATUS_CONFIG.absent.color} />
                <StatTile icon="⏰" num={counts.late} label="Late" color={STATUS_CONFIG.late.color} />
                <StatTile icon="📝" num={counts.excused} label="Excused" color={STATUS_CONFIG.excused.color} />
                <StatTile icon="📊" num={`${rate}%`} label="Attendance Rate" />
              </div>

              <div style={{ ...cardStyle, overflow: "hidden" }}>
                {learnersLoading || existingLoading ? (
                  <div style={{ padding: 40, textAlign: "center", color: T.inkFaint, fontSize: 14 }}>Loading roster…</div>
                ) : learners.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: T.inkFaint, fontSize: 14 }}>No learners enrolled in this class yet.</div>
                ) : (
                  learners.map((l) => (
                    <LearnerMarkRow key={l.id} learner={l} entry={draft[l.id]} onStatusChange={setLearnerStatus} onNotesChange={setLearnerNotes} />
                  ))
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
            </>
          )}
        </>
      )}
    </div>
  );
}
