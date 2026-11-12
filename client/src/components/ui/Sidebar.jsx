import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { FiChevronRight } from "react-icons/fi";
import LogoutButton from "./LogoutButton";
import { BRAND_NAME, BRAND_LOGO_DARK_BG, BRAND_LOGO_DARK_BG_FILTER } from "../../branding";
import { useAuth } from "../../context/AuthContext";
import { isStaff } from "../../hooks/usePermissions";
import { useSidebarHover, SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "../../hooks/useSidebarHover";
import { isCurrent, navFor } from "../../navigation/adminNav";

// The admin app's sidebar — a tree (navigation/adminNav.js): Dashboard, then sections (Teaching &
// learning, People, Programmes, Finance, Quality & insights), each with its items; Settings pinned
// at the bottom. No dropdowns (12 Nov 2026): an item with sub-pages links to its own page, and its
// sub-pages are one hover away in the flyout (desktop) or listed under it (phone drawer).
//   - Desktop: an icon rail (section dividers + item icons) that opens while hovered.
//   - Staff see only what their role allows (navFor), exactly as before.
//   - Desktop hover flyout: pointing at an item with sub-pages opens a second panel beside the
//     sidebar listing them. It's rendered through a portal but stays in the sidebar's React tree,
//     so moving the pointer onto it keeps the sidebar open.

const NAVY = "#25476a";
const GOLD = "#feb139";

const itemCurrent = (item, location) => (item.children
  ? item.children.some((c) => isCurrent(c, location, { siblings: item.children }))
  : isCurrent(item, location));

function LeafLink({ item, location, collapsed, onNavigate, depth = 0, siblings }) {
  const active = isCurrent(item, location, { siblings });
  const Icon = item.icon;
  const child = depth > 0;
  return (
    <Link
      to={item.path}
      onClick={onNavigate}
      title={collapsed ? item.name : undefined}
      aria-current={active ? "page" : undefined}
      data-active={active || undefined}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        justifyContent: collapsed ? "center" : "flex-start",
        padding: collapsed ? "11px" : child ? "8px 12px 8px 14px" : "10px 14px",
        margin: child ? "1px 0" : "0 0 3px",
        borderRadius: child ? 9 : 12,
        textDecoration: "none",
        fontSize: child ? 13.5 : 14.5,
        fontWeight: active ? 700 : 500,
        color: active ? (child ? GOLD : NAVY) : child ? "rgba(255,255,255,0.82)" : "#fff",
        backgroundColor: active ? (child ? "rgba(254,177,57,0.16)" : GOLD) : "transparent",
        transition: "background-color 0.15s ease, color 0.15s ease",
      }}
      className="adm-nav-link"
    >
      {Icon && !child && <Icon size={18} style={{ flexShrink: 0 }} />}
      {!collapsed && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>}
    </Link>
  );
}

function ParentItem({ item, location, collapsed, mobile, onNavigate, onHover, onLeave }) {
  const Icon = item.icon;
  const current = itemCurrent(item, location);
  if (collapsed) {
    // The icon rail: the item's own page (hovering opens the full sidebar).
    return (
      <Link to={item.path} title={item.name} aria-current={current ? "page" : undefined} className="adm-nav-link"
        style={{ display: "flex", justifyContent: "center", padding: 11, margin: "0 0 3px", borderRadius: 12, color: current ? NAVY : "#fff", backgroundColor: current ? GOLD : "transparent" }}>
        {Icon && <Icon size={18} />}
      </Link>
    );
  }
  return (
    <div style={{ margin: "0 0 3px" }}>
      <Link
        to={item.path}
        onClick={onNavigate}
        onMouseEnter={onHover ? (e) => onHover(e.currentTarget) : undefined}
        onMouseLeave={onLeave}
        aria-current={current ? "page" : undefined}
        aria-haspopup={mobile ? undefined : "menu"}
        data-active={current || undefined}
        className="adm-nav-link"
        style={{
          display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, textDecoration: "none",
          backgroundColor: current ? GOLD : "transparent",
          color: current ? NAVY : "#fff", fontSize: 14.5, fontWeight: current ? 700 : 500,
          transition: "background-color 0.15s ease, color 0.15s ease",
        }}
      >
        {Icon && <Icon size={18} style={{ flexShrink: 0 }} />}
        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>
        {/* Points at the flyout of its pages (desktop). */}
        {!mobile && <FiChevronRight size={15} style={{ flexShrink: 0, opacity: 0.65 }} />}
      </Link>
      {/* Phones have no hover: the pages show under the item. */}
      {mobile && (
        <div style={{ margin: "2px 0 6px 23px", paddingLeft: 10, borderLeft: "1.5px solid rgba(255,255,255,0.16)" }}>
          {item.children.map((child) => (
            <LeafLink key={child.path + child.name} item={child} location={location} onNavigate={onNavigate} depth={1} siblings={item.children} />
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ section, location, collapsed, mobile, onNavigate, onFly, onFlyLeave }) {
  return (
    <div style={{ marginTop: collapsed ? 6 : 14 }}>
      {collapsed ? (
        <div aria-hidden="true" style={{ height: 1, margin: "8px 10px 10px", background: "rgba(255,255,255,0.15)" }} />
      ) : (
        <p style={{ margin: "0 0 4px", padding: "6px 14px", color: "rgba(255,255,255,0.58)", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>{section.label}</p>
      )}
      <div>
        {section.items.map((item) => (item.children ? (
          <ParentItem key={item.name} item={item} location={location} collapsed={collapsed} mobile={mobile} onNavigate={onNavigate}
            onHover={onFly ? (el) => onFly({ id: `item:${item.name}`, title: item.name, items: item.children, parent: item }, el) : undefined}
            onLeave={onFlyLeave} />
        ) : (
          <LeafLink key={item.name} item={item} location={location} collapsed={collapsed} onNavigate={onNavigate} />
        )))}
      </div>
    </div>
  );
}

// The second panel: a section's items (each with its sub-pages) or an item's sub-pages.
const FLY_WIDTH = 248;
function Flyout({ fly, location, onEnter, onLeave, onNavigate }) {
  const rows = fly.items.length + fly.items.reduce((n, i) => n + (i.children?.length || 0), 0) + (fly.parent ? 1 : 0);
  const estimate = 56 + rows * 38;
  const top = Math.max(8, Math.min(fly.top - 8, window.innerHeight - estimate - 12));
  const link = (item, siblings, depth) => {
    const active = item.children ? itemCurrent(item, location) : isCurrent(item, location, { siblings });
    const Icon = item.icon;
    return (
      <Link key={item.path + item.name} to={item.path} onClick={onNavigate} aria-current={active ? "page" : undefined} className="adm-fly-link"
        style={{ display: "flex", alignItems: "center", gap: 10, padding: depth ? "7px 12px 7px 36px" : "9px 12px", borderRadius: 10, textDecoration: "none",
          fontSize: depth ? 13 : 14, fontWeight: active ? 700 : depth ? 500 : 600, color: active ? GOLD : depth ? "rgba(255,255,255,0.78)" : "#fff",
          background: active ? "rgba(254,177,57,0.14)" : "transparent" }}>
        {Icon && !depth && <Icon size={16} style={{ flexShrink: 0, opacity: 0.9 }} />}
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>
      </Link>
    );
  };
  return createPortal(
    <div role="menu" aria-label={fly.title} onMouseEnter={onEnter} onMouseLeave={onLeave} className="no-print"
      style={{ position: "fixed", left: SIDEBAR_WIDTH - 6, top, width: FLY_WIDTH, maxHeight: "calc(100vh - 16px)", overflowY: "auto", zIndex: 1301,
        background: "#1f3d5c", color: "#fff", borderRadius: "0 16px 16px 0", padding: "12px 10px 10px 16px",
        boxShadow: "12px 8px 36px rgba(0,0,0,0.28)", fontFamily: "Inter, sans-serif", animation: "admFlyIn 120ms ease-out" }}>
      <p style={{ margin: "2px 4px 8px", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.58)" }}>{fly.title}</p>
      {fly.parent ? fly.items.map((c) => link(c, fly.items, 0)) : fly.items.map((item) => (
        <div key={item.name}>
          {link(item, [], 0)}
          {item.children?.map((c) => link(c, item.children, 1))}
        </div>
      ))}
    </div>,
    document.body,
  );
}

function Sidebar({ isMobile = false, isMobileOpen = false, onClose = () => {} }) {
  const { user } = useAuth();
  const location = useLocation();
  const nav = useMemo(() => navFor(user, { staff: isStaff(user) }), [user]);
  // Desktop: an icon rail that opens while hovered. Never collapsed on mobile — the drawer
  // already fully hides/shows, collapsing it too would just be a narrow drawer with no labels.
  const { expanded, handlers } = useSidebarHover(!isMobile);
  const isCollapsed = !isMobile && !expanded;
  const onNavigate = isMobile ? onClose : undefined;

  // The hover flyout (desktop only): what it shows and where. A short delay before opening stops
  // it flashing while the pointer passes down the list; a short one before closing lets the
  // pointer cross onto it.
  const [fly, setFly] = useState(null);
  const flyTimer = useRef(null);
  const openFly = (payload, el) => {
    clearTimeout(flyTimer.current);
    const top = el.getBoundingClientRect().top;
    flyTimer.current = setTimeout(() => setFly({ ...payload, top }), fly ? 60 : 160);
  };
  const leaveFly = () => { clearTimeout(flyTimer.current); flyTimer.current = setTimeout(() => setFly(null), 220); };
  const keepFly = () => clearTimeout(flyTimer.current);
  useEffect(() => () => clearTimeout(flyTimer.current), []);
  useEffect(() => { if (isCollapsed || isMobile) setFly(null); }, [isCollapsed, isMobile]);
  useEffect(() => { setFly(null); }, [location.pathname, location.search, location.hash]);

  // Keep the current page's link in view when the list is long.
  const navRef = useRef(null);
  useEffect(() => {
    const el = navRef.current?.querySelector("[data-active]");
    el?.scrollIntoView?.({ block: "nearest" });
  }, [location.pathname, location.search, location.hash, isCollapsed]);

  return (
    <>
      {isMobile && isMobileOpen ? (
        <div role="presentation" onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.45)", zIndex: 1200 }} />
      ) : null}

      <aside
        className="no-print"
        {...handlers}
        style={{
          width: isMobile ? "min(86vw, 300px)" : isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
          height: "100vh",
          backgroundColor: NAVY,
          color: "#fff",
          position: "fixed",
          left: isMobile ? (isMobileOpen ? 0 : "-100%") : 0,
          top: 0,
          display: "flex",
          flexDirection: "column",
          fontFamily: "Inter, sans-serif",
          zIndex: 1300,
          transition: "left 0.25s ease, width 0.2s ease",
          boxShadow: isMobile ? "0 18px 60px rgba(0,0,0,0.28)" : expanded ? "8px 0 32px rgba(0,0,0,0.22)" : "none",
          overflowX: "hidden",
        }}
      >
        <style>{`
          .adm-nav-link:not([aria-current="page"]):hover { background-color: rgba(255,255,255,0.08) !important; }
          .adm-nav-link[aria-current="page"]:hover { filter: brightness(1.03); }
          .adm-nav-link:focus-visible, .adm-nav-section:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
          .adm-nav-section:hover { color: #fff !important; }
          .adm-nav-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.25) transparent; }
          .adm-fly-link:not([aria-current="page"]):hover { background-color: rgba(255,255,255,0.09) !important; color: #fff !important; }
          .adm-fly-link:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 1px; }
          @keyframes admFlyIn { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: none; } }
        `}</style>
        {fly && !isCollapsed && !isMobile && <Flyout fly={fly} location={location} onEnter={keepFly} onLeave={leaveFly} />}

        <div
          style={{
            padding: isCollapsed ? "20px 12px" : "20px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center",
            justifyContent: isMobile || isCollapsed ? "center" : "flex-start",
            gap: 8, flexShrink: 0,
          }}
        >
          {!isCollapsed && (
            <img src={BRAND_LOGO_DARK_BG} alt={BRAND_NAME} style={{ height: 40, width: "auto", objectFit: "contain", filter: BRAND_LOGO_DARK_BG_FILTER }} />
          )}
          {isMobile ? (
            <button type="button" onClick={onClose} aria-label="Close menu"
              style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.25)", background: "transparent", color: "#fff", cursor: "pointer", fontSize: 18, flexShrink: 0, marginLeft: "auto" }}>
              ×
            </button>
          ) : null}
        </div>

        <nav ref={navRef} aria-label="Main" className="adm-nav-scroll" style={{ flex: 1, overflowY: "auto", padding: isCollapsed ? "16px 8px" : "16px 12px" }}>
          {nav.top.map((item) => <LeafLink key={item.name} item={item} location={location} collapsed={isCollapsed} onNavigate={onNavigate} />)}
          {nav.sections.map((section) => (
            <Section
              key={section.key}
              section={section}
              location={location}
              collapsed={isCollapsed}
              mobile={isMobile}
              onNavigate={onNavigate}
              onFly={isMobile || isCollapsed ? undefined : openFly}
              onFlyLeave={isMobile || isCollapsed ? undefined : leaveFly}
            />
          ))}
        </nav>

        {nav.bottom.length > 0 && (
          <div style={{ padding: isCollapsed ? "8px" : "8px 12px", borderTop: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}>
            {nav.bottom.map((item) => <LeafLink key={item.name} item={item} location={location} collapsed={isCollapsed} onNavigate={onNavigate} />)}
          </div>
        )}

        <div style={{ padding: isCollapsed ? "8px" : "12px", borderTop: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}>
          <LogoutButton collapsed={isCollapsed} />
        </div>

        {!isCollapsed && (
          <div style={{ padding: 14, textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: 12, color: "rgba(255,255,255,0.8)", flexShrink: 0 }}>
            © {new Date().getFullYear()} {BRAND_NAME}
          </div>
        )}
      </aside>
    </>
  );
}

export default Sidebar;
