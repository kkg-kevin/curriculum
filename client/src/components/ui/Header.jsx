import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiLogOut, FiMenu, FiUser } from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import NotificationBell from "./NotificationBell";
import RoleSwitcher from "./RoleSwitcher";

// The admin's avatar opens a small menu: My profile (/profile — photo, details, password, emails)
// and Sign out. Portals into document.body with fixed positioning computed from the trigger's
// getBoundingClientRect (same pattern as CurriculumCard's kebab menu) — rendered inline instead,
// it gets clipped: MainLayout wraps Header in an `overflow: hidden` container.
function AdminAvatarMenu({ user, initial }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const openMenu = () => {
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (!triggerRef.current?.contains(e.target) && !menuRef.current?.contains(e.target)) setOpen(false);
    };
    const closeNow = () => setOpen(false);
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", closeNow, true);
    window.addEventListener("resize", closeNow);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", closeNow, true);
      window.removeEventListener("resize", closeNow);
    };
  }, [open]);

  const item = { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", border: 0, borderRadius: 8, background: "transparent", color: "#374151", fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", textAlign: "left" };
  const hover = { onMouseEnter: (e) => { e.currentTarget.style.background = "#F3F4F6"; }, onMouseLeave: (e) => { e.currentTarget.style.background = "transparent"; } };

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          width: "40px", height: "40px", borderRadius: "50%",
          backgroundColor: "#25476a", color: "#fff", border: "none", padding: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: "600", flexShrink: 0, cursor: "pointer", overflow: "hidden",
        }}
      >
        {user?.photo ? (
          <img src={user.photo} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : initial}
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: "fixed", top: pos.top, right: pos.right, zIndex: 9999,
            backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px",
            boxShadow: "0 8px 28px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            padding: "6px", width: "230px", fontFamily: "Inter, sans-serif",
          }}
        >
          <div style={{ padding: "8px 12px 10px", borderBottom: "1px solid #F3F4F6", marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{user?.name || "Admin"}</div>
            <div style={{ fontSize: 12, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</div>
          </div>
          <button type="button" role="menuitem" style={item} {...hover} onClick={() => { setOpen(false); navigate("/profile"); }}>
            <FiUser size={15} /> My profile
          </button>
          <button type="button" role="menuitem" style={{ ...item, color: "#B91C1C" }} {...hover} onClick={() => { setOpen(false); logout(); }}>
            <FiLogOut size={15} /> Sign out
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

// `photo` is an optional override: the logged-in `user` object is the generic auth account
// record (name/email/role), which never carries a photo for teacher/school/learner — each of
// those roles' actual photo lives on their own Teacher/LearningHub/Learner entity instead. The
// portal layouts already fetch that entity for their own purposes (HubSwitcher, sidebars, etc.)
// and pass its `.photo` down here, so this doesn't fire a second fetch just for the header.
// Admin has no such split (its own User record *is* the entity with `.photo`), so it's left
// unset and falls back to `user?.photo`.
function Header({ isMobile = false, onMenuClick = () => {}, photo }) {
  const location = useLocation();
  const { user } = useAuth();
  const avatarPhoto = photo ?? user?.photo;

  const initial = user?.name?.trim()?.[0]?.toUpperCase() || "?";
  // "teacher" is still the underlying role value (auth, permissions, users.json) — only the
  // displayed label changes here, same as everywhere else "Teacher" was renamed to "Educator"
  // for display purposes.
  // A staff (collaborator) account shows its staff role, e.g. "Staff · Finance".
  // A "learner" account is either a parent (signs in with email, sees all their children) or a
  // child's own login (username only) — labelled so each can see whose account they're in.
  const roleLabel = user?.hubLead ? "Account Manager / Training Lead"
    : user?.role === "teacher" ? "Educator"
    : user?.role === "supervisor" ? "Supervisor"
    : user?.role === "collaborator" ? (user.accessRole ? `Staff · ${user.accessRole.name}` : "Staff")
    : user?.role === "learner" ? (user.username ? "Learner" : "Parent")
    : user?.role ? user.role[0].toUpperCase() + user.role.slice(1) : "";

  const pageTitles = {
    "/": "Dashboard",
    "/learning-hubs": "Learning Hubs",
    "/learning-hubs/revenue": "Hub Revenue",
    "/settings/learning-hubs/create": "Add Learning Hub",
    "/curriculum": "Curriculum",
    "/learners": "Learners",
    "/teachers": "Educators",
    "/classes": "Classes",
    "/assessments": "Assessments",
    "/reports": "Reports",
    "/settings": "Settings",
    "/profile": "My Profile",
    "/activity": "Activity",
    "/courses": "Courses",
    "/events": "Events",
    "/billing": "Billing",
    "/enquiries": "Enquiries",
    "/home-learning": "Home Learning",
    "/teacher-portal/reports": "Reports",
    "/teacher-portal/timetable": "Timetable",
    "/teacher-portal/home-learning": "Home Learning",
    "/school-portal/attendance": "Attendance",
    "/school-portal/timetable": "Timetable",
    "/school-portal/rooms": "Rooms",
    "/school-portal/billing": "Billing",
    "/learner-portal/reports": "Reports",
    "/learner-portal/timetable": "Timetable",
    "/learner-portal/profile": "My Profile",
    "/learner-portal/family": "Family",
    "/learner-portal/invoices": "Invoices",
    "/learner-portal/receipts": "Receipts",
    "/learner-portal/statement": "Statement",
    "/learner-portal/certificates": "Certificate",
    "/teacher-portal": "My Dashboard",
    "/teacher-portal/course-content": "Course Content",
    "/teacher-portal/assessments": "Assessments",
    "/teacher-portal/attendance": "Attendance",
    "/teacher-portal/claims": "Payments",
    "/teacher-portal/invoices": "Payments",
    "/teacher-portal/profile": "My Profile",
    "/supervisor-portal": "My Dashboard",
    "/supervisor-portal/claims": "Claims",
    "/supervisor-portal/educators": "My Educators",
    "/supervisor-portal/profile": "My Profile",
    "/school-portal": "My Dashboard",
    "/school-portal/curriculum": "Curriculum",
    "/school-portal/reports": "Reports",
    "/school-portal/profile": "My Profile",
    "/learner-portal": "My Dashboard",
    "/parent": "My Family",
    "/parent/timetable": "Timetable",
    "/parent/invoices": "Payments",
    "/parent/receipts": "Receipts",
    "/parent/statement": "Statement",
    "/parent/family": "Packages",
    "/parent/account": "My Account",
    "/learner-portal/courses": "My Courses",
    "/learner-portal/assessments": "Assessments",
    "/learner-portal/progress": "Progress",
  };

  const getPageTitle = (pathname) => {
    if (pageTitles[pathname]) return pageTitles[pathname];
    if (pathname === "/curriculum/create")
      return "Create Curriculum";
    if (pathname.startsWith("/curriculum/") && pathname.endsWith("/structure"))
      return "Structure Builder";
    if (pathname.startsWith("/curriculum/") && pathname.endsWith("/edit"))
      return "Edit Curriculum";
    if (pathname.startsWith("/curriculum/") && pathname.endsWith("/view"))
      return "Curriculum View";
    if (pathname.startsWith("/teacher-portal/classes/"))
      return "My Class";
    if (pathname === "/billing/claim-invoices")
      return "Claim invoices";
    if (pathname.startsWith("/billing/claims/"))
      return "Educator Claim";
    if (pathname.startsWith("/supervisor-portal/claims/"))
      return "Claim";
    // Quality assurance, in every app it's in.
    if (/^\/(supervisor-portal\/|teacher-portal\/|school-portal\/)?qa(\/|$)/.test(pathname))
      return pathname.startsWith("/teacher-portal") || pathname.startsWith("/school-portal") ? "QA Reviews" : "Quality Assurance";
    if (pathname.startsWith("/supervisor-portal/educators/"))
      return "My Educators";
    if (pathname.startsWith("/teacher-portal/claims/"))
      return "Payments";
    if (pathname.startsWith("/teacher-portal/course-content/") || pathname.startsWith("/learner-portal/courses/"))
      return "Course Content";
    if (pathname.startsWith("/parent/children/"))
      return "My Family";
    if (pathname.startsWith("/parent/invoices/"))
      return "Invoice";
    if (pathname.startsWith("/parent/receipts/"))
      return "Receipt";
    if (pathname.startsWith("/school-portal/classes/"))
      return "Classes";
    if (pathname.startsWith("/school-portal/teachers/"))
      return "Educators";
    if (pathname.startsWith("/school-portal/learners/"))
      return "Learners";
    if (pathname.startsWith("/school-portal/curriculum/"))
      return "Curriculum";
    if (pathname.startsWith("/settings/learning-hubs/") && pathname.endsWith("/edit"))
      return "Edit Learning Hub";
    if (pathname.startsWith("/learning-hubs/") && pathname.endsWith("/view"))
      return "Learning Hub View";
    // A page inside a section (a learner's profile, an invoice, a form) carries its section's
    // name — on a phone this title is the only sign of where you are.
    const section = Object.keys(pageTitles)
      .filter((path) => path !== "/" && pathname.startsWith(`${path}/`))
      .sort((x, y) => y.length - x.length)[0];
    if (section) return pageTitles[section];
    return "Dashboard";
  };

  const pageTitle = getPageTitle(location.pathname);

  return (
    <header
      className="no-print"
      style={{
        height: "70px",
        backgroundColor: "#ffffff",
        borderBottom: "1px solid #E5E7EB",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isMobile ? "0 14px 0 16px" : "0 24px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 12, minWidth: 0 }}>
        {isMobile ? (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open menu"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "38px",
              height: "38px",
              flexShrink: 0,
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              background: "none",
              color: "#374151",
              cursor: "pointer",
            }}
          >
            <FiMenu size={18} />
          </button>
        ) : null}

        <h2
          style={{
            margin: 0,
            fontSize: isMobile ? "18px" : "22px",
            fontWeight: "600",
            color: "#111827",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {pageTitle}
        </h2>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: isMobile ? "10px" : "20px",
          flexShrink: 0,
        }}
      >
        <NotificationBell />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          {user?.role === "admin" ? (
            <AdminAvatarMenu user={user} initial={initial} />
          ) : (
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: "#25476a",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "600",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              {avatarPhoto ? (
                <img src={avatarPhoto} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : initial}
            </div>
          )}

          {!isMobile ? (
            <div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "#111827" }}>{user?.name || "..."}</div>
              {/* The role label, or — for a login with more than one role — a menu to switch. */}
              <RoleSwitcher label={roleLabel} />
            </div>
          ) : (
            <RoleSwitcher label={roleLabel} compact />
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;