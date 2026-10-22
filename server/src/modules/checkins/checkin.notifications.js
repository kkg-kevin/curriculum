const NotificationService = require("../notifications/notification.service");
const { managerRecipientIds } = require("./checkin.access");

// In-app notifications (and, for the types in notification.emails.js's EMAIL_TYPES, emails) for
// hub check-ins. Every one carries a dedupeKey, so a reminder job that runs again, a page load
// that checks again, or a retry never sends the same one twice; keys include the date where a
// change (a reschedule, a new due date) should bring a fresh reminder.
//
// None of these may fail what triggered them — they're logged and dropped.

const FORMAT = { online: "online", in_person: "in person" };
const when = (s) => `${new Date(`${s.scheduledDate}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })} at ${s.startTime}`;
const sessionRoute = (s) => `/checkins/sessions/${s.id}`;
const actionRoute = (a) => `/checkins/actions?action=${a.id}`;

async function send(recipientIds, event, ownerAdminId) {
  const ids = [...new Set(recipientIds.filter(Boolean))];
  await Promise.all(ids.map((id) => NotificationService._notify(id, { ...event, ownerAdminId, dedupeKey: `${event.dedupeKey}:${id}` }).catch((err) => {
    console.error("[checkins] could not send a notification:", err.message);
  })));
}

const pairOf = (s) => [s.accountManagerId, s.trainingLeadId];

const CheckinNotifications = {
  // A schedule names someone for the first time (or a change puts them on it).
  assigned(schedule, hubName, userIds) {
    return send(userIds, {
      type: "checkin_assigned",
      title: "You're on a hub check-in",
      message: `You've been assigned to check-ins with ${hubName} (${schedule.frequency.replace("_", "-")}), starting ${schedule.startDate} at ${schedule.startTime}.`,
      payload: { route: "/checkins", scheduleId: schedule.id },
      dedupeKey: `checkin_assigned:${schedule.id}:${schedule.updatedAt ? new Date(schedule.updatedAt).getTime() : ""}`,
    }, schedule.ownerAdminId);
  },

  upcoming(session, hubName) {
    return send(pairOf(session), {
      type: "checkin_upcoming",
      title: "Check-in tomorrow",
      message: `${hubName}: ${when(session)} (${FORMAT[session.format] || session.format}).`,
      payload: { route: sessionRoute(session), sessionId: session.id },
      dedupeKey: `checkin_upcoming:${session.id}:${session.scheduledDate}`,
    }, session.ownerAdminId);
  },

  today(session, hubName) {
    return send(pairOf(session), {
      type: "checkin_today",
      title: "Check-in today",
      message: `${hubName} at ${session.startTime} (${FORMAT[session.format] || session.format}). Write the report from the check-in's page.`,
      payload: { route: sessionRoute(session), sessionId: session.id },
      dedupeKey: `checkin_today:${session.id}:${session.scheduledDate}`,
    }, session.ownerAdminId);
  },

  reportOverdue(session, hubName) {
    return send(pairOf(session), {
      type: "checkin_report_overdue",
      title: "Check-in report not submitted",
      message: `${hubName}: the report for the check-in on ${session.scheduledDate} is still a draft. Submit it to complete the check-in.`,
      payload: { route: sessionRoute(session), sessionId: session.id },
      dedupeKey: `checkin_report_overdue:${session.id}:${session.scheduledDate}`,
    }, session.ownerAdminId);
  },

  async missed(session, hubName) {
    const event = {
      type: "checkin_missed",
      title: "Check-in missed",
      message: `${hubName}: the check-in on ${session.scheduledDate} passed without a report. Reschedule it, cancel it, or write the report late.`,
      payload: { route: sessionRoute(session), sessionId: session.id },
      dedupeKey: `checkin_missed:${session.id}:${session.scheduledDate}`,
    };
    await send([...pairOf(session), ...(await managerRecipientIds(session.ownerAdminId))], event, session.ownerAdminId);
  },

  async rescheduled(session, hubName, actorId) {
    await send([...pairOf(session), ...(await managerRecipientIds(session.ownerAdminId))].filter((id) => id !== actorId), {
      type: "checkin_rescheduled",
      title: "Check-in moved",
      message: `${hubName}: the check-in is now ${when(session)}.`,
      payload: { route: sessionRoute(session), sessionId: session.id },
      dedupeKey: `checkin_rescheduled:${session.id}:${session.scheduledDate}:${session.startTime}`,
    }, session.ownerAdminId);
  },

  cancelled(session, hubName, actorId) {
    return send(pairOf(session).filter((id) => id !== actorId), {
      type: "checkin_cancelled",
      title: "Check-in cancelled",
      message: `${hubName}: the check-in on ${session.scheduledDate} was cancelled${session.cancelReason ? ` (${session.cancelReason})` : ""}.`,
      payload: { route: sessionRoute(session), sessionId: session.id },
      dedupeKey: `checkin_cancelled:${session.id}`,
    }, session.ownerAdminId);
  },

  // A submitted report says the hub needs attention or is critical.
  async hubFlagged(session, hubName) {
    const critical = session.overallStatus === "critical";
    await send(await managerRecipientIds(session.ownerAdminId), {
      type: "checkin_hub_flagged",
      title: critical ? "Hub marked Critical" : "Hub needs attention",
      message: `${hubName}: the check-in on ${session.scheduledDate} marked the hub ${critical ? "Critical" : "Needs attention"}.`,
      payload: { route: sessionRoute(session), sessionId: session.id },
      dedupeKey: `checkin_hub_flagged:${session.id}:${session.overallStatus}:${session.reportSubmittedAt ? new Date(session.reportSubmittedAt).getTime() : ""}`,
    }, session.ownerAdminId);
  },

  actionAssigned(action, hubName, actorId) {
    if (!action.assigneeId || action.assigneeId === actorId) return Promise.resolve();
    return send([action.assigneeId], {
      type: "checkin_action_assigned",
      title: action.kind === "issue" ? "An issue was assigned to you" : "A follow-up was assigned to you",
      message: `${hubName}: ${action.title}${action.dueDate ? ` — due ${action.dueDate}` : ""}.`,
      payload: { route: actionRoute(action), actionId: action.id },
      dedupeKey: `checkin_action_assigned:${action.id}:${action.assigneeId}`,
    }, action.ownerAdminId);
  },

  actionOverdue(action, hubName) {
    if (!action.assigneeId) return Promise.resolve();
    return send([action.assigneeId], {
      type: "checkin_action_overdue",
      title: "Follow-up overdue",
      message: `${hubName}: "${action.title}" was due ${action.dueDate}.`,
      payload: { route: actionRoute(action), actionId: action.id },
      dedupeKey: `checkin_action_overdue:${action.id}:${action.dueDate}`,
    }, action.ownerAdminId);
  },

  async escalated(action, hubName, actorId) {
    await send((await managerRecipientIds(action.ownerAdminId)).filter((id) => id !== actorId), {
      type: "checkin_action_escalated",
      title: "Issue escalated",
      message: `${hubName}: "${action.title}" was escalated — ${action.escalationNote || "no note"}.`,
      payload: { route: actionRoute(action), actionId: action.id },
      dedupeKey: `checkin_action_escalated:${action.id}:${action.escalatedAt ? new Date(action.escalatedAt).getTime() : ""}`,
    }, action.ownerAdminId);
  },
};

module.exports = CheckinNotifications;
