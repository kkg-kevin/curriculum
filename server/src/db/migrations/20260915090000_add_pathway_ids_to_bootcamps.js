// Which of the linked curriculum's pathways this bootcamp actually runs — a curriculum can have
// several pathways, each with its own courses, and not every pathway is relevant to a given
// bootcamp (e.g. a "Robotics Holiday Camp" built on a curriculum that also has an unrelated
// "Digital Literacy" pathway). An array of pathway ids, same "JSON column on the parent record"
// shape as bootcamps.highlights/coursePricing rather than a join table. Empty/null means "not
// scoped yet" — bootcamp.service.js/public-content.js fall back to every pathway under the
// curriculum in that case, so existing bootcamps keep behaving exactly as before this migration.
exports.up = async function (knex) {
  await knex.schema.alterTable("bootcamps", (table) => {
    table.json("pathwayIds").nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("bootcamps", (table) => {
    table.dropColumn("pathwayIds");
  });
};
