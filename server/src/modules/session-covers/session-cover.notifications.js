const db = require("../../config/db");
const NotificationService = require("../notifications/notification.service");

// Session covers' notices (19 Nov 2026). Each is keyed, so nothing is sent twice.
const personName = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
const classLabel = (cls) => [cls?.gradeName, cls?.streamName].filter(Boolean).join(" — ").trim() || "the class";
const dayLabel = (date) => new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
const when = (cover) => `${dayLabel(cover.date)}${cover.startTime ? ` at ${cover.startTime}` : ""}`;
const what = (ctx) => `${ctx.course?.name || "a session"}${ctx.session?.title ? ` (${ctx.session.title})` : ""}, ${classLabel(ctx.cls)}`;
const EDUCATOR_PAGE = "/teacher-portal/covers";

// The covers page in the reader's own app: an educator's Covers, a hub's or admin's overview.
async function coversPageFor(userId) {
  const user = await db("users").where({ id: userId }).first("role");
  return user?.role === "school" ? "/school-portal/covers" : user?.role === "admin" || user?.role === "collaborator" ? "/covers" : EDUCATOR_PAGE;
}

async function send(userId, event, ownerAdminId) {
  if (!userId) return;
  const payload = event.payload?.route === EDUCATOR_PAGE ? { ...event.payload, route: await coversPageFor(userId) } : event.payload;
  await NotificationService.notifyPerson(userId, { ...event, payload, ownerAdminId, dedupeKey: `${event.dedupeKey}:${userId}` }).catch((err) => {
    console.error("[session-covers] notice failed:", err.message);
  });
}

const SessionCoverNotifications = {
  // To the educator asked.
  requested(cover, ctx, userId) {
    const asker = cover.requestedByKind === "educator" ? personName(ctx.original) || "An educator" : ctx.hub?.name || "The learning hub";
    return send(userId, {
      type: "cover_requested",
      title: "Can you cover a session?",
      message: `${asker} asks you to cover ${what(ctx)} on ${when(cover)}.${cover.note ? ` Note: ${cover.note}` : ""} Accept or decline it.`,
      payload: { route: EDUCATOR_PAGE, coverId: cover.id },
      dedupeKey: `cover_requested:${cover.id}`,
    }, cover.ownerAdminId);
  },

  // To whoever asked (and the educator being covered) — yes or no.
  answered(cover, ctx, userIds) {
    const accepted = cover.status === "accepted";
    const who = personName(ctx.coverTeacher) || "The educator";
    return Promise.all(userIds.map((id) => send(id, {
      type: accepted ? "cover_accepted" : "cover_declined",
      title: accepted ? `${who} will cover your session` : `${who} can't cover your session`,
      message: accepted
        ? `${who} will teach ${what(ctx)} on ${when(cover)}.`
        : `${who} declined to cover ${what(ctx)} on ${when(cover)}${cover.declineReason ? `: ${cover.declineReason}` : ""}. You can ask someone else.`,
      payload: { route: EDUCATOR_PAGE, coverId: cover.id },
      dedupeKey: `cover_${cover.status}:${cover.id}`,
    }, cover.ownerAdminId)));
  },

  // The cover is off — to the cover educator (and the class's side when it moved on its own).
  cancelled(cover, ctx, userIds) {
    return Promise.all(userIds.map((id) => send(id, {
      type: "cover_cancelled",
      title: "A cover is cancelled",
      message: `The cover of ${what(ctx)} on ${when(cover)} is cancelled${cover.cancelReason ? `: ${cover.cancelReason}` : ""}.`,
      payload: { route: EDUCATOR_PAGE, coverId: cover.id },
      dedupeKey: `cover_cancelled:${cover.id}`,
    }, cover.ownerAdminId)));
  },

  // The cover educator pulled out — to the class's side.
  withdrawn(cover, ctx, userIds) {
    const who = personName(ctx.coverTeacher) || "The educator";
    return Promise.all(userIds.map((id) => send(id, {
      type: "cover_withdrawn",
      title: `${who} can no longer cover your session`,
      message: `${who} pulled out of covering ${what(ctx)} on ${when(cover)}${cover.cancelReason ? `: ${cover.cancelReason}` : ""}. Ask someone else, or teach it yourself.`,
      payload: { route: EDUCATOR_PAGE, coverId: cover.id },
      dedupeKey: `cover_withdrawn:${cover.id}`,
    }, cover.ownerAdminId)));
  },

  // The day before — each learner's family (and the child's own login): who is teaching.
  familyNotice(cover, ctx, learnerId) {
    const who = personName(ctx.coverTeacher) || "another educator";
    const usual = personName(ctx.original);
    return NotificationService.notifyLearner(learnerId, {
      type: "cover_family_notice",
      title: `${ctx.course?.name || "A session"}: another educator is teaching`,
      message: `${dayLabel(cover.date)}'s ${ctx.course?.name || "session"} session${cover.startTime ? ` at ${cover.startTime}` : ""} will be taught by ${who}${usual ? `, covering for ${usual}` : ""}.`,
      payload: { coverId: cover.id, learnerId },
      dedupeKey: `cover_family_notice:${cover.id}:${learnerId}`,
    }).catch((err) => console.error("[session-covers] family notice failed:", err.message));
  },
};

module.exports = SessionCoverNotifications;
