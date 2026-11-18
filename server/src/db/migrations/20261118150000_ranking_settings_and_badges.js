const { id, fk } = require("../helpers");

// Class rankings, phase 2 (modules/rankings/, 18 Nov 2026).
//   - ranking_settings: one row per workspace (Settings → Rankings) — on/off for the workspace and
//     per hub, the score's weights, how much work ranks a learner and a class, how other children
//     are named, the period ranked (term or the last 30 days) and the workspace's own term dates
//     (the Kenyan three-term calendar when none are set). No row = the defaults.
//   - learner_badges: badges a learner has earned in a class in a term (once each) — kept so each
//     is announced once and stays earned for the term even if the figure behind it later moves.
// New tables have a newer collation than the older ones — never SQL-join them to older tables.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("ranking_settings"))) {
    await knex.schema.createTable("ranking_settings", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      table.boolean("enabled").notNullable().defaultTo(true);
      table.json("disabledHubIds").nullable();
      table.json("weights").nullable();
      table.integer("minMarked").notNullable().defaultTo(3);
      table.integer("minClass").notNullable().defaultTo(5);
      table.string("nameStyle", 20).notNullable().defaultTo("initial"); // initial | first | anonymous
      table.string("period", 20).notNullable().defaultTo("term"); // term | rolling30
      table.json("terms").nullable(); // [{ name, from, to }]
      table.datetime("createdAt").notNullable();
      table.datetime("updatedAt").nullable();
      table.unique(["ownerAdminId"]);
    });
  }
  if (!(await knex.schema.hasTable("learner_badges"))) {
    await knex.schema.createTable("learner_badges", (table) => {
      id(table);
      fk(table, "learnerId").notNullable();
      fk(table, "classId").notNullable();
      table.string("termKey", 40).notNullable();
      table.string("badgeKey", 40).notNullable();
      table.string("detail", 255).nullable();
      table.datetime("earnedAt").notNullable();
      table.unique(["learnerId", "classId", "termKey", "badgeKey"], { indexName: "learner_badges_unique" });
      table.index(["classId", "termKey"], "learner_badges_class");
    });
  }
  // Custom term keys can be longer than "2026-T3".
  await knex.raw("ALTER TABLE learner_rank_snapshots MODIFY termKey VARCHAR(40) NOT NULL");
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("learner_badges");
  await knex.schema.dropTableIfExists("ranking_settings");
};
