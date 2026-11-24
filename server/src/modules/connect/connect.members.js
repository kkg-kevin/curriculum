const { generateId, toJson, whereInChunks } = require("../../shared/utils/model.utils");
const { learnerAge } = require("../../shared/utils/age");
const R = require("./connect.rules");
const S = require("./connect.store");
const Files = require("./connect.files");
const Notices = require("./connect.notifications");
const { requireMember, isSuspended, workspaceOfLearner } = require("./connect.context");

const { db, refuse, now, parseJson } = S;

// Members: switching Connect on (a parent's consent), profiles, finding people with the same
// interests, connections, blocking and muting, badges — and what a parent sees.

const CATALOGUE = {
  interests: R.INTERESTS,
  categories: R.CATEGORIES,
  reactions: R.REACTIONS,
  projectCategories: R.PROJECT_CATEGORIES,
  projectStatuses: R.PROJECT_STATUSES,
  challengeKinds: R.CHALLENGE_KINDS,
  awards: R.AWARDS,
  reportReasons: R.REPORT_REASONS,
  badges: Object.entries(R.BADGES).map(([key, b]) => ({ key, ...b })),
  avatarIcons: R.AVATAR_ICONS,
  avatarColors: R.AVATAR_COLORS,
  teamMax: R.PROJECT_TEAM_MAX,
};

function ownProfile(member, learner) {
  return {
    ...S.card(member, learner),
    bio: member.bio || "",
    interests: parseJson(member.interests, []),
    skills: parseJson(member.skills, []),
    avatarChoice: parseJson(member.avatar, null) || R.defaultAvatar(member.learnerId),
    hasPhoto: !!learner?.photo,
    showCertificates: !!member.showCertificates,
    directMessages: !!member.directMessages,
    joinedAt: member.consentAt || member.createdAt,
  };
}

async function counts(member) {
  const [unread, requests, projectInvites, communityInvites] = await Promise.all([
    unreadMessages(member.id),
    db("connect_connections").where({ addresseeMemberId: member.id, status: "pending" }).count({ n: "*" }).first(),
    db("connect_project_members").where({ memberId: member.id, status: "invited" }).count({ n: "*" }).first(),
    db("connect_community_members").where({ memberId: member.id, status: "invited" }).count({ n: "*" }).first(),
  ]);
  return { unreadMessages: unread, connectionRequests: Number(requests?.n || 0), projectInvites: Number(projectInvites?.n || 0), communityInvites: Number(communityInvites?.n || 0) };
}

// Conversations with something newer than the member last read (their own messages don't count).
async function unreadMessages(memberId) {
  const rows = await db("connect_conversation_participants as p")
    .join("connect_conversations as c", "c.id", "p.conversationId")
    .where({ "p.memberId": memberId, "c.status": "active" })
    .whereNull("p.leftAt")
    .whereNotNull("c.lastMessageAt")
    .andWhere((q) => q.whereNull("p.lastReadAt").orWhereRaw("c.lastMessageAt > p.lastReadAt"))
    .select("p.conversationId", "p.lastReadAt");
  let n = 0;
  for (const r of rows) {
    const q = db("connect_messages").where({ conversationId: r.conversationId, status: "visible" }).whereNot({ senderMemberId: memberId });
    if (r.lastReadAt) q.andWhere("createdAt", ">", r.lastReadAt);
    const hit = await q.first("id");
    if (hit) n += 1;
  }
  return n;
}

const MemberService = {
  CATALOGUE,
  unreadMessages,

  // What the signed-in person is on Connect.
  async me(ctx) {
    const base = { kind: ctx.kind, catalogue: CATALOGUE };
    if (ctx.kind === "parent") return base;
    const s = ctx.settings;
    const rules = { dmMinAge: s.dmMinAge, directMessages: s.directMessages, groupChats: s.groupChats, messageFiles: s.messageFiles };
    if (ctx.kind !== "learner") {
      const [reports, waiting] = await Promise.all([
        db("connect_reports").where({ ownerAdminId: ctx.ownerAdminId, status: "open" }).count({ n: "*" }).first(),
        db("connect_posts").where({ ownerAdminId: ctx.ownerAdminId, status: "pending" }).count({ n: "*" }).first(),
      ]);
      return {
        ...base, rules, name: ctx.name, roleLabel: ctx.roleLabel,
        isModerator: ctx.isModerator, canModerateAll: ctx.canModerateAll, canManage: ctx.canManage, canCreate: ctx.canCreate,
        moderatedCommunityIds: [...ctx.moderatedCommunityIds],
        counts: { openReports: Number(reports?.n || 0), waitingPosts: Number(waiting?.n || 0) },
      };
    }
    const member = ctx.member;
    const age = learnerAge(ctx.learner);
    if (!member || member.status === "off") return { ...base, status: "not_member", rules, firstName: ctx.learner.firstName };
    await db("connect_members").where({ id: member.id }).update({ lastSeenAt: now() });
    const suspended = isSuspended(member);
    return {
      ...base,
      status: suspended ? "suspended" : "active",
      suspendedUntil: suspended ? member.suspendedUntil : null,
      suspendedReason: suspended ? member.suspendedReason : null,
      rules,
      profile: ownProfile(member, ctx.learner),
      canDirectMessage: !!(s.directMessages && member.directMessages && age != null && age >= s.dmMinAge),
      canGroupChat: !!(s.groupChats && s.directMessages && member.directMessages && age != null && age >= s.dmMinAge),
      counts: await counts(member),
    };
  },

  // Light counts for the menu badges (polled).
  async counts(ctx) {
    if (ctx.kind !== "learner" || !ctx.member || ctx.member.status === "off") return {};
    return counts(ctx.member);
  },

  async updateProfile(ctx, input) {
    const member = requireMember(ctx, { write: true });
    S.checkLearnerText(ctx, input.displayName, input.bio);
    const patch = { updatedAt: now() };
    if (input.displayName !== undefined) patch.displayName = input.displayName;
    if (input.bio !== undefined) patch.bio = input.bio || null;
    if (input.interests !== undefined) patch.interests = toJson(input.interests);
    if (input.skills !== undefined) patch.skills = toJson(input.skills);
    if (input.showCertificates !== undefined) patch.showCertificates = input.showCertificates;
    if (input.avatar !== undefined) {
      patch.avatar = toJson(R.cleanAvatar(input.avatar));
    }
    await db("connect_members").where({ id: member.id }).update(patch);
    const updated = await S.memberById(member.id);
    return ownProfile(updated, ctx.learner);
  },

  // ── Finding people ─────────────────────────────────────────────────────────────────────────────
  async people(ctx, { q = "", interest = "", page = 1 } = {}) {
    const viewerMember = ctx.kind === "learner" ? requireMember(ctx) : null;
    const hidden = await S.hiddenFor(viewerMember?.id);
    let query = db("connect_members").where({ ownerAdminId: ctx.ownerAdminId }).whereIn("status", ["active", "suspended"]);
    if (viewerMember) query = query.whereNot({ id: viewerMember.id });
    if (q.trim()) query = query.whereRaw("LOWER(displayName) LIKE ?", [`%${q.trim().toLowerCase()}%`]);
    if (interest && R.INTEREST_KEYS.includes(interest)) query = query.andWhere((w) => w.whereRaw("JSON_CONTAINS(interests, ?)", [JSON.stringify(interest)]).orWhereRaw("JSON_CONTAINS(skills, ?)", [JSON.stringify(interest)]));
    const rows = (await query.orderBy("lastSeenAt", "desc").limit(400)).filter((m) => !hidden.has(m.id));
    const mine = new Set(viewerMember ? [...parseJson(viewerMember.interests, []), ...parseJson(viewerMember.skills, [])] : []);
    const scored = rows.map((m) => {
      const theirs = [...new Set([...parseJson(m.interests, []), ...parseJson(m.skills, [])])];
      return { m, shared: theirs.filter((k) => mine.has(k)), theirs };
    }).sort((a, b) => b.shared.length - a.shared.length);
    const size = 24;
    const pageRows = scored.slice((page - 1) * size, page * size);
    const cards = await S.memberCards(pageRows.map((r) => r.m.id));
    const conn = viewerMember ? await connectionStates(viewerMember.id, pageRows.map((r) => r.m.id)) : new Map();
    return {
      items: pageRows.map((r) => ({ ...cards.get(r.m.id), interests: r.theirs.slice(0, 6), shared: r.shared, connection: conn.get(r.m.id) || null })),
      page, hasMore: scored.length > page * size, total: scored.length,
    };
  },

  async profile(ctx, memberId) {
    const viewer = ctx.kind === "learner" ? requireMember(ctx) : null;
    const member = await S.memberById(memberId);
    if (!member || member.ownerAdminId !== ctx.ownerAdminId || member.status === "off") throw refuse(404, "We couldn't find that person on Connect.");
    if (viewer && viewer.id !== member.id && (await S.isBlockedEitherWay(viewer.id, member.id))) {
      const blockedByMe = await db("connect_blocks").where({ memberId: viewer.id, otherMemberId: member.id, kind: "block" }).first("id");
      if (!blockedByMe) throw refuse(404, "We couldn't find that person on Connect.");
    }
    const learner = await db("learners").where({ id: member.learnerId }).first();
    const [communities, projects, connectBadges, classBadges, certificates] = await Promise.all([
      db("connect_community_members as cm").join("connect_communities as c", "c.id", "cm.communityId")
        .where({ "cm.memberId": member.id, "cm.status": "active", "c.status": "active" }).select("c.id", "c.slug", "c.name", "c.icon", "c.color"),
      db("connect_project_members as pm").join("connect_projects as p", "p.id", "pm.projectId")
        .where({ "pm.memberId": member.id, "pm.status": "active", "p.moderation": "visible", "p.visibility": "community" })
        .select("p.id", "p.title", "p.category", "p.status", "p.showcased", "p.coverFileId", "pm.role"),
      db("connect_badges").where({ memberId: member.id }).orderBy("earnedAt", "desc"),
      classBadgesOf(member.learnerId),
      member.showCertificates || (viewer && viewer.id === member.id) ? certificatesOf(member.learnerId) : [],
    ]);
    const covers = await S.filesFor(projects.map((p) => p.coverFileId));
    const isMe = viewer?.id === member.id;
    const out = {
      ...S.card(member, learner),
      bio: member.bio || "",
      interests: parseJson(member.interests, []),
      skills: parseJson(member.skills, []),
      joinedAt: member.consentAt || member.createdAt,
      communities,
      projects: projects.map((p) => ({ id: p.id, title: p.title, category: p.category, status: p.status, showcased: !!p.showcased, role: p.role, cover: covers.get(p.coverFileId) || null })),
      badges: connectBadges.map((b) => ({ key: b.badge, ...(R.BADGES[b.badge] || { label: b.badge }), earnedAt: b.earnedAt })),
      classBadges,
      certificates,
      isMe,
    };
    if (viewer && !isMe) {
      const [state, myBlock, myMute] = await Promise.all([
        connectionStates(viewer.id, [member.id]),
        db("connect_blocks").where({ memberId: viewer.id, otherMemberId: member.id, kind: "block" }).first("id"),
        db("connect_blocks").where({ memberId: viewer.id, otherMemberId: member.id, kind: "mute" }).first("id"),
      ]);
      out.connection = state.get(member.id) || null;
      out.blocked = !!myBlock;
      out.muted = !!myMute;
      const [myAge, theirAge] = [learnerAge(ctx.learner), learnerAge(learner)];
      out.messageBlocker = R.directMessageBlocker({ settings: ctx.settings, myAge, otherAge: theirAge, me: viewer, other: member, connected: out.connection?.status === "accepted", blocked: !!myBlock || (await S.isBlockedEitherWay(viewer.id, member.id)) });
    }
    if (ctx.kind !== "learner") {
      // Moderators need to know who it is to look after them — the name only, never contact details.
      out.learner = { id: learner?.id, name: [learner?.firstName, learner?.lastName].filter(Boolean).join(" "), age: learnerAge(learner) };
      out.status = isSuspended(member) ? "suspended" : "active";
      out.suspendedUntil = member.suspendedUntil;
    }
    return out;
  },

  // Badges and certificates a learner may put on a post.
  async achievements(ctx) {
    const member = requireMember(ctx);
    const [badges, classBadges, certificates] = await Promise.all([
      db("connect_badges").where({ memberId: member.id }),
      classBadgesOf(member.learnerId),
      certificatesOf(member.learnerId),
    ]);
    return [
      ...badges.map((b) => ({ kind: "connect_badge", id: b.badge, label: R.BADGES[b.badge]?.label || b.badge, detail: R.BADGES[b.badge]?.description || "" })),
      ...classBadges.map((b) => ({ kind: "class_badge", id: b.key, label: b.label, detail: b.description })),
      ...certificates.map((c) => ({ kind: "certificate", id: c.id, label: c.title, detail: c.kindLabel })),
    ];
  },

  // ── Connections ────────────────────────────────────────────────────────────────────────────────
  async connections(ctx) {
    const me = requireMember(ctx);
    const rows = await db("connect_connections").where((q) => q.where({ requesterMemberId: me.id }).orWhere({ addresseeMemberId: me.id })).whereIn("status", ["pending", "accepted"]).orderBy("updatedAt", "desc");
    const other = (r) => (r.requesterMemberId === me.id ? r.addresseeMemberId : r.requesterMemberId);
    const cards = await S.memberCards(rows.map(other));
    const view = (r) => ({ id: r.id, member: cards.get(other(r)), since: r.respondedAt || r.createdAt });
    return {
      connections: rows.filter((r) => r.status === "accepted" && cards.get(other(r)) && !cards.get(other(r)).gone).map(view),
      incoming: rows.filter((r) => r.status === "pending" && r.addresseeMemberId === me.id).map(view),
      outgoing: rows.filter((r) => r.status === "pending" && r.requesterMemberId === me.id).map(view),
    };
  },

  async requestConnection(ctx, otherId) {
    const me = requireMember(ctx, { write: true });
    const other = await activeMemberOfWorkspace(ctx, otherId);
    if (other.id === me.id) throw refuse(400, "That's you!");
    if (await S.isBlockedEitherWay(me.id, other.id)) throw refuse(403, "You can't connect with this person.");
    const today = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if ((await S.countSince("connect_connections", "requesterMemberId", me.id, today)) >= 20) throw refuse(429, "That's a lot of requests today. Try again tomorrow.");
    const key = R.pairKey(me.id, other.id);
    const existing = await db("connect_connections").where({ pairKey: key }).first();
    if (existing?.status === "accepted") return { status: "accepted" };
    if (existing?.status === "pending" && existing.addresseeMemberId === me.id) return MemberService.respondConnection(ctx, existing.id, true);
    if (existing?.status === "pending") return { status: "pending" };
    if (existing) {
      // Declined before: only the person who declined can ask again… or 30 days on.
      const recent = existing.respondedAt && new Date(existing.respondedAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (recent && existing.requesterMemberId === me.id) throw refuse(429, "They didn't accept last time. You can ask again in a few weeks.");
      await db("connect_connections").where({ id: existing.id }).update({ requesterMemberId: me.id, addresseeMemberId: other.id, status: "pending", respondedAt: null, updatedAt: now() });
    } else {
      try {
        await db("connect_connections").insert({ id: generateId(), ownerAdminId: ctx.ownerAdminId, pairKey: key, requesterMemberId: me.id, addresseeMemberId: other.id, status: "pending", createdAt: now(), updatedAt: now() });
      } catch (err) {
        if (err.code !== "ER_DUP_ENTRY") throw err;
        return { status: "pending" };
      }
    }
    await Notices.connectionRequest(other, me.displayName);
    return { status: "pending" };
  },

  async respondConnection(ctx, connectionId, accept) {
    const me = requireMember(ctx, { write: true });
    const row = await db("connect_connections").where({ id: connectionId }).first();
    if (!row || row.addresseeMemberId !== me.id || row.status !== "pending") throw refuse(404, "That request isn't waiting for you any more.");
    await db("connect_connections").where({ id: row.id }).update({ status: accept ? "accepted" : "declined", respondedAt: now(), updatedAt: now() });
    if (accept) {
      await Notices.connectionAccepted(row.requesterMemberId, me.displayName);
      MemberService.awardBadges(me.id).catch(() => {});
      MemberService.awardBadges(row.requesterMemberId).catch(() => {});
    }
    return { status: accept ? "accepted" : "declined" };
  },

  async removeConnection(ctx, otherId) {
    const me = requireMember(ctx, { write: true });
    await db("connect_connections").where({ pairKey: R.pairKey(me.id, otherId) }).del();
    return { status: null };
  },

  // ── Blocking and muting ────────────────────────────────────────────────────────────────────────
  // Block: neither sees the other's posts or comments, no messages, no connection. Mute: their
  // posts leave this member's feed; nothing else changes and they aren't told.
  async setBlock(ctx, otherId, kind, on) {
    const me = requireMember(ctx);
    const other = await S.memberById(otherId);
    if (!other || other.ownerAdminId !== ctx.ownerAdminId || other.id === me.id) throw refuse(404, "We couldn't find that person.");
    await setBlockFor(me.id, other.id, kind, on, false);
    return { blocked: kind === "block" ? on : undefined, muted: kind === "mute" ? on : undefined };
  },

  async blocks(ctx) {
    const me = requireMember(ctx);
    const rows = await db("connect_blocks").where({ memberId: me.id });
    const cards = await S.memberCards(rows.map((r) => r.otherMemberId));
    return rows.map((r) => ({ member: cards.get(r.otherMemberId), kind: r.kind, byParent: !!r.byParent, since: r.createdAt }));
  },

  // ── Badges ─────────────────────────────────────────────────────────────────────────────────────
  async awardBadges(memberId) {
    const member = await S.memberById(memberId);
    if (!member || member.status === "off") return [];
    const json = JSON.stringify(memberId);
    const n = (row) => Number(row?.n || 0);
    const [posts, answers, team, done, showcased, challenges, awards, connections, communities, best] = await Promise.all([
      db("connect_posts").where({ authorMemberId: memberId, status: "visible" }).count({ n: "*" }).first(),
      db("connect_comments as c").join("connect_posts as p", "p.id", "c.postId").where({ "c.authorMemberId": memberId, "c.status": "visible", "p.category": "questions" }).whereNot("p.authorMemberId", memberId).countDistinct({ n: "c.postId" }).first(),
      db("connect_project_members as pm").where({ "pm.memberId": memberId, "pm.status": "active" })
        .whereRaw("(SELECT COUNT(*) FROM connect_project_members x WHERE x.projectId = pm.projectId AND x.status = 'active') >= 2").count({ n: "*" }).first(),
      db("connect_project_members as pm").join("connect_projects as p", "p.id", "pm.projectId").where({ "pm.memberId": memberId, "pm.status": "active", "p.status": "done" }).count({ n: "*" }).first(),
      db("connect_project_members as pm").join("connect_projects as p", "p.id", "pm.projectId").where({ "pm.memberId": memberId, "pm.status": "active", "p.showcased": true }).count({ n: "*" }).first(),
      db("connect_challenge_entries").whereNot({ status: "withdrawn" }).andWhere((q) => q.where({ memberId }).orWhereRaw("JSON_CONTAINS(memberIds, ?)", [json])).count({ n: "*" }).first(),
      db("connect_challenge_entries").whereIn("award", ["winner", "runner_up", "commended"]).andWhere((q) => q.where({ memberId }).orWhereRaw("JSON_CONTAINS(memberIds, ?)", [json])).count({ n: "*" }).first(),
      db("connect_connections").where({ status: "accepted" }).andWhere((q) => q.where({ requesterMemberId: memberId }).orWhere({ addresseeMemberId: memberId })).count({ n: "*" }).first(),
      db("connect_community_members").where({ memberId, status: "active" }).count({ n: "*" }).first(),
      db("connect_posts").where({ authorMemberId: memberId, status: "visible" }).max({ n: "reactionCount" }).first(),
    ]);
    const earned = R.badgesEarned({
      posts: n(posts), answers: n(answers), teamProjects: n(team), doneProjects: n(done), showcased: n(showcased),
      challenges: n(challenges), awards: n(awards), connections: n(connections), communities: n(communities), bestReactions: n(best),
    });
    const have = new Set(await db("connect_badges").where({ memberId }).pluck("badge"));
    const fresh = earned.filter((b) => !have.has(b));
    for (const badge of fresh) {
      try {
        await db("connect_badges").insert({ id: generateId(), memberId, badge, earnedAt: now() });
        await Notices.toMember(member, {
          type: "connect_badge",
          title: `New badge: ${R.BADGES[badge].label}`,
          message: `${R.BADGES[badge].description}. It's on your Connect profile.`,
          payload: { route: "/learner-portal/connect/profile" },
          dedupeKey: `connect_badge:${memberId}:${badge}`,
        });
      } catch (err) {
        if (err.code !== "ER_DUP_ENTRY") throw err;
      }
    }
    return fresh;
  },

  // ── Files ──────────────────────────────────────────────────────────────────────────────────────
  async upload(ctx, file) {
    if (ctx.kind === "learner") requireMember(ctx, { write: true });
    else if (ctx.kind === "parent") throw refuse(403, "Parents don't upload to Connect.");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if ((await S.countSince("connect_files", "uploaderUserId", ctx.userId, since)) >= 60) throw refuse(429, "That's a lot of uploads today. Try again tomorrow.");
    const stored = await Files.store(file);
    const row = { id: generateId(), ownerAdminId: ctx.ownerAdminId, uploaderUserId: ctx.userId, ...stored, createdAt: now() };
    await db("connect_files").insert(row);
    cleanOrphans(ctx.ownerAdminId).catch(() => {});
    return S.fileView(row);
  },

  // ── Parents ────────────────────────────────────────────────────────────────────────────────────
  async parentChildren(ctx) {
    const learners = (ctx.ownLearners || []).filter((l) => !l.teacherId);
    const members = learners.length ? await whereInChunks(db, "connect_members", "learnerId", learners.map((l) => l.id)) : [];
    const byLearner = new Map(members.map((m) => [m.learnerId, m]));
    const out = [];
    for (const l of learners) {
      const m = byLearner.get(l.id);
      const ownerAdminId = m?.ownerAdminId || (await workspaceOfLearner(l));
      const settings = ownerAdminId ? await S.settingsFor(ownerAdminId) : R.mergeSettings({});
      const age = learnerAge(l);
      out.push({
        learnerId: l.id,
        firstName: l.firstName,
        name: [l.firstName, l.lastName].filter(Boolean).join(" "),
        age,
        hasLogin: !!l.username,
        status: !m ? "not_member" : m.status === "off" ? "off" : isSuspended(m) ? "suspended" : "active",
        suspendedUntil: m && isSuspended(m) ? m.suspendedUntil : null,
        displayName: m?.displayName || null,
        directMessages: m ? !!m.directMessages : true,
        consentAt: m?.consentAt || null,
        consentMethod: m?.consentMethod || null,
        dmMinAge: settings.dmMinAge,
        dmPossible: settings.directMessages && age != null && age >= settings.dmMinAge,
        hasWorkspace: !!ownerAdminId,
      });
    }
    return out;
  },

  async parentConsent(ctx, learnerId, input) {
    const learner = parentChild(ctx, learnerId);
    if (!learner.username) throw refuse(400, `${learner.firstName} needs their own Digifunzi login first — Connect is used from the child's own login. Set one up on their Login page.`);
    const ownerAdminId = await workspaceOfLearner(learner);
    if (!ownerAdminId) throw refuse(400, `${learner.firstName} isn't at a Digifunzi hub yet, so Connect can't be switched on.`);
    const existing = await S.memberByLearner(learner.id);
    const consent = { consentByUserId: ctx.userId, consentMethod: "parent", consentNote: null, consentAt: now(), withdrawnAt: null };
    const switches = {};
    if (input.directMessages !== undefined) switches.directMessages = input.directMessages;
    if (existing) {
      await db("connect_members").where({ id: existing.id }).update({ ...consent, ...switches, status: existing.status === "off" ? "active" : existing.status, updatedAt: now() });
    } else {
      await createMember(learner, ownerAdminId, { ...consent, ...switches });
    }
    return MemberService.parentChildren(ctx).then((list) => list.find((c) => c.learnerId === learner.id));
  },

  async parentSwitches(ctx, learnerId, input) {
    const learner = parentChild(ctx, learnerId);
    const member = await S.memberByLearner(learner.id);
    if (!member || member.status === "off") throw refuse(400, `Connect isn't switched on for ${learner.firstName}.`);
    const patch = { updatedAt: now() };
    if (input.directMessages !== undefined) patch.directMessages = input.directMessages;
    await db("connect_members").where({ id: member.id }).update(patch);
    return MemberService.parentChildren(ctx).then((list) => list.find((c) => c.learnerId === learner.id));
  },

  // Switching Connect off: the child's profile and everything they posted stop showing at once.
  // With deleteData their posts, comments, reactions, files, connections and message texts are
  // deleted too (the bare member row stays, as the record of consent given and withdrawn).
  async parentWithdraw(ctx, learnerId, { deleteData = false } = {}) {
    const learner = parentChild(ctx, learnerId);
    const member = await S.memberByLearner(learner.id);
    if (!member) return { status: "not_member" };
    await db("connect_members").where({ id: member.id }).update({ status: "off", withdrawnAt: now(), updatedAt: now() });
    if (deleteData) await eraseMemberData(member);
    await S.log(member.ownerAdminId, { userId: ctx.userId, name: "Parent", roleLabel: "Parent" }, deleteData ? "parent_withdrew_and_deleted" : "parent_withdrew", { targetType: "member", targetId: member.id, memberId: member.id });
    return { status: "off" };
  },

  // Who the child talks to — never what (the user's choice, 24 Nov 2026).
  async parentActivity(ctx, learnerId) {
    const learner = parentChild(ctx, learnerId);
    const member = await S.memberByLearner(learner.id);
    if (!member || member.status === "off") return { status: "off", connections: [], conversations: [], communities: [], projects: [], blocks: [] };
    const [connRows, parts, communities, projects, blockRows, posts] = await Promise.all([
      db("connect_connections").where({ status: "accepted" }).andWhere((q) => q.where({ requesterMemberId: member.id }).orWhere({ addresseeMemberId: member.id })),
      db("connect_conversation_participants").where({ memberId: member.id }).whereNull("leftAt"),
      db("connect_community_members as cm").join("connect_communities as c", "c.id", "cm.communityId").where({ "cm.memberId": member.id, "cm.status": "active" }).select("c.name", "c.slug"),
      db("connect_project_members as pm").join("connect_projects as p", "p.id", "pm.projectId").where({ "pm.memberId": member.id, "pm.status": "active" }).whereNot("p.moderation", "deleted").select("p.id", "p.title", "p.status", "pm.role"),
      db("connect_blocks").where({ memberId: member.id }),
      db("connect_posts").where({ authorMemberId: member.id }).whereNot({ status: "removed" }).count({ n: "*" }).first(),
    ]);
    const convIds = parts.map((p) => p.conversationId);
    const convs = convIds.length ? await whereInChunks(db, "connect_conversations", "id", convIds) : [];
    const allParts = convIds.length ? await whereInChunks(db, "connect_conversation_participants", "conversationId", convIds) : [];
    const otherIds = [
      ...connRows.map((r) => (r.requesterMemberId === member.id ? r.addresseeMemberId : r.requesterMemberId)),
      ...allParts.map((p) => p.memberId),
      ...blockRows.map((b) => b.otherMemberId),
    ];
    const cards = await S.memberCards(otherIds);
    const conversations = [];
    for (const c of convs) {
      const sent = await db("connect_messages").where({ conversationId: c.id, senderMemberId: member.id }).count({ n: "*" }).first();
      conversations.push({
        id: c.id,
        kind: c.kind,
        title: c.title,
        with: allParts.filter((p) => p.conversationId === c.id && p.memberId !== member.id && !p.leftAt).map((p) => cards.get(p.memberId)).filter(Boolean),
        lastMessageAt: c.lastMessageAt,
        sentByChild: Number(sent?.n || 0),
      });
    }
    conversations.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
    return {
      status: isSuspended(member) ? "suspended" : "active",
      displayName: member.displayName,
      postCount: Number(posts?.n || 0),
      connections: connRows.map((r) => ({ member: cards.get(r.requesterMemberId === member.id ? r.addresseeMemberId : r.requesterMemberId), since: r.respondedAt || r.createdAt })),
      conversations,
      communities,
      projects,
      blocks: blockRows.map((b) => ({ member: cards.get(b.otherMemberId), kind: b.kind, byParent: !!b.byParent })),
    };
  },

  async parentBlock(ctx, learnerId, otherId, on) {
    const learner = parentChild(ctx, learnerId);
    const member = await S.memberByLearner(learner.id);
    if (!member || member.status === "off") throw refuse(400, `Connect isn't switched on for ${learner.firstName}.`);
    const other = await S.memberById(otherId);
    if (!other || other.ownerAdminId !== member.ownerAdminId) throw refuse(404, "We couldn't find that person.");
    await setBlockFor(member.id, other.id, "block", on, true);
    return MemberService.parentActivity(ctx, learnerId);
  },

  // ── Admin: recording consent given another way ─────────────────────────────────────────────────
  async recordConsent(ctx, { learnerId, note }) {
    const learner = await db("learners").where({ id: learnerId }).first();
    if (!learner || (await workspaceOfLearner(learner)) !== ctx.ownerAdminId) throw refuse(404, "That learner isn't in this workspace.");
    if (learner.teacherId) throw refuse(400, "Educators in training don't take part in Connect as learners.");
    if (!learner.username) throw refuse(400, `${learner.firstName} needs their own login before Connect can be switched on.`);
    const existing = await S.memberByLearner(learner.id);
    const consent = { consentByUserId: ctx.userId, consentMethod: "recorded", consentNote: note, consentAt: now(), withdrawnAt: null };
    if (existing) await db("connect_members").where({ id: existing.id }).update({ ...consent, status: existing.status === "off" ? "active" : existing.status, updatedAt: now() });
    else await createMember(learner, ctx.ownerAdminId, consent);
    const member = await S.memberByLearner(learner.id);
    await S.log(ctx.ownerAdminId, ctx, "consent_recorded", { targetType: "member", targetId: member.id, memberId: member.id, note });
    return member;
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────────
async function createMember(learner, ownerAdminId, fields) {
  const user = learner.username ? await db("users").whereRaw("LOWER(username) = ?", [learner.username.toLowerCase()]).first("id") : null;
  try {
    await db("connect_members").insert({
      id: generateId(), ownerAdminId, learnerId: learner.id, userId: user?.id || null, status: "active",
      directMessages: true, photoAllowed: false, displayName: R.shortName(learner.firstName, learner.lastName),
      avatar: toJson(R.defaultAvatar(learner.id)), interests: toJson([]), skills: toJson([]), showCertificates: true,
      createdAt: now(), updatedAt: now(), ...fields,
    });
  } catch (err) {
    if (err.code !== "ER_DUP_ENTRY") throw err;
  }
}

function parentChild(ctx, learnerId) {
  if (ctx.kind !== "parent") throw refuse(403, "Only a parent can do this.");
  const learner = (ctx.ownLearners || []).find((l) => l.id === learnerId && !l.teacherId);
  if (!learner) throw refuse(404, "That child isn't linked to your account.");
  return learner;
}

async function activeMemberOfWorkspace(ctx, memberId) {
  const m = await S.memberById(memberId);
  if (!m || m.ownerAdminId !== ctx.ownerAdminId || m.status === "off") throw refuse(404, "We couldn't find that person on Connect.");
  return m;
}

async function connectionStates(meId, otherIds) {
  if (!otherIds.length) return new Map();
  const keys = otherIds.map((o) => R.pairKey(meId, o));
  const rows = await whereInChunks(db, "connect_connections", "pairKey", keys);
  const out = new Map();
  for (const r of rows) {
    const other = r.requesterMemberId === meId ? r.addresseeMemberId : r.requesterMemberId;
    if (r.status === "declined") continue;
    out.set(other, { id: r.id, status: r.status, direction: r.requesterMemberId === meId ? "outgoing" : "incoming" });
  }
  return out;
}

async function setBlockFor(memberId, otherId, kind, on, byParent) {
  if (on) {
    try {
      await db("connect_blocks").insert({ id: generateId(), memberId, otherMemberId: otherId, kind, byParent, createdAt: now() });
    } catch (err) {
      if (err.code !== "ER_DUP_ENTRY") throw err;
      if (byParent) await db("connect_blocks").where({ memberId, otherMemberId: otherId, kind }).update({ byParent: true });
    }
    if (kind === "block") await db("connect_connections").where({ pairKey: R.pairKey(memberId, otherId) }).del();
  } else {
    const q = db("connect_blocks").where({ memberId, otherMemberId: otherId, kind });
    // A child can't undo a block their parent set.
    if (!byParent) q.andWhere({ byParent: false });
    const removed = await q.del();
    if (!removed && !byParent && kind === "block") {
      const parentSet = await db("connect_blocks").where({ memberId, otherMemberId: otherId, kind, byParent: true }).first("id");
      if (parentSet) throw refuse(403, "Your parent blocked this person, so only they can unblock them.");
    }
  }
}

async function classBadgesOf(learnerId) {
  const rows = await db("learner_badges").where({ learnerId }).select("badgeKey").catch(() => []);
  const { BADGES } = require("../rankings/ranking.rules");
  const keys = [...new Set(rows.map((r) => r.badgeKey))];
  return keys.map((k) => {
    const b = (BADGES || []).find((x) => x.key === k);
    return { key: k, label: b?.label || k, description: b?.description || "", icon: b?.icon || "award" };
  });
}

const CERT_KINDS = { course: "Course", bootcamp: "Bootcamp", pathway: "Pathway" };
async function certificatesOf(learnerId) {
  const rows = await db("certificates").where({ learnerId, status: "issued" }).whereIn("kind", Object.keys(CERT_KINDS)).orderBy("issuedAt", "desc").select("id", "kind", "snapshot", "issuedAt");
  return rows.map((c) => {
    const snap = parseJson(c.snapshot, {}) || {};
    return { id: c.id, kind: c.kind, kindLabel: CERT_KINDS[c.kind] || "Certificate", title: snap.title || snap.courseName || snap.bootcampName || "Certificate", issuedAt: c.issuedAt };
  });
}

async function eraseMemberData(member) {
  const postIds = await db("connect_posts").where({ authorMemberId: member.id }).pluck("id");
  const fileIds = [];
  for (const p of await db("connect_posts").whereIn("id", postIds).select("fileIds")) fileIds.push(...parseJson(p.fileIds, []));
  if (postIds.length) {
    await db("connect_comments").whereIn("postId", postIds).del();
    await db("connect_reactions").whereIn("postId", postIds).del();
    await db("connect_posts").whereIn("id", postIds).del();
  }
  // Their comments on other posts: the text goes, the thread keeps its shape.
  const comments = await db("connect_comments").where({ authorMemberId: member.id }).select("id", "postId");
  await db("connect_comments").where({ authorMemberId: member.id }).update({ body: "(removed)", status: "removed" });
  for (const postId of new Set(comments.map((c) => c.postId))) await recountPost(postId);
  const reacted = await db("connect_reactions").where({ memberId: member.id }).pluck("postId");
  await db("connect_reactions").where({ memberId: member.id }).del();
  for (const postId of new Set(reacted)) await recountPost(postId);
  for (const m of await db("connect_messages").where({ senderMemberId: member.id }).select("fileIds")) fileIds.push(...parseJson(m.fileIds, []));
  await db("connect_messages").where({ senderMemberId: member.id }).update({ body: null, fileIds: null, status: "removed", removedBy: "sender" });
  await db("connect_connections").where((q) => q.where({ requesterMemberId: member.id }).orWhere({ addresseeMemberId: member.id })).del();
  await db("connect_blocks").where({ memberId: member.id }).del();
  await db("connect_community_members").where({ memberId: member.id }).del();
  await db("connect_project_members").where({ memberId: member.id }).update({ status: "left", updatedAt: now() });
  await db("connect_conversation_participants").where({ memberId: member.id }).update({ leftAt: now() });
  await db("connect_badges").where({ memberId: member.id }).del();
  const files = fileIds.length ? await whereInChunks(db, "connect_files", "id", fileIds) : [];
  const uploads = member.userId ? await db("connect_files").where({ uploaderUserId: member.userId }) : [];
  for (const f of [...files, ...uploads]) Files.removeStored(f.storedName);
  const allFileIds = [...new Set([...files, ...uploads].map((f) => f.id))];
  if (allFileIds.length) await db("connect_files").whereIn("id", allFileIds).del();
  await db("connect_members").where({ id: member.id }).update({ displayName: "Former member", bio: null, interests: toJson([]), skills: toJson([]), avatar: null });
}

async function recountPost(postId) {
  const [c, r] = await Promise.all([
    db("connect_comments").where({ postId, status: "visible" }).count({ n: "*" }).first(),
    db("connect_reactions").where({ postId }).count({ n: "*" }).first(),
  ]);
  await db("connect_posts").where({ id: postId }).update({ commentCount: Number(c?.n || 0), reactionCount: Number(r?.n || 0) });
}

// Uploads never put on anything are deleted after a day.
async function cleanOrphans(ownerAdminId) {
  const old = await db("connect_files").where({ ownerAdminId }).whereNull("attachedId").andWhere("createdAt", "<", new Date(Date.now() - 24 * 60 * 60 * 1000)).limit(50);
  for (const f of old) Files.removeStored(f.storedName);
  if (old.length) await db("connect_files").whereIn("id", old.map((f) => f.id)).del();
}

module.exports = MemberService;
module.exports.recountPost = recountPost;
