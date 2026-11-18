const { id, fk } = require("../helpers");

// Class rankings (modules/rankings/, 18 Nov 2026): a learner's Learning Score and place in a class
// are worked out from the term's work whenever they're looked at. Once a week the result is kept
// here — one row per learner per class per term per week (the Monday) — so a learner sees how far
// they've moved since last week and how their score has gone over the term, and places stay
// steady instead of changing with every mark.
// `rank` is null while the learner (or the class) doesn't have enough work to be ranked.
// New tables have a newer collation than the older ones — never SQL-join them to older tables.
exports.up = async function up(knex) {
  if (await knex.schema.hasTable("learner_rank_snapshots")) return;
  await knex.schema.createTable("learner_rank_snapshots", (table) => {
    id(table);
    fk(table, "classId").notNullable();
    fk(table, "learnerId").notNullable();
    table.string("termKey", 10).notNullable(); // 2026-T3
    table.date("weekStart").notNullable();
    table.decimal("score", 5, 1).nullable();
    table.integer("rank").nullable();
    table.integer("rankedCount").notNullable().defaultTo(0);
    table.json("parts").nullable();
    table.datetime("createdAt").notNullable();
    table.datetime("updatedAt").nullable();
    table.unique(["classId", "learnerId", "termKey", "weekStart"], { indexName: "rank_snapshots_unique" });
    table.index(["learnerId", "classId", "termKey"], "rank_snapshots_learner");
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("learner_rank_snapshots");
};
