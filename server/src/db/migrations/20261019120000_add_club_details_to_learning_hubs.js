// What parents need to know about a club, separate from the venue's own details: the ages it's
// for, when the club meets (rather than the venue's opening hours), class size, a description
// written for parents, and FAQs. One JSON column on the hub (NULL until set), shown on the
// hub's Estate Tech Club page on the website. Additive only.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("learning_hubs", "clubDetails"))) {
    await knex.schema.alterTable("learning_hubs", (table) => {
      table.json("clubDetails").nullable();
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("learning_hubs", "clubDetails")) {
    await knex.schema.alterTable("learning_hubs", (table) => {
      table.dropColumn("clubDetails");
    });
  }
};
