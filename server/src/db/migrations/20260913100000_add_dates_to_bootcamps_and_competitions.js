// Bootcamps and Competitions each become a standalone run with its own dates, independent of
// the Event entity they used to (optionally) borrow dates from. `startDate`/`endDate` are the
// run's own window; `registrationOpenDate`/`registrationCloseDate` are new on both tables — a
// bootcamp never had ANY date columns before this, a competition already had startDate/endDate
// but no registration window.
//
// All four are plain "YYYY-MM-DD" strings (`string(10)`), matching competitions.startDate's
// existing convention and the client's `dateStr` zod regex — deliberately not a real DATE
// column: events.startDate WAS a real DATE, and that's exactly why EventViewPage.jsx has to
// `.slice(0,10)` it to avoid timezone-shifted display. Every column is nullable — a bootcamp/
// competition that's purely a marketing listing, never yet run at a hub, must stay valid with
// no dates set at all (matches today's competitions, which already allow blank dates).
//
// Every step below checks the current schema before acting, and each of the (up to) four
// missing-column checks is independent per column: MySQL commits every DDL statement
// immediately (alterTable is not rolled back by a later failure in the same migration, unlike
// Postgres), and Knex's alterTable(t.string(...)) throws on the very first column in the
// statement that's already present, aborting before it reaches the others — so a retry after a
// partial failure must add only whatever's still missing, not error out on what already landed
// (see 20260911150000_create_bootcamps.js's SALE_COLUMNS drop for the same technique in reverse).

async function addMissingColumns(knex, table, columns) {
  const presence = await Promise.all(columns.map((col) => knex.schema.hasColumn(table, col)));
  const missing = columns.filter((_, i) => !presence[i]);
  if (!missing.length) return;
  await knex.schema.alterTable(table, (t) => {
    for (const col of missing) t.string(col, 10).nullable();
  });
}

exports.up = async function up(knex) {
  await addMissingColumns(knex, "bootcamps", ["startDate", "endDate", "registrationOpenDate", "registrationCloseDate"]);
  await addMissingColumns(knex, "competitions", ["registrationOpenDate", "registrationCloseDate"]);
};

exports.down = async function down(knex) {
  async function dropIfPresent(table, columns) {
    const presence = await Promise.all(columns.map((col) => knex.schema.hasColumn(table, col)));
    const present = columns.filter((_, i) => presence[i]);
    if (!present.length) return;
    await knex.schema.alterTable(table, (t) => {
      for (const col of present) t.dropColumn(col);
    });
  }
  await dropIfPresent("bootcamps", ["startDate", "endDate", "registrationOpenDate", "registrationCloseDate"]);
  await dropIfPresent("competitions", ["registrationOpenDate", "registrationCloseDate"]);
};
