import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  FiAward, FiCheckCircle, FiTrendingUp, FiBookOpen, FiCompass, FiStar, FiCheck, FiLock, FiHome, FiCalendar, FiLayers, FiTarget, FiMap, FiUsers,
} from "react-icons/fi";
import { usePublicLearnerProfile } from "../hooks/useLearners";
import { formatClassName } from "../../classes/utils/classDisplay";
import { formatAgeRange } from "../utils/ageRange";
import { BRAND_NAME } from "../../../branding";
import CertificatesCard from "../../certificates/components/CertificatesCard";
import { verifyUrl } from "../../certificates/utils/certificate";

const GRAD_FROM = "#1a3550";
const GRAD_TO = "#38aae1";
const ACCENT = "#25476a";
const GOLD = "#feb139";
const GREEN = "#059669";
const AMBER = "#D97706";
const BORDER = "#E6EBF2";
const INK = "#111827";
const INK_MUTED = "#6B7280";
const INK_FAINT = "#9CA3AF";

// Scoped global styles rather than inline style objects, same pattern AuthLayout.jsx already uses
// for its own standalone (outside MainLayout) full-page shell — inline JS style objects can't
// express @media breakpoints. This is a full page (a hero band, then sections on the page's own
// background), not a card floating on a gradient: the link is opened on desktops as often as it's
// scanned on a phone, and one hub's levels/competencies/pathways need the width.
function PageStyles() {
  return (
    <style>{`
      .df-pp { min-height: 100vh; background-color: #F3F6FA; font-family: 'Inter', sans-serif; color: ${INK}; }
      .df-pp-wrap { max-width: 1120px; margin: 0 auto; }
      .df-pp-hero {
        background: linear-gradient(135deg, ${GRAD_FROM} 0%, ${ACCENT} 45%, ${GRAD_TO} 100%);
        padding: 20px 16px 76px; position: relative; overflow: hidden;
      }
      .df-pp-hero-inner { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px; position: relative; padding-top: 20px; }
      .df-pp-body { max-width: 1120px; margin: -52px auto 0; padding: 0 16px 40px; display: flex; flex-direction: column; gap: 16px; position: relative; }
      .df-pp-card { background-color: #fff; border: 1px solid ${BORDER}; border-radius: 16px; padding: 20px; box-shadow: 0 1px 2px rgba(16,24,40,0.04); }
      .df-pp-facts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
      .df-pp-tabs { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px; }
      .df-pp-tab {
        flex: 0 0 auto; min-width: 150px; text-align: left; padding: 10px 14px; border-radius: 12px; cursor: pointer;
        font-family: inherit; background-color: #fff; border: 1.5px solid ${BORDER}; color: ${INK}; transition: border-color 0.15s ease, background-color 0.15s ease;
      }
      .df-pp-tab:hover { border-color: ${GRAD_TO}; }
      .df-pp-tab[aria-selected="true"] { background-color: ${ACCENT}; border-color: ${ACCENT}; color: #fff; }
      .df-pp-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
      .df-pp-level { display: grid; grid-template-columns: 1fr; gap: 24px; align-items: center; }
      .df-pp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
      .df-pp-two { display: grid; grid-template-columns: 1fr; gap: 16px; align-items: start; }
      @media (min-width: 720px) {
        .df-pp-hero { padding: 24px 32px 92px; }
        .df-pp-hero-inner { flex-direction: row; text-align: left; gap: 24px; }
        .df-pp-body { padding: 0 32px 56px; gap: 20px; }
        .df-pp-card { padding: 24px 28px; }
        .df-pp-facts { grid-template-columns: repeat(5, 1fr); }
        .df-pp-stats { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
      }
      @media (min-width: 900px) {
        .df-pp-level { grid-template-columns: 300px 1fr; gap: 36px; }
        .df-pp-two { grid-template-columns: 1fr 1fr; }
      }
      .df-pp-state { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px; }
      @keyframes df-lj-pulse-glow {
        0%, 100% { transform: scale(0.94); opacity: 0.9; }
        50% { transform: scale(1.12); opacity: 0.35; }
      }
      .df-lj-pulse { animation: df-lj-pulse-glow 2.2s ease-in-out infinite; }
    `}</style>
  );
}

function SectionHeading({ icon: Icon, title, aside }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: "#e8f5fb", color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={15} />
        </div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: INK }}>{title}</h2>
      </div>
      {aside}
    </div>
  );
}

function Chip({ label, color, bg }) {
  return <span style={{ fontSize: 11, fontWeight: 700, color, backgroundColor: bg, borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap", flexShrink: 0 }}>{label}</span>;
}

function EmptyNote({ children }) {
  return <p style={{ margin: 0, fontSize: 13, color: INK_MUTED, lineHeight: 1.5 }}>{children}</p>;
}

// White-on-gradient avatar — a translucent fill (rather than this file's own brand gradient) so a
// photo-less learner's initials still read clearly sitting on top of the hero's own gradient,
// plus a soft ring so either variant (photo or initials) reads as one deliberate mark rather than
// a floating image. Initials render immediately as the base layer — the photo is layered on top
// and only faded in once it's confirmed loaded (onLoad), rather than optimistically rendering the
// <img> and reacting only to onError. A QR scan is often the first thing to happen on flaky
// school WiFi, and an in-flight photo request can otherwise sit for seconds with nothing on
// screen but a blank ring; initials-first means there's never a moment with nothing to look at.
function Avatar({ firstName, lastName, photo }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  const ring = { border: "3px solid rgba(255,255,255,0.55)", boxShadow: "0 6px 18px rgba(0,0,0,0.18)" };
  const showPhoto = !!photo && !imgFailed;
  return (
    <div style={{ position: "relative", width: 104, height: 104, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 800, color: "#ffffff", flexShrink: 0, ...ring }}>
      {initials || "?"}
      {showPhoto && (
        <img
          src={photo}
          alt={`${firstName || ""} ${lastName || ""}`.trim()}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgFailed(true)}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover",
            opacity: imgLoaded ? 1 : 0, transition: "opacity 0.25s ease",
          }}
        />
      )}
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: INK_FAINT, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <span style={{ fontSize: 14, color: value ? INK : INK_FAINT, fontWeight: 600, overflowWrap: "anywhere" }}>{value || "—"}</span>
    </div>
  );
}

// A percent ring with whatever sits in its centre — the one shape the level, each competency and
// each ladder node all share, so a glance at any of them reads the same way.
function Ring({ percent, size, stroke, color, track = "#EEF2F6", children }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent || 0));
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - clamped / 100)} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>{children}</div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, sub, tint = "#FEF3E2", color = GOLD }) {
  return (
    <div className="df-pp-card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: tint, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={17} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: INK, lineHeight: 1.2, overflowWrap: "anywhere" }}>{value}</p>
        <p style={{ margin: "2px 0 0", fontSize: 11, fontWeight: 600, color: INK_MUTED }}>{label}</p>
        {sub && <p style={{ margin: "1px 0 0", fontSize: 10.5, color: INK_FAINT }}>{sub}</p>}
      </div>
    </div>
  );
}

/* ── Levels ───────────────────────────────────────────────────────────────── */

// achieved = filled gradient medal, current = gold percent ring + pulsing halo ("you are here"),
// locked = flat dashed disc with a padlock — same three-state visual language as the
// authenticated Progress Arc card (learner-portal's ProgressArcCard.jsx), rebuilt standalone here
// since this page is deliberately self-contained (no login, no shared portal component tree).
function LevelNode({ band, status, ordinal }) {
  const achieved = status === "achieved";
  const current = status === "current";
  const size = 64;
  const disc = (
    <div
      style={{
        position: "absolute", inset: current ? 8 : 0, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: achieved ? "linear-gradient(135deg, #34d399, #059669)" : current ? "#FFFBEB" : "#fff",
        border: achieved ? "none" : current ? `1px solid ${GOLD}` : `1.5px dashed #D1D5DB`,
        boxShadow: achieved ? "0 4px 12px rgba(5,150,105,0.35)" : "none",
        color: achieved ? "#fff" : current ? "#B45309" : INK_FAINT,
        fontSize: 12, fontWeight: 800,
      }}
    >
      {achieved ? <FiCheck size={20} /> : current ? `${Math.round(band.completion)}%` : <FiLock size={16} />}
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 92 }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        {current && <div className="df-lj-pulse" style={{ position: "absolute", inset: -5, borderRadius: "50%", backgroundColor: "rgba(254,177,57,0.28)" }} />}
        {current ? <Ring percent={band.completion} size={size} stroke={6} color={GOLD} track="#FDE9C0">{null}</Ring> : null}
        {disc}
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 9.5, fontWeight: 800, color: achieved ? GREEN : current ? "#B45309" : INK_FAINT, textTransform: "uppercase", letterSpacing: "0.06em" }}>Level {ordinal}</p>
        <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 700, color: achieved || current ? INK : INK_FAINT }}>{band.name}</p>
        <p style={{ margin: "1px 0 0", fontSize: 10.5, fontWeight: 700, color: achieved ? GREEN : current ? AMBER : INK_FAINT }}>
          {achieved ? "Unlocked" : current ? "In progress" : "Locked"}
        </p>
      </div>
    </div>
  );
}

function LevelConnector({ status, percent }) {
  const fillPercent = status === "achieved" ? 100 : status === "current" ? percent : 0;
  const active = status === "achieved" || status === "current";
  return (
    <div style={{ flex: 1, minWidth: 24, height: 6, borderRadius: 3, backgroundColor: "#EEF2F6", overflow: "hidden", marginTop: 29 }}>
      <div style={{ width: `${Math.min(100, Math.max(0, fillPercent))}%`, height: "100%", borderRadius: 3, background: active ? `linear-gradient(90deg, ${GREEN}, ${GOLD})` : "transparent", transition: "width 0.5s ease" }} />
    </div>
  );
}

function LevelSection({ levelJourney, currentLevel }) {
  if (!levelJourney || levelJourney.length === 0) {
    return <EmptyNote>Levels will appear here once this learner has been placed at a developmental stage in this hub.</EmptyNote>;
  }
  const nextIndex = currentLevel?.nextLevelName ? levelJourney.findIndex((b) => b.name === currentLevel.nextLevelName) : -1;
  // The "current"/next band can sit at any index (picked by highest completion, not strictly
  // "the band right after the last achieved one" — see the learner portal's own bandJourney.js).
  // The ladder is still sequential from the learner's point of view, though: being actively
  // worked toward a later band means every earlier one is already behind them, even if that
  // earlier band's own independently-weighted formula never technically cleared its own bar.
  // Both the badge count and the per-node status below agree on this, so they never contradict
  // each other (an earlier node showing "Locked" while a later one is "In progress" reads as
  // broken — how are you past a level you haven't unlocked?).
  const achievedCount = levelJourney.filter((bp, i) => bp.thresholdMet || (nextIndex !== -1 && i < nextIndex)).length;
  // A threshold of 0 means no admin has configured one yet, so a level only counts as "Unlocked"
  // at 100% — worth explaining, otherwise a learner sitting at a high percent with no threshold
  // set looks stalled for no visible reason.
  const noThresholdsConfigured = levelJourney.every((bp) => !bp.advancementThreshold || bp.advancementThreshold <= 0);
  const nextThreshold = nextIndex !== -1 ? (levelJourney[nextIndex].advancementThreshold > 0 ? levelJourney[nextIndex].advancementThreshold : 100) : null;
  const atTop = !currentLevel?.nextLevelName && !!currentLevel?.name;
  const nextPercent = Math.round(currentLevel?.nextLevelCompletion ?? 0);

  return (
    <>
      <div className="df-pp-level">
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Ring percent={atTop ? 100 : nextPercent} size={132} stroke={12} color={atTop ? GREEN : GOLD} track={atTop ? "#D1FAE5" : "#FDE9C0"}>
            {atTop ? (
              <FiAward size={34} color={GREEN} />
            ) : (
              <>
                <span style={{ fontSize: 28, fontWeight: 900, color: INK, lineHeight: 1 }}>{nextPercent}%</span>
                <span style={{ marginTop: 4, fontSize: 10, fontWeight: 700, color: INK_FAINT, textTransform: "uppercase", letterSpacing: "0.05em" }}>to next</span>
              </>
            )}
          </Ring>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, color: INK_FAINT, textTransform: "uppercase", letterSpacing: "0.06em" }}>Current level</p>
            <p style={{ margin: "3px 0 6px", fontSize: 22, fontWeight: 900, color: ACCENT, lineHeight: 1.15 }}>{currentLevel?.name || "Getting started"}</p>
            <p style={{ margin: 0, fontSize: 12.5, color: INK_MUTED, lineHeight: 1.5 }}>
              {currentLevel?.nextLevelName
                ? `${nextPercent}% of the way to ${currentLevel.nextLevelName}. ${nextThreshold}% unlocks it.`
                : atTop
                ? "The highest level on this ladder."
                : "Working toward the first level."}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", overflowX: "auto", padding: "8px 4px 4px" }}>
          {levelJourney.map((bp, i) => {
            const status = bp.thresholdMet ? "achieved" : i === nextIndex ? "current" : nextIndex !== -1 && i < nextIndex ? "achieved" : "locked";
            return (
              <div key={bp.name} style={{ display: "flex", alignItems: "flex-start", flex: i === levelJourney.length - 1 ? "0 0 auto" : 1 }}>
                <LevelNode band={bp} status={status} ordinal={i + 1} />
                {i < levelJourney.length - 1 && <LevelConnector status={status} percent={bp.completion} />}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <Chip label={`${achievedCount} of ${levelJourney.length} levels unlocked`} color="#B45309" bg="#FEF3C7" />
        {noThresholdsConfigured && achievedCount === 0 && (
          <span style={{ fontSize: 11, color: INK_FAINT, fontStyle: "italic" }}>
            No advancement threshold is set on these levels yet, so a level only counts as unlocked once it's 100% complete.
          </span>
        )}
      </div>
    </>
  );
}

/* ── Competencies ─────────────────────────────────────────────────────────── */

// One card per competency in the curriculum — scored ones show their ring, band and where the
// score sits against the competency's own target; unscored ones stay in the grid, greyed, so the
// page shows the whole picture rather than only what happens to have been assessed.
function CompetencyCard({ competency }) {
  const scored = competency.score != null;
  const color = !scored ? INK_FAINT : competency.onTrack ? GREEN : AMBER;
  const status = !scored
    ? { label: "Not assessed yet", color: INK_MUTED, bg: "#F3F4F6" }
    : competency.onTrack
    ? { label: "On track", color: "#047857", bg: "#ECFDF5" }
    : { label: "Still building", color: "#B45309", bg: "#FEF3C7" };
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, backgroundColor: scored ? "#fff" : "#FAFBFC", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Ring percent={scored ? competency.score : 0} size={58} stroke={6} color={color}>
          <span style={{ fontSize: scored ? 14 : 16, fontWeight: 800, color: scored ? INK : INK_FAINT }}>{scored ? `${Math.round(competency.score)}%` : "–"}</span>
        </Ring>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: scored ? INK : INK_MUTED, lineHeight: 1.3 }}>{competency.name}</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {competency.band && <Chip label={competency.band} color={ACCENT} bg="#e8f5fb" />}
            <Chip {...status} />
          </div>
        </div>
      </div>
      {scored && (
        <div>
          <div style={{ position: "relative", height: 8, borderRadius: 4, backgroundColor: "#EEF2F6" }}>
            <div style={{ width: `${Math.min(100, Math.max(0, competency.score))}%`, height: "100%", borderRadius: 4, backgroundColor: color }} />
            <div title={`Target ${competency.threshold}%`} style={{ position: "absolute", top: -3, left: `${Math.min(100, Math.max(0, competency.threshold))}%`, width: 2, height: 14, backgroundColor: INK, borderRadius: 1, transform: "translateX(-1px)" }} />
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 10.5, color: INK_FAINT }}>Target {competency.threshold}%</p>
        </div>
      )}
    </div>
  );
}

function CompetenciesSection({ competencies }) {
  if (!competencies || competencies.length === 0) {
    return <EmptyNote>No competencies are set up for this hub's curriculum yet.</EmptyNote>;
  }
  const sorted = [...competencies].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return <div className="df-pp-grid">{sorted.map((c) => <CompetencyCard key={c.name} competency={c} />)}</div>;
}

/* ── Pathways ─────────────────────────────────────────────────────────────── */

// The learner's place on one Pathway's course ladder, as filled segments (one per course) when
// the ladder is short enough to read that way, a plain bar when it isn't.
function PathwaySteps({ step, total }) {
  if (!total || !step) return null;
  if (total > 10) {
    return (
      <div style={{ height: 6, borderRadius: 3, backgroundColor: "#EEF2F6", overflow: "hidden" }}>
        <div style={{ width: `${(step / total) * 100}%`, height: "100%", backgroundColor: GRAD_TO }} />
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < step - 1 ? GREEN : i === step - 1 ? GOLD : "#EEF2F6" }} />
      ))}
    </div>
  );
}

function PathwayCard({ pathway }) {
  const hasCourse = !!pathway.currentCourseName;
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 12, backgroundColor: "#fff" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#e8f5fb", color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <FiMap size={15} />
        </div>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: INK, lineHeight: 1.35, flex: 1 }}>{pathway.name}</p>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, color: INK_FAINT, textTransform: "uppercase", letterSpacing: "0.06em" }}>Current course</p>
        <p style={{ margin: "3px 0 0", fontSize: 14, fontWeight: 700, color: hasCourse ? ACCENT : INK_FAINT }}>{pathway.currentCourseName || "No course yet"}</p>
      </div>
      <PathwaySteps step={pathway.step} total={pathway.totalCourses} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: "auto" }}>
        <span style={{ fontSize: 11.5, color: INK_MUTED }}>
          {pathway.step && pathway.totalCourses ? `Course ${pathway.step} of ${pathway.totalCourses}` : pathway.totalCourses ? `${pathway.totalCourses} course${pathway.totalCourses === 1 ? "" : "s"}` : "No courses yet"}
        </span>
        {hasCourse && (pathway.placed
          ? <Chip label="Placed" color="#047857" bg="#ECFDF5" />
          : <Chip label="Starting point" color={INK_MUTED} bg="#F3F4F6" />)}
      </div>
    </div>
  );
}

/* ── Hub ──────────────────────────────────────────────────────────────────── */

const ENROLLMENT_STATUS = {
  active: { label: "Active", color: "#047857", bg: "#ECFDF5" },
  inactive: { label: "Inactive", color: "#6B7280", bg: "#F3F4F6" },
  transferred: { label: "Transferred", color: "#B45309", bg: "#FEF3C7" },
  graduated: { label: "Graduated", color: "#1D4ED8", bg: "#EFF6FF" },
};

function formatDay(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function hubClassLabel(hub) {
  return hub.gradeName ? formatClassName({ gradeName: hub.gradeName, streamName: hub.streamName }) : null;
}

function AttendanceSummary({ attendance }) {
  const color = attendance.rate >= 80 ? GREEN : attendance.rate >= 60 ? AMBER : "#DC2626";
  const counts = [
    { label: "Present", value: attendance.present },
    { label: "Late", value: attendance.late },
    { label: "Absent", value: attendance.absent },
    { label: "Excused", value: attendance.excused },
  ];
  const lastMarked = formatDay(attendance.lastMarked);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Ring percent={attendance.rate} size={76} stroke={8} color={color}>
          <span style={{ fontSize: 17, fontWeight: 800, color: INK }}>{attendance.rate}%</span>
        </Ring>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: INK }}>
            Attended {attendance.present + attendance.late} of {attendance.total} day{attendance.total === 1 ? "" : "s"}
          </p>
          {lastMarked && <p style={{ margin: "3px 0 0", fontSize: 11.5, color: INK_FAINT }}>Last marked {lastMarked}</p>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {counts.map((c) => (
          <div key={c.label} style={{ backgroundColor: "#FAFBFC", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: INK }}>{c.value}</p>
            <p style={{ margin: "1px 0 0", fontSize: 10, fontWeight: 700, color: INK_FAINT, textTransform: "uppercase", letterSpacing: "0.04em" }}>{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// A small pill per teacher — they're context for the hub, not the point of the page. Photo when
// the teacher has one, initials otherwise (and initials again if the photo fails to load, same
// fallback the hero's Avatar uses). The course(s) they teach sit in the tooltip.
function TeacherPill({ teacher }) {
  const [imgFailed, setImgFailed] = useState(false);
  const name = `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim() || "Teacher";
  const initials = `${teacher.firstName?.[0] ?? ""}${teacher.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  return (
    <span title={teacher.courses?.length > 0 ? `Teaches ${teacher.courses.join(", ")}` : undefined} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "3px 10px 3px 3px", borderRadius: 20, backgroundColor: "#F3F6FA", border: `1px solid ${BORDER}` }}>
      <span style={{ width: 24, height: 24, borderRadius: "50%", background: `linear-gradient(135deg, ${ACCENT}, ${GRAD_TO})`, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 800, flexShrink: 0, overflow: "hidden" }}>
        {teacher.photo && !imgFailed
          ? <img src={teacher.photo} alt="" onError={() => setImgFailed(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : initials}
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>{name}</span>
    </span>
  );
}

// Everything the page knows about the learner at one hub. Levels, competencies and pathways all
// come from that hub's class and its curriculum, so a learner at several hubs gets a separate,
// independent picture for each (see buildPublicHubSection on the server).
function HubPanel({ hub }) {
  const status = ENROLLMENT_STATUS[hub.status] || ENROLLMENT_STATUS.active;
  const classLabel = hubClassLabel(hub);
  const since = formatDay(hub.since);
  const meta = [classLabel || "Not placed in a class yet", hub.admissionNumber ? `Adm. ${hub.admissionNumber}` : null, since ? `Since ${since}` : null].filter(Boolean).join(" · ");
  const stage = hub.developmentalStage;
  const onTrack = hub.competenciesOnTrack;

  return (
    <>
      <div className="df-pp-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: `linear-gradient(135deg, ${ACCENT}, ${GRAD_TO})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <FiHome size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: INK }}>{hub.hubName || "Learning hub"}</h2>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: INK_MUTED }}>{meta}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {stage?.name && <Chip label={[stage.name, formatAgeRange(stage.minAge, stage.maxAge)].filter(Boolean).join(" · ")} color={ACCENT} bg="#e8f5fb" />}
          <Chip {...status} />
        </div>
        </div>
        {hub.teachers?.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 14, paddingTop: 12, borderTop: "1px solid #F1F4F8" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: INK_MUTED }}><FiUsers size={12} /> {hub.teachers.length === 1 ? "Teacher" : "Teachers"}</span>
            {hub.teachers.map((t, i) => <TeacherPill key={i} teacher={t} />)}
          </div>
        )}
      </div>

      {!classLabel ? (
        <div className="df-pp-card">
          <EmptyNote>Levels, competencies, pathways, courses and attendance will appear here once this learner is placed in a class at {hub.hubName || "this hub"}.</EmptyNote>
        </div>
      ) : (
        <>
          <div className="df-pp-stats">
            <StatTile icon={FiStar} label="Current level" value={hub.currentLevel?.name || "—"} sub={hub.currentLevel?.nextLevelName ? `Next: ${hub.currentLevel.nextLevelName}` : null} />
            <StatTile icon={FiTarget} label="Competencies on track" value={onTrack ? `${onTrack.count}/${onTrack.total}` : "—"} tint="#ECFDF5" color={GREEN} />
            <StatTile icon={FiCheckCircle} label="Evidence items" value={hub.evidenceItemsCollected ?? "—"} tint="#e8f5fb" color={ACCENT} />
            <StatTile icon={FiCalendar} label="Attendance" value={hub.attendance ? `${hub.attendance.rate}%` : "—"} tint="#EFF6FF" color="#1D4ED8" />
          </div>

          <div className="df-pp-card">
            <SectionHeading icon={FiTrendingUp} title="Level" />
            <LevelSection levelJourney={hub.levelJourney} currentLevel={hub.currentLevel} />
          </div>

          <div className="df-pp-card">
            <SectionHeading
              icon={FiAward}
              title="Competencies"
              aside={onTrack && <span style={{ fontSize: 12.5, color: INK_MUTED }}><strong style={{ color: INK }}>{onTrack.count}</strong> of {onTrack.total} on track</span>}
            />
            <CompetenciesSection competencies={hub.competencies} />
          </div>

          <div className="df-pp-card">
            <SectionHeading icon={FiCompass} title="Pathways" />
            {hub.pathways?.length > 0
              ? <div className="df-pp-grid">{hub.pathways.map((p) => <PathwayCard key={p.name} pathway={p} />)}</div>
              : <EmptyNote>No pathways are set up for this hub's curriculum yet.</EmptyNote>}
          </div>

          <div className="df-pp-two">
            <div className="df-pp-card">
              <SectionHeading icon={FiLayers} title="Courses" />
              {hub.courses?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {hub.courses.map((course, i) => (
                    <div key={course.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i === 0 ? "none" : `1px solid #F1F4F8` }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: "#FEF3E2", color: "#B45309", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <FiBookOpen size={14} />
                      </div>
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: INK, flex: 1, minWidth: 0 }}>{course.name}</p>
                      <span style={{ fontSize: 12, color: INK_MUTED, whiteSpace: "nowrap" }}>{course.sessionCount} session{course.sessionCount === 1 ? "" : "s"}</span>
                    </div>
                  ))}
                </div>
              ) : <EmptyNote>No courses are assigned to this class yet.</EmptyNote>}
            </div>

            <div className="df-pp-card">
              <SectionHeading icon={FiCalendar} title="Attendance" />
              {hub.attendance ? <AttendanceSummary attendance={hub.attendance} /> : <EmptyNote>No attendance has been marked for this class yet.</EmptyNote>}
            </div>
          </div>
        </>
      )}
    </>
  );
}

// The scan destination for a learner's "Share Profile" QR code (see LearnerViewPage.jsx's
// ShareProfileCard) — deliberately reachable with no login. Renders whatever
// learner.service.js's getPublicProfile chose to expose: identity, the guardian's name, and one
// section per hub with that hub's teachers, levels, competencies, pathways, courses and attendance. Never
// guardian contact details, fees, or individual assessment scores/teacher feedback.
//
// A 404 is the only real signal that the token was regenerated (old QR/link retired) — see
// usePublicLearnerProfile's retry logic. Any other failure (timeout, dropped connection, a
// transient 5xx) gets its own honest "couldn't load, try again" state instead of also being
// blamed on regeneration, which was misleading whoever hit a plain network hiccup on a valid,
// still-live QR code.
export default function PublicLearnerProfilePage() {
  const { token } = useParams();
  const { data: profile, isLoading, isError, error, refetch, isFetching } = usePublicLearnerProfile(token);
  const [hubIndex, setHubIndex] = useState(null);

  if (isLoading) {
    return (
      <div className="df-pp">
        <PageStyles />
        <div className="df-pp-state"><p style={{ margin: 0, color: INK_FAINT, fontSize: 14 }}>Loading…</p></div>
      </div>
    );
  }

  if (isError || !profile) {
    const notFound = error?.statusCode === 404;
    return (
      <div className="df-pp">
        <PageStyles />
        <div className="df-pp-state">
          <div className="df-pp-card" style={{ textAlign: "center", maxWidth: 420, padding: "32px 28px" }}>
            <h1 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: INK }}>
              {notFound ? "This link is no longer valid" : "Couldn't load this profile"}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: INK_MUTED }}>
              {notFound
                ? "The QR code or link may have been regenerated. Ask the school for a current one."
                : "Something went wrong loading this page — check your connection and try again."}
            </p>
            {!notFound && (
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                style={{ marginTop: 16, padding: "9px 18px", borderRadius: 8, border: "none", backgroundColor: ACCENT, color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: isFetching ? "default" : "pointer", opacity: isFetching ? 0.6 : 1 }}
              >
                {isFetching ? "Retrying…" : "Try again"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const hubs = profile.hubs || [];
  // Opens on the current hub unless the learner has no class there yet, in which case the first
  // hub that does have something to show is the better landing.
  const defaultIndex = hubs[0]?.gradeName ? 0 : Math.max(0, hubs.findIndex((h) => h.gradeName));
  const hub = hubs[hubIndex ?? defaultIndex] || null;
  const metaLine = [
    profile.age != null ? `Age ${profile.age}` : null,
    hubs.length > 0 ? `${hubs.length} learning hub${hubs.length === 1 ? "" : "s"}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="df-pp">
      <PageStyles />

      <header className="df-pp-hero">
        <div style={{ position: "absolute", top: -60, right: -40, width: 240, height: 240, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div className="df-pp-wrap" style={{ position: "relative" }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{BRAND_NAME} · Learner profile</p>
          <div className="df-pp-hero-inner">
            <Avatar firstName={profile.firstName} lastName={profile.lastName} photo={profile.photo} />
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1.15 }}>{profile.firstName} {profile.lastName}</h1>
              {metaLine && <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "rgba(255,255,255,0.78)" }}>{metaLine}</p>}
            </div>
          </div>
        </div>
      </header>

      <main className="df-pp-body">
        <div className="df-pp-card df-pp-facts">
          <Fact label="Registration number" value={profile.registrationNumber} />
          <Fact label="Username" value={profile.username} />
          <Fact label="Nationality" value={profile.nationality} />
          <Fact label="Languages" value={profile.languages} />
          <Fact label="Guardian" value={profile.guardianName} />
        </div>

        {hubs.length === 0 && (
          <div className="df-pp-card">
            <EmptyNote>This learner isn't enrolled at a learning hub yet. Levels, competencies and pathways will appear here once they are.</EmptyNote>
          </div>
        )}

        {hubs.length > 1 && (
          <div>
            <p style={{ margin: "4px 0 10px", fontSize: 12.5, color: INK_MUTED }}>Progress is tracked separately at each learning hub. Choose one to see where this learner stands there.</p>
            <div className="df-pp-tabs" role="tablist">
              {hubs.map((h, i) => {
                const selected = h === hub;
                return (
                  <button key={i} type="button" role="tab" aria-selected={selected} className="df-pp-tab" onClick={() => setHubIndex(i)}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{h.hubName || "Learning hub"}</span>
                    <span style={{ display: "block", marginTop: 2, fontSize: 11.5, opacity: selected ? 0.8 : 1, color: selected ? "#fff" : INK_MUTED }}>{hubClassLabel(h) || "No class yet"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {hub && <HubPanel hub={hub} />}

        {/* Course certificates, across every hub — only shown once there is one. Each opens the
            page that confirms it is genuine. */}
        {(profile.certificates || []).length > 0 && (
          <CertificatesCard
            certificates={profile.certificates}
            newTab
            hrefFor={(c) => verifyUrl(c.verifyToken)}
            style={{ borderColor: BORDER }}
          />
        )}

        <p style={{ margin: "8px 0 0", fontSize: 11.5, color: INK_FAINT, textAlign: "center" }}>{BRAND_NAME} · Shared profile</p>
      </main>
    </div>
  );
}
