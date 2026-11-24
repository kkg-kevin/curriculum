const { generateId, toJson, whereInChunks } = require("../../shared/utils/model.utils");
const { kenyaToday } = require("./connect.time");
const R = require("./connect.rules");
const S = require("./connect.store");
const Notices = require("./connect.notifications");
const MemberService = require("./connect.members");
const { requireMember, requireCreator } = require("./connect.context");

const { db, refuse, now, parseJson } = S;

// Challenges: coding, robotics, AI, design challenges and project showcases, made by admins, staff
// and (when Settings allow) moderator educators. Draft → open (announced to every member) → closed.
// Learners enter on their own or as a project team (the team is the project's), add their work and
// submit; whoever runs it gives awards and feedback. A challenge can point at one of the
// workspace's competitions (modules/competitions) — it doesn't register anyone for it.

const dateOnly = (d) => (d ? (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10) : null);

function view(c, extra = {}) {
  return {
    id: c.id, title: c.title, description: c.description || "", kind: c.kind, entryMode: c.entryMode,
    teamMin: c.teamMin, teamMax: c.teamMax, startsOn: dateOnly(c.startsOn), endsOn: dateOnly(c.endsOn),
    prizes: c.prizes || "", rules: c.rules || "", communityId: c.communityId, competitionId: c.competitionId,
    status: c.status, open: R.challengeOpen({ ...c, startsOn: dateOnly(c.startsOn), endsOn: dateOnly(c.endsOn) }, kenyaToday()),
    createdByName: c.createdByName, createdAt: c.createdAt, ...extra,
  };
}

async function loadChallenge(ctx, id) {
  const c = await db("connect_challenges").where({ id }).first();
  if (!c || c.ownerAdminId !== ctx.ownerAdminId) throw refuse(404, "That challenge isn't there.");
  if (c.status === "draft" && !ctx.canCreate && ctx.kind !== "staff") throw refuse(404, "That challenge isn't there.");
  return c;
}

async function myEntryOf(ctx, challengeId) {
  if (!ctx.member) return null;
  const json = JSON.stringify(ctx.member.id);
  return db("connect_challenge_entries").where({ challengeId }).whereNot({ status: "withdrawn" })
    .andWhere((q) => q.where({ memberId: ctx.member.id }).orWhereRaw("JSON_CONTAINS(memberIds, ?)", [json])).first();
}

async function list(ctx, { view: which = "current" } = {}) {
  if (ctx.kind === "learner") requireMember(ctx);
  let q = db("connect_challenges").where({ ownerAdminId: ctx.ownerAdminId });
  if (ctx.kind === "learner" || which !== "manage") q = q.whereNot({ status: "draft" });
  const rows = await q.orderByRaw("status = 'open' DESC").orderBy("createdAt", "desc").limit(100);
  const counts = rows.length ? await db("connect_challenge_entries").whereIn("challengeId", rows.map((r) => r.id)).whereNot({ status: "withdrawn" }).groupBy("challengeId").select("challengeId").count({ n: "*" }) : [];
  const countBy = new Map(counts.map((r) => [r.challengeId, Number(r.n)]));
  const out = [];
  for (const c of rows) {
    const mine = await myEntryOf(ctx, c.id);
    out.push(view(c, { entries: countBy.get(c.id) || 0, myEntry: mine ? { id: mine.id, status: mine.status, award: mine.award } : null }));
  }
  if (which === "past") return out.filter((c) => c.status === "closed");
  if (which === "current") return out.filter((c) => c.status === "open");
  return out;
}

async function entryViews(ctx, entries) {
  const memberIds = entries.flatMap((e) => [e.memberId, ...parseJson(e.memberIds, [])]).filter(Boolean);
  const cards = await S.memberCards(memberIds);
  const projects = await whereInChunks(db, "connect_projects", "id", entries.map((e) => e.projectId).filter(Boolean));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const files = await S.filesFor(entries.flatMap((e) => parseJson(e.fileIds, [])));
  return entries.map((e) => ({
    id: e.id,
    mode: e.projectId ? "team" : "individual",
    project: e.projectId ? { id: e.projectId, title: projectById.get(e.projectId)?.title || "Project" } : null,
    people: [...new Set([e.memberId, ...parseJson(e.memberIds, [])].filter(Boolean))].map((id) => cards.get(id)).filter((c) => c && !c.gone),
    title: e.title || "", description: e.description || "", link: e.link || null,
    files: parseJson(e.fileIds, []).map((id) => files.get(id)).filter(Boolean),
    status: e.status, award: e.award, feedback: e.feedback || "", submittedAt: e.submittedAt,
  }));
}

async function get(ctx, id) {
  if (ctx.kind === "learner") requireMember(ctx);
  const c = await loadChallenge(ctx, id);
  const manage = ctx.kind !== "learner" && ctx.canCreate;
  const mine = await myEntryOf(ctx, c.id);
  // Learners see submitted entries (the gallery); whoever runs it sees every entry.
  const entries = await db("connect_challenge_entries").where({ challengeId: c.id }).whereNot({ status: "withdrawn" }).modify((q) => { if (!manage) q.where({ status: "submitted" }); }).orderBy("submittedAt", "desc");
  const [competition, myProjects] = await Promise.all([
    c.competitionId ? db("competitions").where({ id: c.competitionId }).first("id", "name").catch(() => null) : null,
    ctx.member ? db("connect_project_members as pm").join("connect_projects as p", "p.id", "pm.projectId").where({ "pm.memberId": ctx.member.id, "pm.status": "active", "p.moderation": "visible" }).select("p.id", "p.title") : [],
  ]);
  return view(c, {
    entries: await entryViews(ctx, entries),
    myEntry: mine ? (await entryViews(ctx, [mine]))[0] : null,
    myProjects,
    competition: competition ? { id: competition.id, name: competition.name } : null,
    canManage: manage,
  });
}

async function create(ctx, input) {
  requireCreator(ctx);
  const row = { id: generateId(), ownerAdminId: ctx.ownerAdminId, ...clean(input), status: "draft", createdByUserId: ctx.userId, createdByName: ctx.name, createdAt: now(), updatedAt: now() };
  await db("connect_challenges").insert(row);
  await S.log(ctx.ownerAdminId, ctx, "challenge_created", { targetType: "challenge", targetId: row.id, note: row.title });
  return get(ctx, row.id);
}

function clean(input) {
  const out = {};
  for (const key of ["title", "description", "kind", "entryMode", "teamMin", "teamMax", "startsOn", "endsOn", "prizes", "rules", "communityId", "competitionId"]) {
    if (input[key] !== undefined) out[key] = input[key] === "" ? null : input[key];
  }
  if (out.teamMin && out.teamMax && out.teamMin > out.teamMax) throw refuse(400, "The smallest team can't be bigger than the biggest.");
  if (out.startsOn && out.endsOn && out.startsOn > out.endsOn) throw refuse(400, "The end date is before the start date.");
  return out;
}

async function update(ctx, id, input) {
  requireCreator(ctx);
  const c = await loadChallenge(ctx, id);
  await db("connect_challenges").where({ id: c.id }).update({ ...clean(input), updatedAt: now() });
  return get(ctx, c.id);
}

// Draft → open: announced once to every member of the workspace (or of its community).
async function publish(ctx, id) {
  requireCreator(ctx);
  const c = await loadChallenge(ctx, id);
  await db("connect_challenges").where({ id: c.id }).update({ status: "open", announcedAt: c.announcedAt || now(), updatedAt: now() });
  if (!c.announcedAt) {
    const members = c.communityId
      ? await db("connect_members as m").join("connect_community_members as cm", "cm.memberId", "m.id").where({ "cm.communityId": c.communityId, "cm.status": "active" }).whereNot("m.status", "off").select("m.*")
      : await db("connect_members").where({ ownerAdminId: ctx.ownerAdminId }).whereNot({ status: "off" });
    Notices.challengeAnnounced(members, c).catch(() => {});
  }
  await S.log(ctx.ownerAdminId, ctx, "challenge_opened", { targetType: "challenge", targetId: c.id, note: c.title });
  return get(ctx, c.id);
}

async function close(ctx, id) {
  requireCreator(ctx);
  const c = await loadChallenge(ctx, id);
  await db("connect_challenges").where({ id: c.id }).update({ status: "closed", updatedAt: now() });
  await S.log(ctx.ownerAdminId, ctx, "challenge_closed", { targetType: "challenge", targetId: c.id, note: c.title });
  return get(ctx, c.id);
}

async function remove(ctx, id) {
  requireCreator(ctx);
  const c = await loadChallenge(ctx, id);
  const entries = await db("connect_challenge_entries").where({ challengeId: c.id }).count({ n: "*" }).first();
  if (Number(entries?.n || 0) > 0) throw refuse(409, "Learners have entered this challenge — close it instead of deleting it.");
  await db("connect_challenges").where({ id: c.id }).del();
  await S.log(ctx.ownerAdminId, ctx, "challenge_deleted", { targetType: "challenge", targetId: c.id, note: c.title });
  return { deleted: true };
}

// ── Taking part ──────────────────────────────────────────────────────────────────────────────────
async function enter(ctx, id, { mode, projectId }) {
  const me = requireMember(ctx, { write: true });
  const c = await loadChallenge(ctx, id);
  if (!R.challengeOpen({ ...c, startsOn: dateOnly(c.startsOn), endsOn: dateOnly(c.endsOn) }, kenyaToday())) throw refuse(400, "This challenge isn't taking entries right now.");
  if (await myEntryOf(ctx, c.id)) throw refuse(400, "You're already taking part in this challenge.");
  let team = [me.id];
  let entryKey = `member:${me.id}`;
  if (mode === "team") {
    const membership = projectId && (await db("connect_project_members").where({ projectId, memberId: me.id, status: "active" }).first());
    const project = membership && (await db("connect_projects").where({ id: projectId, ownerAdminId: ctx.ownerAdminId, moderation: "visible" }).first());
    if (!project) throw refuse(400, "Choose one of your project teams.");
    team = (await db("connect_project_members").where({ projectId, status: "active" })).map((t) => t.memberId);
    entryKey = `project:${projectId}`;
  }
  const problem = R.entryProblem({ challenge: c, mode, teamSize: team.length });
  if (problem) throw refuse(400, problem);
  try {
    await db("connect_challenge_entries").insert({
      id: generateId(), challengeId: c.id, entryKey, memberId: mode === "individual" ? me.id : null, projectId: mode === "team" ? projectId : null,
      enteredByMemberId: me.id, memberIds: toJson(team), status: "joined", createdAt: now(), updatedAt: now(),
    });
  } catch (err) {
    if (err.code !== "ER_DUP_ENTRY") throw err;
    throw refuse(400, mode === "team" ? "Your team has already entered." : "You've already entered.");
  }
  for (const m of team) MemberService.awardBadges(m).catch(() => {});
  return get(ctx, c.id);
}

async function saveEntry(ctx, id, entryId, input) {
  const me = requireMember(ctx, { write: true });
  const c = await loadChallenge(ctx, id);
  const entry = await db("connect_challenge_entries").where({ id: entryId, challengeId: c.id }).first();
  const team = entry ? parseJson(entry.memberIds, []) : [];
  const onIt = entry && (entry.memberId === me.id || team.includes(me.id) || (entry.projectId && (await db("connect_project_members").where({ projectId: entry.projectId, memberId: me.id, status: "active" }).first("id"))));
  if (!onIt) throw refuse(404, "That entry isn't yours.");
  if (entry.status === "withdrawn") throw refuse(400, "This entry was withdrawn.");
  const open = R.challengeOpen({ ...c, startsOn: dateOnly(c.startsOn), endsOn: dateOnly(c.endsOn) }, kenyaToday());
  if (!open) throw refuse(400, "This challenge has closed — entries can't be changed now.");
  S.checkLearnerText(ctx, input.title, input.description);
  const patch = { updatedAt: now() };
  if (input.title !== undefined) patch.title = input.title || null;
  if (input.description !== undefined) patch.description = input.description || null;
  if (input.link !== undefined) {
    patch.link = input.link ? R.allowedLink(input.link, ctx.settings.linkDomains) : null;
    if (input.link && !patch.link) throw refuse(400, "Links can go to learning sites like Scratch, GitHub or YouTube.");
  }
  if (input.fileIds !== undefined) {
    await S.claimFiles(input.fileIds, { userId: ctx.userId, ownerAdminId: ctx.ownerAdminId, attachedType: "entry", attachedId: entry.id });
    patch.fileIds = toJson(input.fileIds);
  }
  if (input.submit) {
    const title = patch.title !== undefined ? patch.title : entry.title;
    if (!title) throw refuse(400, "Give your entry a title before you submit it.");
    patch.status = "submitted";
    patch.submittedAt = now();
    if (entry.projectId) patch.memberIds = toJson((await db("connect_project_members").where({ projectId: entry.projectId, status: "active" })).map((t) => t.memberId));
  }
  await db("connect_challenge_entries").where({ id: entry.id }).update(patch);
  return get(ctx, c.id);
}

async function withdraw(ctx, id, entryId) {
  const me = requireMember(ctx, { write: true });
  const entry = await db("connect_challenge_entries").where({ id: entryId, challengeId: id }).first();
  if (!entry || (entry.enteredByMemberId !== me.id && entry.memberId !== me.id)) throw refuse(403, "Only whoever entered can withdraw the entry.");
  if (entry.award) throw refuse(400, "This entry already has an award.");
  await db("connect_challenge_entries").where({ id: entry.id }).delete();
  return get(ctx, id);
}

async function award(ctx, id, entryId, { award: value, feedback }) {
  requireCreator(ctx);
  const c = await loadChallenge(ctx, id);
  const entry = await db("connect_challenge_entries").where({ id: entryId, challengeId: c.id }).first();
  if (!entry) throw refuse(404, "That entry isn't there.");
  await db("connect_challenge_entries").where({ id: entry.id }).update({ award: value, feedback: feedback || null, updatedAt: now() });
  const team = [...new Set([entry.memberId, ...parseJson(entry.memberIds, [])].filter(Boolean))];
  if (value) {
    await Notices.challengeAward(team.map((m) => ({ id: m })), c, value);
    for (const m of team) MemberService.awardBadges(m).catch(() => {});
  }
  await S.log(ctx.ownerAdminId, ctx, "challenge_award", { targetType: "entry", targetId: entry.id, note: value || "cleared" });
  return get(ctx, c.id);
}

// For the challenge form: the workspace's competitions to point at.
async function competitionOptions(ctx) {
  return db("competitions").where({ ownerAdminId: ctx.ownerAdminId }).orderBy("createdAt", "desc").limit(50).select("id", "name").catch(() => []);
}

module.exports = { list, get, create, update, publish, close, remove, enter, saveEntry, withdraw, award, competitionOptions };
