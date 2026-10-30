// Runs of the same bootcamp (29 Oct 2026). A bootcamp's dates are its own, so running it again
// another time is a new bootcamp record — "Schedule another run" copies it with new dates. Every
// run of one bootcamp shares a `seriesId` (the first run's id), so each run's page can list the
// others and the website can show the next one. Null until a bootcamp is first run again.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("bootcamps", "seriesId"))) {
    await knex.schema.alterTable("bootcamps", (table) => {
      table.string("seriesId", 36).nullable();
      table.index("seriesId");
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("bootcamps", "seriesId")) {
    await knex.schema.alterTable("bootcamps", (table) => {
      table.dropIndex("seriesId");
      table.dropColumn("seriesId");
    });
  }
};
