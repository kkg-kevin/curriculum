import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { FiBell, FiAward, FiCheckCircle, FiFileText, FiUpload, FiCheck, FiMail } from "react-icons/fi";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "../../modules/notifications/hooks/useNotifications";

const ICONS = {
  assessment_graded: { Icon: FiCheckCircle, color: "#059669" },
  assessment_submitted: { Icon: FiUpload, color: "#25476a" },
  session_report_published: { Icon: FiFileText, color: "#7C3AED" },
  level_up: { Icon: FiAward, color: "#feb139" },
  invoice_issued: { Icon: FiFileText, color: "#25476a" },
  lead_submitted: { Icon: FiMail, color: "#2e7db5" },
};

// Where each notification type actually lives, per its own payload (see notification.service.js
// on the server for exactly what each type puts there). `?child=` piggybacks on the
// learner-portal's existing sibling-switcher param (see useLearnerPortalScope.js) so a guardian
// with more than one linked learner lands on the RIGHT child's data even if a different sibling
// was active when the notification arrived — the same URL param the switcher itself already
// reads/writes, not a new mechanism.
function resolveNotificationPath(n) {
  const p = n.payload || {};
  switch (n.type) {
    case "assessment_graded":
      return p.issueId ? `/learner-portal/assessments/${p.issueId}${p.learnerId ? `?child=${p.learnerId}` : ""}` : "/learner-portal/assessments";
    case "assessment_submitted":
      return p.issueId ? `/teacher-portal/assessments/${p.issueId}` : "/teacher-portal/assessments";
    case "session_report_published":
      return p.reportId ? `/learner-portal/reports/${p.reportId}${p.learnerId ? `?child=${p.learnerId}` : ""}` : "/learner-portal/reports";
    case "level_up":
      return p.learnerId ? `/learner-portal?child=${p.learnerId}` : "/learner-portal";
    case "invoice_issued":
      return p.invoiceId ? `${p.route || "/learner-portal/invoices/"}${p.invoiceId}` : "/learner-portal/invoices";
    case "lead_submitted":
      // The admin Enquiries page — ?lead= scrolls to and highlights the row (see EnquiriesListPage).
      return p.leadId ? `/enquiries?lead=${p.leadId}` : (p.route || "/enquiries");
    default:
      return null;
  }
}

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// Trigger + createPortal-rendered dropdown, positioned off the trigger's own
// getBoundingClientRect — same pattern Header.jsx's own AdminAvatarPopover already uses, for the
// same reason: MainLayout wraps Header in an `overflow: hidden` container that would otherwise
// clip a normally-positioned dropdown.
export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const { data } = useNotifications();
  const items = data?.items || [];
  const unreadCount = data?.unreadCount || 0;
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead, isPending: markingAll } = useMarkAllNotificationsRead();

  const handleSelect = (n) => {
    if (!n.isRead) markRead(n.id);
    setOpen(false);
    const path = resolveNotificationPath(n);
    if (path) navigate(path);
  };

  const openPanel = () => {
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 10, right: window.innerWidth - rect.right - 20 });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!triggerRef.current?.contains(e.target) && !panelRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      // Keep the panel open while its own notification list is being scrolled.
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-label="Notifications"
        style={{
          position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
          width: 38, height: 38, border: "none", background: "none", color: "#374151", cursor: "pointer", borderRadius: 10,
        }}
      >
        <FiBell size={22} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute", top: 4, right: 5, minWidth: 16, height: 16, padding: "0 3px",
              borderRadius: 8, backgroundColor: "#DC2626", color: "#fff", fontSize: 10, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif",
              border: "2px solid #fff",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed", top: pos.top, right: pos.right, zIndex: 9999,
            backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "14px",
            boxShadow: "0 8px 28px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            width: "360px", maxWidth: "calc(100vw - 32px)", fontFamily: "Inter, sans-serif", overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #F3F4F6" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#111827" }}>Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead()}
                disabled={markingAll}
                style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#25476a", fontSize: 12, fontWeight: 600, cursor: markingAll ? "default" : "pointer", padding: 0 }}
              >
                <FiCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: "min(55vh, 380px)", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
            {items.length === 0 ? (
              <p style={{ margin: 0, padding: "32px 16px", textAlign: "center", fontSize: 13, color: "#9CA3AF" }}>No notifications yet</p>
            ) : (
              items.map((n) => {
                const { Icon, color } = ICONS[n.type] || { Icon: FiBell, color: "#6B7280" };
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleSelect(n)}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 10, width: "100%", textAlign: "left",
                      padding: "12px 16px", border: "none", borderBottom: "1px solid #F9FAFB", cursor: "pointer",
                      backgroundColor: n.isRead ? "#fff" : "#F0F7FC", fontFamily: "Inter, sans-serif",
                    }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: "50%", backgroundColor: `${color}18`, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12.5, fontWeight: n.isRead ? 500 : 700, color: "#111827" }}>{n.title}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6B7280", lineHeight: 1.4 }}>{n.message}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 10.5, color: "#9CA3AF" }}>{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.isRead && <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#25476a", flexShrink: 0, marginTop: 5 }} />}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
