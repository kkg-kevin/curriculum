const { id, fk } = require("../helpers");

// Digifunzi Connect (modules/connect/, 24 Nov 2026): the learners' own community — a feed, interest
// communities, messages, project teams and challenges. It belongs to the WORKSPACE, never to a class,
// course or bootcamp: nothing here is removed when a learner's enrolment ends.
//
// The user's choices (24 Nov 2026): only a child's own username login takes part; a parent switches
// it on for each child (consent); one-to-one messages only from the age set in Settings (13) and only
// with accepted connections, with a parent's switch; parents see WHO their child talks to, never what.
//
//   connect_settings                one row per workspace (the safety switches)
//   connect_members                 one per learner switched on (consent, profile, suspension)
//   connect_communities (+ _members, _moderators)
//   connect_posts, connect_comments, connect_reactions
//   connect_files                   pictures and project files — kept privately, never under /uploads
//   connect_connections             two learners who both said yes
//   connect_blocks                  block / mute, by the learner or by their parent
//   connect_conversations (+ _participants), connect_messages
//   connect_projects (+ _members, _updates, _milestones)
//   connect_challenges (+ _entries)
//   connect_badges                  Connect's own badges (class badges stay in learner_badges)
//   connect_reports, connect_moderation_log
// New tables have a newer collation than the older ones — never SQL-join them to older tables.
exports.up = async function up(knex) {
  const create = async (name, build) => {
    if (!(await knex.schema.hasTable(name))) await knex.schema.createTable(name, build);
  };

  await create("connect_settings", (t) => {
    id(t);
    fk(t, "ownerAdminId").notNullable().unique();
    t.json("settings").nullable();
    t.datetime("createdAt").notNullable();
    t.datetime("updatedAt").nullable();
  });

  await create("connect_members", (t) => {
    id(t);
    fk(t, "ownerAdminId").notNullable();
    fk(t, "learnerId").notNullable().unique();
    fk(t, "userId").nullable(); // the child's own username login
    t.string("status", 16).notNullable().defaultTo("active"); // active | off | suspended
    // Consent: who switched it on, how, and when (Kenya DPA s.33).
    fk(t, "consentByUserId").nullable();
    t.string("consentMethod", 20).nullable(); // parent | recorded (an admin, offline consent)
    t.string("consentNote", 500).nullable();
    t.datetime("consentAt").nullable();
    t.datetime("withdrawnAt").nullable();
    // The parent's switches.
    t.boolean("directMessages").notNullable().defaultTo(true);
    t.boolean("photoAllowed").notNullable().defaultTo(false);
    // The profile other learners see.
    t.string("displayName", 40).notNullable();
    t.json("avatar").nullable(); // { icon, color } or { photo: true }
    t.string("bio", 300).nullable();
    t.json("interests").nullable();
    t.json("skills").nullable();
    t.boolean("showCertificates").notNullable().defaultTo(true);
    t.integer("postsSent").notNullable().defaultTo(0); // decides "new member" review
    t.datetime("suspendedUntil").nullable();
    t.string("suspendedReason", 500).nullable();
    t.datetime("lastSeenAt").nullable();
    t.datetime("createdAt").notNullable();
    t.datetime("updatedAt").nullable();
    t.index(["ownerAdminId", "status"]);
    t.index("userId");
  });

  await create("connect_communities", (t) => {
    id(t);
    fk(t, "ownerAdminId").notNullable();
    t.string("slug", 80).notNullable();
    t.string("name", 80).notNullable();
    t.string("description", 1000).nullable();
    t.string("icon", 30).nullable();
    t.string("color", 12).nullable();
    t.json("topics").nullable(); // interest keys it suits — Discover suggests from these
    t.string("joinMode", 12).notNullable().defaultTo("open"); // open | approval
    t.string("postingMode", 16).notNullable().defaultTo("members"); // members | moderators
    t.string("status", 12).notNullable().defaultTo("active"); // active | archived
    t.integer("memberCount").notNullable().defaultTo(0);
    t.integer("postCount").notNullable().defaultTo(0);
    fk(t, "createdByUserId").nullable();
    t.string("createdByName", 150).nullable();
    t.datetime("createdAt").notNullable();
    t.datetime("updatedAt").nullable();
    t.unique(["ownerAdminId", "slug"]);
  });

  await create("connect_community_members", (t) => {
    id(t);
    fk(t, "communityId").notNullable();
    fk(t, "memberId").notNullable();
    t.string("status", 12).notNullable().defaultTo("active"); // active | pending | invited
    fk(t, "invitedByUserId").nullable();
    t.datetime("createdAt").notNullable();
    t.datetime("updatedAt").nullable();
    t.unique(["communityId", "memberId"]);
    t.index("memberId");
  });

  await create("connect_community_moderators", (t) => {
    id(t);
    fk(t, "communityId").notNullable();
    fk(t, "userId").notNullable(); // an educator's or staff member's login — never a child
    t.string("name", 150).nullable();
    t.datetime("createdAt").notNullable();
    t.unique(["communityId", "userId"]);
    t.index("userId");
  });

  await create("connect_posts", (t) => {
    id(t);
    fk(t, "ownerAdminId").notNullable();
    fk(t, "communityId").nullable(); // null = the main feed
    fk(t, "authorMemberId").nullable(); // a learner…
    fk(t, "authorUserId").notNullable(); // …or staff (announcements)
    t.string("authorKind", 10).notNullable().defaultTo("learner"); // learner | staff
    t.string("authorName", 150).nullable(); // staff only
    t.string("category", 16).notNullable().defaultTo("general");
    t.text("body").nullable();
    t.json("fileIds").nullable();
    t.string("link", 500).nullable(); // an allowed site (Scratch, GitHub, YouTube…)
    fk(t, "projectId").nullable();
    fk(t, "sharedPostId").nullable();
    t.json("achievement").nullable(); // { kind: badge|certificate, label }
    t.string("status", 12).notNullable().defaultTo("visible"); // visible | pending | removed
    t.string("reviewReason", 200).nullable(); // why it waits for a check
    t.string("removedReason", 500).nullable();
    t.boolean("pinned").notNullable().defaultTo(false);
    t.integer("reactionCount").notNullable().defaultTo(0);
    t.integer("commentCount").notNullable().defaultTo(0);
    t.integer("shareCount").notNullable().defaultTo(0);
    t.datetime("editedAt").nullable();
    t.datetime("createdAt").notNullable();
    t.datetime("updatedAt").nullable();
    t.index(["ownerAdminId", "status", "createdAt"]);
    t.index(["communityId", "status", "createdAt"]);
    t.index("authorMemberId");
    t.index("projectId");
  });

  await create("connect_comments", (t) => {
    id(t);
    fk(t, "postId").notNullable();
    fk(t, "parentCommentId").nullable(); // one level of replies
    fk(t, "authorMemberId").nullable();
    fk(t, "authorUserId").notNullable();
    t.string("authorKind", 10).notNullable().defaultTo("learner");
    t.string("authorName", 150).nullable();
    t.string("body", 1000).notNullable();
    t.string("status", 12).notNullable().defaultTo("visible"); // visible | removed
    t.datetime("editedAt").nullable();
    t.datetime("createdAt").notNullable();
    t.datetime("updatedAt").nullable();
    t.index(["postId", "createdAt"]);
    t.index("authorMemberId");
  });

  await create("connect_reactions", (t) => {
    id(t);
    fk(t, "postId").notNullable();
    fk(t, "userId").notNullable();
    fk(t, "memberId").nullable();
    t.string("kind", 12).notNullable(); // like | love | wow | idea | clap
    t.datetime("createdAt").notNullable();
    t.unique(["postId", "userId"]);
  });

  await create("connect_files", (t) => {
    id(t);
    fk(t, "ownerAdminId").notNullable();
    fk(t, "uploaderUserId").notNullable();
    t.string("storedName", 80).notNullable();
    t.string("filename", 200).notNullable();
    t.string("mimeType", 100).notNullable();
    t.integer("size").notNullable();
    t.string("kind", 8).notNullable(); // image | file
    t.string("attachedType", 16).nullable(); // post | message | project | update | challenge | entry
    fk(t, "attachedId").nullable();
    t.datetime("createdAt").notNullable();
    t.index(["attachedType", "attachedId"]);
    t.index("uploaderUserId");
  });

  await create("connect_connections", (t) => {
    id(t);
    fk(t, "ownerAdminId").notNullable();
    t.string("pairKey", 80).notNullable().unique(); // the two member ids, sorted
    fk(t, "requesterMemberId").notNullable();
    fk(t, "addresseeMemberId").notNullable();
    t.string("status", 12).notNullable().defaultTo("pending"); // pending | accepted | declined
    t.datetime("respondedAt").nullable();
    t.datetime("createdAt").notNullable();
    t.datetime("updatedAt").nullable();
    t.index("requesterMemberId");
    t.index("addresseeMemberId");
  });

  await create("connect_blocks", (t) => {
    id(t);
    fk(t, "memberId").notNullable(); // whose list
    fk(t, "otherMemberId").notNullable();
    t.string("kind", 8).notNullable().defaultTo("block"); // block | mute
    t.boolean("byParent").notNullable().defaultTo(false);
    t.datetime("createdAt").notNullable();
    t.unique(["memberId", "otherMemberId", "kind"]);
    t.index("otherMemberId");
  });

  await create("connect_conversations", (t) => {
    id(t);
    fk(t, "ownerAdminId").notNullable();
    t.string("kind", 10).notNullable(); // direct | group | project
    t.string("title", 80).nullable();
    t.string("directKey", 80).nullable().unique(); // direct only: the two member ids, sorted
    fk(t, "projectId").nullable();
    fk(t, "createdByUserId").nullable();
    t.string("status", 12).notNullable().defaultTo("active"); // active | closed
    t.datetime("lastMessageAt").nullable();
    t.datetime("createdAt").notNullable();
    t.datetime("updatedAt").nullable();
    t.index("projectId");
  });

  await create("connect_conversation_participants", (t) => {
    id(t);
    fk(t, "conversationId").notNullable();
    fk(t, "memberId").notNullable();
    fk(t, "userId").nullable();
    t.string("role", 10).notNullable().defaultTo("member"); // owner | member
    t.datetime("lastReadAt").nullable();
    t.boolean("muted").notNullable().defaultTo(false);
    t.datetime("leftAt").nullable();
    t.datetime("createdAt").notNullable();
    t.unique(["conversationId", "memberId"]);
    t.index("memberId");
  });

  await create("connect_messages", (t) => {
    id(t);
    fk(t, "conversationId").notNullable();
    fk(t, "senderMemberId").notNullable();
    t.string("body", 2000).nullable();
    t.json("fileIds").nullable();
    t.string("status", 12).notNullable().defaultTo("visible"); // visible | removed
    t.string("removedBy", 12).nullable(); // sender | moderator
    t.datetime("createdAt", { precision: 3 }).notNullable();
    t.index(["conversationId", "createdAt"]);
    t.index("senderMemberId");
  });

  await create("connect_projects", (t) => {
    id(t);
    fk(t, "ownerAdminId").notNullable();
    t.string("title", 120).notNullable();
    t.text("description").nullable();
    t.string("category", 30).notNullable().defaultTo("other");
    t.json("technologies").nullable();
    fk(t, "coverFileId").nullable();
    t.string("status", 12).notNullable().defaultTo("idea"); // idea | building | testing | done
    t.string("visibility", 12).notNullable().defaultTo("community"); // team | community
    t.boolean("lookingForMembers").notNullable().defaultTo(false);
    t.string("demoLink", 500).nullable();
    t.boolean("showcased").notNullable().defaultTo(false);
    t.datetime("showcasedAt").nullable();
    t.string("moderation", 12).notNullable().defaultTo("visible"); // visible | removed
    fk(t, "createdByMemberId").notNullable();
    fk(t, "conversationId").nullable();
    t.datetime("createdAt").notNullable();
    t.datetime("updatedAt").nullable();
    t.index(["ownerAdminId", "moderation", "visibility"]);
  });

  await create("connect_project_members", (t) => {
    id(t);
    fk(t, "projectId").notNullable();
    fk(t, "memberId").notNullable();
    t.string("role", 10).notNullable().defaultTo("member"); // owner | member
    t.string("responsibility", 120).nullable();
    t.string("status", 12).notNullable().defaultTo("invited"); // invited | requested | active | declined | left
    fk(t, "invitedByMemberId").nullable();
    t.datetime("createdAt").notNullable();
    t.datetime("updatedAt").nullable();
    t.unique(["projectId", "memberId"]);
    t.index("memberId");
  });

  await create("connect_project_updates", (t) => {
    id(t);
    fk(t, "projectId").notNullable();
    fk(t, "authorMemberId").notNullable();
    t.text("body").notNullable();
    t.json("fileIds").nullable();
    t.string("link", 500).nullable();
    t.string("status", 12).notNullable().defaultTo("visible");
    t.datetime("createdAt").notNullable();
    t.index(["projectId", "createdAt"]);
  });

  await create("connect_project_milestones", (t) => {
    id(t);
    fk(t, "projectId").notNullable();
    t.string("title", 150).notNullable();
    t.date("dueOn").nullable();
    t.boolean("done").notNullable().defaultTo(false);
    t.datetime("doneAt").nullable();
    t.integer("position").notNullable().defaultTo(0);
    t.datetime("createdAt").notNullable();
    t.index("projectId");
  });

  await create("connect_challenges", (t) => {
    id(t);
    fk(t, "ownerAdminId").notNullable();
    t.string("title", 150).notNullable();
    t.text("description").nullable();
    t.string("kind", 16).notNullable().defaultTo("coding"); // coding | robotics | ai | design | showcase | other
    t.string("entryMode", 12).notNullable().defaultTo("individual"); // individual | team | both
    t.integer("teamMin").nullable();
    t.integer("teamMax").nullable();
    t.date("startsOn").nullable();
    t.date("endsOn").nullable();
    t.string("prizes", 1000).nullable();
    t.string("rules", 4000).nullable();
    fk(t, "communityId").nullable();
    fk(t, "competitionId").nullable(); // a linked competition (modules/competitions), if any
    t.string("status", 12).notNullable().defaultTo("draft"); // draft | open | closed
    fk(t, "createdByUserId").nullable();
    t.string("createdByName", 150).nullable();
    t.datetime("announcedAt").nullable();
    t.datetime("createdAt").notNullable();
    t.datetime("updatedAt").nullable();
    t.index(["ownerAdminId", "status"]);
  });

  await create("connect_challenge_entries", (t) => {
    id(t);
    fk(t, "challengeId").notNullable();
    t.string("entryKey", 80).notNullable(); // member:<id> | project:<id> — one entry each
    fk(t, "memberId").nullable(); // an individual entry
    fk(t, "projectId").nullable(); // a team entry (the team is the project's)
    fk(t, "enteredByMemberId").notNullable();
    t.json("memberIds").nullable(); // who was in it when entered / submitted
    t.string("title", 150).nullable();
    t.string("description", 2000).nullable();
    t.json("fileIds").nullable();
    t.string("link", 500).nullable();
    t.string("status", 12).notNullable().defaultTo("joined"); // joined | submitted | withdrawn
    t.string("award", 20).nullable(); // winner | runner_up | commended | participant
    t.string("feedback", 1000).nullable();
    t.datetime("submittedAt").nullable();
    t.datetime("createdAt").notNullable();
    t.datetime("updatedAt").nullable();
    t.unique(["challengeId", "entryKey"]);
    t.index("memberId");
  });

  await create("connect_badges", (t) => {
    id(t);
    fk(t, "memberId").notNullable();
    t.string("badge", 30).notNullable();
    t.string("detail", 200).nullable();
    t.datetime("earnedAt").notNullable();
    t.unique(["memberId", "badge"]);
  });

  await create("connect_reports", (t) => {
    id(t);
    fk(t, "ownerAdminId").notNullable();
    fk(t, "reporterUserId").notNullable();
    fk(t, "reporterMemberId").nullable();
    t.string("targetType", 12).notNullable(); // post | comment | message | member | project | update
    fk(t, "targetId").notNullable();
    fk(t, "targetMemberId").nullable(); // whose content it is
    fk(t, "conversationId").nullable(); // a message's conversation (moderators may then read it)
    t.string("reason", 20).notNullable();
    t.string("note", 1000).nullable();
    t.json("snapshot").nullable(); // the content as it was when reported
    t.string("status", 12).notNullable().defaultTo("open"); // open | actioned | dismissed
    t.string("action", 20).nullable();
    t.string("decisionNote", 1000).nullable();
    fk(t, "decidedByUserId").nullable();
    t.string("decidedByName", 150).nullable();
    t.datetime("decidedAt").nullable();
    t.datetime("createdAt").notNullable();
    t.index(["ownerAdminId", "status"]);
    t.index(["targetType", "targetId"]);
  });

  await create("connect_moderation_log", (t) => {
    id(t);
    fk(t, "ownerAdminId").notNullable();
    fk(t, "actorUserId").nullable();
    t.string("actorName", 150).nullable();
    t.string("actorRole", 30).nullable();
    t.string("action", 40).notNullable();
    t.string("targetType", 16).nullable();
    fk(t, "targetId").nullable();
    fk(t, "memberId").nullable();
    fk(t, "reportId").nullable();
    t.string("note", 1000).nullable();
    t.datetime("createdAt").notNullable();
    t.index(["ownerAdminId", "createdAt"]);
    t.index("memberId");
  });
};

exports.down = async function down(knex) {
  for (const name of [
    "connect_moderation_log", "connect_reports", "connect_badges", "connect_challenge_entries", "connect_challenges",
    "connect_project_milestones", "connect_project_updates", "connect_project_members", "connect_projects",
    "connect_messages", "connect_conversation_participants", "connect_conversations", "connect_blocks",
    "connect_connections", "connect_files", "connect_reactions", "connect_comments", "connect_posts",
    "connect_community_moderators", "connect_community_members", "connect_communities", "connect_members",
    "connect_settings",
  ]) {
    await knex.schema.dropTableIfExists(name);
  }
};
