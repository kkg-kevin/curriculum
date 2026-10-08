import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiAward, FiLock, FiX, FiChevronRight, FiStar, FiTarget, FiMaximize2 } from "react-icons/fi";
import CertificateViewer from "./CertificateViewer";
import { certificateFields, formatCertificateDate, KIND_LABELS } from "../utils/certificate";

/* ──────────────────────────────────────────────────────────────────────────
 * The learner's own "trophy cabinet" on their profile — certificates shown as
 * things earned, not rows in a list.
 *
 *   header      how many they hold, by kind, and the next milestone to reach
 *   latest      the newest certificate, large, with its real sheet as a preview
 *   collection  the rest as a grid of small sheets (the first few, then
 *               "Show all" — it stays tidy whether they hold two or twenty)
 *   next        what they can earn next, each with real progress: sessions
 *               done in a course, courses done in a pathway
 *
 * Clicking any certificate opens it in a preview right here (download and the
 * verification link included) — no leaving the profile.
 *
 * Every number is real: `certificates` are the ones they hold, `progress` comes
 * from the server's own count (certificate.service.js's progressForLearner).
 * ────────────────────────────────────────────────────────────────────────── */

const NAVY = "#25476a";
const NAVY_DEEP = "#1a3550";
const SKY = "#38aae1";
const GOLD = "#feb139";
const GOLD_DEEP = "#B45309";
const INK = "#111827";
const INK_MUTED = "#6B7280";
const INK_FAINT = "#9CA3AF";
const BORDER = "#E5E7EB";

// Milestones on the way up — the next one not yet reached is what the header points at.
const MILESTONES = [
  { at: 1, name: "First certificate" },
  { at: 3, name: "Rising star" },
  { at: 5, name: "High achiever" },
  { at: 10, name: "Trailblazer" },
  { at: 20, name: "Legend" },
];

const KIND_COLOR = { course: SKY, pathway: "#7C3AED", bootcamp: "#059669" };
const NEW_FOR_DAYS = 14;
const COLLECTION_PREVIEW = 6;
const NEXT_PREVIEW = 3;

const isNew = (issuedAt) => issuedAt && Date.now() - new Date(issuedAt).getTime() < NEW_FOR_DAYS * 86400000;

function KindChip({ kind, light = false }) {
  const color = KIND_COLOR[kind] || SKY;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", borderRadius: 20, padding: "3px 9px", color: light ? "#fff" : color, backgroundColor: light ? "rgba(255,255,255,0.18)" : `${color}1A`, whiteSpace: "nowrap" }}>
      {KIND_LABELS[kind] || "Course"}
    </span>
  );
}

function NewRibbon() {
  return (
    <span style={{ position: "absolute", top: 10, left: -4, zIndex: 2, backgroundColor: GOLD, color: NAVY_DEEP, fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", padding: "4px 10px 4px 12px", borderRadius: "0 20px 20px 0", boxShadow: "0 2px 6px rgba(0,0,0,0.18)" }}>
      NEW
    </span>
  );
}

function ProgressBar({ done, total, color = SKY }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} style={{ height: 8, borderRadius: 8, backgroundColor: "#EEF2F6", overflow: "hidden" }}>
      <div style={{ width: `${percent}%`, height: "100%", borderRadius: 8, backgroundColor: color, transition: "width 400ms ease" }} />
    </div>
  );
}

// A certificate in the collection: its real sheet, small, under its name.
function CertificateTile({ certificate, onOpen }) {
  const c = certificateFields(certificate);
  return (
    <button
      type="button"
      onClick={() => onOpen(certificate)}
      className="ach-tile"
      aria-label={`Open your certificate for ${c.title}`}
      style={{ position: "relative", textAlign: "left", padding: 10, borderRadius: 14, border: `1px solid ${BORDER}`, backgroundColor: "#fff", cursor: "pointer", fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 10 }}
    >
      {isNew(c.issuedAt) && <NewRibbon />}
      <div style={{ pointerEvents: "none" }}>
        <CertificateViewer certificate={certificate} actions={false} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
          <KindChip kind={c.kind} />
          <span style={{ fontSize: 11.5, color: INK_FAINT }}>{formatCertificateDate(c.issuedAt)}</span>
        </div>
      </div>
    </button>
  );
}

// Something still to earn, with how far along they really are.
function NextTile({ item }) {
  const course = item.kind === "course";
  const ready = item.done >= item.total;
  const unit = course ? "session" : "course";
  return (
    <div style={{ padding: "14px 16px", borderRadius: 14, border: `1.5px dashed ${BORDER}`, backgroundColor: "#FAFBFC", display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: ready ? "#FEF3E2" : "#F1F5F9", color: ready ? GOLD_DEEP : INK_FAINT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {ready ? <FiStar size={17} /> : <FiLock size={16} />}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{item.title}</p>
          <KindChip kind={item.kind} />
        </div>
        <div style={{ margin: "9px 0 6px" }}>
          <ProgressBar done={item.done} total={item.total} color={ready ? GOLD : KIND_COLOR[item.kind]} />
        </div>
        <p style={{ margin: 0, fontSize: 12, color: INK_MUTED }}>
          {ready && course
            ? "Every session is done. Your certificate arrives when your teacher publishes your final report."
            : `${item.done} of ${item.total} ${unit}${item.total === 1 ? "" : "s"} done${item.done === 0 ? "" : item.total - item.done === 1 ? ` · just 1 ${unit} to go` : ` · ${item.total - item.done} to go`}`}
        </p>
      </div>
    </div>
  );
}

// The certificate, large, over the page — with Download PDF and the verification link.
function PreviewDialog({ certificate, onClose }) {
  const c = certificateFields(certificate);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Certificate for ${c.title}`}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1300, backgroundColor: "rgba(17,24,39,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 980, maxHeight: "100%", overflowY: "auto", backgroundColor: "#fff", borderRadius: 18, padding: "18px 20px 22px", fontFamily: "Inter, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: INK }}>{c.title}</h2>
              <KindChip kind={c.kind} />
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: INK_MUTED }}>
              Awarded {formatCertificateDate(c.issuedAt)} · {c.number}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {certificate.id && (
              <Link to={`/learner-portal/certificates/${certificate.id}`} aria-label="Open on its own page" title="Open on its own page" style={{ width: 34, height: 34, borderRadius: 9, border: `1.5px solid ${BORDER}`, color: NAVY, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FiMaximize2 size={15} />
              </Link>
            )}
            <button type="button" onClick={onClose} aria-label="Close" style={{ width: 34, height: 34, borderRadius: 9, border: `1.5px solid ${BORDER}`, background: "#fff", color: INK_MUTED, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FiX size={17} />
            </button>
          </div>
        </div>
        <CertificateViewer certificate={certificate} />
      </div>
    </div>
  );
}

const CSS = `
  .ach-tile { transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease; }
  .ach-tile:hover, .ach-tile:focus-visible { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(37,71,106,0.14); border-color: #a8d5ee; }
  .ach-feature-btn { transition: transform 160ms ease, box-shadow 160ms ease; }
  .ach-feature-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0,0,0,0.2); }
  .ach-latest { display: grid; gap: 20px; grid-template-columns: minmax(0, 1fr); align-items: center; }
  @media (min-width: 820px) { .ach-latest { grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); } }
  @media (prefers-reduced-motion: reduce) { .ach-tile, .ach-feature-btn { transition: none; } .ach-tile:hover, .ach-feature-btn:hover { transform: none; } }
`;

export default function AchievementsShowcase({ certificates = [], progress, isLoading = false }) {
  const [open, setOpen] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [showAllNext, setShowAllNext] = useState(false);

  // Newest first — the list arrives that way, but the showcase depends on it.
  const earned = useMemo(
    () => [...certificates].filter((c) => (c.status || "issued") === "issued").sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt)),
    [certificates]
  );
  const [latest, ...rest] = earned;
  const counts = useMemo(() => earned.reduce((acc, c) => ({ ...acc, [c.kind || "course"]: (acc[c.kind || "course"] || 0) + 1 }), {}), [earned]);
  const reached = [...MILESTONES].reverse().find((m) => earned.length >= m.at) || null;
  const nextMilestone = MILESTONES.find((m) => earned.length < m.at) || null;

  // What to chase next: courses under way first (closest to done), then pathways.
  const next = useMemo(() => [...(progress?.courses || []), ...(progress?.pathways || [])], [progress]);
  const nextShown = showAllNext ? next : next.slice(0, NEXT_PREVIEW);
  const collection = showAll ? rest : rest.slice(0, COLLECTION_PREVIEW);

  return (
    <section style={{ borderRadius: 18, overflow: "hidden", border: `1px solid ${BORDER}`, backgroundColor: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", fontFamily: "Inter, sans-serif" }}>
      <style>{CSS}</style>

      {/* header — the tally and the next milestone */}
      <div style={{ position: "relative", overflow: "hidden", padding: "22px 24px", color: "#fff", background: `linear-gradient(135deg, ${NAVY_DEEP} 0%, ${NAVY} 45%, #2e7db5 100%)` }}>
        <div style={{ position: "absolute", top: -50, right: -30, width: 190, height: 190, borderRadius: "50%", backgroundColor: "rgba(254,177,57,0.14)", pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: GOLD, color: NAVY_DEEP, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(254,177,57,0.4)", flexShrink: 0 }}>
              <FiAward size={27} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.72)" }}>My achievements</p>
              <h2 style={{ margin: "3px 0 0", fontSize: 22, fontWeight: 900, lineHeight: 1.15 }}>
                {earned.length === 0 ? "Your first certificate is waiting" : `${earned.length} certificate${earned.length === 1 ? "" : "s"} earned`}
              </h2>
              {reached && <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 700, color: GOLD }}>★ {reached.name}</p>}
            </div>
          </div>

          {earned.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Object.keys(KIND_LABELS).filter((k) => counts[k]).map((k) => (
                <div key={k} style={{ padding: "8px 14px", borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", textAlign: "center", minWidth: 74 }}>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 900, lineHeight: 1 }}>{counts[k]}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(255,255,255,0.78)" }}>{KIND_LABELS[k]}{counts[k] === 1 ? "" : "s"}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {nextMilestone && (
          <div style={{ position: "relative", marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.85)" }}>
              <span>Next milestone: <strong style={{ color: "#fff" }}>{nextMilestone.name}</strong></span>
              <span style={{ whiteSpace: "nowrap" }}>{earned.length} / {nextMilestone.at}</span>
            </div>
            <div role="progressbar" aria-valuenow={earned.length} aria-valuemin={0} aria-valuemax={nextMilestone.at} style={{ height: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.18)", overflow: "hidden" }}>
              <div style={{ width: `${(earned.length / nextMilestone.at) * 100}%`, height: "100%", borderRadius: 8, backgroundColor: GOLD, transition: "width 400ms ease" }} />
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 26 }}>
        {isLoading && <p style={{ margin: 0, fontSize: 13, color: INK_FAINT }}>Loading…</p>}

        {/* latest — the newest one, large */}
        {latest && (() => {
          const c = certificateFields(latest);
          return (
            <div className="ach-latest">
              <button type="button" onClick={() => setOpen(latest)} className="ach-tile" aria-label={`Open your certificate for ${c.title}`} style={{ position: "relative", padding: 0, border: `1px solid ${BORDER}`, borderRadius: 12, background: "none", cursor: "pointer" }}>
                {isNew(c.issuedAt) && <NewRibbon />}
                <div style={{ pointerEvents: "none" }}>
                  <CertificateViewer certificate={latest} actions={false} />
                </div>
              </button>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: GOLD_DEEP }}>
                  {rest.length === 0 ? "Your certificate" : "Latest certificate"}
                </p>
                <h3 style={{ margin: "6px 0 8px", fontSize: 21, fontWeight: 800, color: INK, lineHeight: 1.2 }}>{c.title}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <KindChip kind={c.kind} />
                  <span style={{ fontSize: 12.5, color: INK_MUTED }}>Awarded {formatCertificateDate(c.issuedAt)}{c.hubName ? ` · ${c.hubName}` : ""}</span>
                </div>
                <p style={{ margin: "12px 0 16px", fontSize: 13.5, color: INK_MUTED, lineHeight: 1.55 }}>
                  You completed {c.kindNoun}. Open it to see it full size, download it, or share the link that proves it is genuine.
                </p>
                <button type="button" onClick={() => setOpen(latest)} className="ach-feature-btn" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 10, border: "none", backgroundColor: GOLD, color: NAVY_DEEP, fontSize: 13.5, fontWeight: 800, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                  View my certificate <FiChevronRight size={16} />
                </button>
              </div>
            </div>
          );
        })()}

        {/* collection — the rest */}
        {rest.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: INK }}>My collection <span style={{ color: INK_FAINT, fontWeight: 700 }}>· {rest.length} more</span></h3>
              {rest.length > COLLECTION_PREVIEW && (
                <button type="button" onClick={() => setShowAll((v) => !v)} style={{ background: "none", border: "none", color: NAVY, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                  {showAll ? "Show fewer" : `Show all ${rest.length}`}
                </button>
              )}
            </div>
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 210px), 1fr))" }}>
              {collection.map((certificate) => <CertificateTile key={certificate.id || certificate.certificateNumber} certificate={certificate} onOpen={setOpen} />)}
            </div>
          </div>
        )}

        {/* next — what to earn */}
        {next.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: INK, display: "inline-flex", alignItems: "center", gap: 7 }}>
                <FiTarget size={15} color={SKY} /> {earned.length === 0 ? "Earn your first" : "Up next"}
              </h3>
              {next.length > NEXT_PREVIEW && (
                <button type="button" onClick={() => setShowAllNext((v) => !v)} style={{ background: "none", border: "none", color: NAVY, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                  {showAllNext ? "Show fewer" : `Show all ${next.length}`}
                </button>
              )}
            </div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))" }}>
              {nextShown.map((item) => <NextTile key={`${item.kind}:${item.id}`} item={item} />)}
            </div>
          </div>
        )}

        {!isLoading && earned.length === 0 && next.length === 0 && (
          <p style={{ margin: 0, fontSize: 13.5, color: INK_MUTED, lineHeight: 1.55 }}>
            You earn a certificate for every course you complete, and another for finishing a whole pathway or bootcamp. They will appear here.
          </p>
        )}
      </div>

      {open && <PreviewDialog certificate={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
