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
const LearnerModel = require("../learners/learner.model");
const { queueMail } = require("../../shared/mail/mail.service");
const { renderEmail, appUrl } = require("../../shared/mail/mail.layout");
const { MAIL_BRAND_NAME } = require("../../config/env");
const EmailSettingsModel = require("./email-settings.model");
const { BILLING_EMAIL_TYPES, workspaceOf, workspaceAllows, preferencesToken, userForPreferencesToken } = require("./email-workspace");

const LEARNER_ROLES = ["learner"];
const ADMIN_ROLES = ["admin"];
const EDUCATOR_ROLES = ["teacher"];
const CLAIM_REVIEWER_ROLES = ["admin", "supervisor"];
// Hub check-ins: the workspace's admins and staff (Account Managers, Training Leads, managers).
// A hub's Account Manager / Training Lead is an admin or an educator (named on the hub); staff
// who manage check-ins too.
const CHECKIN_ROLES = ["admin", "collaborator", "teacher"];
const checkinPath = (p) => (typeof p.route === "string" && p.route.startsWith("/checkins") ? p.route : "/checkins");
// Everyone who can take part in a hub's check-in (6 Nov 2026): our team, the hub's login, mentors,
// parents — each opens it in their own portal (checkin.notifications.js's PORTAL).
const CHECKIN_PARTICIPANT_ROLES = ["admin", "collaborator", "teacher", "school", "learner"];
const participantCheckinPath = (p) => (typeof p.route === "string" && /^\/([a-z-]+\/)?checkins(\/|$)/.test(p.route) ? p.route : "/checkins");
// Quality assurance: whoever reviews — supervisors, admins and staff.
const QA_REVIEWER_ROLES = ["admin", "collaborator", "supervisor"];
// Parent–mentor check-ins (modules/mentor-checkins/): what parents get, and what the class's
// educators get — their own arrays so Settings → Emails groups them under the feature.
const MENTOR_CHECKIN_PARENT_ROLES = ["learner"];
const MENTOR_CHECKIN_EDUCATOR_ROLES = ["teacher"];
const MENTOR_CHECKIN_BOTH_ROLES = ["learner", "teacher"];
const mentorCheckinPath = (fallback) => (p) => routeOr(p, fallback);
// The weekly summary of Reports & Analytics goes to the workspace's admins and each hub's login.
const SUMMARY_ROLES = ["admin", "school"];
// Mentor bookings (modules/mentor-bookings/): families and mentors.
const BOOKING_PARENT_ROLES = ["learner"];
const BOOKING_BOTH_ROLES = ["learner", "teacher"];
const routeOr = (p, fallback) => (typeof p.route === "string" && p.route.startsWith("/") ? p.route : fallback);

// `path` mirrors NotificationBell.jsx's resolveNotificationPath on the client — where the
// notification opens — so the email's button lands on the same page. `look` is how the email
// tells itself apart at a glance (see mail.layout.js's tones and icons).
const EMAIL_TYPES = {
  session_report_published: {
    label: "A new session report is published",
    roles: LEARNER_ROLES,
    default: true,
    look: { tone: "info", icon: "pencil", eyebrow: "Session report" },
    path: (p) => (p.reportId ? `/learner-portal/reports/${p.reportId}${p.learnerId ? `?child=${p.learnerId}` : ""}` : "/learner-portal/reports"),
  },
  certificate_issued: {
    label: "A certificate is earned",
    roles: LEARNER_ROLES,
    default: true,
    look: { tone: "celebrate", icon: "star", eyebrow: "Certificate" },
    path: (p) => (p.certificateId ? `/learner-portal/certificates/${p.certificateId}${p.learnerId ? `?child=${p.learnerId}` : ""}` : "/learner-portal/profile"),
  },
  level_up: {
    label: "A new level is unlocked",
    roles: LEARNER_ROLES,
    default: true,
    look: { tone: "celebrate", icon: "star", eyebrow: "Level up" },
    path: (p) => (p.learnerId ? `/learner-portal?child=${p.learnerId}` : "/learner-portal"),
  },
  assessment_graded: {
    label: "An assessment is graded",
    roles: LEARNER_ROLES,
    default: false,
    look: { tone: "info", icon: "check", eyebrow: "Assessment" },
    path: (p) => (p.issueId ? `/learner-portal/assessments/${p.issueId}${p.learnerId ? `?child=${p.learnerId}` : ""}` : "/learner-portal/assessments"),
  },
  account_activated: {
    label: "Your account is activated",
    roles: LEARNER_ROLES,
    default: true,
    look: { tone: "success", icon: "check", eyebrow: "Account" },
    path: () => "/learner-portal",
  },
  // The daily "N enquiries are still New" reminder (leads/lead.housekeeping.js).
  enquiries_waiting: {
    label: "Enquiries are waiting for a reply (daily reminder)",
    roles: ADMIN_ROLES,
    default: true,
    look: { tone: "warning", icon: "envelope", eyebrow: "Enquiries" },
    path: () => "/enquiries?status=new",
  },
  lead_submitted: {
    label: "A new enquiry arrives from the website",
    roles: ADMIN_ROLES,
    default: true,
    look: { tone: "info", icon: "envelope", eyebrow: "New enquiry" },
    path: (p) => (p.leadId ? `/enquiries?lead=${p.leadId}` : "/enquiries"),
  },
  home_learning_signup: {
    label: "A family signs up for Home Learning",
    roles: ADMIN_ROLES,
    default: true,
    look: { tone: "success", icon: "home", eyebrow: "Home Learning" },
    path: (p) => (typeof p.route === "string" && p.route.startsWith("/") ? p.route : "/home-learning"),
  },
  tech_club_signup: {
    label: "A family signs up for a Tech Club",
    roles: ADMIN_ROLES,
    default: true,
    look: { tone: "success", icon: "star", eyebrow: "Tech Club" },
    path: (p) => (typeof p.route === "string" && p.route.startsWith("/") ? p.route : "/tech-clubs"),
  },
  // Paying at the end of a website sign-up (payments/payment-notices.service.js): staff hear
  // about a payment to check, the parent when theirs couldn't be confirmed.
  payment_notice_submitted: {
    label: "A family says they've paid and it needs confirming",
    roles: ADMIN_ROLES,
    default: true,
    look: { tone: "info", icon: "check", eyebrow: "Payment to confirm" },
    path: () => "/billing?tab=confirm",
  },
  store_order_placed: {
    label: "A website order comes in",
    roles: ADMIN_ROLES,
    default: true,
    look: { tone: "info", icon: "document", eyebrow: "Website order" },
    path: (p) => (typeof p.route === "string" && p.route.startsWith("/") ? p.route : "/billing?tab=orders"),
  },
  store_order_paid: {
    label: "A website order is paid",
    roles: ADMIN_ROLES,
    default: true,
    look: { tone: "success", icon: "check", eyebrow: "Order paid" },
    path: (p) => (typeof p.route === "string" && p.route.startsWith("/") ? p.route : "/billing?tab=orders"),
  },
  payment_notice_rejected: {
    label: "A payment you told us about couldn't be confirmed",
    roles: LEARNER_ROLES,
    default: true,
    look: { tone: "warning", icon: "alert", eyebrow: "Payment" },
    path: (p) => (p.invoiceId ? `/learner-portal/invoices/${p.invoiceId}` : "/learner-portal/invoices"),
  },
  // Educator claims (modules/claims/) — the reviewer hears about a new claim, the educator about
  // each decision on theirs.
  // Hub check-ins (modules/checkins/checkin.notifications.js).
  checkin_assigned: { label: "You're put on a hub check-in", roles: CHECKIN_ROLES, default: true, look: { tone: "info", icon: "home", eyebrow: "Hub check-in" }, path: checkinPath },
  checkin_due: { label: "A hub check-in of yours is due — write its report", roles: CHECKIN_ROLES, default: true, look: { tone: "info", icon: "document", eyebrow: "Hub check-in" }, path: checkinPath },
  checkin_task_assigned: { label: "You're given a task from a hub check-in", roles: CHECKIN_ROLES, default: true, look: { tone: "info", icon: "check", eyebrow: "Check-in task" }, path: checkinPath },
  checkin_task_due: { label: "A check-in task of yours is due", roles: CHECKIN_ROLES, default: true, look: { tone: "warning", icon: "alert", eyebrow: "Check-in task" }, path: checkinPath },
  checkin_invited: { label: "You're invited to a hub's check-ins", roles: CHECKIN_PARTICIPANT_ROLES, default: true, look: { tone: "info", icon: "home", eyebrow: "Hub check-in" }, path: participantCheckinPath },
  checkin_today: { label: "A check-in you're taking part in is today", roles: CHECKIN_PARTICIPANT_ROLES, default: true, look: { tone: "info", icon: "home", eyebrow: "Hub check-in" }, path: participantCheckinPath },
  checkin_report_ready: { label: "The report from a check-in you took part in is ready", roles: CHECKIN_PARTICIPANT_ROLES, default: true, look: { tone: "info", icon: "document", eyebrow: "Check-in report" }, path: participantCheckinPath },
  // Quality assurance (modules/qa/qa.notifications.js) — the educator hears of an announced visit
  // and of each report; the reviewer (a supervisor, admin or staff) of a visit due and a reply.
  // Parent–mentor check-ins (modules/mentor-checkins/mentor-checkin.notifications.js).
  mentor_checkin_scheduled: { label: "A check-in with your child's mentor is set up", roles: MENTOR_CHECKIN_PARENT_ROLES, default: true, look: { tone: "info", icon: "home", eyebrow: "Mentor check-in" }, path: mentorCheckinPath("/parent/mentor-checkins") },
  mentor_checkin_report_ready: { label: "The report from your mentor check-in is ready to approve", roles: MENTOR_CHECKIN_PARENT_ROLES, default: true, look: { tone: "info", icon: "document", eyebrow: "Mentor check-in" }, path: mentorCheckinPath("/parent/mentor-checkins") },
  mentor_checkin_round_scheduled: { label: "Parent check-ins are set up for your class", roles: MENTOR_CHECKIN_EDUCATOR_ROLES, default: true, look: { tone: "info", icon: "home", eyebrow: "Parent check-ins" }, path: mentorCheckinPath("/teacher-portal/mentor-checkins") },
  mentor_checkin_approved: { label: "A parent approves a check-in report", roles: MENTOR_CHECKIN_EDUCATOR_ROLES, default: true, look: { tone: "success", icon: "check", eyebrow: "Parent check-ins" }, path: mentorCheckinPath("/teacher-portal/mentor-checkins") },
  mentor_checkin_changed: { label: "A parent check-in moves to another time", roles: MENTOR_CHECKIN_BOTH_ROLES, default: true, look: { tone: "info", icon: "refresh", eyebrow: "Mentor check-in" }, path: (p) => routeOr(p, "/parent/mentor-checkins") },
  mentor_checkin_cancelled: { label: "A parent check-in is cancelled", roles: MENTOR_CHECKIN_BOTH_ROLES, default: true, look: { tone: "warning", icon: "alert", eyebrow: "Mentor check-in" }, path: (p) => routeOr(p, "/parent/mentor-checkins") },
  // Mentor bookings (modules/mentor-bookings/mentor-booking.notifications.js).
  mentor_help_requested: { label: "Your child asks for help with a session", roles: BOOKING_PARENT_ROLES, default: true, look: { tone: "info", icon: "alert", eyebrow: "Mentor sessions" }, path: (p) => routeOr(p, "/parent/bookings") },
  mentor_booking_confirmed: { label: "A mentor session is booked", roles: BOOKING_BOTH_ROLES, default: true, look: { tone: "success", icon: "check", eyebrow: "Mentor sessions" }, path: (p) => routeOr(p, "/parent/bookings") },
  mentor_booking_cancelled: { label: "A mentor session is cancelled", roles: BOOKING_BOTH_ROLES, default: true, look: { tone: "warning", icon: "alert", eyebrow: "Mentor sessions" }, path: (p) => routeOr(p, "/parent/bookings") },
  mentor_booking_today: { label: "A mentor session is today", roles: BOOKING_BOTH_ROLES, default: true, look: { tone: "info", icon: "home", eyebrow: "Mentor sessions" }, path: (p) => routeOr(p, "/parent/bookings") },
  mentor_booking_note: { label: "The mentor's note after a session", roles: BOOKING_PARENT_ROLES, default: true, look: { tone: "info", icon: "document", eyebrow: "Mentor sessions" }, path: (p) => routeOr(p, "/parent/bookings") },
  mentor_checkin_today: { label: "A parent check-in is today", roles: MENTOR_CHECKIN_BOTH_ROLES, default: true, look: { tone: "info", icon: "home", eyebrow: "Mentor check-in" }, path: (p) => routeOr(p, "/parent/mentor-checkins") },

  qa_visit_announced: { label: "A QA visit to you is coming up", roles: EDUCATOR_ROLES, default: true, look: { tone: "info", icon: "home", eyebrow: "QA visit" }, path: (p) => routeOr(p, "/teacher-portal/qa") },
  qa_review_submitted: { label: "A QA report on you is ready", roles: EDUCATOR_ROLES, default: true, look: { tone: "info", icon: "document", eyebrow: "QA report" }, path: (p) => routeOr(p, "/teacher-portal/qa") },
  qa_visit_due: { label: "A QA visit of yours is due — fill in the review", roles: QA_REVIEWER_ROLES, default: true, look: { tone: "info", icon: "document", eyebrow: "QA visit" }, path: (p) => routeOr(p, "/qa") },
  qa_review_reply: { label: "An educator replies to a QA report", roles: QA_REVIEWER_ROLES, default: true, look: { tone: "info", icon: "pencil", eyebrow: "QA report" }, path: (p) => routeOr(p, "/qa") },
  // Parent feedback on mentors (modules/mentor-reviews/): the "how is the mentor doing?" prompt to a
  // parent (or a TOT learner's own login), and a conduct concern to the admins and the supervisor.
  mentor_review_request: {
    label: "Asked how your child's mentor is doing",
    roles: [...LEARNER_ROLES, ...EDUCATOR_ROLES],
    default: true,
    look: { tone: "info", icon: "star", eyebrow: "Mentor feedback" },
    path: (p) => routeOr(p, "/parent/feedback"),
  },
  mentor_review_concern: {
    label: "A parent raises a concern about an educator",
    roles: ["admin", "collaborator", "supervisor"],
    default: true,
    look: { tone: "warning", icon: "alert", eyebrow: "Concern about an educator" },
    path: (p) => routeOr(p, "/teachers"),
  },
  // The educator performance profile (modules/educator-profiles/): an educator asks to share their
  // profile (to the admins), the admins publish or send it back (to the educator), and a family asks
  // for an educator in the parent portal (to the admins).
  educator_profile_review: {
    label: "An educator's profile is waiting for approval",
    roles: ["admin", "collaborator"],
    default: true,
    look: { tone: "info", icon: "document", eyebrow: "Educator profile" },
    path: (p) => routeOr(p, "/teachers"),
  },
  educator_profile_published: {
    label: "Your educator profile is published",
    roles: EDUCATOR_ROLES,
    default: true,
    look: { tone: "success", icon: "check", eyebrow: "Your profile" },
    path: (p) => routeOr(p, "/teacher-portal/profile?tab=public"),
  },
  educator_profile_sent_back: {
    label: "Your educator profile needs a change",
    roles: EDUCATOR_ROLES,
    default: true,
    look: { tone: "warning", icon: "pencil", eyebrow: "Your profile" },
    path: (p) => routeOr(p, "/teacher-portal/profile?tab=public"),
  },
  mentor_requested: {
    label: "A family asks for a particular educator",
    roles: ["admin", "collaborator", "supervisor"],
    default: true,
    look: { tone: "info", icon: "star", eyebrow: "Mentor request" },
    path: (p) => routeOr(p, "/teachers"),
  },
  // Website TOT sign-ups (bootcamp-enrollment/educator-enrollment.service.js), to the educator.
  tot_training_on: {
    label: "Your training is paid for and open",
    roles: EDUCATOR_ROLES,
    default: true,
    look: { tone: "success", icon: "check", eyebrow: "Training of trainers" },
    path: (p) => routeOr(p, "/learner-portal"),
  },
  tot_place_released: {
    label: "An unpaid training place is released",
    roles: EDUCATOR_ROLES,
    default: true,
    look: { tone: "warning", icon: "alert", eyebrow: "Training of trainers" },
    path: (p) => routeOr(p, "/learner-portal"),
  },
  // To the workspace admins: an educator still "in training" finished a TOT curriculum.
  tot_training_finished: {
    label: "An educator in training finishes their training",
    roles: ADMIN_ROLES,
    default: true,
    look: { tone: "celebrate", icon: "star", eyebrow: "Training of trainers" },
    path: (p) => routeOr(p, "/teachers"),
  },
  tot_work_submitted: {
    label: "An educator in training hands in work for you to mark",
    roles: CLAIM_REVIEWER_ROLES,
    default: true,
    look: { tone: "info", icon: "document", eyebrow: "Training of trainers" },
    path: (p) => (typeof p.route === "string" && p.route.startsWith("/") ? p.route : "/supervisor-portal/marking"),
  },
  claim_submitted: {
    label: "An educator submits a claim for you to review",
    roles: CLAIM_REVIEWER_ROLES,
    default: true,
    look: { tone: "info", icon: "document", eyebrow: "Educator claim" },
    path: (p) => (typeof p.route === "string" && p.route.startsWith("/") ? p.route : "/claims"),
  },
  claim_awaiting_approval: {
    label: "A supervisor approves a claim, ready to pay",
    roles: ADMIN_ROLES,
    default: true,
    look: { tone: "warning", icon: "alert", eyebrow: "Educator claim" },
    path: (p) => (typeof p.route === "string" && p.route.startsWith("/") ? p.route : "/claims"),
  },
  claim_rejected: {
    label: "A claim of yours is declined",
    roles: EDUCATOR_ROLES,
    default: true,
    look: { tone: "danger", icon: "cross", eyebrow: "Claim declined" },
    path: (p) => (typeof p.route === "string" && p.route.startsWith("/") ? p.route : "/teacher-portal/claims"),
  },
  claim_approved: {
    label: "A claim of yours is approved",
    roles: EDUCATOR_ROLES,
    default: true,
    look: { tone: "success", icon: "check", eyebrow: "Claim approved" },
    path: (p) => (typeof p.route === "string" && p.route.startsWith("/") ? p.route : "/teacher-portal/claims"),
  },
  claim_paid: {
    label: "A claim of yours is paid",
    roles: EDUCATOR_ROLES,
    default: true,
    look: { tone: "success", icon: "check", eyebrow: "Claim paid" },
    path: (p) => (typeof p.route === "string" && p.route.startsWith("/") ? p.route : "/teacher-portal/claims"),
  },
  // Following up a learner at risk (Reports & Analytics, 10 Nov 2026 — analytics.followups.js).
  learner_followup: {
    label: "A message from the learning hub about your child",
    roles: LEARNER_ROLES,
    default: true,
    look: { tone: "info", icon: "envelope", eyebrow: "A message about your child" },
    path: (p) => routeOr(p, "/parent"),
  },
  learner_flagged: {
    label: "A learner of yours needs support",
    roles: EDUCATOR_ROLES,
    default: true,
    look: { tone: "warning", icon: "alert", eyebrow: "Learner needs support" },
    path: (p) => routeOr(p, "/teacher-portal"),
  },
  // Not a notification: the Monday summary of Reports & Analytics (analytics.weekly.js), listed
  // here so the workspace and each person can switch it off like any other email.
  analytics_weekly: {
    label: "The weekly summary of Reports & Analytics",
    roles: SUMMARY_ROLES,
    default: true,
    look: { tone: "info", icon: "document", eyebrow: "Weekly summary" },
    path: () => "/reports",
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
    // A parent with several children sees straight away which one this is about.
    const learner = user.role === "learner" && payload.learnerId ? await LearnerModel.findById(payload.learnerId) : null;
    const { html, text } = renderEmail({
      ...EMAIL_TYPES[notification.type].look,
      preview: notification.message,
      person: learner ? { name: `${learner.firstName} ${learner.lastName}`.trim(), photo: learner.photo, caption: "Learner" } : undefined,
      highlight: notification.type === "level_up" && payload.bandName ? { label: "New level unlocked", value: payload.bandName } : undefined,
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
  if (roles === CHECKIN_ROLES) return "Hub check-ins (Account Managers and Training Leads)";
  if (roles === CHECKIN_PARTICIPANT_ROLES) return "Hub check-ins (everyone taking part)";
  if (roles === SUMMARY_ROLES) return "Weekly summary (you and your hubs)";
  if (roles === MENTOR_CHECKIN_PARENT_ROLES || roles === MENTOR_CHECKIN_EDUCATOR_ROLES || roles === MENTOR_CHECKIN_BOTH_ROLES) return "Parent–mentor check-ins";
  if (roles === BOOKING_PARENT_ROLES || roles === BOOKING_BOTH_ROLES) return "Mentor sessions (families and mentors)";
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

module.exports = { sendNotificationEmail, describePreferences, mergePreferences, describeWorkspaceEmails, saveWorkspaceEmails, userForPreferencesToken, wantsEmail };
