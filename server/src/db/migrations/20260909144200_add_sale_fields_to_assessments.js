// Sellable Project assessments — a `type: "project"` assessment can be marked "for sale" so it
// appears on the public marketing site (digifunzi-landing's /projects section), the same way a
// pathway's diagnostic can be offered publicly. Everything defaults to the existing
// internal-only behaviour: `saleStatus` is `internal` unless an admin explicitly flips it, and
// every other column is nullable. The public projects endpoints only ever read
// `saleStatus = 'for_sale'` rows of `type = 'project'` owned by PUBLIC_CONTENT_ADMIN_ID.
//
// Idempotent (hasColumn guards) so a re-run or partial rollback is safe.
const COLS = [
  'saleStatus',
  'coverImage',
  'priceAmount',
  'priceCurrency',
  'priceNote',
  'saleLevel',
  'saleTagline',
  'ageMin',
  'ageMax',
];

exports.up = async function up(knex) {
  const present = {};
  for (const c of COLS) present[c] = await knex.schema.hasColumn('assessments', c);

  await knex.schema.alterTable('assessments', (t) => {
    if (!present.saleStatus) {
      t.enu('saleStatus', ['internal', 'for_sale']).notNullable().defaultTo('internal');
    }
    if (!present.coverImage) t.string('coverImage', 500).nullable();
    // Whole currency units (e.g. 1800 = KES 1,800) — there's no fractional pricing here and no
    // real checkout; "Enquire to buy" posts a lead, staff quote the real figure.
    if (!present.priceAmount) t.integer('priceAmount').unsigned().nullable();
    if (!present.priceCurrency) t.string('priceCurrency', 8).nullable().defaultTo('KES');
    if (!present.priceNote) t.string('priceNote', 300).nullable();
    if (!present.saleLevel) {
      t.enu('saleLevel', ['beginner', 'intermediate', 'advanced']).nullable();
    }
    if (!present.saleTagline) t.string('saleTagline', 200).nullable();
    if (!present.ageMin) t.integer('ageMin').unsigned().nullable();
    if (!present.ageMax) t.integer('ageMax').unsigned().nullable();
  });

  if (!present.saleStatus) {
    await knex.schema.alterTable('assessments', (t) => t.index('saleStatus'));
  }
};

exports.down = async function down(knex) {
  const present = {};
  for (const c of COLS) present[c] = await knex.schema.hasColumn('assessments', c);
  await knex.schema.alterTable('assessments', (t) => {
    for (const c of COLS) if (present[c]) t.dropColumn(c);
  });
};
