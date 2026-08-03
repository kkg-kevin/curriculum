import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiBell, FiMenu } from "react-icons/fi";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../modules/auth/services/authApi";
import ImageUploadField from "../ImageUploadField";

// Admin is the only role with no dedicated "My Profile" page (Learner/Teacher/School each have
// their own portal profile page where photo upload lives instead) — so this popover is admin's
// only way to set one. Portals into document.body with fixed positioning computed from the
// trigger's getBoundingClientRect (same pattern as CurriculumCard's kebab menu) — rendered
// inline instead, this gets clipped/invisible: MainLayout wraps Header in an `overflow: hidden`
// container, which silently ate the old absolutely-positioned version.
function AdminAvatarPopover({ user, initial, onPhotoChange }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  const openPopover = () => {
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!triggerRef.current?.contains(e.target) && !popoverRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);

  const handleChange = async (url) => {
    setSaving(true);
    try {
      await authApi.updateMe({ photo: url });
      onPhotoChange(url);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to update photo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPopover())}
        aria-label="Edit profile photo"
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
          ref={popoverRef}
          style={{
            position: "fixed", top: pos.top, right: pos.right, zIndex: 9999,
            backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px",
            boxShadow: "0 8px 28px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            padding: "14px", width: "240px", fontFamily: "Inter, sans-serif",
          }}
        >
          <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: "700", color: "#374151" }}>Profile Photo</p>
          <ImageUploadField
            value={user?.photo || null}
            onChange={handleChange}
            width="100%"
            height="140px"
          />
          {saving && <p style={{ margin: "8px 0 0", fontSize: "11px", color: "#9CA3AF" }}>Saving…</p>}
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
  const { user, updateUser } = useAuth();
  const avatarPhoto = photo ?? user?.photo;

  const initial = user?.name?.trim()?.[0]?.toUpperCase() || "?";
  // "teacher" is still the underlying role value (auth, permissions, users.json) — only the
  // displayed label changes here, same as everywhere else "Teacher" was renamed to "Educator"
  // for display purposes.
  const roleLabel = user?.role === "teacher" ? "Educator" : user?.role ? user.role[0].toUpperCase() + user.role.slice(1) : "";

  const pageTitles = {
    "/": "Dashboard",
    "/learning-hubs": "Learning Hubs",
    "/settings/learning-hubs/create": "Add Learning Hub",
    "/curriculum": "Curriculum",
    "/curriculum/create": "Create Curriculum",
    "/learners": "Learners",
    "/teachers": "Educators",
    "/classes": "Classes",
    "/assessments": "Assessments",
    "/reports": "Reports",
    "/settings": "Settings",
    "/teacher-portal": "My Dashboard",
    "/teacher-portal/course-content": "Course Content",
    "/teacher-portal/assessments": "Assessments",
    "/teacher-portal/attendance": "Attendance",
    "/teacher-portal/profile": "My Profile",
    "/school-portal": "My Dashboard",
    "/school-portal/curriculum": "Curriculum",
    "/school-portal/reports": "Reports",
    "/school-portal/profile": "My Profile",
    "/learner-portal": "My Dashboard",
    "/learner-portal/courses": "My Courses",
    "/learner-portal/assessments": "Assessments",
    "/learner-portal/progress": "Progress",
  };

  const getPageTitle = (pathname) => {
    if (pageTitles[pathname]) return pageTitles[pathname];
    if (pathname.startsWith("/curriculum/") && pathname.endsWith("/structure"))
      return "Structure Builder";
    if (pathname.startsWith("/curriculum/") && pathname.endsWith("/edit"))
      return "Edit Curriculum";
    if (pathname.startsWith("/curriculum/") && pathname.endsWith("/view"))
      return "Curriculum View";
    if (pathname.startsWith("/teacher-portal/classes/"))
      return "My Class";
    if (pathname.startsWith("/teacher-portal/course-content/") || pathname.startsWith("/learner-portal/courses/"))
      return "Course Content";
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
    return "Dashboard";
  };

  const pageTitle = getPageTitle(location.pathname);

  return (
    <header
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
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 12 }}>
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
        }}
      >
        {!isMobile ? (
          <div
            style={{
              cursor: "pointer",
              color: "#374151",
            }}
          >
            <FiBell size={22} />
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          {user?.role === "admin" ? (
            <AdminAvatarPopover user={user} initial={initial} onPhotoChange={(photo) => updateUser({ photo })} />
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
              <div style={{ fontSize: "12px", color: "#6B7280" }}>{roleLabel}</div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export default Header;