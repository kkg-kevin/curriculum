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

  // Staff gave it to another mentor (the first one left): the family, the new mentor, the old one.
  mentorChanged(b, { parentUserIds, mentorUserId, previousMentorUserId, childName, mentorName }) {
    const stamp = `${b.teacherId}`;
    return Promise.all([
      sendAll(parentUserIds, {
        type: "mentor_booking_confirmed",
        title: `New mentor for ${childName || "your child"}'s session`,
        message: `${mentorName || "Another mentor"} will now take ${childName || "your child"} through ${about(b)} ${where(b)} on ${when(b)} — same time, nothing to pay again.`,
        payload: { route: `${PARENT}/${b.id}`, bookingId: b.id },
        dedupeKey: `mentor_booking_mentor_changed:${b.id}:${stamp}`,
      }, b.ownerAdminId),
      send(mentorUserId, {
        type: "mentor_booking_confirmed",
        title: `New session: ${childName || "a learner"}, ${when(b)}`,
        message: `You're taking over a session: ${childName || "a learner"} needs help with ${about(b)}${b.topic ? ` — "${String(b.topic).slice(0, 140)}"` : ""}. ${b.minutes} minutes, ${where(b)}.`,
        payload: { route: `${MENTOR}/${b.id}`, bookingId: b.id },
        dedupeKey: `mentor_booking_mentor_changed:${b.id}:${stamp}`,
      }, b.ownerAdminId),
      previousMentorUserId && previousMentorUserId !== mentorUserId ? send(previousMentorUserId, {
        type: "mentor_booking_cancelled",
        title: `Session on ${when(b)} handed over`,
        message: `The session on ${when(b)} has been given to ${mentorName || "another mentor"}.`,
        payload: { route: MENTOR, bookingId: b.id },
        dedupeKey: `mentor_booking_handed_over:${b.id}:${stamp}`,
      }, b.ownerAdminId) : null,
    ]);
  },

  // A class took a paid session's time: the family picks a new one or takes a refund; the mentor
  // and the workspace's admins know it's waiting on them.
  needsNewTime(b, { parentUserIds, mentorUserId, childName, mentorName }) {
    const stamp = new Date(b.clashAt).getTime();
    return Promise.all([
      sendAll(parentUserIds, {
        type: "mentor_booking_needs_new_time",
        title: `Please pick a new time for ${childName || "your child"}'s session`,
        message: `${mentorName || "The mentor"} now has a class on ${when(b)}. Pick another free time at no extra cost, or cancel for a full refund.`,
        payload: { route: `${PARENT}/${b.id}`, bookingId: b.id },
        dedupeKey: `mentor_booking_needs_new_time:${b.id}:${stamp}`,
      }, b.ownerAdminId),
      send(mentorUserId, {
        type: "mentor_booking_needs_new_time",
        title: `Your session on ${when(b)} needs a new time`,
        message: `A class of yours now falls on ${when(b)}, so ${childName || "the family"}'s family has been asked to pick another time. Your class comes first.`,
        payload: { route: `${MENTOR}/${b.id}`, bookingId: b.id },
        dedupeKey: `mentor_booking_needs_new_time:${b.id}:${stamp}`,
      }, b.ownerAdminId),
      NotificationService._notify(b.ownerAdminId, {
        type: "mentor_booking_needs_new_time",
        title: `Mentor session needs a new time: ${when(b)}`,
        message: `${mentorName || "A mentor"} now has a class at the time of ${childName || "a learner"}'s paid session. The family has been asked to pick another time.`,
        payload: { route: `${ADMIN}/${b.id}`, bookingId: b.id },
        dedupeKey: `mentor_booking_needs_new_time:${b.id}:${stamp}:admins`,
        ownerAdminId: b.ownerAdminId,
      }).catch((err) => console.error("[mentor-bookings] could not send a notification:", err.message)),
    ]);
  },

  // The class moved away again: the session stands at its time.
  clashCleared(b, { parentUserIds, mentorUserId, childName }) {
    const stamp = `cleared:${b.date}:${b.startTime}:${new Date(b.clashAt).getTime()}`;
    const event = (route) => ({
      type: "mentor_booking_rescheduled",
      title: `Session on ${when(b)} is back on`,
      message: `The class that clashed has moved, so ${childName || "the learner"}'s session stays on ${when(b)}. There's nothing you need to do.`,
      payload: { route, bookingId: b.id },
      dedupeKey: `mentor_booking_rescheduled:${b.id}:${stamp}`,
    });
    return Promise.all([
      sendAll(parentUserIds, event(`${PARENT}/${b.id}`), b.ownerAdminId),
      send(mentorUserId, event(`${MENTOR}/${b.id}`), b.ownerAdminId),
    ]);
  },

  // Moved to a new time.
  rescheduled(b, { parentUserIds, mentorUserId, childName, mentorName }, { fromDate, fromTime }) {
    const stamp = `${fromDate}:${fromTime}:${b.date}:${b.startTime}`;
    return Promise.all([
      sendAll(parentUserIds, {
        type: "mentor_booking_rescheduled",
        title: `New time: ${when(b)}`,
        message: `${mentorName || "The mentor"} will now meet ${childName || "your child"} ${where(b)} on ${when(b)} (${b.minutes} min). Nothing more to pay.`,
        payload: { route: `${PARENT}/${b.id}`, bookingId: b.id },
        dedupeKey: `mentor_booking_rescheduled:${b.id}:${stamp}`,
      }, b.ownerAdminId),
      send(mentorUserId, {
        type: "mentor_booking_rescheduled",
        title: `Session moved to ${when(b)}`,
        message: `${childName || "The learner"}'s family picked a new time: ${when(b)}, ${b.minutes} minutes, ${where(b)}.`,
        payload: { route: `${MENTOR}/${b.id}`, bookingId: b.id },
        dedupeKey: `mentor_booking_rescheduled:${b.id}:${stamp}`,
      }, b.ownerAdminId),
    ]);
  },

  // A class landed on hours the mentor offers families: once per class, day and time.
  hoursTaken({ teacherId, userId, classId, className, slot, ownerAdminId }) {
    const dayName = slot.dayOfWeek.charAt(0).toUpperCase() + slot.dayOfWeek.slice(1);
    const start = String(slot.startTime).slice(0, 5);
    const end = String(slot.endTime).slice(0, 5);
    return send(userId, {
      type: "mentor_booking_hours_taken",
      title: `${className} now uses your ${dayName} ${start}–${end}`,
      message: `Your class comes first, so families can't book you then. Your other hours are unchanged. Add different hours if you'd like to keep the same time open.`,
      payload: { route: "/teacher-portal/availability" },
      dedupeKey: `mentor_booking_hours_taken:${teacherId}:${classId}:${slot.dayOfWeek}:${start}:${end}`,
    }, ownerAdminId);
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
