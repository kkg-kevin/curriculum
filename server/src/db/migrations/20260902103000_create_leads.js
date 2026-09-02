const { id, timestamps } = require("../helpers");

// Public-site submissions from the digifunzi-landing frontend — POST /api/public/leads (the
// Enroll form) and POST /api/public/contact (the Contact form) both write here, distinguished by
// `source`. This is a lead, not a Learner record: nothing here creates an account or a real
// learner/hub relationship — staff read these from the admin Enquiries page and follow up
// manually, same "notify-first" contract the landing site's own code comments describe.
exports.up = async function up(knex) {
  await knex.schema.createTable("leads", (table) => {
    id(table);
    table.enu("source", ["enroll", "contact"]).notNullable();
    // Enroll: the parent/guardian. Contact: the enquirer. Same two people, different label per
    // form, so one pair of columns covers both instead of a parentX/contactX split.
    table.string("name", 150).notNullable();
    table.string("email", 255).notNullable();
    table.string("phone", 50).nullable();
    // Enroll-only fields — null for a `contact`-sourced row.
    table.string("learnerName", 150).nullable();
    table.integer("learnerAge").nullable();
    table.string("interestedIn", 50).nullable();
    // Free-text: Enroll's optional "Anything else?" note, or Contact's required message.
    table.text("message").nullable();
    // Which bootcamp/project/program this came from, when the Enroll form was opened from a
    // detail page (EnrollForm's `referenceId` prop) — a bare string, no FK constraint, since the
    // catalog it points at isn't in this repo yet (digifunzi-landing's public bootcamp/project
    // read routes are still a separate, not-yet-built piece — see API_CONTRACT.md).
    table.string("referenceId", 100).nullable();
    // Staff follow-up tracking — the whole reason this has an admin UI at all, not just a mail
    // notification.
    table.enu("status", ["new", "contacted", "closed"]).notNullable().defaultTo("new");
    timestamps(table);
    table.index("source");
    table.index("status");
    table.index("createdAt");
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("leads");
};
