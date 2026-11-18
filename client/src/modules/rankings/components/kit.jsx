import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { FiAward, FiBarChart2, FiChevronDown, FiHelpCircle, FiPieChart, FiX } from "react-icons/fi";
import { KID, T, cardStyle } from "../../learner-portal/components/profile/theme";
import { readLocal, writeLocal } from "../../../utils/safeStorage";

// Small shared pieces for the learner-side ranking and analytics pages (UX pass, 19 Nov 2026):
// skeleton loading, the switch between the two pages, the "how is my score worked out" panel, the
// one-time celebration banner, and friendly dates. All in the system colours, Feather icons only.

const GOLD = "#feb139";

// "Fri 21 Nov" — dates the way people say them.
export function friendlyDay(day) {
  if (!day) return "";
  const d = new Date(String(day).length === 10 ? `${day}T12:00:00` : day);
  if (Number.isNaN(d.getTime())) return String(day);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

// "5 minutes ago" for the "updated" line.
export function timeAgo(iso) {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const h = Math.round(mins / 60);
  return `${h} hour${h === 1 ? "" : "s"} ago`;
}

// ---- Skeletons ------------------------------------------------------------------------------------
const SHIMMER = `
@keyframes rk-shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
.rk-sk { background: linear-gradient(90deg, #EEF2F7 0%, #F7F9FC 50%, #EEF2F7 100%); background-size: 800px 100%; animation: rk-shimmer 1.3s linear infinite; border-radius: 14px; }
@media (prefers-reduced-motion: reduce) { .rk-sk { animation: none; } }
`;

export function SkeletonPage({ cards = 4 }) {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ display: "grid", gap: 18, gridTemplateColumns: "100%" }}>
      <style>{SHIMMER}</style>
      <div className="rk-sk" style={{ height: 190, borderRadius: 26 }} />
      <div className="rk-grid">
        {Array.from({ length: cards }, (_, i) => <div key={i} className={`rk-sk ${i % 2 ? "rk-s7" : "rk-s5"}`} style={{ height: 220, borderRadius: 22 }} />)}
      </div>
    </div>
  );
}

// ---- The two learner pages, one area --------------------------------------------------------------
// Shown on the learner's own pages (the parent portal has its own Profile | Class position |
// Analytics switch).
export function PageSwitch() {
  const items = [
    { to: "/learner-portal/position", label: "My class position", icon: FiAward },
    { to: "/learner-portal/analytics", label: "How I'm doing", icon: FiPieChart },
  ];
  return (
    <nav aria-label="My progress" style={{ display: "flex", gap: 6, padding: 5, borderRadius: 16, background: "#fff", border: `1.5px solid ${T.border}`, width: "fit-content", maxWidth: "100%" }} className="rk-scroll">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} className="rk-tab"
          style={({ isActive }) => ({ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 12, textDecoration: "none", whiteSpace: "nowrap", fontWeight: 800, fontSize: 14, background: isActive ? T.accent : "transparent", color: isActive ? "#fff" : T.accentDeep })}>
          <it.icon size={15} />{it.label}
        </NavLink>
      ))}
    </nav>
  );
}

// ---- How the score is worked out ------------------------------------------------------------------
const PART_WORDS = {
  achievement: "how well your marked work went",
  attendance: "coming to your sessions",
  onTime: "handing work in by the due date",
  growth: "getting better over the term",
  competencies: "your skills levels",
};

export function ScoreExplainer({ parts = [], minMarked = 3, minClass = 5, forChild = null }) {
  const [open, setOpen] = useState(false);
  const you = forChild ? `${forChild}'s` : "your";
  return (
    <section style={cardStyle({ padding: 0, overflow: "hidden" })}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="rk-pill"
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", border: 0, background: "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
        <span style={{ width: 34, height: 34, borderRadius: 11, background: KID.sky.soft, border: `1.5px solid ${KID.sky.border}`, color: KID.sky.color, display: "grid", placeItems: "center", flexShrink: 0 }}><FiHelpCircle size={17} /></span>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 800, color: T.accentDeep }}>How is {you} Learning Score worked out?</span>
        <FiChevronDown size={18} color={T.inkMuted} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>
      {open && (
        <div style={{ padding: "0 20px 18px", display: "grid", gap: 12, gridTemplateColumns: "100%" }}>
          <p style={{ margin: 0, fontSize: 14, color: T.inkMuted, lineHeight: 1.6, fontWeight: 600 }}>
            The Learning Score is out of 100. It counts this term&apos;s work in the class — not just marks:
          </p>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "100%" }}>
            {parts.filter((p) => p.weight > 0).map((p) => (
              <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: 12, background: "#F7F9FC", border: `1px solid ${T.border}` }}>
                <span style={{ minWidth: 46, fontSize: 15, fontWeight: 900, color: T.accentMid }}>{p.weight}%</span>
                <span style={{ fontSize: 14, color: T.ink }}><strong>{p.label}</strong> — {PART_WORDS[p.key] || ""}</span>
              </div>
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 13.5, color: T.inkMuted, lineHeight: 1.6, fontWeight: 600 }}>
            A place shows once {forChild || "you"} {forChild ? "has" : "have"} {minMarked} pieces of marked work and {minClass} learners in the class do too.
            The top half of the class sees their exact place; everyone else sees how they&apos;re climbing. Nobody ever sees the bottom of the list.
          </p>
        </div>
      )}
    </section>
  );
}

// ---- Celebration ----------------------------------------------------------------------------------
// Shown once for news the learner hasn't seen on this device: badges earned since their last visit,
// or moving up a place. Remembered per learner and class (browser storage; falls back to showing
// nothing new when storage is blocked).
export function useNews(learnerKey, classId, badges = [], movement = null) {
  const key = `rk-seen:${learnerKey}:${classId}`;
  const [seen, setSeen] = useState(null);
  const earned = badges.filter((b) => b.earned).map((b) => b.key);
  const fresh = seen ? badges.filter((b) => b.earned && !seen.badges.includes(b.key)) : [];
  // One week = one "moved up" moment.
  const week = Math.floor((Date.now() / 86400000 + 3) / 7);
  const movedUp = seen && movement > 0 && seen.movementShown !== week ? movement : null;
  useEffect(() => {
    if (!learnerKey || !classId) return;
    let stored = null;
    try { stored = JSON.parse(readLocal(key) || "null"); } catch { stored = null; }
    if (stored) { setSeen(stored); return; }
    // First visit on this device: remember what's there without celebrating the past.
    const first = { badges: earned, movementShown: null };
    writeLocal(key, JSON.stringify(first));
    setSeen(first);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const dismiss = () => {
    const next = { badges: earned, movementShown: movement > 0 ? week : seen?.movementShown || null };
    writeLocal(key, JSON.stringify(next));
    setSeen(next);
  };
  return { fresh, movedUp, dismiss };
}

export function Celebrate({ fresh = [], movedUp = null, onClose, childName = null }) {
  if (!fresh.length && !movedUp) return null;
  const who = childName || "You";
  const lines = [];
  if (movedUp) lines.push(`${who} moved up ${movedUp} ${movedUp === 1 ? "place" : "places"} this week!`);
  if (fresh.length) lines.push(`New ${fresh.length === 1 ? "badge" : "badges"}: ${fresh.map((b) => b.label).join(", ")}`);
  return (
    <section role="status" aria-live="polite" style={{ display: "flex", gap: 14, alignItems: "center", padding: "14px 18px", borderRadius: 20, background: "linear-gradient(90deg, #FFF5E1 0%, #FFFDF7 100%)", border: `1.5px solid ${KID.gold.border}`, boxShadow: "0 6px 18px rgba(254,177,57,0.18)" }}>
      <span style={{ width: 46, height: 46, borderRadius: "50%", background: GOLD, color: "#25476a", display: "grid", placeItems: "center", flexShrink: 0 }}><FiAward size={22} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: T.accentDeep }}>Well done!</div>
        {lines.map((l) => <div key={l} style={{ fontSize: 14, fontWeight: 700, color: T.ink, lineHeight: 1.45 }}>{l}</div>)}
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="rk-pill" style={{ width: 34, height: 34, borderRadius: 10, border: `1.5px solid ${KID.gold.border}`, background: "#fff", color: T.accentDeep, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}><FiX size={16} /></button>
    </section>
  );
}

// ---- How places work (the not-ranked-yet state) ---------------------------------------------------
export function HowItWorks({ minMarked = 3, childName = null }) {
  const steps = [
    { icon: FiBarChart2, title: "Do the work", text: `Come to sessions and hand work in on time — it all counts towards ${childName ? `${childName}'s` : "your"} score.` },
    { icon: FiAward, title: `Get ${minMarked} pieces marked`, text: "Once your educator marks them, a place in the class appears." },
    { icon: FiPieChart, title: "Climb and collect badges", text: "Move up the leaderboards and earn badges along the way." },
  ];
  return (
    <section style={cardStyle({ padding: 20, height: "100%", boxSizing: "border-box" })}>
      <div style={{ fontSize: 16, fontWeight: 800, color: T.accentDeep, marginBottom: 14 }}>How class positions work</div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
        {steps.map((s, i) => (
          <li key={s.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <span style={{ width: 40, height: 40, borderRadius: 13, background: i === 0 ? GOLD : KID.sky.soft, border: `1.5px solid ${i === 0 ? GOLD : KID.sky.border}`, color: i === 0 ? "#25476a" : KID.sky.color, display: "grid", placeItems: "center", flexShrink: 0 }}><s.icon size={18} /></span>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 900, color: T.accentDeep }}>{i + 1}. {s.title}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: T.inkMuted, lineHeight: 1.5 }}>{s.text}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
