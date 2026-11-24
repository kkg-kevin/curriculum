const asyncHandler = require("express-async-handler");
const db = require("../../config/db");
const { can } = require("../access/access.service");
const { workspaceKeyOf, workspaceOfTeacher } = require("../expenses/expense.context");
const S = require("./connect.store");

// Who is asking, for every /api/connect request (mounted after protect + attachOwnRecords). Sets
// req.connect:
//   kind       learner  — a child's OWN username login (the only one who takes part; the user's
//                         choice, 24 Nov 2026). A TOT learner (an adult educator) is refused.
//              parent   — a parent's login: their children's switches and who they talk to.
//              staff    — an admin, or staff whose role grants Digifunzi Connect (attachOwnRecords
//                         has already checked View / Create / Edit / Delete for the request).
//              educator — an educator: moderates if named a Connect moderator (Settings) or a
//                         community's moderator.
//   ownerAdminId, settings, member (learner), canManage (settings, communities, challenges),
//   canModerateAll, canCreate, moderatedCommunityIds.
// Connect belongs to the WORKSPACE, never a class: a learner's workspace is that of any hub they
// were ever at (links are kept when they leave), else the admin who added them.

async function workspaceOfLearner(learner) {
  if (!learner) return null;
  const links = await db("learner_hub_links").where({ learnerId: learner.id }).orderByRaw("status = 'active' DESC").select("hubId");
  for (const link of links) {
    const hub = await db("learning_hubs").where({ id: link.hubId }).first("ownerAdminId");
    if (hub?.ownerAdminId) return hub.ownerAdminId;
  }
  return learner.createdByAdminId ? workspaceKeyOf(learner.createdByAdminId) : null;
}

const connectContext = asyncHandler(async (req, res, next) => {
  const { role, id: userId } = req.user;
  const ctx = { userId, kind: null, ownerAdminId: null, member: null, learner: null, canManage: false, canModerateAll: false, canCreate: false, moderatedCommunityIds: new Set(), name: null, roleLabel: null };

  if (role === "learner" && req.user.username && !req.user.totLearner) {
    const learner = req.ownLearner;
    if (!learner) throw S.refuse(403, "We couldn't find your learner record.");
    ctx.kind = "learner";
    ctx.learner = learner;
    ctx.member = await S.memberByLearner(learner.id);
    ctx.ownerAdminId = ctx.member?.ownerAdminId || (await workspaceOfLearner(learner));
    ctx.name = ctx.member?.displayName || learner.firstName;
    ctx.roleLabel = "Learner";
  } else if (role === "learner" && req.user.totLearner) {
    throw S.refuse(403, "Digifunzi Connect is the children's community. Educators take part as moderators from the teacher portal.");
  } else if (role === "learner") {
    ctx.kind = "parent";
    ctx.ownLearners = req.ownLearners || [];
    ctx.roleLabel = "Parent";
  } else if (role === "admin") {
    // An admin, or staff aliased to admin by attachOwnRecords for a request their role allows.
    ctx.kind = "staff";
    ctx.ownerAdminId = req.ownerAdminId;
    const staff = req.user.actualRole === "collaborator";
    const perms = req.user.permissions;
    ctx.canManage = !staff || can(perms, "connect", "edit") || can(perms, "connect", "create");
    ctx.canModerateAll = ctx.canManage;
    ctx.canView = true;
    ctx.canCreate = ctx.canManage;
    const user = await db("users").where({ id: userId }).first("name");
    ctx.name = user?.name || "Digifunzi team";
    ctx.roleLabel = staff ? "Staff" : "Admin";
  } else if (role === "teacher") {
    const teacher = req.ownTeacher;
    if (!teacher || ["inactive", "removed"].includes(teacher.status || "active")) throw S.refuse(403, "No active educator profile is linked to this account.");
    ctx.kind = "educator";
    ctx.teacher = teacher;
    ctx.ownerAdminId = await workspaceOfTeacher(teacher);
    ctx.name = [teacher.firstName, teacher.lastName].filter(Boolean).join(" ") || "Educator";
    ctx.roleLabel = "Educator";
  } else {
    throw S.refuse(403, "Digifunzi Connect isn't part of this sign-in.");
  }

  if (ctx.kind !== "parent") {
    if (!ctx.ownerAdminId) throw S.refuse(403, "This account isn't part of a workspace with Digifunzi Connect yet.");
    ctx.settings = await S.settingsFor(ctx.ownerAdminId);
    await S.ensureDefaultCommunities(ctx.ownerAdminId);
  }
  if (ctx.kind === "educator") {
    ctx.canModerateAll = ctx.settings.moderatorUserIds.includes(userId);
    const own = await db("connect_community_moderators as m")
      .join("connect_communities as c", "c.id", "m.communityId")
      .where({ "m.userId": userId, "c.ownerAdminId": ctx.ownerAdminId })
      .pluck("m.communityId");
    ctx.moderatedCommunityIds = new Set(own);
    ctx.canCreate = ctx.canModerateAll && ctx.settings.educatorsCreate;
  }
  ctx.isModerator = ctx.canModerateAll || ctx.moderatedCommunityIds.size > 0;
  req.ownerAdminId = ctx.ownerAdminId || req.ownerAdminId;
  req.connect = ctx;
  next();
});

// May this person moderate content in this community (null = the main feed)?
function canModerate(ctx, communityId = null) {
  if (ctx.canModerateAll) return true;
  return !!communityId && ctx.moderatedCommunityIds.has(communityId);
}

// The learner side: switched on, not suspended. `write` also refuses a suspended member.
function requireMember(ctx, { write = false } = {}) {
  if (ctx.kind !== "learner") throw S.refuse(403, "Only learners take part in Connect this way.");
  const m = ctx.member;
  if (!m || m.status === "off") throw S.refuse(403, "Connect isn't switched on for you yet. Ask your parent to switch it on from their Digifunzi account.", { code: "CONNECT_NOT_ON" });
  if (write && isSuspended(m)) {
    throw S.refuse(403, `You can read Connect but can't post or message until ${new Date(m.suspendedUntil).toLocaleDateString("en-GB")}.`, { code: "CONNECT_SUSPENDED" });
  }
  return m;
}

const isSuspended = (m) => m?.status === "suspended" && (!m.suspendedUntil || new Date(m.suspendedUntil) > new Date());

function requireStaffOrModerator(ctx) {
  if (ctx.kind === "staff" || (ctx.kind === "educator" && ctx.isModerator)) return;
  throw S.refuse(403, "Only Connect moderators can do this.");
}

function requireManager(ctx) {
  if (ctx.kind === "staff" && ctx.canManage) return;
  throw S.refuse(403, "Only admins and staff with Digifunzi Connect access can do this.");
}

function requireCreator(ctx) {
  if (ctx.canCreate) return;
  throw S.refuse(403, "Only admins, staff and educators allowed in Settings can create communities and challenges.");
}

module.exports = { connectContext, workspaceOfLearner, canModerate, requireMember, isSuspended, requireStaffOrModerator, requireManager, requireCreator };
