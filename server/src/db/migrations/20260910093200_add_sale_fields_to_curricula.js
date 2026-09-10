// Sellable Bootcamps — a program-curriculum (`curricula` row with `isProgram: true`) can be
// marked "for sale" so it appears on the public marketing site (digifunzi-landing's /bootcamps
// section), the same pattern as sellable Project assessments
// (20260909144200_add_sale_fields_to_assessments.js) and sellable Inventory items
// (20260909161500_add_sale_fields_to_inventory.js).
//
// Everything defaults to the existing internal-only behaviour: `saleStatus` is `internal`
// unless an admin explicitly flips it on a Program, and every other column is nullable. The
// public bootcamp endpoints only ever read `saleStatus = 'for_sale'` rows that are also
// `isProgram = 1`, owned by PUBLIC_CONTENT_ADMIN_ID. A plain (non-program) curriculum that
// never sends any of these validates and reads back exactly as before.
//
// Idempotent (hasColumn guards) so a re-run or partial rollback is safe.
const COLS = [
  'saleStatus',
  'coverImage',
  'priceAmount',
  'priceCurrency',
  'priceNote',
  'saleTagline',
  'saleFormat',
  'durationLabel',
  'ageMin',
  'ageMax',
  'highlights',
];

exports.up = async function up(knex) {
  const present = {};
  for (const c of COLS) present[c] = await knex.schema.hasColumn('curricula', c);

  await knex.schema.alterTable('curricula', (t) => {
    if (!present.saleStatus) {
      t.enu('saleStatus', ['internal', 'for_sale']).notNullable().defaultTo('internal');
    }
    // A stored "/uploads/x.png" path or an absolute URL — same shape as course.coverImage.
    if (!present.coverImage) t.string('coverImage', 500).nullable();
    // Whole currency units, no fractional pricing (see the assessments migration comment).
    // "Enquire to book" posts a lead; staff quote the real figure.
    if (!present.priceAmount) t.integer('priceAmount').unsigned().nullable();
    if (!present.priceCurrency) t.string('priceCurrency', 8).nullable().defaultTo('KES');
    if (!present.priceNote) t.string('priceNote', 300).nullable();
    if (!present.saleTagline) t.string('saleTagline', 200).nullable();
    // How the bootcamp runs — drives the website's /bootcamps filter chips. Deliberately
    // separate from anything operational on the curriculum.
    if (!present.saleFormat) {
      t.enu('saleFormat', ['holiday', 'weekend', 'after_school', 'online']).nullable();
    }
    // Free-text run length, e.g. "1 week", "4 Saturdays".
    if (!present.durationLabel) t.string('durationLabel', 60).nullable();
    if (!present.ageMin) t.integer('ageMin').unsigned().nullable();
    if (!present.ageMax) t.integer('ageMax').unsigned().nullable();
    // JSON string[] — the "what you'll build / learn" selling-point bullets.
    if (!present.highlights) t.json('highlights').nullable();
  });

  if (!present.saleStatus) {
    await knex.schema.alterTable('curricula', (t) => t.index('saleStatus'));
  }
};

exports.down = async function down(knex) {
  const present = {};
  for (const c of COLS) present[c] = await knex.schema.hasColumn('curricula', c);
  await knex.schema.alterTable('curricula', (t) => {
    for (const c of COLS) if (present[c]) t.dropColumn(c);
  });
};
