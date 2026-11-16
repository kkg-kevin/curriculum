import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FiChevronDown } from "react-icons/fi";
import LogoutButton from "./LogoutButton";
import { BRAND_NAME, BRAND_LOGO_DARK_BG, BRAND_LOGO_DARK_BG_FILTER } from "../../branding";
import { useAuth } from "../../context/AuthContext";
import { isStaff } from "../../hooks/usePermissions";
import { useSidebarHover, SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "../../hooks/useSidebarHover";
import { readLocal, writeLocal } from "../../utils/safeStorage";
import { isCurrent, navFor } from "../../navigation/adminNav";

// The admin app's sidebar — a tree (navigation/adminNav.js): Dashboard, then sections that fold
// (Teaching & learning, People, Programmes, Finance, Quality & insights), each with its items; an
// item with sub-pages opens to show them; Settings pinned at the bottom.
//   - The section and item holding the current page open by themselves; what's folded is remembered
//     in this browser (safeStorage — never throws when storage is blocked).
//   - Desktop: an icon rail (section dividers + item icons) that opens while hovered; an item with
//     sub-pages links to its own page there. Phone: the same tree in the drawer.
//   - Staff see only what their role allows (navFor), exactly as before.

const NAVY = "#25476a";
const GOLD = "#feb139";
const CLOSED_SECTIONS_KEY = "adminNav.closedSections";
const OPEN_ITEMS_KEY = "adminNav.openItems";

const readSet = (key) => {
  try { return new Set(JSON.parse(readLocal(key) || "[]")); } catch { return new Set(); }
};
const writeSet = (key, set) => writeLocal(key, JSON.stringify([...set]));

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

function ParentItem({ item, location, collapsed, open, onToggle, onNavigate }) {
  const Icon = item.icon;
  const current = itemCurrent(item, location);
  if (collapsed) {
    // The icon rail: the item's own page (hovering opens the full tree).
    return (
      <Link to={item.path} title={item.name} aria-current={current ? "page" : undefined} className="adm-nav-link"
        style={{ display: "flex", justifyContent: "center", padding: 11, margin: "0 0 3px", borderRadius: 12, color: current ? NAVY : "#fff", backgroundColor: current ? GOLD : "transparent" }}>
        {Icon && <Icon size={18} />}
      </Link>
    );
  }
  const listId = `adm-sub-${item.name.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div style={{ margin: "0 0 3px" }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={listId}
        className="adm-nav-link"
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", border: "none", borderRadius: 12,
          background: current && !open ? "rgba(254,177,57,0.16)" : "transparent",
          color: current ? GOLD : "#fff", fontSize: 14.5, fontWeight: current ? 700 : 500, fontFamily: "inherit", cursor: "pointer", textAlign: "left",
        }}
      >
        {Icon && <Icon size={18} style={{ flexShrink: 0 }} />}
        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>
        <FiChevronDown size={15} style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease", opacity: 0.8 }} />
      </button>
      {open && (
        <div id={listId} style={{ margin: "2px 0 6px 23px", paddingLeft: 10, borderLeft: "1.5px solid rgba(255,255,255,0.16)" }}>
          {item.children.map((child) => (
            <LeafLink key={child.path + child.name} item={child} location={location} onNavigate={onNavigate} depth={1} siblings={item.children} />
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ section, location, collapsed, closed, onToggleSection, openItems, onToggleItem, onNavigate }) {
  const listId = `adm-sec-${section.key}`;
  const hasCurrent = section.items.some((i) => itemCurrent(i, location));
  return (
    <div style={{ marginTop: collapsed ? 6 : 14 }}>
      {collapsed ? (
        <div aria-hidden="true" style={{ height: 1, margin: "8px 10px 10px", background: "rgba(255,255,255,0.15)" }} />
      ) : (
        <button
          type="button"
          onClick={onToggleSection}
          aria-expanded={!closed}
          aria-controls={listId}
          className="adm-nav-section"
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            padding: "6px 14px", margin: "0 0 4px", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit",
            color: hasCurrent && closed ? GOLD : "rgba(255,255,255,0.58)", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
          }}
        >
          <span>{section.label}</span>
          <FiChevronDown size={13} style={{ transform: closed ? "rotate(-90deg)" : "none", transition: "transform 0.15s ease" }} />
        </button>
      )}
      {(collapsed || !closed) && (
        <div id={listId}>
          {section.items.map((item) => (item.children ? (
            <ParentItem key={item.name} item={item} location={location} collapsed={collapsed} open={openItems.has(item.name)} onToggle={() => onToggleItem(item.name)} onNavigate={onNavigate} />
          ) : (
            <LeafLink key={item.name} item={item} location={location} collapsed={collapsed} onNavigate={onNavigate} />
          )))}
        </div>
      )}
    </div>
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

  const [closedSections, setClosedSections] = useState(() => readSet(CLOSED_SECTIONS_KEY));
  const [openItems, setOpenItems] = useState(() => readSet(OPEN_ITEMS_KEY));

  // The page being shown: its section unfolds and its item opens (and stays so).
  useEffect(() => {
    for (const section of nav.sections) {
      const item = section.items.find((i) => itemCurrent(i, location));
      if (!item) continue;
      setClosedSections((prev) => {
        if (!prev.has(section.key)) return prev;
        const next = new Set(prev); next.delete(section.key); writeSet(CLOSED_SECTIONS_KEY, next); return next;
      });
      if (item.children) {
        setOpenItems((prev) => {
          if (prev.has(item.name)) return prev;
          const next = new Set(prev); next.add(item.name); writeSet(OPEN_ITEMS_KEY, next); return next;
        });
      }
    }
  }, [location.pathname, location.search, location.hash, nav]);

  const toggleSection = (key) => setClosedSections((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    writeSet(CLOSED_SECTIONS_KEY, next);
    return next;
  });
  const toggleItem = (name) => setOpenItems((prev) => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    writeSet(OPEN_ITEMS_KEY, next);
    return next;
  });

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
        `}</style>

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
              closed={closedSections.has(section.key)}
              onToggleSection={() => toggleSection(section.key)}
              openItems={openItems}
              onToggleItem={toggleItem}
              onNavigate={onNavigate}
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
