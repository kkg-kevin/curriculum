const db = require("../../config/db");
const NotificationService = require("../notifications/notification.service");

// Connect's notices go through the app's own bell (notifications table). None is an email type,
// so nothing is emailed — a child's username login has no email anyway, and the bell is enough.
// Kept few on purpose: reactions are one notice per post per day, messages one per unread stretch
// of a conversation, challenges and announcements once each.

const BASE = "/learner-portal/connect";

// The child's own login for a member (stored once found).
async function userIdOfMember(member) {
  if (!member) return null;
  if (member.userId) return member.userId;
  const learner = await db("learners").where({ id: member.learnerId }).first("username");
  if (!learner?.username) return null;
  const user = await db("users").whereRaw("LOWER(username) = ?", [learner.username.toLowerCase()]).first("id");
  if (user) await db("connect_members").where({ id: member.id }).update({ userId: user.id });
  return user?.id || null;
}

async function toMember(memberOrId, event) {
  // An id, or a row that may be only { id } — the full row is loaded when needed.
  const id = typeof memberOrId === "string" ? memberOrId : memberOrId?.id;
  const member = memberOrId && typeof memberOrId === "object" && memberOrId.learnerId ? memberOrId : id ? await db("connect_members").where({ id }).first() : null;
  if (!member || member.status === "off") return null;
  const userId = await userIdOfMember(member);
  if (!userId) return null;
  return NotificationService.notifyPerson(userId, event);
}

async function toMembers(members, makeEvent) {
  for (const m of members) await toMember(m, makeEvent(m));
}

// Moderators of the workspace (its admins, the educators named in Settings) and, for something in
// a community, that community's moderators.
async function toModerators(ownerAdminId, settings, communityId, event) {
  const staffEvent = { ...event, payload: { ...event.payload, route: "/connect?tab=review" }, ownerAdminId };
  await NotificationService._notify(ownerAdminId, staffEvent);
  const educatorIds = new Set(settings?.moderatorUserIds || []);
  if (communityId) {
    for (const id of await db("connect_community_moderators").where({ communityId }).pluck("userId")) educatorIds.add(id);
  }
  for (const id of educatorIds) {
    const user = await db("users").where({ id }).first("role", "extraRoles");
    const route = user?.role === "admin" ? "/connect?tab=review" : "/teacher-portal/connect?tab=review";
    await NotificationService.notifyPerson(id, { ...event, payload: { ...event.payload, route } });
  }
}

const day = () => new Date().toISOString().slice(0, 10);
const clip = (text, n = 80) => {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

const ConnectNotices = {
  userIdOfMember,
  toMember,

  comment(postAuthor, post, who, text) {
    return toMember(postAuthor, {
      type: "connect_comment",
      title: "New comment on your post",
      message: `${who} commented: "${clip(text)}"`,
      payload: { route: `${BASE}/posts/${post.id}` },
    });
  },

  reply(commentAuthor, post, who, text) {
    return toMember(commentAuthor, {
      type: "connect_reply",
      title: "Someone replied to you",
      message: `${who} replied: "${clip(text)}"`,
      payload: { route: `${BASE}/posts/${post.id}` },
    });
  },

  reaction(postAuthor, post) {
    return toMember(postAuthor, {
      type: "connect_reaction",
      title: "People like your post",
      message: "Your post is getting reactions on Connect.",
      payload: { route: `${BASE}/posts/${post.id}` },
      dedupeKey: `connect_reaction:${post.id}:${day()}`,
    });
  },

  message(participant, conversation, who) {
    const since = participant.lastReadAt ? new Date(participant.lastReadAt).getTime() : 0;
    return toMember(participant.memberId, {
      type: "connect_message",
      title: conversation.kind === "direct" ? `Message from ${who}` : `New message in ${conversation.title || "your chat"}`,
      message: conversation.kind === "direct" ? `${who} sent you a message.` : `${who} wrote in ${conversation.title || "the chat"}.`,
      payload: { route: `${BASE}/messages/${conversation.id}` },
      dedupeKey: `connect_message:${conversation.id}:${participant.memberId}:${since}`,
    });
  },

  connectionRequest(addressee, who) {
    return toMember(addressee, {
      type: "connect_connection",
      title: "Connection request",
      message: `${who} would like to connect with you on Connect.`,
      payload: { route: `${BASE}/people?tab=requests` },
    });
  },

  connectionAccepted(requester, who) {
    return toMember(requester, {
      type: "connect_connection",
      title: "You're connected",
      message: `${who} said yes — you're now connected.`,
      payload: { route: `${BASE}/people?tab=connections` },
    });
  },

  communityInvite(member, community, who) {
    return toMember(member, {
      type: "connect_community_invite",
      title: `Invitation to ${community.name}`,
      message: `${who} invited you to join ${community.name}.`,
      payload: { route: `${BASE}/communities/${community.slug}` },
      dedupeKey: `connect_community_invite:${community.id}:${member.id || member}`,
    });
  },

  communityApproved(member, community) {
    return toMember(member, {
      type: "connect_community_invite",
      title: `Welcome to ${community.name}`,
      message: `You're now a member of ${community.name}.`,
      payload: { route: `${BASE}/communities/${community.slug}` },
    });
  },

  projectInvite(member, project, who) {
    return toMember(member, {
      type: "connect_project_invite",
      title: "Join a project team",
      message: `${who} invited you to work on "${clip(project.title, 60)}".`,
      payload: { route: `${BASE}/projects/${project.id}` },
      dedupeKey: `connect_project_invite:${project.id}:${member.id || member}:${day()}`,
    });
  },

  projectJoinRequest(owner, project, who) {
    return toMember(owner, {
      type: "connect_project_invite",
      title: "Someone wants to join your project",
      message: `${who} asked to join "${clip(project.title, 60)}".`,
      payload: { route: `${BASE}/projects/${project.id}?tab=team` },
    });
  },

  projectJoined(member, project) {
    return toMember(member, {
      type: "connect_project_update",
      title: "You're on the team",
      message: `You're now part of "${clip(project.title, 60)}".`,
      payload: { route: `${BASE}/projects/${project.id}` },
    });
  },

  projectUpdate(members, project, who) {
    return toMembers(members, (m) => ({
      type: "connect_project_update",
      title: `Update on ${clip(project.title, 40)}`,
      message: `${who} posted an update.`,
      payload: { route: `${BASE}/projects/${project.id}?tab=updates` },
      dedupeKey: `connect_project_update:${project.id}:${m.id}:${day()}`,
    }));
  },

  challengeAnnounced(members, challenge) {
    return toMembers(members, (m) => ({
      type: "connect_challenge",
      title: `New challenge: ${clip(challenge.title, 60)}`,
      message: challenge.endsOn ? `Take part before ${String(challenge.endsOn).slice(0, 10)}.` : "Have a look and take part.",
      payload: { route: `${BASE}/challenges/${challenge.id}` },
      dedupeKey: `connect_challenge:${challenge.id}:${m.id}`,
    }));
  },

  challengeAward(members, challenge, award) {
    const words = { winner: "won", runner_up: "came runner-up in", commended: "were commended in", participant: "took part in" };
    return toMembers(members, (m) => ({
      type: "connect_challenge",
      title: award === "participant" ? "Thanks for taking part" : "Challenge results",
      message: `You ${words[award] || "took part in"} "${clip(challenge.title, 60)}".`,
      payload: { route: `${BASE}/challenges/${challenge.id}` },
      dedupeKey: `connect_challenge_award:${challenge.id}:${m.id}:${award}`,
    }));
  },

  announcement(members, post, communityName) {
    return toMembers(members, (m) => ({
      type: "connect_announcement",
      title: communityName ? `Announcement in ${communityName}` : "Connect announcement",
      message: clip(post.body, 100),
      payload: { route: `${BASE}/posts/${post.id}` },
      dedupeKey: `connect_announcement:${post.id}:${m.id}`,
    }));
  },

  postApproved(member, post) {
    return toMember(member, {
      type: "connect_moderation",
      title: "Your post is up",
      message: "A teacher checked your post and it's now on Connect.",
      payload: { route: `${BASE}/posts/${post.id}` },
    });
  },

  contentRemoved(member, what, reason) {
    return toMember(member, {
      type: "connect_moderation",
      title: `Your ${what} was taken down`,
      message: reason ? `A teacher took down your ${what}: ${clip(reason, 120)}` : `A teacher took down your ${what} because it didn't follow Connect's rules.`,
      payload: { route: `${BASE}/rules` },
    });
  },

  suspended(member, until, reason) {
    return toMember(member, {
      type: "connect_moderation",
      title: "A break from posting",
      message: `You can read Connect but can't post or message until ${new Date(until).toLocaleDateString("en-GB")}.${reason ? ` ${clip(reason, 120)}` : ""}`,
      payload: { route: `${BASE}/rules` },
    });
  },

  reportSeen(member) {
    return toMember(member, {
      type: "connect_moderation",
      title: "Thanks for telling us",
      message: "A teacher looked at what you reported. Thank you for helping keep Connect kind and safe.",
      payload: { route: BASE },
    });
  },

  toModerators,

  reported(ownerAdminId, settings, communityId, what) {
    return toModerators(ownerAdminId, settings, communityId, {
      type: "connect_report",
      title: "Something was reported on Connect",
      message: `A learner reported a ${what}. Please have a look.`,
      payload: {},
    });
  },

  waitingReview(ownerAdminId, settings, communityId) {
    return toModerators(ownerAdminId, settings, communityId, {
      type: "connect_review",
      title: "Posts waiting on Connect",
      message: "Learners' posts are waiting for a check before others see them.",
      payload: {},
      dedupeKey: `connect_review:${ownerAdminId}:${communityId || "feed"}:${day()}`,
    });
  },

  joinRequest(ownerAdminId, settings, community, who) {
    return toModerators(ownerAdminId, settings, community.id, {
      type: "connect_review",
      title: `Request to join ${community.name}`,
      message: `${who} asked to join ${community.name}.`,
      payload: {},
      dedupeKey: `connect_join:${community.id}:${day()}`,
    });
  },
};

module.exports = ConnectNotices;
