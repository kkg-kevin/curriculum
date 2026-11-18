const { id, fk } = require("../helpers");

// Affiliate prospects (modules/affiliates/affiliate.prospects.js, 19 Nov 2026): families an
// affiliate has talked to and pre-registered. For `claimDays` (Settings, 60 by default) the family
// is claimed for that affiliate: if they sign up — with or without a code — matched by the
// parent's phone or email, the sign-up is that affiliate's referral (via "prospect").
//   status   open → signed_up (referralId set) | lost (signed up with another affiliate's typed code)
//            | expired | released (the affiliate or an admin let it go) | opted_out (the family said no)
//   Contact details are kept only while a claim is open, and on the record of a sign-up; an
//   expired, released or opted-out claim keeps the first name only (Data Protection Act).
//   phoneKey / emailKey: the last 9 digits / the lower-cased email, for matching.
//   possibleMatch: a sign-up with the same parent name but no matching phone or email, for an
//   admin to approve or dismiss ({ programme, recordId, invoiceId, parent, at }).
// New tables have a newer collation than the older ones — never SQL-join them to older tables.
exports.up = async function up(knex) {
  if (await knex.schema.hasTable("affiliate_prospects")) return;
  await knex.schema.createTable("affiliate_prospects", (table) => {
    id(table);
    fk(table, "ownerAdminId").notNullable();
    fk(table, "affiliateId").notNullable();
    table.string("parentName", 150).notNullable();
    table.string("phone", 40).nullable();
    table.string("phoneKey", 20).nullable();
    table.string("email", 255).nullable();
    table.string("emailKey", 255).nullable();
    table.string("childName", 150).nullable();
    table.integer("childAge").nullable();
    table.string("programme", 20).nullable();
    table.string("notes", 1000).nullable();
    table.string("source", 20).notNullable().defaultTo("portal"); // portal | bulk | admin
    fk(table, "createdBy").nullable();
    table.datetime("consentAt").notNullable();
    table.string("status", 20).notNullable().defaultTo("open");
    table.datetime("expiresAt").notNullable();
    fk(table, "referralId").nullable();
    table.datetime("convertedAt").nullable();
    table.string("inviteToken", 64).nullable();
    table.datetime("invitedAt").nullable();
    table.integer("inviteCount").notNullable().defaultTo(0);
    table.datetime("optedOutAt").nullable();
    table.json("possibleMatch").nullable();
    table.string("closedReason", 255).nullable();
    table.datetime("createdAt").notNullable();
    table.datetime("updatedAt").nullable();
    table.index(["ownerAdminId", "status"]);
    table.index(["ownerAdminId", "phoneKey"]);
    table.index(["ownerAdminId", "emailKey"]);
    table.index("affiliateId");
    table.unique(["inviteToken"]);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("affiliate_prospects");
};
