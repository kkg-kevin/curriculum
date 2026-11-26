import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FiX } from "react-icons/fi";
import { BRAND, FONT, pill } from "../../../theme/brand";
import { useAuth } from "../../../context/AuthContext";
import { AnnouncementBody } from "./AnnouncementView";
import { announcementsApi } from "../services/announcementsApi";

// The sign-in pop-up for an "Important" announcement (26 Nov 2026): the newest live one this person
// hasn't opened. Mounted in every portal's layout beside the general-event pop-up. "Read it" opens
// it on their Announcements page; closing marks it seen, so it shows once. It waits while another
// sign-in pop-up is open (marked data-signin-popup) and never shows on the Announcements page itself.

const BASE_OF = { teacher: "/teacher-portal", school: "/school-portal", supervisor: "/supervisor-portal", affiliate: "/affiliate-portal" };
function portalBase(user) {
  if (!user) return "";
  if (user.totLearner) return "/teacher-portal"; // an educator learning: their announcements are an educator's
  if (user.role === "learner") return user.username && !user.email ? "/learner-portal" : "/parent";
  return BASE_OF[user.role] ?? "";
}

export default function AnnouncementPopup() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [closed, setClosed] = useState(null);
  const [othersOpen, setOthersOpen] = useState(false);
  const { data: a } = useQuery({ queryKey: ["announcements", "popup"], queryFn: announcementsApi.popup, enabled: !!user, staleTime: 5 * 60 * 1000 });

  // Another sign-in pop-up (check-ins, events) goes first.
  useEffect(() => {
    const check = () => setOthersOpen(!!document.querySelector("[data-signin-popup]:not([data-announcement-popup])"));
    check();
    const t = setInterval(check, 1500);
    return () => clearInterval(t);
  }, []);

  if (!a || closed === a.id || othersOpen || pathname.includes("/announcements")) return null;
  const close = () => {
    setClosed(a.id);
    announcementsApi.seen(a.id).catch(() => {}).finally(() => qc.invalidateQueries({ queryKey: ["announcements"] }));
  };
  const read = () => {
    setClosed(a.id);
    navigate(`${portalBase(user)}/announcements/${a.id}`);
  };
  return createPortal(
    <div data-signin-popup data-announcement-popup role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
      style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100dvh", zIndex: 9500, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box", fontFamily: FONT }}>
      <div role="dialog" aria-modal="true" aria-label={a.title} style={{ width: "min(100%, 560px)", maxHeight: "88dvh", overflowY: "auto", background: "#fff", borderRadius: 20, boxShadow: "0 24px 60px rgba(15,23,42,0.3)", padding: "20px 22px", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 6 }}>
            <span style={{ display: "flex", gap: 6 }}><span style={pill("waiting")}>Important</span><span style={pill("strong")}>Announcement</span></span>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: BRAND.ink, lineHeight: 1.25 }}>{a.title}</h2>
            <span style={{ fontSize: 12.5, color: BRAND.muted }}>{a.authorName}</span>
          </div>
          <button type="button" onClick={close} aria-label="Close" style={{ width: 40, height: 40, borderRadius: 10, border: "none", background: BRAND.greyTint, color: BRAND.muted, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}><FiX /></button>
        </div>
        <AnnouncementBody a={a} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" onClick={close} style={{ padding: "10px 16px", borderRadius: 10, border: `1.5px solid ${BRAND.border}`, background: "#fff", fontWeight: 700, fontFamily: FONT, cursor: "pointer", color: BRAND.inkSoft }}>Close</button>
          <button type="button" onClick={read} style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: BRAND.navy, color: "#fff", fontWeight: 800, fontFamily: FONT, cursor: "pointer" }}>{a.askAck || a.allowComments ? "Open it" : "Read it in full"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
