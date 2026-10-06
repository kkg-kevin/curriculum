// Emailed copies of in-app notifications. Only the types listed here are ever emailed, each can
// be switched off per user (users.emailPreferences), and an account with no email address of its
// own (a child's username login) is never emailed — the parent's account gets its own copy of
// every learner notification anyway (see notification.service.js's notifyLearner).
//
// A workspace's admin can also switch a type off for everyone in it (Settings → Emails, see
// email-workspace.js); that is checked before the person's own choice.
//
// invoice_issued is deliberately absent: invoices have their own, fuller email (billing.emails.js).
// assessment_submitted too — a teacher can get dozens of those in one lesson.
const UserModel = require("../auth/user.model");
const { queueMail } = require("../../shared/mail/mail.service");
const { renderEmail, appUrl } = require("../../shared/mail/mail.layout");
const { MAIL_BRAND_NAME } = require("../../config/env");
const EmailSettingsModel = require("./email-settings.model");
const { BILLING_EMAIL_TYPES, workspaceOf, workspaceAllows, preferencesToken, userForPreferencesToken } = require("./email-workspace");

const LEARNER_ROLES = ["learner"];
const ADMIN_ROLES = ["admin"];
const EDUCATOR_ROLES = ["teacher"];
const CLAIM_REVIEWER_ROLES = ["admin", "supervisor"];

// `path` mirrors NotificationBell.jsx's resolveNotificationPath on the client — where the
// notification opens — so the email's button lands on the same page.
const EMAIL_TYPES = {
  session_report_published: {
    label: "A new session report is published",
    roles: LEARNER_ROLES,
    default: true,
    path: (p) => (p.reportId ? `/learner-portal/reports/${p.reportId}${p.learnerId ? `?child=${p.learnerId}` : ""}` : "/learner-portal/reports"),
  },
  level_up: {
    label: "A new level is unlocked",
    roles: LEARNER_ROLES,
    default: true,
    path: (p) => (p.learnerId ? `/learner-portal?child=${p.learnerId}` : "/learner-portal"),
  },
  assessment_graded: {
    label: "An assessment is graded",
    roles: LEARNER_ROLES,
    default: false,
    path: (p) => (p.issueId ? `/learner-portal/assessments/${p.issueId}${p.learnerId ? `?child=${p.learnerId}` : ""}` : "/learner-portal/assessments"),
  },
  account_activated: {
    label: "Your account is activated",
    roles: LEARNER_ROLES,
    default: true,
    path: () => "/learner-portal",
  },
  lead_submitted: {
    label: "A new enquiry arrives from the website",
    roles: ADMIN_ROLES,
    default: true,
    path: (p) => (p.leadId ? `/enquiries?lead=${p.leadId}` : "/enquiries"),
  },
  home_learning_signup: {
    label: "A family signs up for Home Learning",
    roles: ADMIN_ROLES,
    default: true,
    path: (p) => (typeof p.route === "string" && p.route.startsWith("/") ? p.route : "/home-learning"),
  },
  // Educator claims (modules/claims/) — the reviewer hears about a new claim, the educator about
  // each decision on theirs.
  claim_submitted: {
    label: "An educator submits a claim for you to review",
    roles: CLAIM_REVIEWER_ROLES,
    default: true,
    path: (p) => (typeof p.route === "string" && p.route.startsWith("/") ? p.route : "/claims"),
  },
  claim_awaiting_approval: {
    label: "A supervisor approves a claim, ready to pay",
    roles: ADMIN_ROLES,
    default: true,
    path: (p) => (typeof p.route === "string" && p.route.startsWith("/") ? p.route : "/claims"),
  },
  claim_rejected: {
    label: "A claim of yours is declined",
    roles: EDUCATOR_ROLES,
    default: true,
    path: (p) => (typeof p.route === "string" && p.route.startsWith("/") ? p.route : "/teacher-portal/claims"),
  },
  claim_approved: {
    label: "A claim of yours is approved",
    roles: EDUCATOR_ROLES,
    default: true,
    path: (p) => (typeof p.route === "string" && p.route.startsWith("/") ? p.route : "/teacher-portal/claims"),
  },
  claim_paid: {
    label: "A claim of yours is paid",
    roles: EDUCATOR_ROLES,
    default: true,
    path: (p) => (typeof p.route === "string" && p.route.startsWith("/") ? p.route : "/teacher-portal/claims"),
  },
};

const typesForRole = (role) => Object.entries(EMAIL_TYPES).filter(([, def]) => def.roles.includes(role));

function wantsEmail(user, type) {
  const def = EMAIL_TYPES[type];
  if (!def || !user?.email || !def.roles.includes(user.role)) return false;
  const prefs = user.emailPreferences || {};
  if (prefs.all === false) return false;
  return typeof prefs[type] === "boolean" ? prefs[type] : def.default;
}

// What the "Email notifications" settings show for this user. A type their workspace has switched
// off is marked `workspaceOff`: it stays listed, but their own switch can't bring it back.
async function describePreferences(user) {
  const prefs = user.emailPreferences || {};
  const off = await EmailSettingsModel.disabledTypes(await workspaceOf(user));
  return {
    email: user.email || null,
    enabled: prefs.all !== false,
    types: typesForRole(user.role).map(([type, def]) => ({
      type,
      label: def.label,
      enabled: typeof prefs[type] === "boolean" ? prefs[type] : def.default,
      workspaceOff: off.includes(type),
    })),
  };
}

// Folds a settings change into the stored preferences. Only types this user's role can actually
// receive are kept; anything else in the request is ignored.
function mergePreferences(user, { enabled, types = {} }) {
  const next = { ...(user.emailPreferences || {}) };
  if (typeof enabled === "boolean") next.all = enabled;
  for (const [type] of typesForRole(user.role)) {
    if (typeof types[type] === "boolean") next[type] = types[type];
  }
  return next;
}

// Emails a notification that was just created, if its recipient wants that. Never throws.
async function sendNotificationEmail(notification) {
  try {
    if (!EMAIL_TYPES[notification.type]) return null;
    const user = await UserModel.findById(notification.recipientId);
    if (!wantsEmail(user, notification.type)) return null;
    const payload = notification.payload || {};
    const ownerAdminId = notification.ownerAdminId || (await workspaceOf(user, { learnerId: payload.learnerId }));
    if (!(await workspaceAllows(ownerAdminId, notification.type))) return null;
    const { html, text } = renderEmail({
      heading: notification.title,
      greeting: `Hi ${String(user.name || "").trim().split(/\s+/)[0] || "there"},`,
      paragraphs: [notification.message],
      button: { label: `Open ${MAIL_BRAND_NAME}`, url: appUrl(EMAIL_TYPES[notification.type].path(payload)) },
      footerNote: `You're receiving this because email notifications are on for your ${MAIL_BRAND_NAME} account.`,
      footerLink: { label: "Choose which emails you get, or stop them", url: appUrl(`/email-preferences?token=${preferencesToken(user.id)}&type=${notification.type}`) },
    });
    return await queueMail({
      to: user.email, subject: notification.title, html, text,
      template: `notification:${notification.type}`, userId: user.id, dedupeKey: `notification:${notification.id}`,
    });
  } catch (err) {
    console.error("[notifications] could not email notification:", err.message);
    return null;
  }
}

// What Settings → Emails shows the admin: every email the workspace can send, grouped by who
// receives it, and whether it is switched on.
const groupFor = (roles) => {
  if (roles === LEARNER_ROLES) return "Parents and learners";
  if (roles === EDUCATOR_ROLES) return "Educators";
  if (roles === CLAIM_REVIEWER_ROLES) return "You and your supervisors";
  return "You (the admin)";
};

const WORKSPACE_TYPES = [
  ...Object.entries(EMAIL_TYPES).map(([type, def]) => ({ type, label: def.label, group: groupFor(def.roles) })),
  ...Object.entries(BILLING_EMAIL_TYPES).map(([type, def]) => ({ type, label: def.label, group: def.group })),
];

async function describeWorkspaceEmails(ownerAdminId) {
  const off = await EmailSettingsModel.disabledTypes(ownerAdminId);
  return { types: WORKSPACE_TYPES.map((t) => ({ ...t, enabled: !off.includes(t.type) })) };
}

// `types` is { <type>: boolean } for the ones being changed; anything not a known type is ignored.
async function saveWorkspaceEmails(ownerAdminId, types = {}) {
  const off = new Set(await EmailSettingsModel.disabledTypes(ownerAdminId));
  for (const { type } of WORKSPACE_TYPES) {
    if (types[type] === false) off.add(type);
    if (types[type] === true) off.delete(type);
  }
  await EmailSettingsModel.saveDisabledTypes(ownerAdminId, [...off].filter((type) => WORKSPACE_TYPES.some((t) => t.type === type)));
  return describeWorkspaceEmails(ownerAdminId);
}

module.exports = { sendNotificationEmail, describePreferences, mergePreferences, describeWorkspaceEmails, saveWorkspaceEmails, userForPreferencesToken };
