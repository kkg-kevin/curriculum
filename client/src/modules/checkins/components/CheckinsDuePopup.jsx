import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { FiArrowRight, FiCalendar, FiCheckCircle, FiClipboard, FiMapPin, FiTrendingDown, FiTrendingUp, FiUser, FiVideo, FiX } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { usePermissions } from "../../../hooks/usePermissions";
import { useDueCheckins } from "../hooks/useCheckins";
import { FORMAT_LABEL, FREQUENCY_LABEL, font, formatDate } from "../shared";

// Shown when a hub's Account Manager or Training Lead signs in and has check-ins whose day has
// come with no report yet (GET /api/checkins/due). "Remind me later" hides it until they next
// sign in — remembered for this browser tab, so reloading doesn't bring it back. Mounted in each
// portal they can be in:
//   admin   the admin app (MainLayout) — an admin named on a hub; reports at /checkins
//   hub     the hub portal (SchoolPortalLayout) — an Account Manager / Training Lead session
//   teacher the teacher portal (TeacherPortalLayout) — an educator named on a hub; "Write report"
//           first switches them to their Account Manager / Training Lead sign-in

const dismissedKey = (userId) => `checkins.duePopup.dismissed:${userId}`;
function isDismissed(userId) {
  try { return sessionStorage.getItem(dismissedKey(userId)) === "1"; } catch { return false; }
}

const SHOWN = 3;
const kenyaToday = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
const daysBetween = (from, to) => Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000);

// "Today", or how long it has been waiting.
function dueLook(scheduledDate) {
  const late = daysBetween(scheduledDate, kenyaToday());
  if (late <= 0) return { text: "Due today", bg: "#E0F2FE", color: "#075985" };
  if (late < 7) return { text: `${late} day${late === 1 ? "" : "s"} overdue`, bg: "#FEF3C7", color: "#92400E" };
  return { text: `${Math.floor(late / 7)} week${late < 14 ? "" : "s"} overdue`, bg: "#FEE2E2", color: "#991B1B" };
}

function HubAvatar({ name, photo }) {
  const initials = String(name || "?").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  if (photo) return <img src={photo} alt="" style={{ width: 46, height: 46, borderRadius: 12, objectFit: "cover", flexShrink: 0, border: "1px solid #E5E7EB" }} />;
  return (
    <div aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #25476a, #38aae1)", color: "#fff", fontSize: 15, fontWeight: 800, letterSpacing: "0.5px" }}>
      {initials}
    </div>
  );
}

function Tag({ icon: Icon, children, bg = "#F3F4F6", color = "#4B5563" }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, background: bg, color, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>
      {Icon && <Icon size={11} />}{children}
    </span>
  );
}

const PARTS = [
  { icon: FiTrendingUp, label: "Highs", color: "#047857", bg: "#ECFDF5" },
  { icon: FiTrendingDown, label: "Lows", color: "#B45309", bg: "#FFFBEB" },
  { icon: FiCheckCircle, label: "Resolutions", color: "#1D4ED8", bg: "#EFF6FF" },
];

export default function CheckinsDuePopup() {
  const { user, switchRole } = useAuth();
  const { can } = usePermissions();
  const mode = user?.hubLead ? "hub" : user?.role === "teacher" ? "teacher" : "admin";
  const allowed = !!user && (mode === "hub"
    || (mode === "teacher" && (user.roles || []).includes("hubLead"))
    || (mode === "admin" && can("checkins-manage", "view")));
  const base = mode === "admin" ? "/checkins" : "/school-portal/checkins";
  const [dismissed, setDismissed] = useState(() => (user ? isDismissed(user.id) : false));
  const { data: due = [] } = useDueCheckins({ enabled: allowed && !dismissed });
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  const visible = allowed && !dismissed && due.length > 0;

  const close = () => {
    try { sessionStorage.setItem(dismissedKey(user.id), "1"); } catch { /* private mode: shows again next page load */ }
    setDismissed(true);
  };
  const open = async (path) => {
    close();
    if (mode === "teacher") {
      try { await switchRole("hubLead"); } catch { return; }
    }
    navigate(path);
  };

  useEffect(() => {
    if (!visible) return undefined;
    dialogRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  const firstName = String(user.name || "").trim().split(/\s+/)[0];
  const partnerOf = (s) => (s.accountManagerId === user.id
    ? s.trainingLeadName && { name: s.trainingLeadName, role: "Training Lead" }
    : s.accountManagerName && { name: s.accountManagerName, role: "Account Manager" });
  const extra = due.length - SHOWN;

  return createPortal(
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }} className="ci-due-backdrop" style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: font }}>
      <style>{`
        @keyframes ciDueIn { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes ciDueFade { from { opacity: 0; } to { opacity: 1; } }
        .ci-due-backdrop { animation: ciDueFade 180ms ease-out; }
        .ci-due-card { animation: ciDueIn 260ms cubic-bezier(.2,.8,.2,1); }
        .ci-due-row { transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease; }
        .ci-due-row:hover { border-color: #A8D5EE; box-shadow: 0 6px 18px rgba(37,71,106,0.10); transform: translateY(-1px); }
        .ci-due-go { transition: background 150ms ease, gap 150ms ease; }
        .ci-due-row:hover .ci-due-go { background: #1a3550; gap: 9px; }
        @media (prefers-reduced-motion: reduce) { .ci-due-backdrop, .ci-due-card { animation: none; } .ci-due-row, .ci-due-go { transition: none; } }
      `}</style>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ci-due-title" className="ci-due-card" style={{ width: "100%", maxWidth: 560, maxHeight: "92vh", display: "flex", flexDirection: "column", background: "#fff", borderRadius: 22, overflow: "hidden", boxShadow: "0 28px 70px rgba(15,23,42,0.35)", outline: "none" }}>
        {/* Header */}
        <div style={{ position: "relative", padding: "24px 26px 22px", background: "linear-gradient(135deg, #1a3550 0%, #25476a 45%, #2e7db5 80%, #38aae1 100%)", color: "#fff", overflow: "hidden" }}>
          <div aria-hidden="true" style={{ position: "absolute", top: -50, right: -40, width: 170, height: 170, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
          <div aria-hidden="true" style={{ position: "absolute", bottom: -36, right: 90, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
          <button type="button" onClick={close} aria-label="Close" style={{ position: "absolute", top: 14, right: 14, width: 32, height: 32, borderRadius: 10, border: "none", background: "rgba(255,255,255,0.14)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FiX size={16} />
          </button>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", position: "relative" }}>
            <div aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FiClipboard size={22} />
            </div>
            <div style={{ minWidth: 0, paddingRight: 28 }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>Hub check-ins</p>
              <h2 id="ci-due-title" style={{ margin: 0, fontSize: 20, fontWeight: 900, lineHeight: 1.25, letterSpacing: "-0.3px" }}>
                {firstName ? `${firstName}, you` : "You"} have {due.length === 1 ? "a report" : `${due.length} reports`} to write
              </h2>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>
                Once a check-in has happened, share how it went. It only takes three parts:
              </p>
              {mode === "teacher" && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
                  Writing one switches you to your Account Manager / Training Lead sign-in.
                </p>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {PARTS.map(({ icon: Icon, label }) => (
                  <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.22)", fontSize: 12, fontWeight: 700 }}>
                    <Icon size={12} /> {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Check-ins */}
        <div style={{ padding: "18px 20px 6px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, background: "#F8FAFC" }}>
          {due.slice(0, SHOWN).map((s) => {
            const look = dueLook(s.scheduledDate);
            const partner = partnerOf(s);
            return (
              <button
                key={s.id}
                type="button"
                className="ci-due-row"
                onClick={() => open(`${base}/sessions/${s.id}`)}
                style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 14px", borderRadius: 14, border: "1.5px solid #E5E7EB", background: "#fff", textAlign: "left", cursor: "pointer", fontFamily: font }}
              >
                <HubAvatar name={s.hubName} photo={s.hubPhoto} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.hubName}</p>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5 }}>
                    <Tag bg={look.bg} color={look.color}>{look.text}</Tag>
                    <Tag icon={FiCalendar}>{formatDate(s.scheduledDate, { day: "numeric", month: "short" })}</Tag>
                    <Tag icon={s.format === "online" ? FiVideo : FiMapPin}>{FORMAT_LABEL[s.format]}</Tag>
                    {s.frequency && <Tag>{FREQUENCY_LABEL[s.frequency]}</Tag>}
                  </div>
                  {partner && (
                    <p style={{ margin: "5px 0 0", fontSize: 12, color: "#6B7280", display: "flex", alignItems: "center", gap: 4 }}>
                      <FiUser size={11} /> With {partner.name}, {partner.role}
                    </p>
                  )}
                </div>
                <span className="ci-due-go" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, background: "#25476a", color: "#fff", fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0 }}>
                  Write report <FiArrowRight size={13} />
                </span>
              </button>
            );
          })}
          {extra > 0 && (
            <button type="button" onClick={() => open(base)} style={{ alignSelf: "center", border: "none", background: "none", color: "#2e7db5", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: font, padding: "2px 0 4px" }}>
              + {extra} more waiting — see them all
            </button>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "14px 20px 18px", background: "#F8FAFC", borderTop: "1px solid #EEF2F6" }}>
          <button type="button" onClick={close} style={{ border: "none", background: "none", color: "#6B7280", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: font, padding: "8px 4px" }}>
            Remind me later
          </button>
          <button type="button" onClick={() => open(base)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 11, border: "1.5px solid #D6E4EF", background: "#fff", color: "#25476a", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: font }}>
            Open my check-ins
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
