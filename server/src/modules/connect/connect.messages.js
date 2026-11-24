const { generateId, toJson, whereInChunks } = require("../../shared/utils/model.utils");
const { learnerAge } = require("../../shared/utils/age");
const R = require("./connect.rules");
const S = require("./connect.store");
const Notices = require("./connect.notifications");
const { requireMember } = require("./connect.context");

const { db, refuse, now, parseJson } = S;

// Messages between learners. Only ever between learners — no adult has a private chat with a child
// here (moderators read a conversation only through a report about it).
//   direct   one-to-one: both at least the age in Settings (13), both allowed by their parent,
//            connected, and nobody blocked (connect.rules.js's directMessageBlocker)
//   group    a learner of that age starts it with their connections, under the same rule
//   project  a project team's own chat — every age; its people follow the team
// The page asks for new messages every few seconds (no WebSockets: the hosting doesn't keep them
// open reliably).

const PAGE = 40;

async function loadConversation(ctx, conversationId) {
  const me = requireMember(ctx);
  const conv = await db("connect_conversations").where({ id: conversationId }).first();
  const part = conv ? await db("connect_conversation_participants").where({ conversationId: conv.id, memberId: me.id }).first() : null;
  // Only the people in a conversation reach it — anyone else gets "not found".
  if (!conv || conv.ownerAdminId !== ctx.ownerAdminId || !part || part.leftAt) throw refuse(404, "That conversation isn't there.");
  return { conv, part, me };
}

// Why this member can't write here now, or null.
async function sendBlocker(ctx, conv, me) {
  if (conv.status !== "active") return "This chat is closed.";
  if (conv.kind === "project") {
    const team = await db("connect_project_members").where({ projectId: conv.projectId, memberId: me.id, status: "active" }).first("id");
    return team ? null : "You're no longer on this project's team.";
  }
  const myAge = learnerAge(ctx.learner);
  const others = await db("connect_conversation_participants").where({ conversationId: conv.id }).whereNot({ memberId: me.id }).whereNull("leftAt");
  if (conv.kind === "direct") {
    const other = await S.memberById(others[0]?.memberId);
    if (!other || other.status === "off") return "This person isn't on Connect any more.";
    return R.directMessageBlocker({
      settings: ctx.settings, myAge, otherAge: await S.ageOfMember(other), me, other,
      connected: await S.areConnected(me.id, other.id), blocked: await S.isBlockedEitherWay(me.id, other.id),
    });
  }
  // group: the sender must still be allowed group chats.
  const s = ctx.settings;
  if (!s.groupChats || !s.directMessages) return "Group chats are switched off on Connect.";
  if (myAge == null || myAge < s.dmMinAge) return `Group chats open when you're ${s.dmMinAge}.`;
  if (!me.directMessages) return "Your parent has switched messages with other learners off for you.";
  return null;
}

async function list(ctx) {
  const me = requireMember(ctx);
  const parts = await db("connect_conversation_participants").where({ memberId: me.id }).whereNull("leftAt");
  if (!parts.length) return [];
  const convs = (await whereInChunks(db, "connect_conversations", "id", parts.map((p) => p.conversationId))).filter((c) => c.status === "active" || c.lastMessageAt);
  const everyone = await whereInChunks(db, "connect_conversation_participants", "conversationId", convs.map((c) => c.id));
  const cards = await S.memberCards(everyone.map((p) => p.memberId));
  const projects = await whereInChunks(db, "connect_projects", "id", convs.map((c) => c.projectId).filter(Boolean));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const myPart = new Map(parts.map((p) => [p.conversationId, p]));
  const out = [];
  for (const c of convs) {
    const last = await db("connect_messages").where({ conversationId: c.id }).orderBy("createdAt", "desc").first();
    const mine = myPart.get(c.id);
    const unreadQ = db("connect_messages").where({ conversationId: c.id, status: "visible" }).whereNot({ senderMemberId: me.id });
    if (mine.lastReadAt) unreadQ.andWhere("createdAt", ">", mine.lastReadAt);
    const unread = await unreadQ.count({ n: "*" }).first();
    const people = everyone.filter((p) => p.conversationId === c.id && p.memberId !== me.id && !p.leftAt).map((p) => cards.get(p.memberId)).filter(Boolean);
    out.push({
      id: c.id,
      kind: c.kind,
      title: c.kind === "project" ? projectById.get(c.projectId)?.title || c.title : c.kind === "direct" ? people[0]?.displayName || "Chat" : c.title || people.map((p) => p.displayName).join(", "),
      people,
      projectId: c.projectId,
      muted: !!mine.muted,
      unread: Number(unread?.n || 0),
      lastMessage: last ? { preview: last.status !== "visible" ? "Message removed" : last.body ? String(last.body).slice(0, 80) : "Sent a file", mine: last.senderMemberId === me.id, at: last.createdAt } : null,
      lastMessageAt: c.lastMessageAt || c.createdAt,
      status: c.status,
    });
  }
  return out.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
}

// Starts (or reopens) a chat. One other person = one-to-one (the same one each time); more = a group.
async function start(ctx, { memberIds, title }) {
  const me = requireMember(ctx, { write: true });
  const ids = [...new Set(memberIds)].filter((id) => id !== me.id);
  if (!ids.length) throw refuse(400, "Choose who to chat with.");
  const others = [];
  for (const id of ids) {
    const m = await S.memberById(id);
    if (!m || m.ownerAdminId !== ctx.ownerAdminId || m.status === "off") throw refuse(404, "We couldn't find one of those people.");
    others.push(m);
  }
  const myAge = learnerAge(ctx.learner);
  if (others.length === 1) {
    const other = others[0];
    const reason = R.directMessageBlocker({
      settings: ctx.settings, myAge, otherAge: await S.ageOfMember(other), me, other,
      connected: await S.areConnected(me.id, other.id), blocked: await S.isBlockedEitherWay(me.id, other.id),
    });
    if (reason) throw refuse(403, reason, { code: "CONNECT_DM_REFUSED" });
    const directKey = R.pairKey(me.id, other.id);
    let conv = await db("connect_conversations").where({ directKey }).first();
    if (!conv) {
      conv = { id: generateId(), ownerAdminId: ctx.ownerAdminId, kind: "direct", directKey, createdByUserId: ctx.userId, status: "active", createdAt: now(), updatedAt: now() };
      try {
        await db("connect_conversations").insert(conv);
        await addParticipants(conv.id, [me, other], me.id);
      } catch (err) {
        if (err.code !== "ER_DUP_ENTRY") throw err;
        conv = await db("connect_conversations").where({ directKey }).first();
      }
    } else {
      await db("connect_conversation_participants").where({ conversationId: conv.id }).whereIn("memberId", [me.id, other.id]).update({ leftAt: null });
      if (conv.status !== "active") await db("connect_conversations").where({ id: conv.id }).update({ status: "active" });
    }
    return { id: conv.id };
  }
  if (others.length > 9) throw refuse(400, "A group chat can have up to 10 people.");
  const ages = await S.agesOfMembers(others);
  const checks = [];
  for (const o of others) checks.push({ member: o, age: ages.get(o.id), connected: await S.areConnected(me.id, o.id), blocked: await S.isBlockedEitherWay(me.id, o.id) });
  const reason = R.groupChatBlocker({ settings: ctx.settings, myAge, me, others: checks });
  if (reason) throw refuse(403, reason, { code: "CONNECT_DM_REFUSED" });
  S.checkLearnerText(ctx, title);
  const conv = { id: generateId(), ownerAdminId: ctx.ownerAdminId, kind: "group", title: title || null, createdByUserId: ctx.userId, status: "active", createdAt: now(), updatedAt: now() };
  await db("connect_conversations").insert(conv);
  await addParticipants(conv.id, [me, ...others], me.id);
  return { id: conv.id };
}

async function addParticipants(conversationId, members, ownerMemberId) {
  for (const m of members) {
    try {
      await db("connect_conversation_participants").insert({ id: generateId(), conversationId, memberId: m.id, userId: m.userId || null, role: m.id === ownerMemberId ? "owner" : "member", createdAt: now() });
    } catch (err) {
      if (err.code !== "ER_DUP_ENTRY") throw err;
      await db("connect_conversation_participants").where({ conversationId, memberId: m.id }).update({ leftAt: null });
    }
  }
}

async function messageViews(ctx, rows, me) {
  const cards = await S.memberCards(rows.map((m) => m.senderMemberId));
  const files = await S.filesFor(rows.flatMap((m) => (m.status === "visible" ? parseJson(m.fileIds, []) : [])));
  return rows.map((m) => ({
    id: m.id,
    sender: cards.get(m.senderMemberId),
    mine: m.senderMemberId === me.id,
    body: m.status === "visible" ? m.body || "" : "",
    files: m.status === "visible" ? parseJson(m.fileIds, []).map((id) => files.get(id)).filter(Boolean) : [],
    removed: m.status !== "visible",
    removedBy: m.status !== "visible" ? m.removedBy : null,
    createdAt: m.createdAt,
  }));
}

// A page of messages, newest last. `before` (a cursor) for older ones; `after` (a time) for the
// new ones since the last look — what the page polls.
async function messages(ctx, conversationId, { before, after } = {}) {
  const { conv, part, me } = await loadConversation(ctx, conversationId);
  let q = db("connect_messages").where({ conversationId: conv.id });
  if (after) {
    const at = new Date(after);
    if (!Number.isNaN(at.getTime())) q = q.andWhere("createdAt", ">", at);
    const rows = await q.orderBy("createdAt", "asc").limit(200);
    return { items: await messageViews(ctx, rows, me), hasMore: false, nextCursor: null, ...(await convHeader(ctx, conv, part, me)) };
  }
  const c = R.decodeCursor(before);
  if (c) q = q.andWhere((w) => w.where("createdAt", "<", c.createdAt).orWhere((x) => x.where("createdAt", "=", c.createdAt).andWhere("id", "<", c.id)));
  const rows = await q.orderBy([{ column: "createdAt", order: "desc" }, { column: "id", order: "desc" }]).limit(PAGE + 1);
  const hasMore = rows.length > PAGE;
  const page = rows.slice(0, PAGE).reverse();
  return { items: await messageViews(ctx, page, me), hasMore, nextCursor: hasMore ? R.encodeCursor(page[0]) : null, ...(await convHeader(ctx, conv, part, me)) };
}

async function convHeader(ctx, conv, part, me) {
  const people = await db("connect_conversation_participants").where({ conversationId: conv.id }).whereNull("leftAt");
  const cards = await S.memberCards(people.map((p) => p.memberId));
  const project = conv.projectId ? await db("connect_projects").where({ id: conv.projectId }).first("id", "title") : null;
  const others = people.filter((p) => p.memberId !== me.id).map((p) => cards.get(p.memberId)).filter(Boolean);
  // When the others last read — "Seen" on my latest message.
  const othersRead = people.filter((p) => p.memberId !== me.id).map((p) => p.lastReadAt).filter(Boolean).map((d) => new Date(d).getTime());
  return {
    conversation: {
      id: conv.id, kind: conv.kind, status: conv.status,
      title: conv.kind === "project" ? project?.title || conv.title : conv.kind === "direct" ? others[0]?.displayName : conv.title || others.map((o) => o.displayName).join(", "),
      projectId: conv.projectId,
      people: others,
      muted: !!part.muted,
      seenUpTo: othersRead.length ? new Date(Math.min(...othersRead)) : null,
      sendBlocker: await sendBlocker(ctx, conv, me),
      filesAllowed: R.messageFilesAllowed(ctx.settings, conv.kind),
    },
  };
}

async function send(ctx, conversationId, { body, fileIds = [] }) {
  const { conv, me } = await loadConversation(ctx, conversationId);
  requireMember(ctx, { write: true });
  const blocker = await sendBlocker(ctx, conv, me);
  if (blocker) throw refuse(403, blocker, { code: "CONNECT_DM_REFUSED" });
  S.checkLearnerText(ctx, body);
  if (fileIds.length && !R.messageFilesAllowed(ctx.settings, conv.kind)) throw refuse(403, conv.kind === "project" || ctx.settings.messageFiles === "off" ? "Pictures and files can't be sent in messages on Connect." : "Pictures and files can only be sent in project team chats.");
  const minute = new Date(Date.now() - 60 * 1000);
  if ((await S.countSince("connect_messages", "senderMemberId", me.id, minute)) >= ctx.settings.messagesPerMinute) throw refuse(429, "Slow down a little — wait a minute before sending more.");
  const id = generateId();
  await S.claimFiles(fileIds, { userId: ctx.userId, ownerAdminId: ctx.ownerAdminId, attachedType: "message", attachedId: id, max: 4 });
  const at = now();
  await db("connect_messages").insert({ id, conversationId: conv.id, senderMemberId: me.id, body: body || null, fileIds: toJson(fileIds), status: "visible", createdAt: at });
  await db("connect_conversations").where({ id: conv.id }).update({ lastMessageAt: at, updatedAt: at });
  await db("connect_conversation_participants").where({ conversationId: conv.id, memberId: me.id }).update({ lastReadAt: at });
  // Tell the others — once per stretch of unread messages, never when they muted the chat.
  const others = await db("connect_conversation_participants").where({ conversationId: conv.id }).whereNot({ memberId: me.id }).whereNull("leftAt");
  for (const p of others) {
    if (p.muted) continue;
    if (conv.kind === "direct" && (await S.isBlockedEitherWay(me.id, p.memberId))) continue;
    Notices.message(p, conv, me.displayName).catch(() => {});
  }
  const [view] = await messageViews(ctx, [{ id, conversationId: conv.id, senderMemberId: me.id, body, fileIds, status: "visible", createdAt: at }], me);
  return view;
}

async function removeMessage(ctx, messageId) {
  const me = requireMember(ctx);
  const msg = await db("connect_messages").where({ id: messageId }).first();
  if (!msg) throw refuse(404, "That message isn't there.");
  await loadConversation(ctx, msg.conversationId);
  if (msg.senderMemberId !== me.id) throw refuse(403, "You can only remove your own messages.");
  await db("connect_messages").where({ id: msg.id }).update({ status: "removed", removedBy: "sender" });
  return { removed: true };
}

async function markRead(ctx, conversationId) {
  const { conv, me } = await loadConversation(ctx, conversationId);
  await db("connect_conversation_participants").where({ conversationId: conv.id, memberId: me.id }).update({ lastReadAt: now() });
  return { read: true };
}

async function mute(ctx, conversationId, muted) {
  const { conv, me } = await loadConversation(ctx, conversationId);
  await db("connect_conversation_participants").where({ conversationId: conv.id, memberId: me.id }).update({ muted });
  return { muted };
}

async function leaveConversation(ctx, conversationId) {
  const { conv, me } = await loadConversation(ctx, conversationId);
  if (conv.kind === "project") throw refuse(400, "This is your project team's chat — leave the team to leave it.");
  await db("connect_conversation_participants").where({ conversationId: conv.id, memberId: me.id }).update({ leftAt: now() });
  return { left: true };
}

// ── Project team chats ───────────────────────────────────────────────────────────────────────────
// Keeps a project's chat in step with its active team (called whenever the team changes).
async function syncProjectChat(project) {
  let convId = project.conversationId;
  if (!convId) {
    convId = generateId();
    await db("connect_conversations").insert({ id: convId, ownerAdminId: project.ownerAdminId, kind: "project", title: project.title.slice(0, 80), projectId: project.id, status: "active", createdAt: now(), updatedAt: now() });
    await db("connect_projects").where({ id: project.id }).update({ conversationId: convId });
  } else {
    await db("connect_conversations").where({ id: convId }).update({ title: project.title.slice(0, 80), status: project.moderation === "visible" ? "active" : "closed" });
  }
  const team = await db("connect_project_members as pm").join("connect_members as m", "m.id", "pm.memberId").where({ "pm.projectId": project.id, "pm.status": "active" }).select("m.id", "m.userId", "pm.role");
  const teamIds = new Set(team.map((t) => t.id));
  const parts = await db("connect_conversation_participants").where({ conversationId: convId });
  for (const p of parts) {
    if (!teamIds.has(p.memberId) && !p.leftAt) await db("connect_conversation_participants").where({ id: p.id }).update({ leftAt: now() });
  }
  for (const t of team) {
    const p = parts.find((x) => x.memberId === t.id);
    if (!p) await db("connect_conversation_participants").insert({ id: generateId(), conversationId: convId, memberId: t.id, userId: t.userId || null, role: t.role === "owner" ? "owner" : "member", createdAt: now() });
    else if (p.leftAt) await db("connect_conversation_participants").where({ id: p.id }).update({ leftAt: null });
  }
  return convId;
}

// For a report about a message: the conversation around it, for the moderator only.
async function contextAround(messageId, span = 10) {
  const msg = await db("connect_messages").where({ id: messageId }).first();
  if (!msg) return [];
  const [before, after] = await Promise.all([
    db("connect_messages").where({ conversationId: msg.conversationId }).andWhere("createdAt", "<", msg.createdAt).orderBy("createdAt", "desc").limit(span),
    db("connect_messages").where({ conversationId: msg.conversationId }).andWhere("createdAt", ">=", msg.createdAt).orderBy("createdAt", "asc").limit(span + 1),
  ]);
  const rows = [...before.reverse(), ...after];
  const cards = await S.memberCards(rows.map((m) => m.senderMemberId));
  const files = await S.filesFor(rows.flatMap((m) => parseJson(m.fileIds, [])));
  return rows.map((m) => ({
    id: m.id, sender: cards.get(m.senderMemberId), body: m.body || "", files: parseJson(m.fileIds, []).map((id) => files.get(id)).filter(Boolean),
    status: m.status, createdAt: m.createdAt, reported: m.id === messageId,
  }));
}

module.exports = { list, start, messages, send, removeMessage, markRead, mute, leaveConversation, syncProjectChat, contextAround };
