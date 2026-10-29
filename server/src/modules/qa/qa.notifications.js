const db = require("../../config/db");
const NotificationService = require("../notifications/notification.service");
const { rolesOf } = require("../auth/account-roles");

// In-app notifications (and, for the types in notification.emails.js's EMAIL_TYPES, emails) for
// quality assurance: an educator hears of an announced visit coming up and of each report on them;
// the reviewer hears that a visit is due and that the educator has replied. A surprise visit is
// never announced. Each carries a dedupeKey, so a job that runs again never sends one twice.
//
// None of these may fail what triggered them — they're logged and dropped.

const day = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function deliver(userId, event) {
  if (!userId) return Promise.resolve();
  return NotificationService.notifyPerson(userId, event).catch((err) => console.error("[qa] could not send a notification:", err.message));
}

// The educator's own login (teachers have no user id of their own — it's the login with their email).
async function educatorLoginId(teacher) {
  if (!teacher?.email) return null;
  const user = await db("users").whereRaw("LOWER(email) = ?", [String(teacher.email).toLowerCase()]).whereNull("deactivatedAt").first("id");
  return user?.id || null;
}

// Where a reviewer opens a visit: the admin app for an admin or staff, the supervisor portal otherwise.
async function reviewerRoute(reviewerId, visitId) {
  const user = await db("users").where({ id: reviewerId }).first();
  const inAdminApp = user && (user.role === "admin" || user.role === "collaborator");
  if (!inAdminApp && user && rolesOf(user).includes("supervisor")) return `/supervisor-portal/qa/visits/${visitId}`;
  return `/qa/visits/${visitId}`;
}

const QaNotifications = {
  // An announced visit is coming up (sent once per date — a new date tells them again).
  async announced(visit, teacher, reviewerName, hubName) {
    const userId = await educatorLoginId(teacher);
    await deliver(userId, {
      type: "qa_visit_announced",
      title: "A QA visit is coming up",
      message: `${reviewerName} will visit${hubName ? ` you at ${hubName}` : ""} on ${day(visit.scheduledDate)} to see how your classes are going.`,
      payload: { route: "/teacher-portal/qa", visitId: visit.id },
      dedupeKey: `qa_visit_announced:${visit.id}:${visit.scheduledDate}`,
      ownerAdminId: visit.ownerAdminId,
    });
  },

  // On the day: the visit is due, and its review is waiting (announced or not).
  async due(visit, teacherName) {
    await deliver(visit.reviewerId, {
      type: "qa_visit_due",
      title: "QA visit due today",
      message: `${teacherName}${visit.visitType === "surprise" ? " (surprise visit)" : ""}. Once you've visited, fill in the review.`,
      payload: { route: await reviewerRoute(visit.reviewerId, visit.id), visitId: visit.id },
      dedupeKey: `qa_visit_due:${visit.id}:${visit.scheduledDate}`,
      ownerAdminId: visit.ownerAdminId,
    });
  },

  // The report is in — to the educator, once.
  async submitted(visit, teacher, reviewerName) {
    const userId = await educatorLoginId(teacher);
    await deliver(userId, {
      type: "qa_review_submitted",
      title: "Your QA report is ready",
      message: `${reviewerName} sent the report from the visit on ${day(visit.scheduledDate)}${visit.score != null ? ` — ${Number(visit.score)}%` : ""}. Read it, and reply if you'd like to.`,
      payload: { route: `/teacher-portal/qa/${visit.id}`, visitId: visit.id },
      dedupeKey: `qa_review_submitted:${visit.id}`,
      ownerAdminId: visit.ownerAdminId,
    });
  },

  // The educator replied — to the reviewer, and to the educator's supervisor when that's someone else.
  async replied(visit, teacher) {
    const name = [teacher?.firstName, teacher?.lastName].filter(Boolean).join(" ") || "The educator";
    const recipients = [...new Set([visit.reviewerId, teacher?.supervisorId].filter(Boolean))];
    await Promise.all(recipients.map(async (userId) => deliver(userId, {
      type: "qa_review_reply",
      title: "A reply to a QA report",
      message: `${name} replied to the report from the visit on ${day(visit.scheduledDate)}.`,
      payload: { route: await reviewerRoute(userId, visit.id), visitId: visit.id },
      dedupeKey: `qa_review_reply:${visit.id}:${userId}`,
      ownerAdminId: visit.ownerAdminId,
    })));
  },
};

module.exports = QaNotifications;
module.exports._internal = { educatorLoginId };
