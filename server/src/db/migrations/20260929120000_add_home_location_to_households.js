// Helps the visiting educator find the home: a Google Maps link and up to two photos of the
// gate / building / landmark (stored as a JSON array of uploaded image URLs).
exports.up = async function up(knex) {
  await knex.schema.alterTable("home_learning_households", (table) => {
    table.string("mapUrl", 2048).nullable();
    table.json("locationPhotos").nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("home_learning_households", (table) => {
    table.dropColumn("locationPhotos");
    table.dropColumn("mapUrl");
  });
};
