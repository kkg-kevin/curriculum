// More images for a bootcamp beyond its cover — the website's bootcamp page shows the cover and
// then these, with buttons to move between them. An array of stored "/uploads/x.png" paths or
// absolute URLs, same shape as coverImage. null on every bootcamp from before (cover only).
//
// Idempotent (hasColumn guard) so a re-run or partial rollback is safe.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("bootcamps", "images"))) {
    await knex.schema.alterTable("bootcamps", (table) => {
      table.json("images").nullable();
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("bootcamps", "images")) {
    await knex.schema.alterTable("bootcamps", (table) => {
      table.dropColumn("images");
    });
  }
};
