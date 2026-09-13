// Per-course pricing for a bootcamp/competition's curriculum — an array of
// { courseId, priceAmount, priceCurrency }, same "JSON column on the parent record" shape as
// bootcamps.highlights / competitions.tracks rather than a new join table.
exports.up = async function (knex) {
  await knex.schema.alterTable("bootcamps", (table) => {
    table.json("coursePricing").nullable();
  });
  await knex.schema.alterTable("competitions", (table) => {
    table.json("coursePricing").nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("bootcamps", (table) => {
    table.dropColumn("coursePricing");
  });
  await knex.schema.alterTable("competitions", (table) => {
    table.dropColumn("coursePricing");
  });
};
