const db = require("../../config/db");
const { generateId, toJson, whereInChunks } = require("../../shared/utils/model.utils");
const { learnerAge } = require("../../shared/utils/age");
const R = require("./connect.rules");
const Files = require("./connect.files");

// Small shared pieces every part of Connect uses: the workspace's settings, how a learner or a
// staff member appears to others, blocks, file links and the moderation history.

const refuse = (status, message, extra = {}) => Object.assign(new Error(message), { statusCode: status, ...extra });
const now = () => new Date();
const parseJson = (v, fallback) => {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return fallback; }
  }
  return v;
};

// ── Settings ─────────────────────────────────────────────────────────────────────────────────────
const settingsCache = new Map();

async function settingsFor(ownerAdminId) {
  const hit = settingsCache.get(ownerAdminId);
  if (hit && hit.at > Date.now() - 30 * 1000) return hit.settings;
  const row = await db("connect_settings").where({ ownerAdminId }).first();
  const settings = R.mergeSettings(parseJson(row?.settings, {}));
  settingsCache.set(ownerAdminId, { settings, at: Date.now() });
  return settings;
}

async function saveSettings(ownerAdminId, input) {
  const settings = R.mergeSettings({ ...(await settingsFor(ownerAdminId)), ...input });
  const row = await db("connect_settings").where({ ownerAdminId }).first();
  if (row) await db("connect_settings").where({ id: row.id }).update({ settings: toJson(settings), updatedAt: now() });
  else await db("connect_settings").insert({ id: generateId(), ownerAdminId, settings: toJson(settings), createdAt: now(), updatedAt: now() });
  settingsCache.delete(ownerAdminId);
  return settings;
}

// ── Communities a workspace starts with ──────────────────────────────────────────────────────────
const seeded = new Set();
async function ensureDefaultCommunities(ownerAdminId) {
  if (!ownerAdminId || seeded.has(ownerAdminId)) return;
  const existing = await db("connect_communities").where({ ownerAdminId }).count({ n: "*" }).first();
  if (Number(existing?.n || 0) === 0) {
    for (const c of R.DEFAULT_COMMUNITIES) {
      try {
        await db("connect_communities").insert({
          id: generateId(), ownerAdminId, slug: c.slug, name: c.name, description: c.description, icon: c.icon, color: c.color,
          topics: toJson(c.topics), joinMode: "open", postingMode: "members", status: "active", createdByName: "Digifunzi", createdAt: now(), updatedAt: now(),
        });
      } catch (err) {
        if (err.code !== "ER_DUP_ENTRY") throw err; // another request made it at the same moment
      }
    }
  }
  seeded.add(ownerAdminId);
}

// ── Members ──────────────────────────────────────────────────────────────────────────────────────
const memberById = (id) => (id ? db("connect_members").where({ id }).first() : null);
const memberByLearner = (learnerId) => (learnerId ? db("connect_members").where({ learnerId }).first() : null);

function avatarOf(member, learner) {
  // The learner's own profile photo (their learner profile's picture) is their Connect picture;
  // without one, the avatar they drew.
  if (learner?.photo) return { photoUrl: learner.photo };
  const avatar = parseJson(member.avatar, null);
  return avatar && !avatar.photo ? avatar : R.defaultAvatar(member.learnerId);
}

// How learners appear to each other: a chosen name and avatar — never a surname, school, class,
// age or anything to find them by.
async function memberCards(memberIds) {
  const ids = [...new Set((memberIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const members = await whereInChunks(db, "connect_members", "id", ids);
  const learners = members.length ? await whereInChunks(db, "learners", "id", members.map((m) => m.learnerId)) : [];
  const learnerById = new Map(learners.map((l) => [l.id, l]));
  return new Map(members.map((m) => [m.id, card(m, learnerById.get(m.learnerId))]));
}

function card(member, learner) {
  if (!member) return { id: null, displayName: "Former member", avatar: { icon: "user", color: "#8C94A3" }, kind: "learner", gone: true };
  const gone = member.status === "off";
  return {
    id: member.id,
    displayName: gone ? "Former member" : member.displayName,
    avatar: gone ? { icon: "user", color: "#8C94A3" } : avatarOf(member, learner),
    kind: "learner",
    ...(gone ? { gone: true } : {}),
  };
}

// A staff author (an announcement, a moderator's comment): name and role, no contact details.
function staffCard(userId, name, role = "Digifunzi team") {
  return { id: null, userId, displayName: name || "Digifunzi team", avatar: { icon: "shield", color: "#25476a" }, kind: "staff", role };
}

async function ageOfMember(member) {
  if (!member) return null;
  const learner = await db("learners").where({ id: member.learnerId }).first("dateOfBirth", "statedAge", "statedAgeOn");
  return learnerAge(learner);
}

async function agesOfMembers(members) {
  const learners = await whereInChunks(db, "learners", "id", members.map((m) => m.learnerId));
  const byId = new Map(learners.map((l) => [l.id, learnerAge(l)]));
  return new Map(members.map((m) => [m.id, byId.get(m.learnerId) ?? null]));
}

// ── Blocks and mutes ─────────────────────────────────────────────────────────────────────────────
// Members whose posts and comments this member doesn't see: those they blocked or muted, and those
// who blocked them.
async function hiddenFor(memberId) {
  if (!memberId) return new Set();
  const [mine, theirs] = await Promise.all([
    db("connect_blocks").where({ memberId }).pluck("otherMemberId"),
    db("connect_blocks").where({ otherMemberId: memberId, kind: "block" }).pluck("memberId"),
  ]);
  return new Set([...mine, ...theirs]);
}

async function isBlockedEitherWay(a, b) {
  if (!a || !b) return false;
  const row = await db("connect_blocks")
    .where({ kind: "block" })
    .andWhere((q) => q.where({ memberId: a, otherMemberId: b }).orWhere({ memberId: b, otherMemberId: a }))
    .first("id");
  return !!row;
}

async function areConnected(a, b) {
  const row = await db("connect_connections").where({ pairKey: R.pairKey(a, b), status: "accepted" }).first("id");
  return !!row;
}

// Members of the workspace whose content no longer shows (their parent switched Connect off).
async function goneMemberIds(ownerAdminId) {
  return db("connect_members").where({ ownerAdminId, status: "off" }).pluck("id");
}

// ── Files ────────────────────────────────────────────────────────────────────────────────────────
// The files behind these ids, as the viewer gets them (with a signed link). Only call this once the
// viewer is known to be allowed to see what the files are on.
async function filesFor(fileIds) {
  const ids = [...new Set((fileIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await whereInChunks(db, "connect_files", "id", ids);
  return new Map(rows.map((f) => [f.id, fileView(f)]));
}

const fileView = (f) => ({ id: f.id, kind: f.kind, filename: f.filename, mimeType: f.mimeType, size: f.size, url: Files.signedUrl(f.id) });

// Files a person just uploaded, put on something. Only their own, not yet on anything else.
async function claimFiles(fileIds, { userId, ownerAdminId, attachedType, attachedId, max = 6 }) {
  const ids = [...new Set((fileIds || []).filter(Boolean))];
  if (!ids.length) return [];
  if (ids.length > max) throw refuse(400, `You can add up to ${max} files.`);
  const rows = await whereInChunks(db, "connect_files", "id", ids);
  const usable = rows.filter((f) => f.uploaderUserId === userId && f.ownerAdminId === ownerAdminId && (!f.attachedId || (f.attachedType === attachedType && f.attachedId === attachedId)));
  if (usable.length !== ids.length) throw refuse(400, "One of those files can't be used here. Upload it again.");
  await db("connect_files").whereIn("id", ids).update({ attachedType, attachedId });
  return ids;
}

// ── Moderation history ───────────────────────────────────────────────────────────────────────────
async function log(ownerAdminId, actor, action, { targetType = null, targetId = null, memberId = null, reportId = null, note = null } = {}) {
  await db("connect_moderation_log").insert({
    id: generateId(), ownerAdminId, actorUserId: actor?.userId || null, actorName: actor?.name || null, actorRole: actor?.roleLabel || null,
    action, targetType, targetId, memberId, reportId, note: note ? String(note).slice(0, 1000) : null, createdAt: now(),
  });
}

// ── Text checks for learners ─────────────────────────────────────────────────────────────────────
// Every field a learner writes goes through this; staff aren't filtered (an announcement may need a
// venue or a phone number), but they're never anonymous either.
function checkLearnerText(ctx, ...texts) {
  if (ctx.kind !== "learner") return;
  for (const text of texts) {
    const problem = R.checkText(text, ctx.settings);
    if (problem) throw refuse(422, problem.message, { code: "CONNECT_TEXT_REFUSED", reason: problem.kind });
  }
}

// How many things this member did since `since` (rate limits).
async function countSince(table, column, value, since) {
  const row = await db(table).where(column, value).andWhere("createdAt", ">=", since).count({ n: "*" }).first();
  return Number(row?.n || 0);
}

module.exports = {
  db, refuse, now, parseJson, settingsFor, saveSettings, ensureDefaultCommunities,
  memberById, memberByLearner, memberCards, card, staffCard, ageOfMember, agesOfMembers,
  hiddenFor, isBlockedEitherWay, areConnected, goneMemberIds, filesFor, fileView, claimFiles, log, checkLearnerText, countSince,
};
