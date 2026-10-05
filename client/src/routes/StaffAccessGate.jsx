import { Link, useLocation } from "react-router-dom";
import { FiLock } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { canViewAny, isStaff } from "../hooks/usePermissions";

// Admin-app path prefix → the staff-role module(s) needed to view it (keys as in
// server/src/modules/access/access.registry.js), longest prefix first. `null` = owner-only.
// Paths not listed (the dashboard) are open to every staff member.
const PATH_MODULES = [
  ["/learning-hubs/revenue", "hub-visits"],
  ["/settings/learning-hubs", "learning-hubs"],
  ["/learning-hubs", "learning-hubs"],
  ["/curriculum", "curriculum"],
  ["/learners", "learners"],
  ["/home-learning", "home-learning"],
  ["/teachers", "teachers"],
  ["/classes", "classes"],
  ["/events", ["competitions", "bootcamps"]],
  ["/courses", "courses"],
  ["/assessments", "assessments"],
  // /billing itself also holds Educator Claims (see BillingPage.jsx's BillingHome); its
  // sub-pages are Billing only.
  ["/billing/customers", "billing"],
  ["/billing/receipts", "billing"],
  ["/billing/statements", "billing"],
  ["/billing", ["billing", "claims", "claims-approval"]],
  ["/claims", ["claims", "claims-approval"]],
  ["/activity", "activity"],
  ["/settings", "settings"],
  ["/enquiries", null],
  ["/reports", null],
];

function modulesFor(pathname) {
  const match = PATH_MODULES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match ? { matched: true, modules: match[1] } : { matched: false };
}

// Wraps the admin shell's page area: a staff member (see usePermissions.js) opening a page their
// role can't view gets a clear "no access" screen instead of a page full of failed requests. The
// server refuses those requests regardless — this is only about what they see.
export default function StaffAccessGate({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!isStaff(user)) return children;
  const { matched, modules } = modulesFor(pathname);
  if (!matched || (modules && canViewAny(user, modules))) return children;

  return (
    <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center", fontFamily: "Inter, sans-serif", padding: "0 16px" }}>
      <div style={{ width: 56, height: 56, margin: "0 auto 16px", borderRadius: 16, display: "grid", placeItems: "center", background: "#EEF2F7", color: "#25476a" }}>
        <FiLock size={24} />
      </div>
      <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "#111827" }}>You don't have access to this page</h1>
      <p style={{ margin: "0 0 20px", color: "#6B7280", fontSize: 14, lineHeight: 1.6 }}>
        {user.accessRole ? <>Your role, <strong>{user.accessRole.name}</strong>, doesn't include it.</> : "Your access doesn't include it."}{" "}
        Ask your workspace administrator if you need it.
      </p>
      <Link to="/" style={{ display: "inline-block", padding: "10px 18px", borderRadius: 9, background: "#25476a", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>Go to dashboard</Link>
    </div>
  );
}
