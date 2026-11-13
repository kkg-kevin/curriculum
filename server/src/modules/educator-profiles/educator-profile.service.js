const db = require("../../config/db");
const { generateId } = require("../../shared/utils/model.utils");
const NotificationService = require("../notifications/notification.service");
const { workspaceTeacherIds } = require("../qa/qa.access");
const { isParent } = require("../parent/parent.access");
const { ANONYMOUS_MIN_REVIEWS } = require("../mentor-reviews/mentor-review.rules");
const { getSettings } = require("../mentor-reviews/mentor-review.service");
const R = require("./educator-profile.rules");
const { getStats, fullName } = require("./educator-profile.stats");

// The educator's performance profile (5 Nov 2026) — one profile, three views:
//   internal  admins / staff (Educators), the educator's supervisor: everything, with growth tips
//             and parents' requests for them; the hub: the same less tips and requests, parent
//             ratings only from 3 reviews (and only when the workspace shares them with hubs).
//   own       the educator (teacher portal → My profile): everything about them, their tips, and a
//             preview of the public profile; they write their "About" and choose to share.
//   public    only once the educator opted in AND an admin approved: their approved About, earned
//             badges, hours / sessions / learners / courses, the parent rating from 5 reviews (else
//             "New"), a QA band (never the score), comments parents agreed to share. Read by the
//             portal's own share page (/public/educators/:slug) and the parent portal's Find a
//             mentor. Nothing about pay, concerns, QA detail or hidden comments — ever.
// Nothing is collected from the website: parents ask for a mentor in the parent portal.

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const parseJson = (v) => (typeof v === "string" ? JSON.parse(v || "null") : v);

const PROFILE_FIELDS = ["id", "firstName", "lastName", "email", "phone", "photo", "status", "teacherLevel", "supervisorId", "createdByAdminId", "createdAt",
  "profileAbout", "profileAboutDraft", "profileOptIn", "profilePublic", "profileSlug", "profilePublishedAt", "profileApprovedBy", "profileReviewNote"];

const about = (t) => R.cleanAbout(parseJson(t.profileAbout) || {});
const draft = (t) => R.cleanAbout(parseJson(t.profileAboutDraft) || parseJson(t.profileAbout) || {});

// Where the profile stands: private (not shared) · pending (shared, waiting for an admin) ·
// published · changes (published, with edits waiting for an admin).
function publishState(t) {
  if (!t.profileOptIn) return "private";
  if (!t.profilePublic) return "pending";
  return R.sameAbout(parseJson(t.profileAboutDraft) || parseJson(t.profileAbout), parseJson(t.profileAbout)) ? "published" : "changes";
}

async function uniqueSlug(teacher) {
  const base = R.slugify(fullName(teacher));
  for (let i = 0; i < 50; i += 1) {
    const slug = i ? `${base}-${i + 1}` : base;
    const taken = await db("teachers").where({ profileSlug: slug }).whereNot({ id: teacher.id }).first("id");
    if (!taken) return slug;
  }
  return `${base}-${teacher.id.slice(0, 6)}`;
}

// The workspace an educator belongs to (for notifications): the one that added them, else a hub's.
async function workspaceOf(teacher) {
  if (teacher.createdByAdminId) return teacher.createdByAdminId;
  const hubId = (await db("teacher_hub_links").where({ teacherId: teacher.id }).first("hubId"))?.hubId;
  return hubId ? (await db("learning_hubs").where({ id: hubId }).first("ownerAdminId"))?.ownerAdminId || null : null;
}

async function educatorUserId(teacher) {
  return teacher.email ? (await db("users").whereRaw("LOWER(email) = ?", [teacher.email.toLowerCase()]).first("id"))?.id || null : null;
}

// The public view of an educator — the only shape that ever leaves the system unauthenticated.
function publicView(teacher, stats, { useDraft = false } = {}) {
  const a = useDraft ? draft(teacher) : about(teacher);
  const r = stats.rating || {};
  const rated = r.count >= R.PUBLIC_MIN_REVIEWS;
  const byCourse = new Map();
  for (const c of stats.courses || []) {
    const row = byCourse.get(c.course) || byCourse.set(c.course, { course: c.course, sessions: 0, learners: 0, finished: 0 }).get(c.course);
    row.sessions += c.sessions; row.learners += c.learners; row.finished += c.finished;
  }
  const modes = new Set((stats.experience?.hubs || []).map((h) => h.deliveryMode));
  return {
    slug: teacher.profileSlug,
    name: fullName(teacher),
    photo: teacher.photo || null,
    ...a,
    places: [...new Set((stats.experience?.hubs || []).map((h) => h.name))],
    teaches: { online: modes.has("virtual") || modes.has("hybrid"), inPerson: modes.has("in_person") || modes.has("hybrid"), atHome: modes.has("home") },
    since: stats.experience?.since || null,
    experienceMonths: stats.experience?.months || 0,
    hours: Math.floor(stats.hours?.total || 0),
    sessions: stats.sessions?.total || 0,
    learnersTaught: stats.learnersTaught || 0,
    learnersFinished: stats.outcomes?.learnersFinished || 0,
    certificatesEarned: stats.outcomes?.certificatesEarned || 0,
    courses: [...byCourse.values()].filter((c) => c.sessions > 0 || c.learners > 0).sort((x, y) => y.sessions - x.sessions).slice(0, 12),
    rating: rated ? { average: r.average, count: r.count, aspects: (r.aspects || []).filter((x) => x.average != null).map((x) => ({ label: x.label, average: x.average })) } : { count: r.count || 0, isNew: true },
    qa: stats.qa?.count ? { band: stats.qa.band, reviews: stats.qa.count } : null,
    badges: (stats.badges || []).filter((b) => b.earned).map((b) => ({ key: b.key, label: b.label, rule: b.rule })),
    comments: r.sharedComments || [],
    availability: [...new Set((stats.availability || []).map((s) => s.dayOfWeek))],
    totLevel: stats.tot?.level || null,
    updatedAt: stats.computedAt || null,
  };
}

// Who may open this educator's internal profile, and how much of it.
async function accessFor(req, teacherId) {
  const teacher = await db("teachers").where({ id: teacherId }).first(PROFILE_FIELDS);
  if (!teacher) fail("Educator not found", 404);
  const role = req.user.role;
  if (role === "admin") {
    if (!(await workspaceTeacherIds(req.ownerAdminId)).includes(teacherId)) fail("Educator not found", 404);
    return { teacher, view: "manager", ownerAdminId: req.ownerAdminId };
  }
  if (role === "supervisor") {
    if (teacher.supervisorId !== req.user.id) fail("Educator not found", 404);
    return { teacher, view: "manager", ownerAdminId: req.user.invitedByAdminId };
  }
  if (role === "school") {
    const hubId = req.ownSchool?.id;
    const linked = hubId && (await db("teacher_hub_links").where({ teacherId, hubId }).first("id")
      || await db("class_course_teacher_links").where({ teacherId }).whereIn("classId", db("classes").where({ schoolId: hubId }).select("id")).first("id"));
    if (!linked) fail("Educator not found", 404);
    return { teacher, view: "hub", ownerAdminId: req.ownSchool.ownerAdminId };
  }
  if (role === "teacher" && req.ownTeacher?.id === teacherId) return { teacher, view: "own", ownerAdminId: null };
  fail("Not allowed", 403);
}

async function requestsFor(teacherId, ownerAdminId) {
  const rows = await db("mentor_requests").where({ teacherId, ...(ownerAdminId ? { ownerAdminId } : {}) }).orderBy("createdAt", "desc").limit(30);
  if (!rows.length) return [];
  const learners = new Map((await db("learners").whereIn("id", rows.map((r) => r.learnerId)).select("id", "firstName", "lastName")).map((l) => [l.id, l]));
  const users = new Map((await db("users").whereIn("id", rows.map((r) => r.parentUserId)).select("id", "name", "email", "phone")).map((u) => [u.id, u]));
  return rows.map((r) => ({
    id: r.id, status: r.status, note: r.note || "", createdAt: r.createdAt, handledAt: r.handledAt,
    learner: { id: r.learnerId, name: fullName(learners.get(r.learnerId)) || "Learner" },
    parent: { name: users.get(r.parentUserId)?.name || "Parent", email: users.get(r.parentUserId)?.email || null, phone: users.get(r.parentUserId)?.phone || null },
  }));
}

const EducatorProfileService = {
  publicView,

  // The internal profile — admins, staff, the supervisor, the hub, or the educator themself.
  async profile(req, teacherId, { fresh = false } = {}) {
    const { teacher, view, ownerAdminId } = await accessFor(req, teacherId);
    const stats = await getStats(teacherId, { fresh });
    const out = {
      view,
      teacher: { id: teacher.id, name: fullName(teacher), photo: teacher.photo || null, status: teacher.status, level: teacher.teacherLevel || null },
      stats,
      publish: { state: publishState(teacher), optIn: !!teacher.profileOptIn, public: !!teacher.profilePublic, slug: teacher.profileSlug || null, publishedAt: teacher.profilePublishedAt || null, reviewNote: teacher.profileReviewNote || null },
      about: about(teacher),
      aboutDraft: draft(teacher),
    };
    if (view === "hub") {
      const settings = await getSettings(ownerAdminId);
      const shareRatings = settings.hubsSeeAverages && stats.rating.count >= ANONYMOUS_MIN_REVIEWS;
      out.stats = { ...stats, tips: [], rating: shareRatings ? { ...stats.rating, sharedComments: [] } : { count: stats.rating.count, hidden: true } };
      delete out.aboutDraft;
    }
    if (view === "manager") out.requests = await requestsFor(teacherId, ownerAdminId);
    // The workspace's mentor standards and where they stand (10 Nov 2026) — never for a hub.
    if (view !== "hub") out.standards = await require("../mentor-standards/mentor-standards.service").standingFor(teacher, stats, view === "manager" ? ownerAdminId : null);
    out.preview = publicView(teacher, stats, { useDraft: view !== "hub" });
    return out;
  },

  // The educator's own profile (teacher portal → My profile).
  async mine(req, { fresh = false } = {}) {
    if (!req.ownTeacher) fail("No educator record for this login", 404);
    return EducatorProfileService.profile(req, req.ownTeacher.id, { fresh });
  },

  // The educator writes their About and chooses whether to share their profile. Sharing (or a change
  // to a published About) waits for an admin; not sharing takes the public profile down at once.
  async saveMine(req, { about: raw, optIn }) {
    if (!req.ownTeacher) fail("No educator record for this login", 404);
    const teacher = await db("teachers").where({ id: req.ownTeacher.id }).first(PROFILE_FIELDS);
    const next = R.cleanAbout(raw || {});
    const patch = { profileAboutDraft: JSON.stringify(next), profileOptIn: !!optIn, updatedAt: new Date() };
    if (!optIn) Object.assign(patch, { profilePublic: false });
    await db("teachers").where({ id: teacher.id }).update(patch);
    const updated = await db("teachers").where({ id: teacher.id }).first(PROFILE_FIELDS);
    const state = publishState(updated);
    if (state === "pending" || state === "changes") {
      const ownerAdminId = await workspaceOf(updated);
      if (ownerAdminId) {
        await NotificationService._notify(ownerAdminId, {
          type: "educator_profile_review",
          title: `${fullName(updated)}'s profile is waiting for approval`,
          message: state === "pending" ? `${fullName(updated)} would like to share their educator profile. Check their About and publish it.` : `${fullName(updated)} changed their published About. Check it and publish the change.`,
          payload: { route: `/teachers/${updated.id}/view`, teacherId: updated.id },
          dedupeKey: `educator_profile_review:${updated.id}:${JSON.stringify(next).length}:${state}`,
          ownerAdminId,
        }).catch(() => {});
      }
    }
    return EducatorProfileService.mine(req);
  },

  // An admin: publish (the educator's current About becomes the public one), send back with a note,
  // or take the public profile down.
  async review(req, teacherId, { action, note = "" }) {
    const { teacher, view } = await accessFor(req, teacherId);
    if (view !== "manager" || req.user.role !== "admin") fail("Only admins publish educator profiles", 403);
    const now = new Date();
    const userId = await educatorUserId(teacher);
    const tell = (type, title, message) => (userId ? NotificationService.notifyPerson(userId, { type, title, message, payload: { route: "/teacher-portal/profile?tab=public" } }).catch(() => {}) : null);
    if (action === "approve") {
      if (!teacher.profileOptIn) fail(`${fullName(teacher)} hasn't chosen to share their profile`, 409);
      await db("teachers").where({ id: teacherId }).update({
        profileAbout: JSON.stringify(draft(teacher)), profilePublic: true, profileSlug: teacher.profileSlug || await uniqueSlug(teacher),
        profilePublishedAt: teacher.profilePublishedAt || now, profileApprovedBy: req.user.id, profileReviewNote: null, updatedAt: now,
      });
      await tell("educator_profile_published", "Your profile is published", "Your educator profile is live — share its link with families.");
    } else if (action === "send_back") {
      const text = String(note || "").trim().slice(0, 500);
      if (!text) fail("Say what to change, so they can fix it");
      await db("teachers").where({ id: teacherId }).update({ profileReviewNote: text, updatedAt: now });
      await tell("educator_profile_sent_back", "Your profile needs a change", text);
    } else if (action === "unpublish") {
      await db("teachers").where({ id: teacherId }).update({ profilePublic: false, updatedAt: now });
    } else fail("Unknown action");
    return EducatorProfileService.profile(req, teacherId);
  },

  // The public profile by its link — only while published (and the educator isn't inactive).
  async publicProfile(slug) {
    const teacher = await db("teachers").where({ profileSlug: String(slug || "").slice(0, 90), profilePublic: true }).first(PROFILE_FIELDS);
    if (!teacher || ["inactive", "removed"].includes(teacher.status)) fail("This profile isn't available", 404);
    return publicView(teacher, await getStats(teacher.id));
  },

  // Find a mentor (parent portal): the published educators of the workspaces their children learn in.
  async directory(req) {
    if (req.user.role !== "learner" || !isParent(req.user)) fail("For parents", 403);
    const learnerIds = (req.ownLearners || []).map((l) => l.id);
    if (!learnerIds.length) return [];
    const hubIds = await db("learner_hub_links").whereIn("learnerId", learnerIds).distinct("hubId").pluck("hubId");
    const owners = hubIds.length ? await db("learning_hubs").whereIn("id", hubIds).distinct("ownerAdminId").pluck("ownerAdminId") : [];
    const ids = new Set();
    for (const o of owners.filter(Boolean)) (await workspaceTeacherIds(o)).forEach((id) => ids.add(id));
    if (!ids.size) return [];
    const teachers = await db("teachers").whereIn("id", [...ids]).where({ profilePublic: true }).whereNotIn("status", ["inactive", "removed"]).select(PROFILE_FIELDS);
    const cards = [];
    for (const t of teachers) {
      const v = publicView(t, await getStats(t.id));
      cards.push({ ...v, teacherId: t.id, comments: v.comments.slice(0, 1) });
    }
    // Rated first (smoothed), then hours.
    return cards.sort((a, b) => (b.rating.isNew ? 0 : b.rating.average) - (a.rating.isNew ? 0 : a.rating.average) || b.hours - a.hours);
  },

  // A parent asks, in the parent portal, for a published educator to teach one of their children.
  async requestMentor(req, teacherId, { learnerId, note = "" }) {
    if (req.user.role !== "learner" || !isParent(req.user)) fail("For parents", 403);
    const learner = (req.ownLearners || []).find((l) => l.id === learnerId);
    if (!learner) fail("Choose one of your children", 404);
    const listed = (await EducatorProfileService.directory(req)).find((c) => c.teacherId === teacherId);
    if (!listed) fail("This educator isn't available to request", 404);
    const open = await db("mentor_requests").where({ parentUserId: req.user.id, learnerId, teacherId, status: "open" }).first("id");
    if (open) fail(`You've already asked for ${listed.name} for ${learner.firstName} — the team will be in touch`, 409);
    const hubId = (await db("learner_hub_links").where({ learnerId }).first("hubId"))?.hubId;
    const ownerAdminId = hubId ? (await db("learning_hubs").where({ id: hubId }).first("ownerAdminId"))?.ownerAdminId || null : null;
    const id = generateId();
    await db("mentor_requests").insert({ id, ownerAdminId, parentUserId: req.user.id, learnerId, teacherId, note: String(note || "").trim().slice(0, 1000) || null, status: "open", createdAt: new Date() });
    if (ownerAdminId) {
      await NotificationService._notify(ownerAdminId, {
        type: "mentor_requested",
        title: `A family asked for ${listed.name}`,
        message: `${learner.firstName}'s parent would like ${listed.name} to teach ${learner.firstName}.${note ? ` "${String(note).slice(0, 160)}"` : ""}`,
        payload: { route: `/teachers/${teacherId}/view`, teacherId, requestId: id },
        dedupeKey: `mentor_requested:${id}`,
        ownerAdminId,
      }).catch(() => {});
    }
    return { id };
  },

  async handleRequest(req, requestId) {
    const row = await db("mentor_requests").where({ id: requestId }).first();
    if (!row) fail("Request not found", 404);
    const { view } = await accessFor(req, row.teacherId);
    if (view !== "manager") fail("Not allowed", 403);
    await db("mentor_requests").where({ id: requestId }).update({ status: "handled", handledBy: req.user.id, handledAt: new Date() });
  },
};

module.exports = EducatorProfileService;
