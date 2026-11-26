const { id, fk } = require("../helpers");

// Connect → Announcements (26 Nov 2026 — modules/connect/connect.announcements.js): a post from the
// team to chosen groups of people in the system (educators, parents, learners, hubs, staff,
// supervisors, affiliates), narrowed by hub and class, with the engagement the admin allows.
//   connect_announcements             the post, who it's for (`audience` { groups, hubIds, classIds })
//                                     and how people may engage (reactions, comments, "I've read
//                                     this"); published now or at `publishAt`, until `endsAt`.
//   connect_announcement_recipients   one row per person it reached, fixed when it's published:
//                                     their group (their comment thread), `channel` feed | notice
//                                     (a child whose Connect isn't switched on only gets the bell),
//                                     when they opened it and confirmed reading it.
//   connect_announcement_comments     comments, one thread per group (parents never see children's).
//   connect_announcement_reactions    one reaction per person.
// New tables have a newer collation than the older ones — never SQL-join them to older tables.
exports.up = async function up(knex) {
  const create = async (name, build) => {
    if (!(await knex.schema.hasTable(name))) await knex.schema.createTable(name, build);
  };

  await create("connect_announcements", (t) => {
    id(t);
    fk(t, "ownerAdminId").notNullable();
    t.string("title", 200).notNullable();
    t.text("body").nullable(); // rich text (HTML)
    t.string("imageUrl", 500).nullable();
    t.string("fileUrl", 500).nullable();
    t.string("fileName", 255).nullable();
    t.string("linkUrl", 500).nullable();
    t.string("linkLabel", 80).nullable();
    t.json("audience").notNullable();
    t.boolean("allowReactions").notNullable().defaultTo(true);
    t.boolean("allowComments").notNullable().defaultTo(false);
    t.boolean("askAck").notNullable().defaultTo(false);
    t.boolean("important").notNullable().defaultTo(false);
    t.boolean("pinned").notNullable().defaultTo(false);
    t.boolean("sendEmail").notNullable().defaultTo(false);
    t.string("status", 16).notNullable().defaultTo("scheduled"); // scheduled | published | ended
    t.datetime("publishAt").nullable();
    t.datetime("publishedAt").nullable();
    t.datetime("endsAt").nullable();
    t.datetime("endedAt").nullable();
    t.integer("recipientCount").notNullable().defaultTo(0);
    fk(t, "createdBy").nullable();
    t.string("authorName", 150).nullable();
    t.datetime("createdAt").notNullable();
    t.datetime("updatedAt").nullable();
    t.datetime("deletedAt").nullable();
    t.index(["ownerAdminId", "status"]);
    t.index(["status", "publishAt"]);
  });

  await create("connect_announcement_recipients", (t) => {
    id(t);
    fk(t, "announcementId").notNullable();
    fk(t, "userId").notNullable();
    t.string("audienceGroup", 20).notNullable();
    t.string("channel", 10).notNullable().defaultTo("feed"); // feed | notice
    t.datetime("seenAt").nullable();
    t.datetime("ackAt").nullable();
    t.datetime("createdAt").notNullable();
    t.unique(["announcementId", "userId"]);
    t.index(["userId"]);
  });

  await create("connect_announcement_comments", (t) => {
    id(t);
    fk(t, "announcementId").notNullable();
    t.string("audienceGroup", 20).notNullable();
    fk(t, "userId").notNullable();
    t.string("authorName", 150).nullable();
    t.string("authorRole", 40).nullable();
    t.boolean("fromTeam").notNullable().defaultTo(false);
    t.text("body").notNullable();
    t.datetime("hiddenAt").nullable();
    t.string("hiddenBy", 150).nullable();
    t.datetime("createdAt").notNullable();
    t.index(["announcementId", "audienceGroup", "createdAt"]);
  });

  await create("connect_announcement_reactions", (t) => {
    id(t);
    fk(t, "announcementId").notNullable();
    fk(t, "userId").notNullable();
    t.string("kind", 12).notNullable();
    t.datetime("createdAt").notNullable();
    t.unique(["announcementId", "userId"]);
  });
};

exports.down = async function down(knex) {
  for (const name of ["connect_announcement_reactions", "connect_announcement_comments", "connect_announcement_recipients", "connect_announcements"]) {
    await knex.schema.dropTableIfExists(name);
  }
};
