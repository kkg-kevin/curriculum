import {
  FiGrid, FiHome, FiBookOpen, FiUsers, FiUserCheck, FiLayers, FiAward, FiBook, FiClipboard, FiBarChart2,
  FiDollarSign, FiSettings, FiMail, FiHeart, FiActivity, FiCpu, FiCheckSquare, FiStar, FiRepeat, FiFileText, FiGift, FiMessageCircle, FiCalendar,
} from "react-icons/fi";
import { canViewAny } from "../hooks/usePermissions";

// The admin app's sidebar, as one tree (components/ui/Sidebar.jsx draws it):
//   - a top link (Dashboard), then SECTIONS (headings that fold), each with ITEMS; an item may have
//     SUB-PAGES (`children`) — the tabs / sections that already exist inside that page, linked straight
//     to (?tab=… or #…), so the page's own tabs keep working too; then Settings, pinned to the bottom.
//   - `module` is the staff-role permission key that gates a node (server/src/modules/access/
//     access.registry.js — keep the keys identical): a staff account sees it only if their role can
//     view that module. An array means "any of these". Absent means always shown. `ownerOnly` nodes
//     are never shown to staff whatever their role says (Enquiries, Reports & Analytics).
//   - `isDefault` on a sub-page: it's the one shown when its page is opened with no ?tab / #.
//   - `match(location)`: when a sub-page counts as the current page, if not the plain rule (same path,
//     same ?tab, same #).

export const DASHBOARD = { name: "Dashboard", path: "/", icon: FiGrid, end: true };
export const SETTINGS = { name: "Settings", path: "/settings", icon: FiSettings, module: "settings" };

export const ADMIN_SECTIONS = [
  {
    key: "teaching",
    label: "Teaching & learning",
    items: [
      { name: "Curriculum", path: "/curriculum", icon: FiBookOpen, module: "curriculum" },
      { name: "Courses", path: "/courses", icon: FiBook, module: "courses" },
      { name: "Assessments", path: "/assessments", icon: FiClipboard, module: "assessments" },
      { name: "Classes", path: "/classes", icon: FiLayers, module: "classes" },
    ],
  },
  {
    key: "people",
    label: "People",
    items: [
      {
        name: "Learners", path: "/learners", icon: FiUsers, module: "learners",
        children: [
          { name: "All learners", path: "/learners", isDefault: true },
          { name: "TOT learners", path: "/learners?tab=tot" },
          { name: "Parents", path: "/learners?tab=parents" },
          { name: "Parent & learner logins", path: "/learners?tab=logins" },
        ],
      },
      {
        name: "Educators", path: "/teachers", icon: FiUserCheck, module: "teachers",
        children: [
          // Every educator page except Work to mark (an educator's own page, the forms) sits here.
          { name: "All educators", path: "/teachers", match: (l) => l.pathname.startsWith("/teachers") && !l.pathname.startsWith("/teachers/training") },
          { name: "Work to mark", path: "/teachers/training", match: (l) => l.pathname.startsWith("/teachers/training") },
          // How each educator performs, side by side — Reports & Analytics' Educators tab (owner only).
          { name: "Performance", path: "/reports?tab=educators", ownerOnly: true },
          // What families say — Reports & Analytics' Parent feedback tab (owner only, like Reports).
          { name: "Parent feedback", path: "/reports?tab=parent-feedback", ownerOnly: true },
        ],
      },
      { name: "Learning Hubs", path: "/learning-hubs", icon: FiHome, module: "learning-hubs" },
    ],
  },
  {
    key: "programmes",
    label: "Programmes",
    items: [
      { name: "Home Learning", path: "/home-learning", icon: FiHeart, module: "home-learning" },
      { name: "Tech Clubs", path: "/tech-clubs", icon: FiCpu, module: "tech-clubs" },
      { name: "Pathway Subscriptions", path: "/pathway-subscriptions", icon: FiRepeat, module: "pathway-subscriptions" },
      // Families booking a mentor for a stuck learner (modules/mentor-bookings — its tabs, ?tab=).
      {
        name: "Mentor Bookings", path: "/mentor-bookings", icon: FiCalendar, module: "mentor-bookings",
        children: [
          { name: "Bookings", path: "/mentor-bookings?tab=bookings", isDefault: true, match: (l) => l.pathname.startsWith("/mentor-bookings") && (!tabOf(l) || tabOf(l) === "bookings") },
          { name: "Refunds", path: "/mentor-bookings?tab=refunds" },
          { name: "Hub settlements", path: "/mentor-bookings?tab=hubs" },
        ],
      },
      {
        name: "Events", path: "/events", icon: FiAward, module: ["competitions", "bootcamps", "general-events"],
        // One page with three sections (ProgramsListPage scrolls to #…); a bootcamp's or a
        // competition's own pages light up their sub-page.
        children: [
          { name: "General events", path: "/events#general", module: "general-events", match: (l) => l.hash === "#general" || l.pathname.startsWith("/events/general") },
          { name: "Bootcamps", path: "/events#bootcamps", module: "bootcamps", match: (l) => l.hash === "#bootcamps" || l.pathname.startsWith("/events/bootcamps") },
          { name: "Competitions", path: "/events#competitions", module: "competitions", match: (l) => l.hash === "#competitions" || l.pathname.startsWith("/events/competitions") },
          { name: "Games", path: "/events#games", module: "bootcamps", match: (l) => l.hash === "#games" },
        ],
      },
      { name: "Enquiries", path: "/enquiries", icon: FiMail, ownerOnly: true },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    items: [
      {
        name: "Billing", path: "/billing", icon: FiDollarSign, module: "billing",
        // Billing's own tabs (BillingPage's ADMIN_TABS, ?tab=); its other pages (an invoice, a
        // customer, receipts, statements) light up Billing itself.
        children: [
          { name: "Invoices", path: "/billing?tab=invoices", match: (l) => tabOf(l) === "invoices" || /^\/billing\/(?!customers|receipts|statements|claims|claim-invoices)[^/]+$/.test(l.pathname) },
          { name: "Payments", path: "/billing?tab=payments", match: (l) => tabOf(l) === "payments" || l.pathname.startsWith("/billing/receipts") },
          { name: "Customers", path: "/billing?tab=customers", isDefault: true, match: (l) => (l.pathname === "/billing" && (!tabOf(l) || tabOf(l) === "customers")) || l.pathname.startsWith("/billing/customers") },
          { name: "Orders", path: "/billing?tab=orders" },
          { name: "To confirm", path: "/billing?tab=confirm" },
          { name: "Packages", path: "/billing?tab=packages" },
          { name: "M-Pesa", path: "/billing?tab=mpesa" },
        ],
      },
      // Educators' payment requests — Billing's Educator Claims tab, for whoever reviews or approves them.
      { name: "Educator claims", path: "/billing?tab=claims", icon: FiFileText, module: ["claims", "claims-approval"], match: (l) => tabOf(l) === "claims" || l.pathname.startsWith("/billing/claims") || l.pathname.startsWith("/billing/claim-invoices") },
      // Affiliate marketing (AffiliatesPage's tabs, ?tab=).
      {
        name: "Affiliates", path: "/affiliates", icon: FiGift, module: "affiliates",
        children: [
          { name: "Affiliates", path: "/affiliates?tab=affiliates", isDefault: true, match: (l) => l.pathname === "/affiliates" && (!tabOf(l) || tabOf(l) === "affiliates") },
          { name: "Referrals", path: "/affiliates?tab=referrals" },
          { name: "Commissions", path: "/affiliates?tab=commissions" },
          { name: "Payouts", path: "/affiliates?tab=payouts" },
          { name: "Settings", path: "/affiliates?tab=settings" },
        ],
      },
    ],
  },
  {
    key: "insights",
    label: "Quality & insights",
    items: [
      {
        name: "Reports & Analytics", path: "/reports", icon: FiBarChart2, module: "reports", ownerOnly: true,
        match: (l) => l.pathname.startsWith("/reports") && !["parent-feedback", "educators"].includes(tabOf(l)),
        // The page's tabs most opened on their own (10 Nov 2026); the rest are one click inside.
        children: [
          { name: "Overview", path: "/reports", isDefault: true },
          { name: "Trends", path: "/reports?tab=trends" },
          { name: "Hubs side by side", path: "/reports?tab=hubs" },
          { name: "Learner growth", path: "/reports?tab=growth" },
          { name: "Attendance", path: "/reports?tab=attendance" },
          { name: "Learners at risk", path: "/reports?tab=at-risk" },
          { name: "Parent engagement", path: "/reports?tab=parents" },
          { name: "Enrolment & income", path: "/reports?tab=enrolment" },
        ],
      },
      { name: "Quality Assurance", path: "/qa", icon: FiStar, module: "qa" },
      // A class's educators meeting each family about their child (modules/mentor-checkins).
      { name: "Parent–Mentor Check-ins", path: "/mentor-checkins", icon: FiMessageCircle, module: "mentor-checkins" },
      { name: "Hub Check-ins", path: "/checkins", icon: FiCheckSquare, module: "checkins-manage" },
      { name: "Activity", path: "/activity", icon: FiActivity, module: "activity" },
    ],
  },
];

// A curriculum admin only ever reaches the curriculum-authoring routes (scoped server-side to their
// own curriculum) — everything else would 403, so their menu is just this, flat.
export const CURRICULUM_ADMIN_NAV = { top: [{ name: "Curriculum", path: "/curriculum", icon: FiBookOpen }], sections: [], bottom: [] };

export const tabOf = (location) => new URLSearchParams(location.search).get("tab") || "";

const splitPath = (path) => {
  const [rest, hash = ""] = path.split("#");
  const [pathname, query = ""] = rest.split("?");
  return { pathname, tab: new URLSearchParams(query).get("tab") || "", hash: hash ? `#${hash}` : "" };
};

// Whether a link (an item or a sub-page) is the page being shown.
export function isCurrent(node, location, { siblings = [] } = {}) {
  if (node.match) return node.match(location);
  const target = splitPath(node.path);
  if (node.end || target.pathname === "/") return location.pathname === target.pathname;
  const samePath = location.pathname === target.pathname || location.pathname.startsWith(`${target.pathname}/`);
  if (!samePath) return false;
  if (target.hash) return location.hash === target.hash;
  const tab = tabOf(location);
  if (target.tab) return tab === target.tab;
  // A sub-page with no ?tab: current when no tab is open (it's the default), or no sibling claims it.
  if (siblings.length) return node.isDefault ? !tab || !siblings.some((s) => s !== node && splitPath(s.path).tab === tab) : !tab;
  return true;
}

// The tree a signed-in admin or staff member sees: staff lose owner-only nodes and modules their role
// can't view; a section left empty goes; an item left with one sub-page becomes a plain link to it.
export function navFor(user, { staff }) {
  if (user?.role === "curriculumAdmin") return CURRICULUM_ADMIN_NAV;
  const visible = (node) => !staff || (!node.ownerOnly && (!node.module || canViewAny(user, node.module)));
  const sections = ADMIN_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(visible).map((item) => {
      if (!item.children) return item;
      const children = item.children.filter(visible);
      if (children.length === 0) return { ...item, children: undefined };
      if (children.length === 1) return { ...item, path: children[0].path, match: children[0].match, children: undefined };
      return { ...item, children };
    }),
  })).filter((section) => section.items.length > 0);
  return { top: [DASHBOARD], sections, bottom: visible(SETTINGS) ? [SETTINGS] : [] };
}
