const NotificationService = require("../notifications/notification.service");

// In-app notifications (and, for the types in notification.emails.js's EMAIL_TYPES, emails) for
// hub check-ins: you've been put on a hub's check-ins, a check-in is due — write its report, and
// you've been given a task from one, or its deadline has come.
// Each carries a dedupeKey, so a job that runs again or a page that checks again never sends the
// same one twice.
//
// None of these may fail what triggered them — they're logged and dropped.

const FREQUENCY = { weekly: "weekly", monthly: "monthly", quarterly: "quarterly", semi_annually: "every 6 months", annually: "yearly", once: "once" };
const FORMAT = { online: "online", in_person: "in person" };
// A task is rich text; a notification (and its email) quotes it as plain text, cut short.
function plainText(html, max = 140) {
  const text = String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
const day = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

async function send(recipientIds, event, ownerAdminId) {
  const ids = [...new Set(recipientIds.filter(Boolean))];
  // Each named person only (an admin who is an Account Manager isn't "every admin").
  await Promise.all(ids.map((id) => NotificationService.notifyPerson(id, { ...event, ownerAdminId, dedupeKey: `${event.dedupeKey}:${id}` }).catch((err) => {
    console.error("[checkins] could not send a notification:", err.message);
  })));
}

// Where a person reads check-ins, from their own portal (6 Nov 2026): our team in the admin app, the
// hub's login in the hub portal, a mentor in the teacher portal, a parent in /parent.
const PORTAL = { admin: "/checkins", collaborator: "/checkins", school: "/school-portal/checkins", teacher: "/teacher-portal/checkins", learner: "/parent/checkins" };
async function portalsOf(userIds) {
  const db = require("../../config/db");
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const users = await db("users").whereIn("id", ids).select("id", "role");
  return new Map(users.map((u) => [u.id, PORTAL[u.role] || "/checkins"]));
}

// One notification per person, its link into their own portal (`event(base)` builds it).
async function sendToPortals(recipientIds, event, ownerAdminId) {
  const portals = await portalsOf(recipientIds);
  await Promise.all([...portals.entries()].map(([id, base]) => {
    const e = event(base);
    return NotificationService.notifyPerson(id, { ...e, ownerAdminId, dedupeKey: `${e.dedupeKey}:${id}` }).catch((err) => {
      console.error("[checkins] could not send a notification:", err.message);
    });
  }));
}

const CheckinNotifications = {
  // Chosen to take part in a hub's check-ins (when they're set up, or added later).
  invited(schedule, hubName, userIds) {
    return sendToPortals(userIds, (base) => ({
      type: "checkin_invited",
      title: `You're invited to check-ins with ${hubName}`,
      message: `${FREQUENCY[schedule.frequency] || schedule.frequency} check-ins with ${hubName} (${FORMAT[schedule.format] || schedule.format}), starting ${day(schedule.startDate)}.${schedule.format === "online" && schedule.meetingLink ? " You'll get the link to join before each one." : ""}`.replace(/^./, (c) => c.toUpperCase()),
      payload: { route: base, scheduleId: schedule.id },
      dedupeKey: `checkin_invited:${schedule.id}`,
    }), schedule.ownerAdminId);
  },

  // On the day, to everyone taking part (the Account Manager and Training Lead get "due").
  today(session, hubName, userIds) {
    const join = session.format === "online" && session.meetingLink ? ` Join here: ${session.meetingLink}` : "";
    return sendToPortals(userIds, (base) => ({
      type: "checkin_today",
      title: `Check-in with ${hubName} today`,
      message: `Today's check-in with ${hubName} is ${FORMAT[session.format] || session.format}.${join}`,
      payload: { route: `${base}/sessions/${session.id}`, sessionId: session.id, meetingLink: session.meetingLink || null },
      dedupeKey: `checkin_today:${session.id}:${session.scheduledDate}`,
    }), session.ownerAdminId);
  },

  // The report is in — to everyone involved (not whoever wrote it).
  reportReady(session, hubName, userIds) {
    return sendToPortals(userIds, (base) => ({
      type: "checkin_report_ready",
      title: `Report from the check-in with ${hubName}`,
      message: `The report from the ${day(session.scheduledDate)} check-in with ${hubName} is ready to read.`,
      payload: { route: `${base}/sessions/${session.id}`, sessionId: session.id },
      dedupeKey: `checkin_report_ready:${session.id}`,
    }), session.ownerAdminId);
  },

  // A schedule names someone for the first time (or a change puts them on it).
  assigned(schedule, hubName, userIds) {
    return send(userIds, {
      type: "checkin_assigned",
      title: "You're on a hub check-in",
      message: `You've been put on ${FREQUENCY[schedule.frequency] || schedule.frequency} check-ins with ${hubName} (${FORMAT[schedule.format] || schedule.format}), starting ${day(schedule.startDate)}.`,
      payload: { route: "/checkins", scheduleId: schedule.id },
      dedupeKey: `checkin_assigned:${schedule.id}:${schedule.updatedAt ? new Date(schedule.updatedAt).getTime() : ""}`,
    }, schedule.ownerAdminId);
  },

  // On the day: the check-in is due, and its report is waiting.
  due(session, hubName) {
    return send([session.accountManagerId, session.trainingLeadId], {
      type: "checkin_due",
      title: "Check-in due today",
      message: `${hubName} (${FORMAT[session.format] || session.format}). Once it's happened, write the report: highs, lows and resolutions.`,
      payload: { route: `/checkins/sessions/${session.id}`, sessionId: session.id },
      dedupeKey: `checkin_due:${session.id}:${session.scheduledDate}`,
    }, session.ownerAdminId);
  },

  // A task from a check-in's resolutions — to the one person it's for (not fanned out to every
  // admin of an organisation, as `send` would for its key admin).
  async taskAssigned(task, hubName, byName) {
    await NotificationService._deliver(task.assigneeId, {
      type: "checkin_task_assigned",
      title: "A task from a hub check-in",
      message: `${byName} gave you a task from the check-in with ${hubName}: "${plainText(task.title)}" — by ${day(task.dueDate)}.`,
      payload: { route: `/checkins/sessions/${task.sessionId}`, sessionId: task.sessionId, taskId: task.id },
      dedupeKey: `checkin_task_assigned:${task.id}:${task.assigneeId}`,
      ownerAdminId: task.ownerAdminId,
    }).catch((err) => console.error("[checkins] could not send a notification:", err.message));
  },

  // Its deadline has come (sent once per deadline; checkin.service.js's sendTaskDueNotices).
  async taskDue(task, hubName, today) {
    const late = task.dueDate < today;
    await NotificationService._deliver(task.assigneeId, {
      type: "checkin_task_due",
      title: late ? "A check-in task is overdue" : "A check-in task is due today",
      message: `"${plainText(task.title)}" (check-in with ${hubName}) — ${late ? "was due" : "due"} ${day(task.dueDate)}. Mark it done once it's finished.`,
      payload: { route: `/checkins/sessions/${task.sessionId}`, sessionId: task.sessionId, taskId: task.id },
      dedupeKey: `checkin_task_due:${task.id}:${task.dueDate}`,
      ownerAdminId: task.ownerAdminId,
    }).catch((err) => console.error("[checkins] could not send a notification:", err.message));
  },
};

module.exports = CheckinNotifications;
