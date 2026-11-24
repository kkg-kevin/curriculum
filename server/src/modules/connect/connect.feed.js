const { generateId, toJson, whereInChunks } = require("../../shared/utils/model.utils");
const { slugify } = require("../../shared/utils/slugify");
const R = require("./connect.rules");
const S = require("./connect.store");
const Files = require("./connect.files");
const Notices = require("./connect.notifications");
const MemberService = require("./connect.members");
const { requireMember, canModerate, requireCreator, requireManager } = require("./connect.context");

const { db, refuse, now, parseJson } = S;

// The community feed and the interest communities: posts, comments (one level of replies),
// reactions, sharing — and joining, leaving and running communities.

const PAGE = 15;

// ── Who may see what ─────────────────────────────────────────────────────────────────────────────
async function communityAccess(ctx, community) {
  if (!community || community.ownerAdminId !== ctx.ownerAdminId) return { see: false };
  const moderator = canModerate(ctx, community.id);
  if (ctx.kind !== "learner") return { see: true, moderator, member: false, post: moderator || ctx.kind === "staff" };
  const row = ctx.member ? await db("connect_community_members").where({ communityId: community.id, memberId: ctx.member.id }).first() : null;
  const member = row?.status === "active";
  const see = community.joinMode === "open" || member;
  const post = member && community.status === "active" && community.postingMode === "members";
  return { see, moderator: false, member, myStatus: row?.status || null, post };
}

async function loadPostFor(ctx, postId, { forWrite = false } = {}) {
  const post = await db("connect_posts").where({ id: postId }).first();
  if (!post || post.ownerAdminId !== ctx.ownerAdminId || post.status === "deleted") throw refuse(404, "That post isn't there any more.");
  const mine = ctx.kind === "learner" ? post.authorMemberId === ctx.member?.id : post.authorUserId === ctx.userId;
  const moderator = canModerate(ctx, post.communityId);
  if (post.status !== "visible" && !mine && !moderator) throw refuse(404, "That post isn't there any more.");
  if (post.communityId) {
    const community = await db("connect_communities").where({ id: post.communityId }).first();
    const access = await communityAccess(ctx, community);
    if (!access.see && !mine) throw refuse(403, "Join this community to see its posts.");
  }
  if (ctx.kind === "learner" && !mine) {
    const hidden = await S.hiddenFor(ctx.member.id);
    if (post.authorMemberId && hidden.has(post.authorMemberId) && !forWrite) throw refuse(404, "That post isn't there any more.");
    if (forWrite && post.authorMemberId && (await S.isBlockedEitherWay(ctx.member.id, post.authorMemberId))) throw refuse(403, "You can't reply to this person.");
  }
  return { post, mine, moderator };
}

// ── Turning rows into what the page shows ────────────────────────────────────────────────────────
async function serialisePosts(ctx, posts) {
  if (!posts.length) return [];
  const sharedIds = posts.map((p) => p.sharedPostId).filter(Boolean);
  const shared = sharedIds.length ? await whereInChunks(db, "connect_posts", "id", sharedIds) : [];
  const sharedById = new Map(shared.map((p) => [p.id, p]));
  const all = [...posts, ...shared];
  const [cards, files, communities, projects, myReactions] = await Promise.all([
    S.memberCards(all.map((p) => p.authorMemberId)),
    S.filesFor(all.flatMap((p) => parseJson(p.fileIds, []))),
    whereInChunks(db, "connect_communities", "id", all.map((p) => p.communityId).filter(Boolean)),
    whereInChunks(db, "connect_projects", "id", all.map((p) => p.projectId).filter(Boolean)),
    whereInChunks(db, "connect_reactions", "postId", posts.map((p) => p.id)).then((rows) => rows.filter((r) => r.userId === ctx.userId)),
  ]);
  const covers = await S.filesFor(projects.map((p) => p.coverFileId));
  const communityById = new Map(communities.map((c) => [c.id, { id: c.id, name: c.name, slug: c.slug, color: c.color, icon: c.icon }]));
  const projectById = new Map(projects.filter((p) => p.moderation === "visible").map((p) => [p.id, { id: p.id, title: p.title, category: p.category, status: p.status, cover: covers.get(p.coverFileId) || null }]));
  const reactionByPost = new Map(myReactions.map((r) => [r.postId, r.kind]));
  const author = (p) => (p.authorKind === "staff" ? S.staffCard(p.authorUserId, p.authorName) : cards.get(p.authorMemberId) || S.card(null));
  const base = (p) => ({
    id: p.id,
    author: author(p),
    category: p.category,
    body: p.body || "",
    files: parseJson(p.fileIds, []).map((id) => files.get(id)).filter(Boolean),
    link: p.link || null,
    community: p.communityId ? communityById.get(p.communityId) || null : null,
    project: p.projectId ? projectById.get(p.projectId) || null : null,
    achievement: parseJson(p.achievement, null),
    createdAt: p.createdAt,
    editedAt: p.editedAt,
  });
  return posts.map((p) => {
    const mine = ctx.kind === "learner" ? p.authorMemberId === ctx.member?.id : p.authorUserId === ctx.userId;
    const moderator = canModerate(ctx, p.communityId);
    const s = p.sharedPostId ? sharedById.get(p.sharedPostId) : null;
    return {
      ...base(p),
      sharedPost: s ? (s.status === "visible" ? base(s) : { id: s.id, unavailable: true }) : null,
      status: p.status,
      reviewReason: p.status === "pending" && (mine || moderator) ? p.reviewReason : null,
      removedReason: p.status === "removed" && (mine || moderator) ? p.removedReason : null,
      pinned: !!p.pinned,
      reactionCount: p.reactionCount,
      commentCount: p.commentCount,
      shareCount: p.shareCount,
      myReaction: reactionByPost.get(p.id) || null,
      mine,
      canEdit: mine && p.status !== "removed",
      canDelete: mine,
      canModerate: moderator,
    };
  });
}

// ── The feed ─────────────────────────────────────────────────────────────────────────────────────
// scope: feed (the main feed + my communities) | community | member | mine.
async function list(ctx, { scope = "feed", communityId, memberId, category, sort = "new", cursor, page = 1 } = {}) {
  if (ctx.kind === "learner") requireMember(ctx);
  let q = db("connect_posts").where({ ownerAdminId: ctx.ownerAdminId }).whereNot({ status: "deleted" });
  const meId = ctx.member?.id;
  let community = null;
  if (scope === "community") {
    community = await db("connect_communities").where({ id: communityId }).first();
    const access = await communityAccess(ctx, community);
    if (!access.see) throw refuse(403, "Join this community to see its posts.");
    q = q.where({ communityId });
  } else if (scope === "member") {
    q = q.where({ authorMemberId: memberId });
    const openCommunities = db("connect_communities").where({ ownerAdminId: ctx.ownerAdminId, joinMode: "open" }).select("id");
    q = q.andWhere((w) => w.whereNull("communityId").orWhereIn("communityId", openCommunities));
  } else if (scope === "mine") {
    if (!meId) return { items: [], nextCursor: null };
    q = q.where({ authorMemberId: meId });
  } else if (ctx.kind === "learner") {
    const mine = db("connect_community_members").where({ memberId: meId, status: "active" }).select("communityId");
    q = q.andWhere((w) => w.whereNull("communityId").orWhereIn("communityId", mine));
  } else if (ctx.kind === "educator" && !ctx.canModerateAll) {
    // A community's moderator looks through their own communities only.
    q = q.whereIn("communityId", ctx.moderatedCommunityIds.size ? [...ctx.moderatedCommunityIds] : ["-"]);
  }
  // What shows: visible posts; my own waiting or taken-down ones; moderators see waiting ones too.
  q = q.andWhere((w) => {
    w.where({ status: "visible" });
    if (meId) w.orWhere((x) => x.where({ authorMemberId: meId }).whereIn("status", ["pending", "removed"]));
    if (ctx.kind !== "learner") w.orWhere((x) => x.where({ authorUserId: ctx.userId }).whereIn("status", ["pending", "removed"]));
  });
  if (category && R.CATEGORY_KEYS.includes(category)) q = q.where({ category });
  const gone = await S.goneMemberIds(ctx.ownerAdminId);
  const hidden = ctx.kind === "learner" ? [...(await S.hiddenFor(meId))] : [];
  const skip = [...gone, ...hidden];
  if (skip.length) q = q.andWhere((w) => w.whereNull("authorMemberId").orWhereNotIn("authorMemberId", skip));

  let rows;
  let nextCursor = null;
  let hasMore = false;
  if (sort === "top") {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    rows = await q.andWhere("createdAt", ">=", since).orderByRaw("(reactionCount + 2 * commentCount + 3 * shareCount) DESC").orderBy("createdAt", "desc").limit(PAGE + 1).offset((page - 1) * PAGE);
    hasMore = rows.length > PAGE;
    rows = rows.slice(0, PAGE);
  } else {
    const c = R.decodeCursor(cursor);
    if (c) q = q.andWhere((w) => w.where("createdAt", "<", c.createdAt).orWhere((x) => x.where("createdAt", "=", c.createdAt).andWhere("id", "<", c.id)));
    rows = await q.orderBy([{ column: "createdAt", order: "desc" }, { column: "id", order: "desc" }]).limit(PAGE + 1);
    hasMore = rows.length > PAGE;
    rows = rows.slice(0, PAGE);
    if (hasMore) nextCursor = R.encodeCursor(rows[rows.length - 1]);
  }
  // Pinned posts (announcements) on top of the first page of the feed or a community.
  let pinned = [];
  if (!cursor && page === 1 && (scope === "feed" || scope === "community")) {
    pinned = await db("connect_posts").where({ ownerAdminId: ctx.ownerAdminId, status: "visible", pinned: true, communityId: scope === "community" ? communityId : null }).orderBy("createdAt", "desc").limit(3);
    const pinnedIds = new Set(pinned.map((p) => p.id));
    rows = rows.filter((r) => !pinnedIds.has(r.id));
  }
  return { pinned: await serialisePosts(ctx, pinned), items: await serialisePosts(ctx, rows), nextCursor, hasMore, page };
}

async function get(ctx, postId) {
  if (ctx.kind === "learner") requireMember(ctx);
  const { post } = await loadPostFor(ctx, postId);
  const [view] = await serialisePosts(ctx, [post]);
  return { ...view, comments: await commentsOf(ctx, post) };
}

// ── Writing posts ────────────────────────────────────────────────────────────────────────────────
async function create(ctx, input) {
  const body = String(input.body || "").trim();
  let category = input.category || "general";
  let community = null;
  if (input.communityId) {
    community = await db("connect_communities").where({ id: input.communityId }).first();
    if (!community || community.ownerAdminId !== ctx.ownerAdminId) throw refuse(404, "That community isn't there.");
    if (community.status !== "active") throw refuse(400, "This community is closed for new posts.");
  }

  if (ctx.kind === "learner") {
    const member = requireMember(ctx, { write: true });
    if (!R.LEARNER_CATEGORY_KEYS.includes(category)) category = "general";
    if (community) {
      const access = await communityAccess(ctx, community);
      if (!access.member) throw refuse(403, `Join ${community.name} to post there.`);
      if (!access.post) throw refuse(403, `Only the moderators post in ${community.name}.`);
    }
    S.checkLearnerText(ctx, body);
    const hour = new Date(Date.now() - 60 * 60 * 1000);
    if ((await S.countSince("connect_posts", "authorMemberId", member.id, hour)) >= ctx.settings.postsPerHour) throw refuse(429, "You've posted a lot in the last hour. Take a break and post again later.");
  } else {
    if (!canModerate(ctx, community?.id || null) && !(ctx.kind === "staff" && ctx.canManage)) throw refuse(403, "Only moderators post here.");
  }

  let link = null;
  if (input.link) {
    link = R.allowedLink(input.link, ctx.settings.linkDomains);
    if (!link) throw refuse(400, "Links are only allowed to learning sites like Scratch, GitHub or YouTube.");
  }
  let projectId = null;
  if (input.projectId) {
    const project = await db("connect_projects").where({ id: input.projectId }).first();
    const onTeam = ctx.member && (await db("connect_project_members").where({ projectId: input.projectId, memberId: ctx.member.id, status: "active" }).first("id"));
    if (!project || project.ownerAdminId !== ctx.ownerAdminId || project.moderation !== "visible" || project.visibility !== "community" || (ctx.kind === "learner" && !onTeam)) {
      throw refuse(400, "You can share projects you're on that the community can see.");
    }
    projectId = project.id;
    if (category === "general") category = "projects";
  }
  let achievement = null;
  if (input.achievement) {
    if (ctx.kind !== "learner") throw refuse(400, "Only learners share their achievements.");
    const mine = await MemberService.achievements(ctx);
    const found = mine.find((a) => a.kind === input.achievement.kind && a.id === input.achievement.id);
    if (!found) throw refuse(400, "That achievement isn't yours to share.");
    achievement = { kind: found.kind, label: found.label, detail: found.detail };
    if (category === "general") category = "achievements";
  }
  const fileIds = input.fileIds || [];
  if (!body && !fileIds.length && !projectId && !achievement) throw refuse(400, "Write something or add a picture first.");

  const id = generateId();
  const status = ctx.kind === "learner" && R.reviewReason({ settings: ctx.settings, postsSent: ctx.member.postsSent, hasFiles: fileIds.length > 0 }) ? "pending" : "visible";
  await S.claimFiles(fileIds, { userId: ctx.userId, ownerAdminId: ctx.ownerAdminId, attachedType: "post", attachedId: id });
  const row = {
    id, ownerAdminId: ctx.ownerAdminId, communityId: community?.id || null,
    authorMemberId: ctx.kind === "learner" ? ctx.member.id : null, authorUserId: ctx.userId,
    authorKind: ctx.kind === "learner" ? "learner" : "staff", authorName: ctx.kind === "learner" ? null : ctx.name,
    category, body: body || null, fileIds: toJson(fileIds), link, projectId, achievement: toJson(achievement),
    status, reviewReason: status === "pending" ? R.reviewReason({ settings: ctx.settings, postsSent: ctx.member.postsSent, hasFiles: fileIds.length > 0 }) : null,
    pinned: ctx.kind !== "learner" && category === "announcement",
    sharedPostId: input.sharedPostId || null,
    createdAt: now(), updatedAt: now(),
  };
  await db("connect_posts").insert(row);
  if (ctx.kind === "learner") await db("connect_members").where({ id: ctx.member.id }).increment("postsSent", 1);
  if (community) await recountCommunity(community.id);
  if (status === "pending") Notices.waitingReview(ctx.ownerAdminId, ctx.settings, community?.id || null).catch(() => {});
  if (status === "visible" && ctx.kind === "learner") MemberService.awardBadges(ctx.member.id).catch(() => {});
  if (row.category === "announcement") announce(ctx, row, community).catch(() => {});
  const [view] = await serialisePosts(ctx, [row]);
  return view;
}

// An announcement goes to every member of the community, or of the workspace for the main feed.
async function announce(ctx, post, community) {
  const members = community
    ? await db("connect_members as m").join("connect_community_members as cm", "cm.memberId", "m.id").where({ "cm.communityId": community.id, "cm.status": "active" }).whereNot("m.status", "off").select("m.*")
    : await db("connect_members").where({ ownerAdminId: ctx.ownerAdminId }).whereNot({ status: "off" });
  await Notices.announcement(members, post, community?.name || null);
}

async function update(ctx, postId, input) {
  const { post, mine } = await loadPostFor(ctx, postId);
  if (!mine) throw refuse(403, "You can only change your own posts.");
  if (post.status === "removed") throw refuse(400, "A moderator took this post down, so it can't be changed.");
  if (ctx.kind === "learner") requireMember(ctx, { write: true });
  const patch = { editedAt: now(), updatedAt: now() };
  if (input.body !== undefined) {
    S.checkLearnerText(ctx, input.body);
    patch.body = input.body || null;
  }
  if (input.category !== undefined) {
    if (ctx.kind === "learner" && !R.LEARNER_CATEGORY_KEYS.includes(input.category)) throw refuse(400, "Pick a category.");
    patch.category = input.category;
  }
  if (input.link !== undefined) {
    patch.link = input.link ? R.allowedLink(input.link, ctx.settings.linkDomains) : null;
    if (input.link && !patch.link) throw refuse(400, "Links are only allowed to learning sites like Scratch, GitHub or YouTube.");
  }
  await db("connect_posts").where({ id: post.id }).update(patch);
  return get(ctx, post.id);
}

// The author deleting: gone for good — unless it has been reported, when it's kept (hidden) for the
// moderators to look at.
async function remove(ctx, postId) {
  const { post, mine } = await loadPostFor(ctx, postId);
  if (!mine) throw refuse(403, "You can only delete your own posts.");
  const reported = await db("connect_reports").where({ targetType: "post", targetId: post.id, status: "open" }).first("id");
  if (reported) {
    await db("connect_posts").where({ id: post.id }).update({ status: "deleted", updatedAt: now() });
  } else {
    const files = await whereInChunks(db, "connect_files", "id", parseJson(post.fileIds, []));
    for (const f of files) Files.removeStored(f.storedName);
    if (files.length) await db("connect_files").whereIn("id", files.map((f) => f.id)).del();
    await db("connect_comments").where({ postId: post.id }).del();
    await db("connect_reactions").where({ postId: post.id }).del();
    await db("connect_posts").where({ id: post.id }).del();
  }
  if (post.communityId) await recountCommunity(post.communityId);
  return { deleted: true };
}

async function moderateRemove(ctx, postId, reason) {
  const { post, moderator } = await loadPostFor(ctx, postId);
  if (!moderator) throw refuse(403, "Only moderators can take posts down.");
  await db("connect_posts").where({ id: post.id }).update({ status: "removed", removedReason: reason || null, pinned: false, updatedAt: now() });
  if (post.authorMemberId) await Notices.contentRemoved(post.authorMemberId, "post", reason);
  await S.log(ctx.ownerAdminId, ctx, "post_removed", { targetType: "post", targetId: post.id, memberId: post.authorMemberId, note: reason });
  if (post.communityId) await recountCommunity(post.communityId);
  return { removed: true };
}

async function setPinned(ctx, postId, pinned) {
  const { post, moderator } = await loadPostFor(ctx, postId);
  if (!moderator) throw refuse(403, "Only moderators can pin posts.");
  if (post.status !== "visible") throw refuse(400, "Only posts that are up can be pinned.");
  await db("connect_posts").where({ id: post.id }).update({ pinned, updatedAt: now() });
  await S.log(ctx.ownerAdminId, ctx, pinned ? "post_pinned" : "post_unpinned", { targetType: "post", targetId: post.id });
  return { pinned };
}

async function share(ctx, postId, input) {
  const { post } = await loadPostFor(ctx, postId, { forWrite: true });
  if (post.status !== "visible") throw refuse(400, "Only posts that are up can be shared.");
  const original = post.sharedPostId ? post.sharedPostId : post.id;
  const created = await create(ctx, { body: input.body || "", communityId: input.communityId || null, category: post.category === "announcement" ? "general" : post.category, sharedPostId: original });
  await db("connect_posts").where({ id: original }).increment("shareCount", 1);
  return created;
}

// ── Reactions ────────────────────────────────────────────────────────────────────────────────────
async function react(ctx, postId, kind) {
  if (ctx.kind === "learner") requireMember(ctx, { write: true });
  const { post, mine } = await loadPostFor(ctx, postId, { forWrite: true });
  if (post.status !== "visible") throw refuse(400, "You can react once the post is up.");
  const existing = await db("connect_reactions").where({ postId: post.id, userId: ctx.userId }).first();
  if (existing) await db("connect_reactions").where({ id: existing.id }).update({ kind });
  else {
    try {
      await db("connect_reactions").insert({ id: generateId(), postId: post.id, userId: ctx.userId, memberId: ctx.member?.id || null, kind, createdAt: now() });
    } catch (err) {
      if (err.code !== "ER_DUP_ENTRY") throw err;
      await db("connect_reactions").where({ postId: post.id, userId: ctx.userId }).update({ kind });
    }
  }
  await MemberService.recountPost(post.id);
  if (!mine && post.authorMemberId) {
    Notices.reaction(post.authorMemberId, post).catch(() => {});
    MemberService.awardBadges(post.authorMemberId).catch(() => {});
  }
  return reactionsOf(ctx, post.id);
}

async function unreact(ctx, postId) {
  if (ctx.kind === "learner") requireMember(ctx, { write: true });
  await loadPostFor(ctx, postId);
  await db("connect_reactions").where({ postId, userId: ctx.userId }).del();
  await MemberService.recountPost(postId);
  return reactionsOf(ctx, postId);
}

async function reactionsOf(ctx, postId) {
  const rows = await db("connect_reactions").where({ postId }).select("kind", "userId");
  const byKind = {};
  for (const r of rows) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
  return { reactionCount: rows.length, byKind, myReaction: rows.find((r) => r.userId === ctx.userId)?.kind || null };
}

// ── Comments ─────────────────────────────────────────────────────────────────────────────────────
async function commentsOf(ctx, post) {
  const moderator = canModerate(ctx, post.communityId);
  let rows = await db("connect_comments").where({ postId: post.id }).orderBy("createdAt", "asc").limit(500);
  const gone = new Set(await S.goneMemberIds(ctx.ownerAdminId));
  const hidden = ctx.kind === "learner" ? await S.hiddenFor(ctx.member.id) : new Set();
  rows = rows.filter((c) => !c.authorMemberId || (!gone.has(c.authorMemberId) && !hidden.has(c.authorMemberId)));
  const cards = await S.memberCards(rows.map((c) => c.authorMemberId));
  const view = (c) => {
    const mine = ctx.kind === "learner" ? c.authorMemberId === ctx.member?.id : c.authorUserId === ctx.userId;
    const removed = c.status !== "visible";
    return {
      id: c.id,
      parentCommentId: c.parentCommentId,
      author: c.authorKind === "staff" ? S.staffCard(c.authorUserId, c.authorName) : cards.get(c.authorMemberId) || S.card(null),
      body: removed && !moderator ? "" : c.body,
      removed,
      createdAt: c.createdAt,
      editedAt: c.editedAt,
      mine,
      canModerate: moderator,
    };
  };
  const top = rows.filter((c) => !c.parentCommentId);
  return top
    .map((c) => ({ ...view(c), replies: rows.filter((r) => r.parentCommentId === c.id).map(view).filter((r) => !r.removed || moderator) }))
    .filter((c) => !c.removed || c.replies.length || moderator);
}

async function addComment(ctx, postId, { body, parentCommentId }) {
  const { post, mine } = await loadPostFor(ctx, postId, { forWrite: true });
  if (post.status !== "visible") throw refuse(400, "You can comment once the post is up.");
  if (ctx.kind === "learner") {
    const member = requireMember(ctx, { write: true });
    S.checkLearnerText(ctx, body);
    const hour = new Date(Date.now() - 60 * 60 * 1000);
    if ((await S.countSince("connect_comments", "authorMemberId", member.id, hour)) >= ctx.settings.commentsPerHour) throw refuse(429, "You've written a lot of comments in the last hour. Take a break and come back later.");
  } else if (!canModerate(ctx, post.communityId)) {
    throw refuse(403, "Only moderators comment as staff.");
  }
  let parent = null;
  if (parentCommentId) {
    parent = await db("connect_comments").where({ id: parentCommentId, postId: post.id }).first();
    if (!parent || parent.status !== "visible") throw refuse(400, "That comment isn't there any more.");
    if (parent.parentCommentId) parent = await db("connect_comments").where({ id: parent.parentCommentId }).first();
    if (ctx.kind === "learner" && parent.authorMemberId && (await S.isBlockedEitherWay(ctx.member.id, parent.authorMemberId))) throw refuse(403, "You can't reply to this person.");
  }
  const row = {
    id: generateId(), postId: post.id, parentCommentId: parent?.id || null,
    authorMemberId: ctx.member?.id || null, authorUserId: ctx.userId,
    authorKind: ctx.kind === "learner" ? "learner" : "staff", authorName: ctx.kind === "learner" ? null : ctx.name,
    body, status: "visible", createdAt: now(), updatedAt: now(),
  };
  await db("connect_comments").insert(row);
  await MemberService.recountPost(post.id);
  const who = ctx.kind === "learner" ? ctx.member.displayName : ctx.name;
  if (!mine && post.authorMemberId) Notices.comment(post.authorMemberId, post, who, body).catch(() => {});
  if (parent?.authorMemberId && parent.authorMemberId !== ctx.member?.id && parent.authorMemberId !== post.authorMemberId) Notices.reply(parent.authorMemberId, post, who, body).catch(() => {});
  if (ctx.kind === "learner") MemberService.awardBadges(ctx.member.id).catch(() => {});
  return commentsOf(ctx, post);
}

async function loadComment(ctx, commentId) {
  const comment = await db("connect_comments").where({ id: commentId }).first();
  if (!comment) throw refuse(404, "That comment isn't there any more.");
  const { post } = await loadPostFor(ctx, comment.postId);
  const mine = ctx.kind === "learner" ? comment.authorMemberId === ctx.member?.id : comment.authorUserId === ctx.userId;
  return { comment, post, mine };
}

async function editComment(ctx, commentId, { body }) {
  const { comment, post, mine } = await loadComment(ctx, commentId);
  if (!mine || comment.status !== "visible") throw refuse(403, "You can only change your own comments.");
  if (ctx.kind === "learner") requireMember(ctx, { write: true });
  S.checkLearnerText(ctx, body);
  await db("connect_comments").where({ id: comment.id }).update({ body, editedAt: now(), updatedAt: now() });
  return commentsOf(ctx, post);
}

async function deleteComment(ctx, commentId, reason) {
  const { comment, post, mine } = await loadComment(ctx, commentId);
  const moderator = canModerate(ctx, post.communityId);
  if (!mine && !moderator) throw refuse(403, "You can only delete your own comments.");
  const hasReplies = await db("connect_comments").where({ parentCommentId: comment.id }).first("id");
  const reported = await db("connect_reports").where({ targetType: "comment", targetId: comment.id, status: "open" }).first("id");
  if (mine && !hasReplies && !reported) await db("connect_comments").where({ id: comment.id }).del();
  else await db("connect_comments").where({ id: comment.id }).update({ status: "removed", updatedAt: now() });
  if (!mine) {
    if (comment.authorMemberId) await Notices.contentRemoved(comment.authorMemberId, "comment", reason);
    await S.log(ctx.ownerAdminId, ctx, "comment_removed", { targetType: "comment", targetId: comment.id, memberId: comment.authorMemberId, note: reason });
  }
  await MemberService.recountPost(post.id);
  return commentsOf(ctx, post);
}

// ── Communities ──────────────────────────────────────────────────────────────────────────────────
async function recountCommunity(communityId) {
  const [m, p] = await Promise.all([
    db("connect_community_members as cm").join("connect_members as m", "m.id", "cm.memberId").where({ "cm.communityId": communityId, "cm.status": "active" }).whereNot("m.status", "off").count({ n: "*" }).first(),
    db("connect_posts").where({ communityId, status: "visible" }).count({ n: "*" }).first(),
  ]);
  await db("connect_communities").where({ id: communityId }).update({ memberCount: Number(m?.n || 0), postCount: Number(p?.n || 0) });
}

function communityView(c, extra = {}) {
  return {
    id: c.id, slug: c.slug, name: c.name, description: c.description || "", icon: c.icon || "users", color: c.color || "#25476a",
    topics: parseJson(c.topics, []), joinMode: c.joinMode, postingMode: c.postingMode, status: c.status,
    memberCount: c.memberCount, postCount: c.postCount, createdAt: c.createdAt, ...extra,
  };
}

async function communities(ctx, { q = "", mine = false, includeArchived = false } = {}) {
  if (ctx.kind === "learner") requireMember(ctx);
  let query = db("connect_communities").where({ ownerAdminId: ctx.ownerAdminId });
  if (!(includeArchived && ctx.kind !== "learner")) query = query.where({ status: "active" });
  if (q.trim()) query = query.andWhere((w) => w.whereRaw("LOWER(name) LIKE ?", [`%${q.trim().toLowerCase()}%`]).orWhereRaw("LOWER(description) LIKE ?", [`%${q.trim().toLowerCase()}%`]));
  const rows = await query.orderBy("memberCount", "desc").orderBy("name");
  const myRows = ctx.member ? await db("connect_community_members").where({ memberId: ctx.member.id }) : [];
  const status = new Map(myRows.map((r) => [r.communityId, r.status]));
  const interests = new Set(ctx.member ? [...parseJson(ctx.member.interests, []), ...parseJson(ctx.member.skills, [])] : []);
  const out = rows
    .map((c) => communityView(c, {
      myStatus: status.get(c.id) || null,
      isModerator: canModerate(ctx, c.id),
      suggested: !status.get(c.id) && parseJson(c.topics, []).some((t) => interests.has(t)),
    }))
    .filter((c) => !mine || c.myStatus === "active" || (ctx.kind !== "learner" && c.isModerator));
  return out;
}

async function communityBySlug(ctx, slug) {
  if (ctx.kind === "learner") requireMember(ctx);
  const c = await db("connect_communities").where({ ownerAdminId: ctx.ownerAdminId, slug }).first();
  if (!c || (c.status !== "active" && ctx.kind === "learner")) throw refuse(404, "That community isn't there.");
  const access = await communityAccess(ctx, c);
  const [mods, recent] = await Promise.all([
    db("connect_community_moderators").where({ communityId: c.id }),
    db("connect_community_members as cm").join("connect_members as m", "m.id", "cm.memberId").where({ "cm.communityId": c.id, "cm.status": "active" }).whereNot("m.status", "off").orderBy("cm.createdAt", "desc").limit(24).pluck("m.id"),
  ]);
  const cards = await S.memberCards(recent);
  const hidden = ctx.kind === "learner" ? await S.hiddenFor(ctx.member.id) : new Set();
  return communityView(c, {
    myStatus: access.myStatus || null,
    canSee: access.see,
    canPost: access.post,
    isModerator: access.moderator,
    canManage: ctx.kind === "staff" && ctx.canManage,
    moderators: mods.map((m) => ({ userId: ctx.kind === "learner" ? undefined : m.userId, name: m.name })),
    members: recent.filter((id) => !hidden.has(id)).map((id) => cards.get(id)).filter(Boolean),
  });
}

async function join(ctx, communityId) {
  const member = requireMember(ctx, { write: true });
  const c = await db("connect_communities").where({ id: communityId, ownerAdminId: ctx.ownerAdminId }).first();
  if (!c || c.status !== "active") throw refuse(404, "That community isn't open.");
  const row = await db("connect_community_members").where({ communityId: c.id, memberId: member.id }).first();
  if (row?.status === "active") return { myStatus: "active" };
  const status = c.joinMode === "open" || row?.status === "invited" ? "active" : "pending";
  if (row) await db("connect_community_members").where({ id: row.id }).update({ status, updatedAt: now() });
  else {
    try {
      await db("connect_community_members").insert({ id: generateId(), communityId: c.id, memberId: member.id, status, createdAt: now(), updatedAt: now() });
    } catch (err) {
      if (err.code !== "ER_DUP_ENTRY") throw err;
    }
  }
  if (status === "pending") await Notices.joinRequest(ctx.ownerAdminId, ctx.settings, c, member.displayName);
  await recountCommunity(c.id);
  if (status === "active") MemberService.awardBadges(member.id).catch(() => {});
  return { myStatus: status };
}

async function leave(ctx, communityId) {
  const member = requireMember(ctx);
  await db("connect_community_members").where({ communityId, memberId: member.id }).del();
  await recountCommunity(communityId);
  return { myStatus: null };
}

async function loadManagedCommunity(ctx, communityId) {
  const c = await db("connect_communities").where({ id: communityId, ownerAdminId: ctx.ownerAdminId }).first();
  if (!c) throw refuse(404, "That community isn't there.");
  if (!canModerate(ctx, c.id)) throw refuse(403, "Only this community's moderators can do this.");
  return c;
}

async function communityMembers(ctx, communityId) {
  await loadManagedCommunity(ctx, communityId);
  const rows = await db("connect_community_members").where({ communityId }).orderBy("createdAt", "desc");
  const cards = await S.memberCards(rows.map((r) => r.memberId));
  return rows.map((r) => ({ member: cards.get(r.memberId), status: r.status, since: r.createdAt })).filter((r) => r.member && !r.member.gone);
}

async function setMembership(ctx, communityId, memberId, action) {
  const c = await loadManagedCommunity(ctx, communityId);
  const row = await db("connect_community_members").where({ communityId, memberId }).first();
  if (!row) throw refuse(404, "They aren't in this community's list.");
  if (action === "approve") {
    await db("connect_community_members").where({ id: row.id }).update({ status: "active", updatedAt: now() });
    await Notices.communityApproved(memberId, c);
  } else {
    await db("connect_community_members").where({ id: row.id }).del();
    await S.log(ctx.ownerAdminId, ctx, action === "decline" ? "community_request_declined" : "community_member_removed", { targetType: "community", targetId: c.id, memberId });
  }
  await recountCommunity(c.id);
  return communityMembers(ctx, communityId);
}

async function inviteToCommunity(ctx, communityId, memberIds) {
  const c = await loadManagedCommunity(ctx, communityId);
  for (const memberId of memberIds) {
    const m = await S.memberById(memberId);
    if (!m || m.ownerAdminId !== ctx.ownerAdminId || m.status === "off") continue;
    const row = await db("connect_community_members").where({ communityId: c.id, memberId }).first();
    if (row) continue;
    await db("connect_community_members").insert({ id: generateId(), communityId: c.id, memberId, status: "invited", invitedByUserId: ctx.userId, createdAt: now(), updatedAt: now() });
    await Notices.communityInvite(m, c, ctx.name);
  }
  return communityMembers(ctx, communityId);
}

async function createCommunity(ctx, input) {
  requireCreator(ctx);
  let slug = slugify(input.name).slice(0, 70) || "community";
  if (await db("connect_communities").where({ ownerAdminId: ctx.ownerAdminId, slug }).first("id")) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  const row = {
    id: generateId(), ownerAdminId: ctx.ownerAdminId, slug, name: input.name, description: input.description || null,
    icon: input.icon || "users", color: input.color || "#25476a", topics: toJson(input.topics || []),
    joinMode: input.joinMode || "open", postingMode: input.postingMode || "members", status: "active",
    createdByUserId: ctx.userId, createdByName: ctx.name, createdAt: now(), updatedAt: now(),
  };
  await db("connect_communities").insert(row);
  // An educator who makes a community moderates it.
  if (ctx.kind === "educator") await db("connect_community_moderators").insert({ id: generateId(), communityId: row.id, userId: ctx.userId, name: ctx.name, createdAt: now() });
  await S.log(ctx.ownerAdminId, ctx, "community_created", { targetType: "community", targetId: row.id, note: row.name });
  return communityView(row);
}

async function updateCommunity(ctx, communityId, input) {
  const c = await loadManagedCommunity(ctx, communityId);
  const patch = { updatedAt: now() };
  for (const key of ["name", "description", "icon", "color", "joinMode", "postingMode"]) if (input[key] !== undefined) patch[key] = input[key];
  if (input.topics !== undefined) patch.topics = toJson(input.topics);
  await db("connect_communities").where({ id: c.id }).update(patch);
  await S.log(ctx.ownerAdminId, ctx, "community_updated", { targetType: "community", targetId: c.id });
  return communityView(await db("connect_communities").where({ id: c.id }).first());
}

async function setCommunityStatus(ctx, communityId, status) {
  requireManager(ctx);
  const c = await db("connect_communities").where({ id: communityId, ownerAdminId: ctx.ownerAdminId }).first();
  if (!c) throw refuse(404, "That community isn't there.");
  await db("connect_communities").where({ id: c.id }).update({ status, updatedAt: now() });
  await S.log(ctx.ownerAdminId, ctx, status === "archived" ? "community_archived" : "community_restored", { targetType: "community", targetId: c.id, note: c.name });
  return communityView({ ...c, status });
}

async function setModerators(ctx, communityId, userIds) {
  requireManager(ctx);
  const c = await db("connect_communities").where({ id: communityId, ownerAdminId: ctx.ownerAdminId }).first();
  if (!c) throw refuse(404, "That community isn't there.");
  const options = await moderatorOptions(ctx);
  const allowed = new Map(options.map((o) => [o.userId, o]));
  const chosen = [...new Set(userIds)].filter((id) => allowed.has(id));
  await db("connect_community_moderators").where({ communityId: c.id }).del();
  for (const userId of chosen) await db("connect_community_moderators").insert({ id: generateId(), communityId: c.id, userId, name: allowed.get(userId).name, createdAt: now() });
  await S.log(ctx.ownerAdminId, ctx, "community_moderators_set", { targetType: "community", targetId: c.id, note: chosen.map((id) => allowed.get(id).name).join(", ") });
  return chosen.map((id) => allowed.get(id));
}

// Who can be named a moderator: the workspace's admins and staff, and its educators with a login.
// Never a learner or parent.
async function moderatorOptions(ctx) {
  const { adminIdsOf } = require("../../shared/utils/organisation");
  const adminIds = await adminIdsOf(ctx.ownerAdminId);
  const orgAdmins = adminIds.length ? adminIds : [ctx.ownerAdminId];
  const [admins, staff] = await Promise.all([
    db("users").whereIn("id", orgAdmins).select("id", "name"),
    db("users").whereIn("invitedByAdminId", orgAdmins).whereIn("role", ["collaborator"]).select("id", "name"),
  ]);
  const hubIds = await db("learning_hubs").where({ ownerAdminId: ctx.ownerAdminId }).pluck("id");
  const linked = hubIds.length ? await whereInChunks(db, "teacher_hub_links", "hubId", hubIds) : [];
  const teachers = await db("teachers").where((q) => {
    q.whereIn("createdByAdminId", orgAdmins);
    if (linked.length) q.orWhereIn("id", [...new Set(linked.map((l) => l.teacherId))]);
  }).whereNotIn("status", ["inactive", "removed"]).whereNotNull("email").select("firstName", "lastName", "email");
  const emails = teachers.map((t) => String(t.email).toLowerCase());
  const users = emails.length ? await db("users").whereRaw(`LOWER(email) IN (${emails.map(() => "?").join(",")})`, emails).select("id", "email") : [];
  const userByEmail = new Map(users.map((u) => [String(u.email).toLowerCase(), u.id]));
  const out = [
    ...admins.map((u) => ({ userId: u.id, name: u.name, role: "Admin" })),
    ...staff.map((u) => ({ userId: u.id, name: u.name, role: "Staff" })),
    ...teachers.filter((t) => userByEmail.get(String(t.email).toLowerCase())).map((t) => ({ userId: userByEmail.get(String(t.email).toLowerCase()), name: [t.firstName, t.lastName].filter(Boolean).join(" "), role: "Educator" })),
  ];
  const seen = new Set();
  return out.filter((o) => (seen.has(o.userId) ? false : seen.add(o.userId)));
}

module.exports = {
  list, get, create, update, remove, moderateRemove, setPinned, share, react, unreact,
  addComment, editComment, deleteComment, communities, communityBySlug, join, leave, communityMembers, setMembership,
  inviteToCommunity, createCommunity, updateCommunity, setCommunityStatus, setModerators, moderatorOptions, recountCommunity, serialisePosts,
};
