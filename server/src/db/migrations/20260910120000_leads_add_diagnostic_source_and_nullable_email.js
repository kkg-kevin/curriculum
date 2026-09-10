// The public diagnostic now captures the parent's name + phone and creates a lead on submit
// (source: "diagnostic"). Two changes to `leads`:
//   1. widen the `source` enum to include "diagnostic"
//   2. make `email` nullable — the diagnostic form asks for name + phone only, no email
//      (the enrol and contact forms still require it client-side; this only relaxes the DB
//      constraint so a diagnostic lead can be stored without one)
//
// MySQL enum change = a plain ALTER ... MODIFY; `email` drop-NOT-NULL likewise. Reversible:
// down() puts the enum back to ["enroll","contact"] and re-adds NOT NULL — safe only while no
// diagnostic-sourced or null-email rows exist (a rollback in a fresh environment), same caveat
// as any enum-narrowing down().

exports.up = async function up(knex) {
  await knex.raw(
    "ALTER TABLE `leads` MODIFY `source` ENUM('enroll', 'contact', 'diagnostic') NOT NULL",
  );
  await knex.raw("ALTER TABLE `leads` MODIFY `email` VARCHAR(255) NULL");
};

exports.down = async function down(knex) {
  await knex.raw("ALTER TABLE `leads` MODIFY `email` VARCHAR(255) NOT NULL");
  await knex.raw("ALTER TABLE `leads` MODIFY `source` ENUM('enroll', 'contact') NOT NULL");
};
