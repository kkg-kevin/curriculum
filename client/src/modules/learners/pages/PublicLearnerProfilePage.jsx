import { useState } from "react";
import { useParams } from "react-router-dom";
import { FiAward, FiCheckCircle, FiTrendingUp, FiBookOpen, FiCompass, FiStar, FiCheck, FiLock } from "react-icons/fi";
import { usePublicLearnerProfile } from "../hooks/useLearners";
import { formatClassName } from "../../classes/utils/classDisplay";
import { formatAgeRange } from "../utils/ageRange";

const GRAD_FROM = "#1a3550";
const GRAD_TO = "#38aae1";
const ACCENT = "#25476a";
const GOLD = "#feb139";
const BORDER = "#E5E7EB";
const INK = "#111827";
const INK_MUTED = "#6B7280";
const INK_FAINT = "#9CA3AF";

const sectionStyle = { padding: "20px 24px", borderTop: `1px solid #F3F4F6` };

// Scoped global styles rather than inline style objects, same pattern AuthLayout.jsx already uses
// for its own standalone (outside MainLayout) full-page shell — inline JS style objects can't
// express @media breakpoints. Two things this buys over the page's old fixed-480px mobile card:
// (1) the outer page centers its card both axes, not just horizontally — short states (loading,
// invalid-link) no longer sit pinned at the top of an otherwise-empty gradient wall; (2) the card
// widens and the hero switches to a horizontal (photo-left, text-right) layout past 768px, since
// this link is also copy/paste-shareable (see ShareProfileCard's Copy button), not only ever
// opened by a QR scan on a phone — a 480px mobile card centered in a 1280px desktop viewport reads
// as unfinished rather than deliberate.
function PageStyles() {
  return (
    <style>{`
      .df-public-page {
        min-height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 32px 16px;
        font-family: 'Inter', sans-serif;
        background: linear-gradient(135deg, ${GRAD_FROM} 0%, ${ACCENT} 45%, ${GRAD_TO} 100%);
      }
      .df-public-card {
        width: 100%;
        max-width: 480px;
        background-color: #ffffff;
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0,0,0,0.25);
      }
      @media (min-width: 640px) {
        .df-public-card { max-width: 600px; }
      }
      @media (min-width: 1024px) {
        .df-public-card { max-width: 760px; }
      }
      .df-public-hero {
        background: linear-gradient(135deg, ${GRAD_FROM} 0%, ${ACCENT} 45%, ${GRAD_TO} 100%);
        padding: 32px 24px 26px;
        position: relative;
        overflow: hidden;
      }
      .df-public-hero-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        position: relative;
      }
      .df-public-hero-text {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        text-align: center;
      }
      .df-public-hero-pills {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: center;
        margin-top: 4px;
        position: relative;
      }
      @media (min-width: 768px) {
        .df-public-hero { padding: 40px; }
        .df-public-hero-inner { flex-direction: row; align-items: center; gap: 28px; }
        .df-public-hero-text { align-items: flex-start; text-align: left; }
        .df-public-hero-pills { justify-content: flex-start; }
      }
      @keyframes df-lj-pulse-glow {
        0%, 100% { transform: scale(0.94); opacity: 0.9; }
        50% { transform: scale(1.12); opacity: 0.35; }
      }
      .df-lj-pulse { animation: df-lj-pulse-glow 2.2s ease-in-out infinite; }
      .df-public-identity-grid {
        display: grid;
        /* Fixed at 2 columns rather than switching to 3 above 640px — with exactly 4 fields
           (Registration Number, Nationality, Languages, Username), 3 columns always strands the
           4th alone on its own row with empty space beside it; 2 columns pairs all 4 cleanly at
           any width instead (auto-fit doesn't help here — it still fits 3 across on a wide card,
           same stranding). */
        grid-template-columns: repeat(2, 1fr);
        gap: 14px 16px;
      }
    `}</style>
  );
}

function SectionHeading({ icon: Icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <div style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: "#e8f5fb", color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={12} />
      </div>
      <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: GRAD_TO, textTransform: "uppercase", letterSpacing: "0.07em" }}>{children}</h2>
    </div>
  );
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
    <div style={{ position: "relative", width: 96, height: 96, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 800, color: "#ffffff", ...ring }}>
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

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: INK_FAINT, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: 14, color: INK, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// Translucent white-on-gradient badge for the hero — same "eyebrow + value + sub" shape as the
// learner portal's own ProfileIdentityCard StatusPill, condensed to fit this page's smaller card.
function HeroPill({ icon: Icon, label, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 12, padding: "7px 12px", backdropFilter: "blur(2px)" }}>
      <Icon size={13} color="#fff" style={{ flexShrink: 0 }} />
      <div style={{ textAlign: "left" }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{label}</p>
        {sub && <p style={{ margin: 0, fontSize: 10.5, color: "rgba(255,255,255,0.68)", lineHeight: 1.3 }}>{sub}</p>}
      </div>
    </div>
  );
}

// Gold icon chip + big number, matching the learner portal's own PortfolioSnapshot Stat tiles —
// these figures are always real data here (the pill only renders once its value exists), so the
// "preview/greyed" state that component supports never applies on this page.
function Pill({ icon: Icon, label, value }) {
  return (
    <div style={{ backgroundColor: "#FAFBFF", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: "#FEF3E2", color: GOLD, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={13} />
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, color: INK_FAINT, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
        <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 800, color: INK }}>{value}</p>
      </div>
    </div>
  );
}

// Gold ring + pulsing glow around whichever node the learner is actively working toward —
// mirrors the learner portal's own ProgressArcCard (client/src/modules/learner-portal/
// components/ProgressArcCard.jsx), rebuilt standalone here since this page is deliberately
// self-contained (no login, no shared authenticated-portal component tree to reach into).
function ProgressRing({ percent, size, stroke }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circumference * (1 - clamped / 100);
  return (
    <svg width={size} height={size} style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#FDE9C0" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={GOLD} strokeWidth={stroke}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </svg>
  );
}

// achieved = filled gradient medal, current = gold percent ring + pulsing halo ("you are here"),
// locked = flat dashed disc with a padlock — same three-state visual language as the
// authenticated Progress Arc card, just sized to fit this smaller shared-profile card.
function LevelNode({ band, status, ordinal }) {
  const achieved = status === "achieved";
  const current = status === "current";
  const size = 56;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 82 }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        {current && (
          <>
            <div className="df-lj-pulse" style={{ position: "absolute", inset: -5, borderRadius: "50%", backgroundColor: "rgba(254,177,57,0.28)" }} />
            <ProgressRing percent={band.completion} size={size} stroke={5} />
          </>
        )}
        <div
          style={{
            position: "absolute", inset: current ? 7 : 0, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: achieved ? "linear-gradient(135deg, #34d399, #059669)" : current ? "#FFFBEB" : "#fff",
            border: achieved ? "none" : current ? `1px solid ${GOLD}` : `1.5px dashed ${BORDER}`,
            boxShadow: achieved ? "0 4px 12px rgba(5,150,105,0.35)" : "none",
            color: achieved ? "#fff" : current ? "#B45309" : INK_FAINT,
            fontSize: 11, fontWeight: 800,
          }}
        >
          {achieved ? <FiCheck size={17} /> : current ? `${Math.round(band.completion)}%` : <FiLock size={14} />}
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 9, fontWeight: 800, color: achieved ? "#059669" : current ? "#B45309" : INK_FAINT, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Level {ordinal}
        </p>
        <p style={{ margin: "1px 0 0", fontSize: 11.5, fontWeight: 700, color: achieved || current ? INK : INK_FAINT }}>{band.name}</p>
        <p style={{ margin: "1px 0 0", fontSize: 9.5, fontWeight: 700, color: achieved ? "#059669" : current ? GOLD : INK_FAINT }}>
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
    <div style={{ flex: 1, minWidth: 20, height: 5, borderRadius: 3, backgroundColor: "#F3F4F6", overflow: "hidden", marginTop: 27 }}>
      <div style={{ width: `${Math.min(100, Math.max(0, fillPercent))}%`, height: "100%", borderRadius: 3, background: active ? "linear-gradient(90deg, #059669, #feb139)" : "transparent", transition: "width 0.5s ease" }} />
    </div>
  );
}

function LevelJourney({ levelJourney, currentLevel }) {
  if (!levelJourney || levelJourney.length === 0) return null;
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
  // Same guard as the authenticated card: a threshold of 0 means no admin has configured one
  // yet, so a level only counts as "Unlocked" at 100% — worth explaining, otherwise a learner
  // sitting at a high percent with no threshold set looks stalled for no visible reason.
  const noThresholdsConfigured = levelJourney.every((bp) => !bp.advancementThreshold || bp.advancementThreshold <= 0);
  const nextThreshold = nextIndex !== -1 ? (levelJourney[nextIndex].advancementThreshold > 0 ? levelJourney[nextIndex].advancementThreshold : 100) : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 13, color: INK_MUTED, lineHeight: 1.5, flex: 1, minWidth: 180 }}>
          {currentLevel?.nextLevelName
            ? `${currentLevel.name ? `Currently at ${currentLevel.name} — ` : ""}${currentLevel.nextLevelCompletion}% of the way to ${currentLevel.nextLevelName} (needs ${nextThreshold}%).`
            : currentLevel?.name
            ? `${currentLevel.name} — the highest level on this ladder.`
            : "Working toward the first level."}
        </p>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: "#B45309", backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap", flexShrink: 0 }}>
          {achievedCount} of {levelJourney.length} unlocked
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", overflowX: "auto", paddingBottom: 4 }}>
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

      {noThresholdsConfigured && achievedCount === 0 && (
        <p style={{ margin: "14px 0 0", fontSize: 11, color: INK_FAINT, fontStyle: "italic" }}>
          No advancement threshold is set on these levels yet, so a level only counts as "Unlocked" once it's 100% complete.
        </p>
      )}
    </div>
  );
}

// One row per competency: name + band + score, with a thin fill bar underneath — same 6px
// track/fill spec the learner portal's own CompetencyProgressGrid uses (track #F3F4F6, fill
// green/red by the 60% pass line), so a scanned score reads at a glance rather than as bare text.
function CompetencyRow({ name, band, score }) {
  const good = score >= 60;
  const color = good ? "#059669" : "#DC2626";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
          {band && <p style={{ margin: 0, fontSize: 11, color: ACCENT }}>{band}</p>}
        </div>
        <span style={{ fontSize: 12.5, fontWeight: 700, color, whiteSpace: "nowrap" }}>{score}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, backgroundColor: "#F3F4F6", overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, Math.max(0, score))}%`, height: "100%", backgroundColor: color }} />
      </div>
    </div>
  );
}

// The scan destination for a learner's "Share Profile" QR code (see LearnerViewPage.jsx's
// ShareProfileCard) — deliberately reachable with no login. Renders whatever
// learner.service.js's getPublicProfile chose to expose — a comprehensive mirror of the
// learner's own Profile page (identity, guardian, competencies, level journey, learning
// journey), short of individual assessment scores/teacher feedback text, which stays private.
//
// A 404 is the only real signal that the token was regenerated (old QR/link retired) — see
// usePublicLearnerProfile's retry logic. Any other failure (timeout, dropped connection, a
// transient 5xx) gets its own honest "couldn't load, try again" state instead of also being
// blamed on regeneration, which was misleading whoever hit a plain network hiccup on a valid,
// still-live QR code.
export default function PublicLearnerProfilePage() {
  const { token } = useParams();
  const { data: profile, isLoading, isError, error, refetch, isFetching } = usePublicLearnerProfile(token);

  if (isLoading) {
    return (
      <div className="df-public-page">
        <PageStyles />
        <div className="df-public-card" style={{ textAlign: "center", padding: "32px 28px", color: INK_FAINT, fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (isError || !profile) {
    const notFound = error?.statusCode === 404;
    return (
      <div className="df-public-page">
        <PageStyles />
        <div className="df-public-card" style={{ textAlign: "center", padding: "32px 28px" }}>
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
    );
  }

  const classLabel = profile.gradeName ? formatClassName({ gradeName: profile.gradeName, streamName: profile.streamName }) : null;
  const metaLine = [classLabel, profile.age != null ? `Age ${profile.age}` : null].filter(Boolean).join(" · ");

  return (
    <div className="df-public-page">
      <PageStyles />
      <div className="df-public-card">
        <div className="df-public-hero">
          <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />

          <div className="df-public-hero-inner">
            <Avatar firstName={profile.firstName} lastName={profile.lastName} photo={profile.photo} />
            <div className="df-public-hero-text">
              <h1 style={{ margin: 0, fontSize: 21, fontWeight: 900, color: "#fff" }}>
                {profile.firstName} {profile.lastName}
              </h1>
              {profile.hubName && <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.75)" }}>{profile.hubName}</span>}
              {metaLine && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{metaLine}</span>}

              {(profile.developmentalStage?.name || profile.currentLevel?.name) && (
                <div className="df-public-hero-pills">
                  {profile.developmentalStage?.name && (
                    <HeroPill
                      icon={FiCompass}
                      label={profile.developmentalStage.name}
                      sub={formatAgeRange(profile.developmentalStage.minAge, profile.developmentalStage.maxAge) || "Developmental stage"}
                    />
                  )}
                  {profile.currentLevel?.name && (
                    <HeroPill
                      icon={FiStar}
                      label={profile.currentLevel.name}
                      sub={profile.currentLevel.nextLevelName ? `${profile.currentLevel.nextLevelCompletion}% to ${profile.currentLevel.nextLevelName}` : "Highest level reached"}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="df-public-identity-grid">
            <Row label="Registration Number" value={profile.registrationNumber} />
            <Row label="Nationality" value={profile.nationality} />
            <Row label="Languages" value={profile.languages} />
            <Row label="Username" value={profile.username} />
          </div>
        </div>

        {(profile.competenciesOnTrack || profile.evidenceItemsCollected != null) && (
          <div style={sectionStyle}>
            <SectionHeading icon={FiAward}>Portfolio Snapshot</SectionHeading>
            {/* grid instead of flex-wrap with a fixed basis — this section only ever has 1-2
                tiles (there's no "courses completed" figure on the public profile), and a fixed
                basis left visible dead space to the right instead of the tile(s) filling the
                row. auto-fit grows them evenly across however many actually render. */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
              {profile.competenciesOnTrack && <Pill icon={FiAward} label="Competencies On Track" value={profile.competenciesOnTrack} />}
              {profile.evidenceItemsCollected != null && <Pill icon={FiCheckCircle} label="Evidence Items" value={profile.evidenceItemsCollected} />}
            </div>
          </div>
        )}

        {profile.levelJourney?.length > 0 && (
          <div style={sectionStyle}>
            <SectionHeading icon={FiTrendingUp}>Progress Arc</SectionHeading>
            <LevelJourney levelJourney={profile.levelJourney} currentLevel={profile.currentLevel} />
          </div>
        )}

        {profile.competencies?.length > 0 && (
          <div style={sectionStyle}>
            <SectionHeading icon={FiCheckCircle}>Competencies</SectionHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {profile.competencies.map((c) => (
                <CompetencyRow key={c.name} name={c.name} band={c.band} score={c.score} />
              ))}
            </div>
          </div>
        )}

        {profile.learningJourney?.length > 0 && (
          <div style={sectionStyle}>
            <SectionHeading icon={FiBookOpen}>Learning Journey</SectionHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {profile.learningJourney.map((row) => (
                <div key={row.learningAreaName} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: INK }}>{row.learningAreaName}</p>
                  <span style={{ fontSize: 12, color: INK_MUTED, textAlign: "right" }}>{row.currentCourseName || "Not placed"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p style={{ margin: 0, padding: "16px 24px", fontSize: 11, color: "#D1D5DB", textAlign: "center", borderTop: "1px solid #F3F4F6" }}>Digifunzi · Shared profile</p>
      </div>
    </div>
  );
}
