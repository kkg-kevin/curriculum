import { useState } from "react";
import { useParams } from "react-router-dom";
import { FiUsers, FiAward, FiCheckCircle, FiTrendingUp, FiBookOpen, FiCompass, FiStar } from "react-icons/fi";
import { usePublicLearnerProfile } from "../hooks/useLearners";
import { formatClassName } from "../../classes/utils/classDisplay";

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
      .df-public-identity-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px 16px;
      }
      @media (min-width: 640px) {
        .df-public-identity-grid { grid-template-columns: repeat(3, 1fr); }
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
    <div style={{ flex: "0 1 200px", minWidth: 130, backgroundColor: "#FAFBFF", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
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

// Small horizontal level ladder — same idea as the learner portal's own Level Journey card
// (client/src/modules/learner-portal/components/profile/CompetenciesTabContent.jsx), rebuilt
// standalone here since this page is deliberately self-contained (no login, no shared
// authenticated-portal component tree to reach into).
function LevelJourney({ levelJourney, currentLevel }) {
  if (!levelJourney || levelJourney.length === 0) return null;
  const nextIndex = currentLevel?.nextLevelName ? levelJourney.findIndex((b) => b.name === currentLevel.nextLevelName) : -1;

  return (
    <div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: INK_MUTED, lineHeight: 1.5 }}>
        {currentLevel?.nextLevelName
          ? `${currentLevel.name ? `Currently at ${currentLevel.name} — ` : ""}${currentLevel.nextLevelCompletion}% of the way to ${currentLevel.nextLevelName}.`
          : currentLevel?.name
          ? `${currentLevel.name} — the highest level on this ladder.`
          : "Working toward the first level."}
      </p>
      <div style={{ display: "flex", overflowX: "auto", gap: 0, paddingBottom: 4 }}>
        {levelJourney.map((bp, i) => {
          const status = bp.thresholdMet ? "achieved" : i === nextIndex ? "current" : "locked";
          return (
            <div key={bp.name} style={{ display: "flex", alignItems: "center", flex: i === levelJourney.length - 1 ? "0 0 auto" : 1 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 68 }}>
                <div
                  style={{
                    width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800,
                    backgroundColor: status === "achieved" ? "#059669" : status === "current" ? "#FFFBEB" : "#fff",
                    color: status === "achieved" ? "#fff" : status === "current" ? GOLD : INK_FAINT,
                    border: status === "achieved" ? "none" : status === "current" ? `2px solid ${GOLD}` : `1.5px dashed ${BORDER}`,
                  }}
                >
                  {status === "achieved" ? "✓" : `${Math.round(bp.completion)}%`}
                </div>
                <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, color: status === "locked" ? INK_FAINT : INK, textAlign: "center" }}>{bp.name}</p>
              </div>
              {i < levelJourney.length - 1 && (
                <div style={{ flex: 1, minWidth: 12, height: 3, borderRadius: 2, backgroundColor: status === "achieved" ? "#059669" : "#F3F4F6", marginBottom: 18 }} />
              )}
            </div>
          );
        })}
      </div>
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
// A 404 here almost always means the token was regenerated (old QR/link retired), not a broken
// link — worded that way rather than a generic error.
export default function PublicLearnerProfilePage() {
  const { token } = useParams();
  const { data: profile, isLoading, isError } = usePublicLearnerProfile(token);

  if (isLoading) {
    return (
      <div className="df-public-page">
        <PageStyles />
        <div className="df-public-card" style={{ textAlign: "center", padding: "32px 28px", color: INK_FAINT, fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="df-public-page">
        <PageStyles />
        <div className="df-public-card" style={{ textAlign: "center", padding: "32px 28px" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: INK }}>This link is no longer valid</h1>
          <p style={{ margin: 0, fontSize: 13, color: INK_MUTED }}>
            The QR code or link may have been regenerated. Ask the school for a current one.
          </p>
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
                    <HeroPill icon={FiCompass} label={profile.developmentalStage.name} sub={profile.developmentalStage.ageRange || "Developmental stage"} />
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
            <Row label="Date of Birth" value={profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : null} />
            <Row label="Registration Number" value={profile.registrationNumber} />
            <Row label="Nationality" value={profile.nationality} />
            <Row label="Languages" value={profile.languages} />
            <Row label="Username" value={profile.username} />
          </div>
        </div>

        {(profile.guardianName || profile.guardianPhone || profile.guardianEmail) && (
          <div style={sectionStyle}>
            <SectionHeading icon={FiUsers}>Guardian</SectionHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Row label="Name" value={profile.guardianName} />
              <Row label="Phone" value={profile.guardianPhone} />
              <Row label="Email" value={profile.guardianEmail} />
            </div>
          </div>
        )}

        {(profile.competenciesOnTrack || profile.evidenceItemsCollected != null) && (
          <div style={sectionStyle}>
            <SectionHeading icon={FiAward}>Portfolio Snapshot</SectionHeading>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {profile.competenciesOnTrack && <Pill icon={FiAward} label="Competencies On Track" value={profile.competenciesOnTrack} />}
              {profile.evidenceItemsCollected != null && <Pill icon={FiCheckCircle} label="Evidence Items" value={profile.evidenceItemsCollected} />}
            </div>
          </div>
        )}

        {profile.levelJourney?.length > 0 && (
          <div style={sectionStyle}>
            <SectionHeading icon={FiTrendingUp}>Level Journey</SectionHeading>
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
