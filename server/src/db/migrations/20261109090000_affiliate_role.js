// Affiliates sign in (9 Nov 2026): an affiliate who isn't a parent or educator here gets a login of
// their own, role "affiliate" (account-roles.js's AFFILIATE_ROLE; affiliates/affiliate.service.js's
// ensureLogin), signing in to the affiliate portal. users.role is an ENUM, so it needs the value.
// (As an extra role on another login it lives in users.extraRoles, JSON — nothing to change there.)
// Affiliates already on file without a login get one when staff press "Email sign-in details", or
// when they're next approved / reactivated — nothing is made here, since that sends email.
const WITH = ["admin", "school", "teacher", "learner", "curriculumAdmin", "collaborator", "supervisor", "affiliate"];
const WITHOUT = WITH.filter((r) => r !== "affiliate");

exports.up = async function up(knex) {
  await knex.schema.alterTable("users", (table) => {
    table.enu("role", WITH).notNullable().alter();
  });
};

exports.down = async function down(knex) {
  const [{ n }] = await knex("users").where({ role: "affiliate" }).count({ n: "*" });
  if (Number(n) > 0) {
    throw new Error(`${n} login(s) have the role "affiliate" — delete those affiliates (or their logins) before rolling this back.`);
  }
  await knex.schema.alterTable("users", (table) => {
    table.enu("role", WITHOUT).notNullable().alter();
  });
};
