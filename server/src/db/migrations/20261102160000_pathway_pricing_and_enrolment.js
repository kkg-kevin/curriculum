// Pathways sold on the website (Settings → Pathways → On the website → Price):
//   pathway_templates.pricingMode   — "none" (the website takes an enquiry, as before), "whole" (one
//                                     price for the pathway) or "by_course" (each course priced; a
//                                     family pays for the learner's starting course)
//   pathway_templates.priceAmount   — the whole-pathway price
//   pathway_templates.priceCurrency — default KES
//   pathway_templates.coursePrices  — [{ courseId, amount }] for by_course
// and a "pathway" invoice type for a website pathway enrolment's invoice (pathway-enrollment/).
// Every pathway starts at "none", so nothing changes on the website until a price is set.
// The invoice type list is read from the database and "pathway" appended, so whatever types are
// there stay exactly as they are. Idempotent.
async function invoiceTypes(knex) {
  const [rows] = await knex.raw(
    "SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'invoiceType'",
  );
  const match = /^enum\((.*)\)$/i.exec(rows[0]?.t || "");
  return match ? match[1].split(",").map((v) => v.trim().replace(/^'|'$/g, "")) : null;
}

exports.up = async function up(knex) {
  const columns = {
    pricingMode: (t) => t.string("pricingMode", 16).notNullable().defaultTo("none"),
    priceAmount: (t) => t.decimal("priceAmount", 12, 2).nullable(),
    priceCurrency: (t) => t.string("priceCurrency", 8).notNullable().defaultTo("KES"),
    coursePrices: (t) => t.json("coursePrices").nullable(),
  };
  for (const [name, add] of Object.entries(columns)) {
    if (!(await knex.schema.hasColumn("pathway_templates", name))) {
      await knex.schema.alterTable("pathway_templates", (t) => add(t));
    }
  }
  const types = await invoiceTypes(knex);
  if (types && !types.includes("pathway")) {
    const list = [...types, "pathway"].map((v) => `'${v}'`).join(",");
    await knex.raw(`ALTER TABLE billing_invoices MODIFY COLUMN invoiceType ENUM(${list}) NOT NULL`);
  }
};

exports.down = async function down(knex) {
  for (const name of ["pricingMode", "priceAmount", "priceCurrency", "coursePrices"]) {
    if (await knex.schema.hasColumn("pathway_templates", name)) {
      await knex.schema.alterTable("pathway_templates", (t) => t.dropColumn(name));
    }
  }
  // The "pathway" invoice type stays: invoices may already use it.
};
