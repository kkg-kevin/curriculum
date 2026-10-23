// Base plus gets a session rate of its own (claim_settings.basePlusSessionRate) instead of being
// paid on top of the per-session rate — it is a separate way of paying part-time educators, so its
// base is set separately (Settings → Educator pay → Base plus). Null = Base plus isn't offered.
//
// A workspace already offering Base plus (a commission set) keeps paying exactly what it did: its
// per-session rate is copied in as the Base plus session rate.
//
// Additive and idempotent (hasColumn guard; the copy only fills empty rows).

exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("claim_settings", "basePlusSessionRate"))) {
    await knex.schema.alterTable("claim_settings", (t) => {
      t.decimal("basePlusSessionRate", 12, 3).nullable();
    });
  }
  await knex("claim_settings")
    .whereNotNull("commissionRate")
    .whereNull("basePlusSessionRate")
    .update({ basePlusSessionRate: knex.ref("sessionRate") });
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("claim_settings", "basePlusSessionRate")) {
    await knex.schema.alterTable("claim_settings", (t) => t.dropColumn("basePlusSessionRate"));
  }
};
