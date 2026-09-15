// New accountStatus value: "pending_payment" - a learner auto-provisioned from a public bootcamp
// enrollment (see the bootcamp-enrollment module) whose payment hasn't been recorded yet. Kept
// distinct from "inactive" (a school/admin explicitly deactivating an existing learner) so
// auth.service.js's resolveSuspension can tell the two apart and return a different reason
// ("payment" vs "learner") - the client shows genuinely different copy for "please pay to
// unlock" vs "contact your school administrator", and conflating them would show the wrong
// message for one of the two cases. Every existing accountStatus==="active" /
// !=="active" check keeps working unchanged; only resolveSuspension needs new branching.
//
// Knex's schema builder can't alter a MySQL enum's allowed values in place, so this uses a raw
// ALTER TABLE ... MODIFY, same technique as the 20260916110000_add_hub_usage_invoice_type
// migration.
const OLD_VALUES = ["active", "inactive"];
const NEW_VALUES = [...OLD_VALUES, "pending_payment"];

function enumSql(values) {
  return values.map((v) => `'${v}'`).join(", ");
}

exports.up = async function up(knex) {
  await knex.raw(`ALTER TABLE learners MODIFY accountStatus ENUM(${enumSql(NEW_VALUES)}) NOT NULL DEFAULT 'active'`);
};

exports.down = async function down(knex) {
  // Any existing pending_payment rows would need reassigning (e.g. to "inactive") before this
  // can run cleanly - MySQL truncates values not in the target ENUM list to '' rather than
  // failing loudly.
  await knex.raw(`ALTER TABLE learners MODIFY accountStatus ENUM(${enumSql(OLD_VALUES)}) NOT NULL DEFAULT 'active'`);
};
