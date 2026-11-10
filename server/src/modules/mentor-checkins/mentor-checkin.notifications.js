const NotificationService = require("../notifications/notification.service");

// In-app notifications (and, for the types in notification.emails.js's EMAIL_TYPES, emails) for
// parent–mentor check-ins. Each goes to one person (notifyPerson — never fanned out to an
// organisation's admins) with a dedupeKey, so a job or page that runs again sends nothing twice.
// None of these may fail what triggered them — they're logged and dropped.
//
// Parents open theirs in /parent/mentor-checkins, educators in /teacher-portal/mentor-checkins.

const PARENT_BASE = "/parent/mentor-checkins";
const EDUCATOR_BASE = "/teacher-portal/mentor-checkins";

const day = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const when = (m) => `${day(m.date)}, ${m.startTime}`;
const names = (list) => {
  const items = list.filter(Boolean);
  if (items.length <= 1) return items[0] || "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
};
const where = (round) => (round.format === "online" ? "online" : round.location ? `at ${round.location}` : "in person");

async function send(userId, event, ownerAdminId) {
  if (!userId) return;
  await NotificationService.notifyPerson(userId, { ...event, ownerAdminId, dedupeKey: `${event.dedupeKey}:${userId}` }).catch((err) => {
    console.error("[mentor-checkins] could not send a notification:", err.message);
  });
}
const sendAll = (userIds, event, ownerAdminId) => Promise.all([...new Set(userIds.filter(Boolean))].map((id) => send(id, event, ownerAdminId)));

const MentorCheckinNotifications = {
  // A round is set up: each family hears their time (3 days' notice at least) …
  scheduled(round, meeting, { childNames, educatorNames }) {
    return send(meeting.parentUserId, {
      type: "mentor_checkin_scheduled",
      title: `Check-in about ${names(childNames) || "your child"}`,
      message: `${names(educatorNames) || "Your child's mentor"} would like to meet you ${where(round)} on ${when(meeting)} to talk about how ${names(childNames) || "your child"} is doing. Confirm the time, or pick another that suits you.`,
      payload: { route: `${PARENT_BASE}/meetings/${meeting.id}`, meetingId: meeting.id },
      dedupeKey: `mentor_checkin_scheduled:${meeting.id}`,
    }, round.ownerAdminId);
  },

  // … and the educators get the whole schedule.
  roundScheduled(round, educatorUserIds, { className, count }) {
    return sendAll(educatorUserIds, {
      type: "mentor_checkin_round_scheduled",
      title: `Parent check-ins for ${className}`,
      message: `${count} parent check-in${count === 1 ? "" : "s"} for ${className}, ${where(round)}, between ${day(round.windowStart)} and ${day(round.windowEnd)}. Each family's time is on your schedule.`,
      payload: { route: `${EDUCATOR_BASE}?round=${round.id}`, roundId: round.id },
      dedupeKey: `mentor_checkin_round_scheduled:${round.id}`,
    }, round.ownerAdminId);
  },

  // A check-in's time moved — by the parent (the educators are told) or by our team (the parent and
  // the educators are told).
  changed(round, meeting, { byParent, parentName, childNames, educatorUserIds }) {
    const stamp = `${meeting.date} ${meeting.startTime}`;
    const toEducators = sendAll(educatorUserIds, {
      type: "mentor_checkin_changed",
      title: byParent ? `${parentName || "A parent"} picked another time` : "A parent check-in has moved",
      message: `The check-in with ${parentName || "a parent"} about ${names(childNames) || "their child"} is now on ${when(meeting)}.`,
      payload: { route: `${EDUCATOR_BASE}/meetings/${meeting.id}`, meetingId: meeting.id },
      dedupeKey: `mentor_checkin_changed:${meeting.id}:${stamp}`,
    }, round.ownerAdminId);
    const toParent = byParent ? null : send(meeting.parentUserId, {
      type: "mentor_checkin_changed",
      title: "Your check-in has a new time",
      message: `Your check-in about ${names(childNames) || "your child"} is now on ${when(meeting)} (${where(round)}).`,
      payload: { route: `${PARENT_BASE}/meetings/${meeting.id}`, meetingId: meeting.id },
      dedupeKey: `mentor_checkin_changed:${meeting.id}:${stamp}`,
    }, round.ownerAdminId);
    return Promise.all([toEducators, toParent]);
  },

  cancelled(round, meeting, { childNames, educatorUserIds, notifyEducators = true }) {
    const event = (base) => ({
      type: "mentor_checkin_cancelled",
      title: "A check-in has been cancelled",
      message: `The check-in about ${names(childNames) || "a learner"} on ${when(meeting)} won't go ahead.`,
      payload: { route: `${base}/meetings/${meeting.id}`, meetingId: meeting.id },
      dedupeKey: `mentor_checkin_cancelled:${meeting.id}`,
    });
    return Promise.all([
      send(meeting.parentUserId, event(PARENT_BASE), round.ownerAdminId),
      notifyEducators ? sendAll(educatorUserIds, event(EDUCATOR_BASE), round.ownerAdminId) : null,
    ]);
  },

  // A whole round called off — the educators hear once.
  roundCancelled(round, educatorUserIds, { className }) {
    return sendAll(educatorUserIds, {
      type: "mentor_checkin_cancelled",
      title: `Parent check-ins for ${className} cancelled`,
      message: `The parent check-ins still to come for ${className} won't go ahead. The families have been told.`,
      payload: { route: EDUCATOR_BASE, roundId: round.id },
      dedupeKey: `mentor_checkin_round_cancelled:${round.id}`,
    }, round.ownerAdminId);
  },

  // On the day: the parent, with the link to join an online one …
  todayForParent(round, meeting, { childNames }) {
    const join = round.format === "online" && round.meetingLink ? ` Join here: ${round.meetingLink}` : "";
    return send(meeting.parentUserId, {
      type: "mentor_checkin_today",
      title: "Your check-in is today",
      message: `Your check-in about ${names(childNames) || "your child"} is today at ${meeting.startTime} (${where(round)}).${join}`,
      payload: { route: `${PARENT_BASE}/meetings/${meeting.id}`, meetingId: meeting.id, meetingLink: round.format === "online" ? round.meetingLink || null : null },
      dedupeKey: `mentor_checkin_today:${meeting.id}:${meeting.date}`,
    }, round.ownerAdminId);
  },

  // … and each educator once for all of theirs that day.
  todayForEducator(userId, date, meetings, ownerAdminId) {
    const first = [...meetings].sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
    return send(userId, {
      type: "mentor_checkin_today",
      title: meetings.length === 1 ? "A parent check-in today" : `${meetings.length} parent check-ins today`,
      message: `${meetings.length === 1 ? "Your parent check-in today is" : "Your first parent check-in today is"} at ${first.startTime}. Write each report once it's done.`,
      payload: { route: EDUCATOR_BASE },
      dedupeKey: `mentor_checkin_today_educator:${date}`,
    }, ownerAdminId);
  },

  // The report is in — the parent reads it and approves it.
  reportReady(round, meeting, { childNames, educatorName }) {
    return send(meeting.parentUserId, {
      type: "mentor_checkin_report_ready",
      title: `Report from your check-in about ${names(childNames) || "your child"}`,
      message: `${educatorName || "The mentor"} has written up your check-in on ${day(meeting.date)}. Read it through, then approve it.`,
      payload: { route: `${PARENT_BASE}/meetings/${meeting.id}`, meetingId: meeting.id },
      dedupeKey: `mentor_checkin_report_ready:${meeting.id}`,
    }, round.ownerAdminId);
  },

  approved(round, meeting, { parentName, childNames, educatorUserIds }) {
    return sendAll(educatorUserIds, {
      type: "mentor_checkin_approved",
      title: `${parentName || "A parent"} approved the report`,
      message: `${parentName || "The parent"} has read and approved the report from the check-in about ${names(childNames) || "their child"} on ${day(meeting.date)}.${meeting.parentComment ? ` They added: "${String(meeting.parentComment).slice(0, 140)}"` : ""}`,
      payload: { route: `${EDUCATOR_BASE}/meetings/${meeting.id}`, meetingId: meeting.id },
      dedupeKey: `mentor_checkin_approved:${meeting.id}`,
    }, round.ownerAdminId);
  },
};

module.exports = MentorCheckinNotifications;
