import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FiCompass, FiList, FiUsers, FiMessageCircle, FiTool, FiFlag, FiUser, FiUserPlus, FiShield } from "react-icons/fi";
import { connectApi } from "../services/connectApi";
import { C, FONT, card, ErrorBox, Loading, ConnectStyles, ScrollRow, useNarrow } from "../components/kit";
import { HERO_GRADIENT } from "../../../theme/brand";

export const CONNECT_BASE = "/learner-portal/connect";

const TABS = [
  { to: "", label: "Discover", icon: FiCompass, end: true },
  { to: "/feed", label: "Community Feed", icon: FiList },
  { to: "/communities", label: "My Communities", icon: FiUsers },
  { to: "/messages", label: "Messages", icon: FiMessageCircle, count: "unreadMessages" },
  { to: "/projects", label: "Projects", icon: FiTool, count: "projectInvites" },
  { to: "/challenges", label: "Challenges", icon: FiFlag },
  { to: "/people", label: "People", icon: FiUserPlus, count: "connectionRequests" },
  { to: "/profile", label: "My Profile", icon: FiUser },
];

export const useConnectMe = () => useQuery({ queryKey: ["connect", "me"], queryFn: connectApi.me, staleTime: 60 * 1000 });

// Digifunzi Connect for a learner (their own login): the area's header and tabs, then the page.
// Connect is the learner's whatever classes they're in — nothing here looks at enrolment.
export default function ConnectLayout() {
  const { pathname } = useLocation();
  const narrow = useNarrow(640);
  const me = useConnectMe();
  const counts = useQuery({
    queryKey: ["connect", "counts"],
    queryFn: connectApi.counts,
    enabled: me.data?.status === "active" || me.data?.status === "suspended",
    refetchInterval: 30 * 1000,
  });
  if (me.isLoading) return <Loading rows={2} />;
  if (me.error) return <ErrorBox error={me.error} onRetry={me.refetch} />;
  const data = me.data;
  if (data.status === "not_member") return <div className="cx"><ConnectStyles /><NotOnYet firstName={data.firstName} /></div>;
  const n = { ...(data.counts || {}), ...(counts.data || {}) };
  const rulesPage = pathname.endsWith("/rules");

  return (
    <div className="cx" style={{ fontFamily: FONT, color: C.ink, width: "100%" }}>
      <ConnectStyles />
      {/* On phones the header is one slim line, so the page itself starts near the top. */}
      <header style={{ background: HERO_GRADIENT, borderRadius: narrow ? 16 : 22, padding: narrow ? "10px 12px 10px 16px" : "18px 22px", color: "#fff", marginBottom: narrow ? 10 : 14, display: "flex", alignItems: "center", gap: narrow ? 8 : 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: narrow ? 13 : 12, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: C.gold }}>Digifunzi Connect</div>
          {!narrow && <div style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>Learn together. Build together. Innovate together.</div>}
        </div>
        <NavLink to={`${CONNECT_BASE}/rules`} aria-label="Staying safe" style={{ color: "#fff", fontWeight: 800, fontSize: 13.5, display: "inline-flex", gap: 6, alignItems: "center", justifyContent: "center", textDecoration: "none", border: "1.5px solid rgba(255,255,255,0.45)", borderRadius: 999, padding: narrow ? 0 : "6px 12px", minWidth: 40, minHeight: 40, flexShrink: 0 }}>
          <FiShield size={narrow ? 18 : 15} />{!narrow && " Staying safe"}
        </NavLink>
      </header>
      {data.status === "suspended" && (
        <div role="status" style={{ ...card, background: C.goldTint, borderColor: C.goldBorder, color: C.goldText, marginBottom: 12, fontWeight: 700 }}>
          You can read Connect, but posting and messages are paused until {new Date(data.suspendedUntil).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.
          {data.suspendedReason ? ` ${data.suspendedReason}` : ""}
        </div>
      )}
      {!rulesPage && (
        <ScrollRow as="nav" aria-label="Connect" activeKey={pathname} style={{ marginBottom: narrow ? 10 : 14 }}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const count = t.count ? n[t.count] || 0 : 0;
            return (
              <NavLink key={t.label} to={`${CONNECT_BASE}${t.to}`} end={t.end}
                style={({ isActive }) => ({ display: "inline-flex", alignItems: "center", gap: 7, padding: narrow ? "8px 12px" : "9px 14px", minHeight: 40, flexShrink: 0, borderRadius: 999, textDecoration: "none", fontWeight: 800, fontSize: 14, whiteSpace: "nowrap", border: `1.5px solid ${isActive ? C.navy : C.border}`, background: isActive ? C.navy : "#fff", color: isActive ? "#fff" : C.navy })}>
                <Icon size={16} /> {t.label}
                {count > 0 && <span aria-label={`${count} new`} style={{ background: C.gold, color: C.navyDeep, borderRadius: 999, fontSize: 11.5, fontWeight: 900, padding: "1px 7px" }}>{count}</span>}
              </NavLink>
            );
          })}
        </ScrollRow>
      )}
      <Outlet context={{ me: data }} />
    </div>
  );
}

function NotOnYet({ firstName }) {
  return (
    <div style={{ fontFamily: FONT, width: "100%" }}>
      <div style={{ background: HERO_GRADIENT, borderRadius: 24, padding: "28px 26px", color: "#fff" }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: C.gold }}>Digifunzi Connect</div>
        <h1 style={{ margin: "6px 0 8px", fontSize: 28 }}>Learn together. Build together. Innovate together.</h1>
        <p style={{ margin: 0, opacity: 0.92, lineHeight: 1.6 }}>
          Connect is where Digifunzi learners share what they make, ask for help, join communities like Robotics or Python,
          team up on projects and take on challenges — and it stays yours after your classes and bootcamps end.
        </p>
      </div>
      <div style={{ ...card, marginTop: 14, lineHeight: 1.6 }}>
        <h2 style={{ marginTop: 0, fontSize: 19 }}>Ask your parent to switch it on{firstName ? `, ${firstName}` : ""}</h2>
        <p style={{ color: C.muted }}>
          To keep everyone safe, a parent or guardian says yes first. They sign in to their own Digifunzi account, open your page
          and choose <strong>Connect</strong>. Once they've switched it on, come back here.
        </p>
      </div>
    </div>
  );
}
