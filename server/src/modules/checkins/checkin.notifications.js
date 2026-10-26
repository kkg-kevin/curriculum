const NotificationService = require("../notifications/notification.service");

// In-app notifications (and, for the types in notification.emails.js's EMAIL_TYPES, emails) for
// hub check-ins: you've been put on a hub's check-ins, and a check-in is due — write its report.
// Each carries a dedupeKey, so a job that runs again or a page that checks again never sends the
// same one twice.
//
// None of these may fail what triggered them — they're logged and dropped.

const FREQUENCY = { weekly: "weekly", monthly: "monthly", quarterly: "quarterly", semi_annually: "every 6 months", annually: "yearly", once: "once" };
const FORMAT = { online: "online", in_person: "in person" };
const day = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

async function send(recipientIds, event, ownerAdminId) {
  const ids = [...new Set(recipientIds.filter(Boolean))];
  await Promise.all(ids.map((id) => NotificationService._notify(id, { ...event, ownerAdminId, dedupeKey: `${event.dedupeKey}:${id}` }).catch((err) => {
    console.error("[checkins] could not send a notification:", err.message);
  })));
}

const CheckinNotifications = {
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
};

module.exports = CheckinNotifications;
