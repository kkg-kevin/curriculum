import { useQuery } from "@tanstack/react-query";
import { FiArchive, FiArrowRight, FiCalendar, FiPlayCircle } from "react-icons/fi";
import { classApi } from "../services/classApi";

// A bootcamp run's class, told apart from the same bootcamp's other runs (26 Nov 2026). Runs of one
// bootcamp at one hub share the curriculum, so a class says which run it is (its dates) and where
// that run stands — Upcoming, Running, Ended. The server sends `bootcampRun` and `movedOnCount` on
// every class (classes/class-former-members.js); a class that isn't a run's has bootcampRun null.

const fmt = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

const LOOK = {
  running:  { label: "Running now", icon: FiPlayCircle, bg: "#ECFDF5", color: "#047857", border: "#A7F3D0", dark: "rgba(16,185,129,0.25)" },
  upcoming: { label: "Upcoming",    icon: FiCalendar,   bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE", dark: "rgba(59,130,246,0.25)" },
  ended:    { label: "Run ended",   icon: FiArchive,    bg: "#F3F4F6", color: "#4B5563", border: "#D1D5DB", dark: "rgba(255,255,255,0.18)" },
};

export const isEndedRun = (cls) => cls?.bootcampRun?.state === "ended";

// "3 Aug – 14 Aug 2026"
export function runDates(run) {
  if (!run) return "";
  return [fmt(run.startDate), fmt(run.endDate)].filter(Boolean).join(" – ");
}

// The pill: state + the run's dates. `onDark` for the gradient page headers.
export default function ClassRunBadge({ cls, onDark = false, showDates = true, style }) {
  const run = cls?.bootcampRun;
  if (!run) return null;
  const look = LOOK[run.state] || LOOK.running;
  const Icon = look.icon;
  return (
    <span
      title={`${run.name}: ${runDates(run)}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
        backgroundColor: onDark ? look.dark : look.bg, color: onDark ? "#fff" : look.color, border: `1px solid ${onDark ? "rgba(255,255,255,0.3)" : look.border}`,
        ...style,
      }}
    >
      <Icon size={11} /> {look.label}{showDates ? ` · ${runDates(run)}` : ""}
    </span>
  );
}

// On an ended run's class page: what this class is now, so nobody takes attendance or issues work
// on the wrong one.
export function EndedRunBanner({ cls, style }) {
  if (!isEndedRun(cls)) return null;
  const run = cls.bootcampRun;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 16px", borderRadius: 12, background: "#F9FAFB", border: "1.5px dashed #D1D5DB", color: "#374151", fontSize: 13, lineHeight: 1.55, ...style }}>
      <FiArchive size={18} style={{ flexShrink: 0, marginTop: 2, color: "#6B7280" }} />
      <div>
        <strong>This class is from an earlier run of {run.name}</strong> ({runDates(run)}), which has ended.
        {" "}Use it to finish the run: marking, reports and certificates.
        {cls.movedOnCount > 0 && <> {cls.movedOnCount} learner{cls.movedOnCount === 1 ? " has" : "s have"} moved on to the next run and {cls.movedOnCount === 1 ? "is" : "are"} still listed here under <strong>Moved on</strong>.</>}
        {" "}New lessons, attendance and assessments belong in the current run&rsquo;s class.
      </div>
    </div>
  );
}

// "Moved on": learners who went on to the next run of the same bootcamp. Their work for this run
// is still marked, reported and certified here. `onOpen(learner)` opens a learner (staff only).
export function MovedOnSection({ classId, onOpen, style }) {
  const { data: rows = [] } = useQuery({
    queryKey: ["classes", "moved-on", classId],
    queryFn: () => classApi.movedOn(classId),
    enabled: !!classId,
  });
  if (!rows.length) return null;
  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB", overflow: "hidden", ...style }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #F3F4F6", background: "#FAFAFA" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#111827" }}>Moved on ({rows.length})</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6B7280" }}>In the next run now. Their work for this run is still marked, reported and certified here.</p>
      </div>
      {rows.map((l) => (
        <div
          key={l.id}
          role={onOpen ? "button" : undefined}
          tabIndex={onOpen ? 0 : undefined}
          onClick={onOpen ? () => onOpen(l) : undefined}
          onKeyDown={onOpen ? (e) => { if (e.key === "Enter") onOpen(l); } : undefined}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: "1px solid #F3F4F6", cursor: onOpen ? "pointer" : "default" }}
        >
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#E5E7EB", color: "#4B5563", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0, overflow: "hidden" }}>
            {l.photo ? <img src={l.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : `${(l.firstName || "?")[0]}${(l.lastName || "")[0] || ""}`}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#111827" }}>{[l.firstName, l.lastName].filter(Boolean).join(" ")}</p>
            <p style={{ margin: 0, fontSize: 12, color: "#6B7280", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
              <FiArrowRight size={11} /> {l.movedTo || "The next run"}{l.movedAt ? ` · ${new Date(l.movedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
            </p>
          </div>
          <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#F3F4F6", color: "#4B5563", border: "1px solid #D1D5DB", whiteSpace: "nowrap" }}>Moved on</span>
        </div>
      ))}
    </div>
  );
}

// The small tag for rows on marking / report lists.
export function MovedOnTag({ movedOn }) {
  if (!movedOn) return null;
  return (
    <span title={movedOn.to ? `Now in ${movedOn.to}` : "Moved on to the next run"} style={{ marginLeft: 6, padding: "1px 7px", borderRadius: 20, fontSize: 10.5, fontWeight: 700, background: "#F3F4F6", color: "#4B5563", border: "1px solid #D1D5DB", whiteSpace: "nowrap", verticalAlign: "middle" }}>
      Moved on
    </span>
  );
}
