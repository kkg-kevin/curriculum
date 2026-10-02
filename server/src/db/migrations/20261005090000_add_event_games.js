const { id, fk, timestamps } = require("../helpers");

// Games and play activities for bootcamps (Events → Games) — chess, Monopoly, a treasure hunt:
// what makes a bootcamp more than lessons, and a selling point on the public bootcamp page.
//
//   event_games          an admin's games library: each game described once (what the children
//                        do, what it builds, a built-in icon (a key into the apps' icon set) on
//                        its own colour, and an optional photo).
//   bootcamps.gameIds    which of those games a bootcamp includes, in display order — the same
//                        "JSON id list on the parent record" shape as pathwayIds.
//   bootcamps.gamesNote  one optional line on how play fits into the day.
//
// Additive only: every existing bootcamp has no games (NULL), which reads everywhere as "none".
exports.up = async function up(knex) {
  await knex.schema.createTable("event_games", (table) => {
    id(table);
    fk(table, "ownerAdminId").notNullable();
    table.string("name", 80).notNullable();
    table.string("description", 300).nullable();
    table.json("skills").nullable();
    table.string("icon", 40).nullable();
    table.string("color", 7).nullable();
    table.string("image", 500).nullable();
    timestamps(table);
    table.index("ownerAdminId");
  });
  await knex.schema.alterTable("bootcamps", (table) => {
    table.json("gameIds").nullable();
    table.string("gamesNote", 200).nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("bootcamps", (table) => {
    table.dropColumn("gameIds");
    table.dropColumn("gamesNote");
  });
  await knex.schema.dropTableIfExists("event_games");
};
