const { generateId, toJson, whereInChunks } = require("../../shared/utils/model.utils");
const R = require("./connect.rules");
const S = require("./connect.store");
const Notices = require("./connect.notifications");
const MemberService = require("./connect.members");
const Messages = require("./connect.messages");
const { requireMember, canModerate } = require("./connect.context");

const { db, refuse, now, parseJson } = S;

// Project collaboration spaces: learners' own projects, whoever they learned with. A project has a
// team (owner + members, each with a responsibility), invitations and join requests, milestones,
// updates with files, a team chat, and — when finished — a place in the community showcase.
// visibility: community (every member can see it and ask to join) | team (only the team and the
// moderators).

async function loadProject(ctx, projectId) {
  const project = await db("connect_projects").where({ id: projectId }).first();
  if (!project || project.ownerAdminId !== ctx.ownerAdminId || project.moderation === "deleted") throw refuse(404, "That project isn't there.");
  const team = await db("connect_project_members").where({ projectId: project.id });
  const mine = ctx.member ? team.find((t) => t.memberId === ctx.member.id) : null;
  const moderator = canModerate(ctx, null);
  const onTeam = mine?.status === "active";
  if (project.moderation === "removed" && !onTeam && !moderator) throw refuse(404, "That project isn't there.");
  if (project.visibility === "team" && !onTeam && !["invited", "requested"].includes(mine?.status) && !moderator && ctx.kind === "learner") throw refuse(404, "That project isn't there.");
  if (ctx.kind === "learner" && !onTeam) {
    const owner = team.find((t) => t.role === "owner");
    if (owner && (await S.isBlockedEitherWay(ctx.member.id, owner.memberId))) throw refuse(404, "That project isn't there.");
  }
  return { project, team, mine, onTeam, isOwner: onTeam && mine.role === "owner", moderator };
}

function summary(p, cover, extra = {}) {
  return {
    id: p.id, title: p.title, description: p.description || "", category: p.category, technologies: parseJson(p.technologies, []),
    status: p.status, visibility: p.visibility, lookingForMembers: !!p.lookingForMembers, showcased: !!p.showcased,
    demoLink: p.demoLink || null, cover: cover || null, moderation: p.moderation, createdAt: p.createdAt, updatedAt: p.updatedAt, ...extra,
  };
}

// view: mine | invites | showcase | open (looking for members) | all
async function list(ctx, { view = "all", q = "", category = "", page = 1 } = {}) {
  if (ctx.kind === "learner") requireMember(ctx);
  const meId = ctx.member?.id;
  let query = db("connect_projects").where({ ownerAdminId: ctx.ownerAdminId }).whereNot({ moderation: "deleted" });
  if (view === "mine" || view === "invites") {
    if (!meId) return { items: [], hasMore: false };
    const statuses = view === "mine" ? ["active", "requested"] : ["invited"];
    const ids = await db("connect_project_members").where({ memberId: meId }).whereIn("status", statuses).pluck("projectId");
    query = query.whereIn("id", ids.length ? ids : ["-"]);
  } else {
    query = query.where({ moderation: "visible", visibility: "community" });
    if (view === "showcase") query = query.where({ showcased: true });
    if (view === "open") query = query.where({ lookingForMembers: true }).whereNot({ status: "done" });
  }
  if (q.trim()) query = query.andWhere((w) => w.whereRaw("LOWER(title) LIKE ?", [`%${q.trim().toLowerCase()}%`]).orWhereRaw("LOWER(description) LIKE ?", [`%${q.trim().toLowerCase()}%`]));
  if (category && R.PROJECT_CATEGORY_KEYS.includes(category)) query = query.where({ category });
  const size = 18;
  const rows = await query.orderBy(view === "showcase" ? "showcasedAt" : "updatedAt", "desc").limit(size + 1).offset((page - 1) * size);
  const pageRows = rows.slice(0, size);
  const [covers, team] = await Promise.all([
    S.filesFor(pageRows.map((p) => p.coverFileId)),
    whereInChunks(db, "connect_project_members", "projectId", pageRows.map((p) => p.id)),
  ]);
  const hidden = ctx.kind === "learner" ? await S.hiddenFor(meId) : new Set();
  const cards = await S.memberCards(team.filter((t) => t.status === "active").map((t) => t.memberId));
  const items = pageRows
    .filter((p) => {
      const owner = team.find((t) => t.projectId === p.id && t.role === "owner");
      return !owner || !hidden.has(owner.memberId) || view === "mine";
    })
    .map((p) => {
      const mineRow = team.find((t) => t.projectId === p.id && t.memberId === meId);
      return summary(p, covers.get(p.coverFileId), {
        team: team.filter((t) => t.projectId === p.id && t.status === "active").map((t) => cards.get(t.memberId)).filter((c) => c && !c.gone),
        myStatus: mineRow?.status || null,
        myRole: mineRow?.role || null,
      });
    });
  return { items, hasMore: rows.length > size, page };
}

async function get(ctx, projectId) {
  if (ctx.kind === "learner") requireMember(ctx);
  const { project, team, mine, onTeam, isOwner, moderator } = await loadProject(ctx, projectId);
  const [milestones, updates, covers] = await Promise.all([
    db("connect_project_milestones").where({ projectId: project.id }).orderBy("position").orderBy("createdAt"),
    db("connect_project_updates").where({ projectId: project.id, status: "visible" }).orderBy("createdAt", "desc").limit(50),
    S.filesFor([project.coverFileId]),
  ]);
  const cards = await S.memberCards([...team.map((t) => t.memberId), ...updates.map((u) => u.authorMemberId)]);
  const files = await S.filesFor(updates.flatMap((u) => parseJson(u.fileIds, [])));
  const visibleTeam = team.filter((t) => t.status === "active" || ((onTeam || moderator) && ["invited", "requested"].includes(t.status)));
  const entries = await db("connect_challenge_entries as e").join("connect_challenges as c", "c.id", "e.challengeId").where({ "e.projectId": project.id }).whereNot("e.status", "withdrawn").select("c.id", "c.title", "e.status", "e.award");
  return summary(project, covers.get(project.coverFileId), {
    team: visibleTeam.map((t) => ({ member: cards.get(t.memberId), role: t.role, responsibility: t.responsibility || "", status: t.status, isMe: t.memberId === ctx.member?.id })).filter((t) => t.member && !t.member.gone),
    milestones: milestones.map((m) => ({ id: m.id, title: m.title, dueOn: m.dueOn ? String(m.dueOn instanceof Date ? m.dueOn.toISOString() : m.dueOn).slice(0, 10) : null, done: !!m.done, doneAt: m.doneAt })),
    updates: updates.map((u) => ({ id: u.id, author: cards.get(u.authorMemberId), body: u.body, link: u.link, files: parseJson(u.fileIds, []).map((id) => files.get(id)).filter(Boolean), createdAt: u.createdAt, mine: u.authorMemberId === ctx.member?.id })),
    files: updates.flatMap((u) => parseJson(u.fileIds, []).map((id) => files.get(id)).filter(Boolean)),
    challenges: entries,
    myStatus: mine?.status || null,
    myRole: mine?.role || null,
    onTeam, isOwner, canModerate: moderator,
    conversationId: onTeam ? project.conversationId : null,
    teamMax: R.PROJECT_TEAM_MAX,
  });
}

async function create(ctx, input) {
  const member = requireMember(ctx, { write: true });
  S.checkLearnerText(ctx, input.title, input.description);
  const day = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if ((await S.countSince("connect_projects", "createdByMemberId", member.id, day)) >= 5) throw refuse(429, "You've started a lot of projects today. Finish one first!");
  let demoLink = null;
  if (input.demoLink) {
    demoLink = R.allowedLink(input.demoLink, ctx.settings.linkDomains);
    if (!demoLink) throw refuse(400, "Demo links can go to learning sites like Scratch, GitHub or YouTube.");
  }
  const id = generateId();
  if (input.coverFileId) await S.claimFiles([input.coverFileId], { userId: ctx.userId, ownerAdminId: ctx.ownerAdminId, attachedType: "project", attachedId: id, max: 1 });
  const project = {
    id, ownerAdminId: ctx.ownerAdminId, title: input.title, description: input.description || null, category: input.category || "other",
    technologies: toJson(input.technologies || []), coverFileId: input.coverFileId || null, status: input.status || "idea",
    visibility: input.visibility || "community", lookingForMembers: !!input.lookingForMembers, demoLink, moderation: "visible",
    createdByMemberId: member.id, createdAt: now(), updatedAt: now(),
  };
  await db("connect_projects").insert(project);
  await db("connect_project_members").insert({ id: generateId(), projectId: id, memberId: member.id, role: "owner", status: "active", responsibility: "Project lead", createdAt: now(), updatedAt: now() });
  await Messages.syncProjectChat(project);
  return get(ctx, id);
}

async function update(ctx, projectId, input) {
  const { project, onTeam, moderator } = await loadProject(ctx, projectId);
  if (!onTeam) throw refuse(403, "Only the team can change this project.");
  requireMember(ctx, { write: true });
  if (project.moderation !== "visible") throw refuse(400, "A moderator took this project down.");
  S.checkLearnerText(ctx, input.title, input.description);
  const patch = { updatedAt: now() };
  for (const key of ["title", "description", "category", "status", "visibility", "lookingForMembers"]) if (input[key] !== undefined) patch[key] = input[key];
  if (input.technologies !== undefined) patch.technologies = toJson(input.technologies);
  if (input.demoLink !== undefined) {
    patch.demoLink = input.demoLink ? R.allowedLink(input.demoLink, ctx.settings.linkDomains) : null;
    if (input.demoLink && !patch.demoLink) throw refuse(400, "Demo links can go to learning sites like Scratch, GitHub or YouTube.");
  }
  if (input.coverFileId !== undefined) {
    if (input.coverFileId) await S.claimFiles([input.coverFileId], { userId: ctx.userId, ownerAdminId: ctx.ownerAdminId, attachedType: "project", attachedId: project.id, max: 1 });
    patch.coverFileId = input.coverFileId || null;
  }
  // Hidden from the community again → out of the showcase.
  if (patch.visibility === "team") patch.showcased = false;
  await db("connect_projects").where({ id: project.id }).update(patch);
  const updated = await db("connect_projects").where({ id: project.id }).first();
  if (patch.title) await Messages.syncProjectChat(updated);
  if (patch.status === "done") for (const t of await activeTeam(project.id)) MemberService.awardBadges(t.memberId).catch(() => {});
  void moderator;
  return get(ctx, project.id);
}

async function activeTeam(projectId) {
  return db("connect_project_members").where({ projectId, status: "active" });
}

// The owner deletes it: hidden everywhere and its chat closed (kept for safety records).
async function remove(ctx, projectId) {
  const { project, isOwner } = await loadProject(ctx, projectId);
  if (!isOwner) throw refuse(403, "Only the project's owner can delete it.");
  await db("connect_projects").where({ id: project.id }).update({ moderation: "deleted", showcased: false, updatedAt: now() });
  if (project.conversationId) await db("connect_conversations").where({ id: project.conversationId }).update({ status: "closed" });
  return { deleted: true };
}

async function invite(ctx, projectId, memberIds) {
  const { project, team, onTeam } = await loadProject(ctx, projectId);
  if (!onTeam) throw refuse(403, "Only the team can invite people.");
  const me = requireMember(ctx, { write: true });
  const results = [];
  for (const memberId of [...new Set(memberIds)]) {
    const other = await S.memberById(memberId);
    const name = other?.displayName || "Someone";
    if (!other || other.ownerAdminId !== ctx.ownerAdminId || other.status === "off") { results.push({ memberId, ok: false, reason: "Not on Connect" }); continue; }
    if (await S.isBlockedEitherWay(me.id, other.id)) { results.push({ memberId, name, ok: false, reason: "Can't be invited" }); continue; }
    const current = await db("connect_project_members").where({ projectId: project.id });
    if (current.filter((t) => ["active", "invited"].includes(t.status)).length >= R.PROJECT_TEAM_MAX) { results.push({ memberId, name, ok: false, reason: `Teams can have up to ${R.PROJECT_TEAM_MAX} people` }); continue; }
    const row = current.find((t) => t.memberId === other.id);
    if (row?.status === "active") { results.push({ memberId, name, ok: false, reason: "Already on the team" }); continue; }
    if (row?.status === "requested") {
      await db("connect_project_members").where({ id: row.id }).update({ status: "active", updatedAt: now() });
      await Notices.projectJoined(other, project);
    } else if (row) {
      await db("connect_project_members").where({ id: row.id }).update({ status: "invited", invitedByMemberId: me.id, updatedAt: now() });
      await Notices.projectInvite(other, project, me.displayName);
    } else {
      await db("connect_project_members").insert({ id: generateId(), projectId: project.id, memberId: other.id, role: "member", status: "invited", invitedByMemberId: me.id, createdAt: now(), updatedAt: now() });
      await Notices.projectInvite(other, project, me.displayName);
    }
    results.push({ memberId, name, ok: true });
  }
  void team;
  await afterTeamChange(project);
  return { results, project: await get(ctx, project.id) };
}

// The invited learner says yes or no.
async function respondInvite(ctx, projectId, accept) {
  const me = requireMember(ctx, { write: true });
  const { project, mine } = await loadProject(ctx, projectId);
  if (mine?.status !== "invited") throw refuse(400, "That invitation isn't waiting for you any more.");
  if (accept && (await activeTeam(project.id)).length >= R.PROJECT_TEAM_MAX) throw refuse(400, "The team is full.");
  await db("connect_project_members").where({ id: mine.id }).update({ status: accept ? "active" : "declined", updatedAt: now() });
  if (accept) {
    const owner = (await activeTeam(project.id)).find((t) => t.role === "owner");
    if (owner) await Notices.toMember(owner.memberId, { type: "connect_project_update", title: "New team member", message: `${me.displayName} joined "${project.title}".`, payload: { route: `/learner-portal/connect/projects/${project.id}?tab=team` } });
  }
  await afterTeamChange(project);
  return get(ctx, project.id);
}

// Asking to join a project the community can see.
async function requestJoin(ctx, projectId) {
  const me = requireMember(ctx, { write: true });
  const { project, mine } = await loadProject(ctx, projectId);
  if (project.visibility !== "community" || project.moderation !== "visible") throw refuse(400, "This project isn't open to new members.");
  if (mine?.status === "active") return get(ctx, project.id);
  if (mine?.status === "invited") return respondInvite(ctx, projectId, true);
  if (mine) await db("connect_project_members").where({ id: mine.id }).update({ status: "requested", updatedAt: now() });
  else await db("connect_project_members").insert({ id: generateId(), projectId: project.id, memberId: me.id, role: "member", status: "requested", createdAt: now(), updatedAt: now() });
  const owner = (await activeTeam(project.id)).find((t) => t.role === "owner");
  if (owner) await Notices.projectJoinRequest(owner.memberId, project, me.displayName);
  return get(ctx, project.id);
}

// The owner answers a request, changes someone's role, or takes them off the team; anyone leaves.
async function setMember(ctx, projectId, memberId, input) {
  const { project, mine, isOwner } = await loadProject(ctx, projectId);
  requireMember(ctx, { write: true });
  const row = await db("connect_project_members").where({ projectId: project.id, memberId }).first();
  if (!row) throw refuse(404, "They aren't on this project.");
  const self = memberId === ctx.member.id;
  if (input.action === "accept" || input.action === "decline") {
    if (!isOwner || row.status !== "requested") throw refuse(403, "Only the owner answers requests to join.");
    if (input.action === "accept" && (await activeTeam(project.id)).length >= R.PROJECT_TEAM_MAX) throw refuse(400, "The team is full.");
    await db("connect_project_members").where({ id: row.id }).update({ status: input.action === "accept" ? "active" : "declined", updatedAt: now() });
    if (input.action === "accept") await Notices.projectJoined(memberId, project);
  } else if (input.action === "edit") {
    if (!isOwner && !self) throw refuse(403, "Only the owner sets roles.");
    S.checkLearnerText(ctx, input.responsibility);
    const patch = { updatedAt: now() };
    if (input.responsibility !== undefined) patch.responsibility = input.responsibility || null;
    if (input.makeOwner && isOwner && !self && row.status === "active") {
      await db("connect_project_members").where({ id: mine.id }).update({ role: "member" });
      patch.role = "owner";
    }
    await db("connect_project_members").where({ id: row.id }).update(patch);
  } else if (input.action === "remove") {
    if (!isOwner && !self) throw refuse(403, "Only the owner can take someone off the team.");
    await db("connect_project_members").where({ id: row.id }).update({ status: "left", role: "member", updatedAt: now() });
    // The owner leaving hands the project to whoever joined first.
    if (row.role === "owner") {
      const next = (await activeTeam(project.id)).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
      if (next) await db("connect_project_members").where({ id: next.id }).update({ role: "owner" });
    }
  }
  await afterTeamChange(project);
  return get(ctx, project.id);
}

async function afterTeamChange(project) {
  const fresh = await db("connect_projects").where({ id: project.id }).first();
  await Messages.syncProjectChat(fresh);
  for (const t of await activeTeam(project.id)) MemberService.awardBadges(t.memberId).catch(() => {});
}

// ── Milestones and updates ───────────────────────────────────────────────────────────────────────
async function teamOnly(ctx, projectId) {
  const loaded = await loadProject(ctx, projectId);
  if (!loaded.onTeam) throw refuse(403, "Only the team can do this.");
  requireMember(ctx, { write: true });
  if (loaded.project.moderation !== "visible") throw refuse(400, "A moderator took this project down.");
  return loaded;
}

async function addMilestone(ctx, projectId, { title, dueOn }) {
  const { project } = await teamOnly(ctx, projectId);
  S.checkLearnerText(ctx, title);
  const count = await db("connect_project_milestones").where({ projectId: project.id }).count({ n: "*" }).first();
  if (Number(count?.n || 0) >= 30) throw refuse(400, "A project can have up to 30 milestones.");
  await db("connect_project_milestones").insert({ id: generateId(), projectId: project.id, title, dueOn: dueOn || null, done: false, position: Number(count?.n || 0), createdAt: now() });
  await db("connect_projects").where({ id: project.id }).update({ updatedAt: now() });
  return get(ctx, project.id);
}

async function editMilestone(ctx, projectId, milestoneId, input) {
  const { project } = await teamOnly(ctx, projectId);
  const m = await db("connect_project_milestones").where({ id: milestoneId, projectId: project.id }).first();
  if (!m) throw refuse(404, "That milestone isn't there.");
  S.checkLearnerText(ctx, input.title);
  const patch = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.dueOn !== undefined) patch.dueOn = input.dueOn || null;
  if (input.done !== undefined) { patch.done = input.done; patch.doneAt = input.done ? now() : null; }
  await db("connect_project_milestones").where({ id: m.id }).update(patch);
  await db("connect_projects").where({ id: project.id }).update({ updatedAt: now() });
  return get(ctx, project.id);
}

async function deleteMilestone(ctx, projectId, milestoneId) {
  const { project } = await teamOnly(ctx, projectId);
  await db("connect_project_milestones").where({ id: milestoneId, projectId: project.id }).del();
  return get(ctx, project.id);
}

async function addUpdate(ctx, projectId, { body, fileIds = [], link }) {
  const { project } = await teamOnly(ctx, projectId);
  S.checkLearnerText(ctx, body);
  let clean = null;
  if (link) {
    clean = R.allowedLink(link, ctx.settings.linkDomains);
    if (!clean) throw refuse(400, "Links can go to learning sites like Scratch, GitHub or YouTube.");
  }
  const id = generateId();
  await S.claimFiles(fileIds, { userId: ctx.userId, ownerAdminId: ctx.ownerAdminId, attachedType: "update", attachedId: id });
  await db("connect_project_updates").insert({ id, projectId: project.id, authorMemberId: ctx.member.id, body, fileIds: toJson(fileIds), link: clean, status: "visible", createdAt: now() });
  await db("connect_projects").where({ id: project.id }).update({ updatedAt: now() });
  const others = (await activeTeam(project.id)).filter((t) => t.memberId !== ctx.member.id).map((t) => ({ id: t.memberId }));
  Notices.projectUpdate(others, project, ctx.member.displayName).catch(() => {});
  return get(ctx, project.id);
}

async function deleteUpdate(ctx, projectId, updateId) {
  const { project, moderator } = await loadProject(ctx, projectId);
  const u = await db("connect_project_updates").where({ id: updateId, projectId: project.id }).first();
  if (!u) throw refuse(404, "That update isn't there.");
  if (u.authorMemberId !== ctx.member?.id && !moderator) throw refuse(403, "You can only remove your own updates.");
  await db("connect_project_updates").where({ id: u.id }).update({ status: "removed" });
  if (u.authorMemberId !== ctx.member?.id) {
    await Notices.contentRemoved(u.authorMemberId, "project update");
    await S.log(ctx.ownerAdminId, ctx, "update_removed", { targetType: "update", targetId: u.id, memberId: u.authorMemberId });
  }
  return get(ctx, project.id);
}

// ── The showcase ─────────────────────────────────────────────────────────────────────────────────
// A finished project the community can see: the team shows it off — it joins the showcase and a
// post goes on the feed (checked first, like any post, when Settings say so).
async function showcase(ctx, projectId, { body } = {}) {
  const { project, onTeam } = await loadProject(ctx, projectId);
  if (!onTeam) throw refuse(403, "Only the team can show this project off.");
  requireMember(ctx, { write: true });
  if (project.status !== "done") throw refuse(400, "Mark the project as done first.");
  if (project.visibility !== "community") throw refuse(400, "Let the community see the project first (Edit → Who can see it).");
  if (!project.showcased) await db("connect_projects").where({ id: project.id }).update({ showcased: true, showcasedAt: now(), updatedAt: now() });
  const Feed = require("./connect.feed");
  const post = await Feed.create(ctx, { body: body || `We finished "${project.title}"!`, category: "projects", projectId: project.id });
  for (const t of await activeTeam(project.id)) MemberService.awardBadges(t.memberId).catch(() => {});
  return { project: await get(ctx, project.id), post };
}

async function moderate(ctx, projectId, action, reason) {
  const { project, moderator } = await loadProject(ctx, projectId);
  if (!moderator) throw refuse(403, "Only moderators can do this.");
  const patch = { updatedAt: now() };
  if (action === "remove") Object.assign(patch, { moderation: "removed", showcased: false });
  if (action === "restore") patch.moderation = "visible";
  if (action === "unshowcase") patch.showcased = false;
  await db("connect_projects").where({ id: project.id }).update(patch);
  await Messages.syncProjectChat({ ...project, ...patch });
  if (action === "remove") for (const t of await activeTeam(project.id)) await Notices.contentRemoved(t.memberId, "project", reason);
  await S.log(ctx.ownerAdminId, ctx, `project_${action}`, { targetType: "project", targetId: project.id, note: reason });
  return get(ctx, project.id);
}

module.exports = { list, get, create, update, remove, invite, respondInvite, requestJoin, setMember, addMilestone, editMilestone, deleteMilestone, addUpdate, deleteUpdate, showcase, moderate, activeTeam };
