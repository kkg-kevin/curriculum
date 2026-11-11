const NotificationService = require("../notifications/notification.service");

// In-app notifications (and, for the types in notification.emails.js's EMAIL_TYPES, emails) for
// mentor bookings. Each goes to one person (notifyPerson) with a dedupeKey, so a job or page that
// runs again sends nothing twice — except the refund notice, which goes to the workspace's admins.
// None of these may fail what triggered them.
//
// Parents open theirs in /parent/bookings, mentors in /teacher-portal/bookings, admins in
// /mentor-bookings.

const PARENT = "/parent/bookings";
const MENTOR = "/teacher-portal/bookings";
const ADMIN = "/mentor-bookings";

const day = (date) => new Date(`${String(date).slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const when = (b) => `${day(b.date)}, ${b.startTime}`;
const where = (b) => (b.mode === "online" ? "online" : `at ${[b.hubName, b.spaceName].filter(Boolean).join(" — ") || "the hub"}`);
const about = (b) => b.sessionTitle || b.courseName || "their course";

async function send(userId, event, ownerAdminId) {
  if (!userId) return;
  await NotificationService.notifyPerson(userId, { ...event, ownerAdminId, dedupeKey: `${event.dedupeKey}:${userId}` }).catch((err) => {
    console.error("[mentor-bookings] could not send a notification:", err.message);
  });
}
const sendAll = (userIds, event, ownerAdminId) => Promise.all([...new Set((userIds || []).filter(Boolean))].map((id) => send(id, event, ownerAdminId)));

const MentorBookingNotifications = {
  // A child asked for help: each of their parents hears.
  helpRequested(request, { parentUserIds, childName }) {
    return sendAll(parentUserIds, {
      type: "mentor_help_requested",
      title: `${childName || "Your child"} asked for help`,
      message: `${childName || "Your child"} is stuck on ${request.sessionTitle || request.courseName || "a session"}${request.message ? ` — "${String(request.message).slice(0, 140)}"` : ""}. Book a mentor to take them through it.`,
      payload: { route: `${PARENT}/new?learnerId=${request.learnerId}&help=${request.id}`, helpRequestId: request.id },
      dedupeKey: `mentor_help_requested:${request.id}`,
    }, request.ownerAdminId);
  },

  // Paid (or included in their plan): the family and the mentor have it on their lists.
  confirmed(b, { parentUserIds, mentorUserId, childName, mentorName }) {
    return Promise.all([
      sendAll(parentUserIds, {
        type: "mentor_booking_confirmed",
        title: `Booked: ${mentorName || "a mentor"} with ${childName || "your child"}`,
        message: `${mentorName || "The mentor"} will take ${childName || "your child"} through ${about(b)} ${where(b)} on ${when(b)} (${b.minutes} min).`,
        payload: { route: `${PARENT}/${b.id}`, bookingId: b.id },
        dedupeKey: `mentor_booking_confirmed:${b.id}`,
      }, b.ownerAdminId),
      send(mentorUserId, {
        type: "mentor_booking_confirmed",
        title: `New session: ${childName || "a learner"}, ${when(b)}`,
        message: `${childName || "A learner"} needs help with ${about(b)}${b.topic ? ` — "${String(b.topic).slice(0, 140)}"` : ""}. ${b.minutes} minutes, ${where(b)}.`,
        payload: { route: `${MENTOR}/${b.id}`, bookingId: b.id },
        dedupeKey: `mentor_booking_confirmed:${b.id}`,
      }, b.ownerAdminId),
    ]);
  },

  // Cancelled — everyone involved but whoever cancelled hears.
  cancelled(b, { parentUserIds, mentorUserId, by, refund }) {
    const who = { parent: "The family", mentor: "The mentor", staff: "Our team", system: "We" }[by] || "Someone";
    const event = (route) => ({
      type: "mentor_booking_cancelled",
      title: `Session on ${when(b)} cancelled`,
      message: `${who} cancelled the mentor session on ${when(b)}${b.cancelReason ? `: "${String(b.cancelReason).slice(0, 160)}"` : "."}${refund > 0 ? ` What was paid (KSh ${Number(refund).toLocaleString("en-KE")}) will be refunded.` : ""}`,
      payload: { bookingId: b.id, route },
      dedupeKey: `mentor_booking_cancelled:${b.id}`,
    });
    return Promise.all([
      by === "parent" ? null : sendAll(parentUserIds, event(`${PARENT}/${b.id}`), b.ownerAdminId),
      by === "mentor" ? null : send(mentorUserId, event(`${MENTOR}/${b.id}`), b.ownerAdminId),
    ]);
  },

  // The day of it: the family and the mentor.
  today(b, { parentUserIds, mentorUserId, childName, mentorName }) {
    const stamp = String(b.date).slice(0, 10);
    return Promise.all([
      sendAll(parentUserIds, {
        type: "mentor_booking_today",
        title: `Mentor session today at ${b.startTime}`,
        message: `${mentorName || "The mentor"} meets ${childName || "your child"} ${where(b)} at ${b.startTime}.${b.mode === "online" && b.meetingLink ? " Join from the booking." : ""}`,
        payload: { route: `${PARENT}/${b.id}`, bookingId: b.id },
        dedupeKey: `mentor_booking_today:${b.id}:${stamp}`,
      }, b.ownerAdminId),
      send(mentorUserId, {
        type: "mentor_booking_today",
        title: `Session today at ${b.startTime}: ${childName || "a learner"}`,
        message: `${about(b)}, ${b.minutes} minutes, ${where(b)}.`,
        payload: { route: `${MENTOR}/${b.id}`, bookingId: b.id },
        dedupeKey: `mentor_booking_today:${b.id}:${stamp}`,
      }, b.ownerAdminId),
    ]);
  },

  // The mentor says how it went.
  noted(b, { parentUserIds, mentorName, childName }) {
    return sendAll(parentUserIds, {
      type: "mentor_booking_note",
      title: `${mentorName || "The mentor"}'s note on ${childName || "your child"}'s session`,
      message: b.status === "no_show"
        ? `${mentorName || "The mentor"} was ready on ${when(b)}, but ${childName || "your child"} didn't join.`
        : `How the session on ${about(b)} went, and what to try next.`,
      payload: { route: `${PARENT}/${b.id}`, bookingId: b.id },
      dedupeKey: `mentor_booking_note:${b.id}:${b.status}`,
    }, b.ownerAdminId);
  },

  // Money to give back — the workspace's admins.
  refundDue(b, amount) {
    return NotificationService._notify(b.ownerAdminId, {
      type: "mentor_booking_refund_due",
      title: `Refund due: KSh ${Number(amount).toLocaleString("en-KE")}`,
      message: `The mentor session on ${when(b)} was cancelled after it was paid. Give the family their money back, then mark it refunded.`,
      payload: { route: `${ADMIN}?tab=refunds`, bookingId: b.id },
      dedupeKey: `mentor_booking_refund_due:${b.id}`,
      ownerAdminId: b.ownerAdminId,
    }).catch((err) => console.error("[mentor-bookings] could not send a notification:", err.message));
  },
};

module.exports = MentorBookingNotifications;
module.exports.routes = { PARENT, MENTOR, ADMIN };
