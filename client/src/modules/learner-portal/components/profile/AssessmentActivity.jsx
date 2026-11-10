import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { FiActivity, FiArrowRight, FiCheckCircle, FiClock, FiEdit3, FiFileText, FiSlash, FiX } from "react-icons/fi";
import { assessmentSubmissionApi } from "../../../assessments/services/assessmentSubmissionApi";
import { useReport } from "../../../reports/hooks/useReports";
import ReportView, { LevelPill } from "../../../reports/components/ReportView";
import { levelFor } from "../../../reports/utils/reportView";
import { usePortalNavigate } from "../../utils/usePortalNavigate";
import { T, KID_FONT, GLASS } from "./theme";

// A year of the learner's assessment work, a square per day, like a GitHub contributions graph
// (10 Nov 2026). It sits on the profile banner. Server: GET /api/assessment-submissions/learner/
// :learnerId/activity (learner-activity.service.js): one entry per piece of work, on the day it was
// handed in (a draft: last saved). Clicking a day lists that day's work with its state and what to
// open: the assessment, and the session's report ("Report so far" while some of it is still to be
// marked). `staff` (the staff learner page, its preview too): no learner-portal links; a report
// opens over the page.

const CELL = 11;
const GAP = 3;
const LABELS_W = 26;
const SHADES = ["rgba(255,255,255,0.13)", "#FDE3B0", "#FCC96A", "#FEB139", "#E58A00"];
const shadeFor = (n) => SHADES[Math.min(4, n)];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fmt = (date) => date.toISOString().slice(0, 10);
const longDay = (s) => parse(s).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const shortDay = (s) => parse(s).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
const shortDate = (v) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Nairobi" }) : null);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export const STATE = {
  marked: { label: "Marked", icon: FiCheckCircle, color: "#25476a", soft: "#E3EEF8" },
  waiting: { label: "Waiting for marking", icon: FiClock, color: "#2e7db5", soft: "#EAF6FD" },
  in_progress: { label: "In progress", icon: FiEdit3, color: "#9A6300", soft: "#FFF5E1" },
  revoked: { label: "Taken back", icon: FiSlash, color: "#6B7280", soft: "#F3F4F6" },
};

// Weeks (columns, Sunday first) from `from` to `to`, each day with its entries.
function buildWeeks(from, to, byDay) {
  const start = parse(from);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const end = parse(to);
  const weeks = [];
  for (let d = new Date(start); d <= end;) {
    const week = [];
    for (let i = 0; i < 7; i += 1) {
      const key = fmt(d);
      week.push(key < from || key > to ? null : { date: key, entries: byDay.get(key) || [] });
      d.setUTCDate(d.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function useLearnerActivity(learnerId) {
  return useQuery({
    queryKey: ["learner-activity", learnerId],
    queryFn: () => assessmentSubmissionApi.getLearnerActivity(learnerId),
    enabled: !!learnerId,
    staleTime: 60_000,
  });
}

export default function AssessmentActivity({ learnerId, firstName = "", staff = false, own = false }) {
  const { data, isLoading, isError } = useLearnerActivity(learnerId);
  const [openDay, setOpenDay] = useState(null);
  const [hover, setHover] = useState(null);
  const scroller = useRef(null);
  const box = useRef(null);
  const row = useRef(null);
  const [rowWidth, setRowWidth] = useState(0);

  // The squares grow or shrink so the whole year fits the card (7–14px); only below 7px does it
  // scroll, opened on the latest weeks.
  useLayoutEffect(() => {
    const el = row.current;
    if (!el) return undefined;
    const measure = () => setRowWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isError]);

  const { weeks, byDay, totals } = useMemo(() => {
    const map = new Map();
    const t = { all: 0, days: 0, marked: 0, waiting: 0, in_progress: 0 };
    for (const e of data?.entries || []) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
      t.all += 1;
      if (t[e.state] !== undefined) t[e.state] += 1;
    }
    t.days = map.size;
    return { byDay: map, totals: t, weeks: data ? buildWeeks(data.from, data.to, map) : [] };
  }, [data]);


  const monthLabels = useMemo(() => {
    const labels = [];
    let last = -1;
    weeks.forEach((week, i) => {
      const first = week.find(Boolean);
      if (!first) return;
      const m = parse(first.date).getUTCMonth();
      if (m !== last) {
        // Skip a label squeezed against the next one at the very start.
        if (!(i === 0 && parse(first.date).getUTCDate() > 21)) labels.push({ i, text: MONTHS[m] });
        last = m;
      }
    });
    return labels;
  }, [weeks]);

  const cols = Math.max(1, weeks.length);
  const cell = rowWidth ? Math.max(7, Math.min(14, Math.floor((rowWidth - LABELS_W - 6) / cols) - GAP)) : CELL;
  const step = cell + GAP;
  const width = cols * step - GAP;

  // Open on the latest weeks when it still doesn't fit.
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, [weeks.length, cell]);

  return (
    <section ref={box} aria-label="Assessment activity" style={{ ...GLASS, position: "relative", flex: 1, minWidth: 0, maxWidth: "100%", padding: "18px 18px 14px", color: "#fff", fontFamily: KID_FONT, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 14.5, fontWeight: 900 }}>
          <span aria-hidden style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: "#fff", color: T.accent, display: "grid", placeItems: "center" }}><FiActivity size={14} /></span>
          {isLoading ? "Loading activity…" : `${plural(totals.all, "assessment", "assessments")} in the last year`}
        </p>
        {!isLoading && totals.all > 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>Active on {plural(totals.days, "day", "days")}</span>
        )}
      </div>

      {isError ? (
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>The activity couldn’t be loaded.</p>
      ) : (
        <div ref={row} style={{ display: "flex", gap: 6, flex: 1, alignItems: "center", justifyContent: "center", minWidth: 0 }}>
          <div aria-hidden style={{ width: LABELS_W, paddingTop: 16, display: "grid", gridTemplateRows: `repeat(7, ${cell}px)`, rowGap: GAP, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.75)", flexShrink: 0 }}>
            {["", "Mon", "", "Wed", "", "Fri", ""].map((d, i) => <span key={i} style={{ lineHeight: `${cell}px` }}>{d}</span>)}
          </div>
          <div ref={scroller} className="aa-scroll" style={{ overflowX: "auto", overflowY: "hidden", minWidth: 0, paddingBottom: 4, position: "relative" }}>
            <div style={{ position: "relative", width, height: 16 }} aria-hidden>
              {monthLabels.map((m) => (
                <span key={`${m.i}-${m.text}`} style={{ position: "absolute", left: m.i * step, top: 0, fontSize: 10.5, fontWeight: 800, color: "rgba(255,255,255,0.85)" }}>{m.text}</span>
              ))}
            </div>
            <div role="grid" aria-label="Assessments by day" style={{ display: "grid", gridAutoFlow: "column", gridTemplateRows: `repeat(7, ${cell}px)`, gridAutoColumns: `${cell}px`, gap: GAP, width }}>
              {weeks.flatMap((week, wi) => week.map((day, di) => {
                if (!day) return <span key={`${wi}-${di}`} aria-hidden />;
                const n = day.entries.length;
                const label = n ? `${plural(n, "assessment", "assessments")} on ${shortDay(day.date)}` : `No assessments on ${shortDay(day.date)}`;
                const today = day.date === data?.to;
                return (
                  <button
                    key={day.date}
                    type="button"
                    aria-label={label}
                    onClick={() => n && setOpenDay(day.date)}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const outer = box.current?.getBoundingClientRect();
                      if (outer) setHover({ label, x: rect.left - outer.left + rect.width / 2, y: rect.top - outer.top });
                    }}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(null)}
                    style={{
                      width: cell, height: cell, padding: 0, borderRadius: cell > 10 ? 3 : 2, border: today ? "1.5px solid #fff" : "none",
                      backgroundColor: shadeFor(n), cursor: n ? "pointer" : "default",
                      outline: openDay === day.date ? "2px solid #fff" : "none", outlineOffset: 1,
                    }}
                  />
                );
              }))}
            </div>
          </div>
        </div>
      )}

      {hover && (
        <div role="tooltip" style={{ position: "absolute", left: hover.x, top: hover.y - 6, transform: "translate(-50%, -100%)", pointerEvents: "none", padding: "5px 9px", borderRadius: 7, backgroundColor: "#1F2937", color: "#fff", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(0,0,0,0.25)", zIndex: 3 }}>
          {hover.label}
        </div>
      )}

      <div aria-hidden style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3, marginTop: 6, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>
        <span style={{ marginRight: 3 }}>Less</span>
        {SHADES.map((c) => <span key={c} style={{ width: CELL, height: CELL, borderRadius: 3, backgroundColor: c }} />)}
        <span style={{ marginLeft: 3 }}>More</span>
      </div>

      {/* Where the year's work stands: marked, waiting for marking, in progress. */}
      {!isLoading && totals.all === 0 ? (
        <p style={{ margin: "12px 0 0", fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{own ? "Your work will show here as you do it." : "Work handed in will show here."}</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 12 }}>
          {["marked", "waiting", "in_progress"].map((k) => {
            const Icon = STATE[k].icon;
            return (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", minWidth: 0 }}>
                <span aria-hidden className="aa-stat-icon" style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.14)", color: "#FDE3B0", placeItems: "center", flexShrink: 0 }}><Icon size={14} /></span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 17, fontWeight: 900, lineHeight: 1.1 }}>{isLoading ? "…" : totals[k]}</p>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.75)", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k === "waiting" ? "Waiting" : STATE[k].label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`.aa-scroll::-webkit-scrollbar{height:6px}.aa-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.3);border-radius:3px}.aa-stat-icon{display:grid}@media (max-width:480px){.aa-stat-icon{display:none}}`}</style>

      {openDay && (
        <DayDialog date={openDay} entries={byDay.get(openDay) || []} staff={staff} own={own} firstName={firstName} onClose={() => setOpenDay(null)} />
      )}
    </section>
  );
}

// Close on Escape, keep the page from scrolling behind.
function useDialogKeys(onClose) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
}

// On the page body: the banner clips what's inside it, and the panel's blur would otherwise make
// "fixed" measure from the panel instead of the screen.
function Overlay({ children, onClose, width = 560, label }) {
  return createPortal(
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1300, backgroundColor: "rgba(15, 30, 50, 0.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px", overflowY: "auto" }}>
      <div role="dialog" aria-modal="true" aria-label={label}
        style={{ width: "100%", maxWidth: width, backgroundColor: "#fff", borderRadius: 22, boxShadow: "0 24px 60px rgba(0,0,0,0.3)", fontFamily: KID_FONT, color: T.ink, overflow: "hidden" }}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

const actionBtn = (primary) => ({
  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 11, cursor: "pointer",
  fontFamily: KID_FONT, fontSize: 13, fontWeight: 800,
  border: primary ? "none" : `1.5px solid ${T.tintBorder}`,
  backgroundColor: primary ? T.accent : "#fff", color: primary ? "#fff" : T.accent,
});

function DayDialog({ date, entries, staff, own, firstName, onClose }) {
  useDialogKeys(onClose);
  const navigate = usePortalNavigate();
  const [reportId, setReportId] = useState(null);
  const go = (to) => { onClose(); navigate(to); };

  return (
    <>
      <Overlay onClose={onClose} label={`Assessments on ${longDay(date)}`}>
        <div style={{ padding: "18px 20px 14px", background: "linear-gradient(135deg, #25476a, #2e7db5)", color: "#fff", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: "rgba(255,255,255,0.8)" }}>{plural(entries.length, "assessment", "assessments")}</p>
            <h2 style={{ margin: "2px 0 0", fontSize: 19, fontWeight: 900 }}>{longDay(date)}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ width: 34, height: 34, borderRadius: 10, border: "none", backgroundColor: "rgba(255,255,255,0.18)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <FiX size={17} />
          </button>
        </div>
        <div style={{ padding: "6px 20px 18px" }}>
          {entries.map((e) => {
            const look = STATE[e.state] || STATE.waiting;
            const Icon = look.icon;
            const level = e.state === "marked" && e.percent != null ? levelFor(e.percent) : null;
            const where = [e.courseName, e.sessionTitle].filter(Boolean).join(" · ");
            const when = [e.submittedAt && `Handed in ${shortDate(e.submittedAt)}`, e.markedAt && `marked ${shortDate(e.markedAt)}`].filter(Boolean).join(", ");
            const openLabel = e.state === "in_progress" ? (own ? "Carry on" : "Open") : e.state === "marked" ? (own ? "See my result" : "See the result") : "Open";
            return (
              <div key={e.id} style={{ padding: "14px 0", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span aria-hidden style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: level ? level.soft : look.soft, color: level ? level.color : look.color, border: `1.5px solid ${level ? level.border : "transparent"}`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Icon size={18} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: T.ink, overflowWrap: "anywhere" }}>{e.assessmentName}</p>
                  {where && <p style={{ margin: "2px 0 0", fontSize: 12.5, fontWeight: 700, color: T.inkMuted }}>{where}</p>}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 7 }}>
                    {level ? <LevelPill level={level} small /> : (
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: look.color, backgroundColor: look.soft, borderRadius: 999, padding: "2px 9px" }}>{look.label}</span>
                    )}
                    {staff && level && <span style={{ fontSize: 12, fontWeight: 800, color: T.inkMuted }}>{e.percent}%</span>}
                    {e.reissue && <span style={{ fontSize: 11.5, fontWeight: 700, color: T.inkMuted }}>Another try</span>}
                    {when && <span style={{ fontSize: 12, color: T.inkFaint }}>{when}</span>}
                  </div>
                  {e.state === "revoked" && <p style={{ margin: "6px 0 0", fontSize: 12.5, color: T.inkMuted }}>The teacher took this one back, so it no longer counts.</p>}
                  {(e.issueId || e.reportId) && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                      {!staff && e.issueId && (
                        <button type="button" style={actionBtn(true)} onClick={() => go(`/learner-portal/assessments/${e.issueId}`)}>
                          {openLabel} <FiArrowRight size={14} />
                        </button>
                      )}
                      {e.reportId && (
                        <button type="button" style={actionBtn(staff || !e.issueId)}
                          onClick={() => (staff ? setReportId(e.reportId) : go(`/learner-portal/reports/${e.reportId}`))}>
                          <FiFileText size={14} /> {e.reportSoFar ? "Session report so far" : "Session report"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Overlay>
      {reportId && <ReportDialog id={reportId} firstName={firstName} onClose={() => setReportId(null)} />}
    </>
  );
}

// Staff read a session report over their page (they have no learner-portal pages to go to).
function ReportDialog({ id, firstName, onClose }) {
  const { data: report, isLoading, isError } = useReport(id);
  return (
    <Overlay onClose={onClose} width={1040} label="Session report">
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 14px 0" }}>
        <button type="button" onClick={onClose} aria-label="Close" style={{ width: 34, height: 34, borderRadius: 10, border: `1.5px solid ${T.border}`, backgroundColor: "#fff", color: T.ink, cursor: "pointer", display: "grid", placeItems: "center" }}>
          <FiX size={17} />
        </button>
      </div>
      <div style={{ padding: "4px 18px 20px" }}>
        {isLoading && <p style={{ margin: 0, color: T.inkMuted }}>Loading the report…</p>}
        {isError && <p style={{ margin: 0, color: T.inkMuted }}>The report couldn’t be loaded.</p>}
        {report && <ReportView report={report} audience="staff" firstName={firstName} showMarks />}
      </div>
    </Overlay>
  );
}
