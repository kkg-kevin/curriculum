// Replaces bootcamps.priceNote (a single string(300)) with priceNotes (a JSON array of
// strings) — the admin wants more than one price note (e.g. "Includes all materials" AND
// "Price excludes transport"), same list-of-short-strings shape as bootcamps.highlights. Also
// makes it a genuinely shared field across BOTH pricing modes (whole-bootcamp price and
// per-course pricing) rather than living only next to the whole-bootcamp Price field — see
// bootcamp.service.js/CreateBootcampPage.jsx for how the two pricing modes are otherwise
// mutually exclusive; notes are the one thing that still applies regardless of which is active.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("bootcamps", "priceNotes"))) {
    await knex.schema.alterTable("bootcamps", (t) => {
      t.json("priceNotes").nullable();
    });
  }
  if (await knex.schema.hasColumn("bootcamps", "priceNote")) {
    const rows = await knex("bootcamps").whereNotNull("priceNote").andWhere("priceNote", "!=", "");
    for (const r of rows) {
      // eslint-disable-next-line no-await-in-loop
      await knex("bootcamps").where({ id: r.id }).update({ priceNotes: JSON.stringify([r.priceNote]) });
    }
    await knex.schema.alterTable("bootcamps", (t) => {
      t.dropColumn("priceNote");
    });
  }
};

exports.down = async function down(knex) {
  if (!(await knex.schema.hasColumn("bootcamps", "priceNote"))) {
    await knex.schema.alterTable("bootcamps", (t) => {
      t.string("priceNote", 300).nullable();
    });
  }
  if (await knex.schema.hasColumn("bootcamps", "priceNotes")) {
    const rows = await knex("bootcamps").whereNotNull("priceNotes");
    for (const r of rows) {
      // eslint-disable-next-line no-await-in-loop
      const notes = Array.isArray(r.priceNotes) ? r.priceNotes : [];
      if (notes.length) await knex("bootcamps").where({ id: r.id }).update({ priceNote: notes.join(" · ").slice(0, 300) });
    }
    await knex.schema.alterTable("bootcamps", (t) => {
      t.dropColumn("priceNotes");
    });
  }
};
