const { id, fk, timestamps } = require("../helpers");

// Certificates of completion (see modules/certificates/certificate.service.js).
//
// `certificates` — one row per thing a learner has completed. `kind` says what:
//   course   — issued when that learner's final course report is published. Its issuedAt is the
//              nearest thing the system has to "the day this learner finished this course".
//   pathway  — issued once the learner holds a course certificate for every course in a pathway.
//   bootcamp — issued once the learner holds one for every course their bootcamp class runs.
//
// identityKey is what makes a certificate unique for a learner — "course:<courseId>:<classId>",
// "pathway:<pathwayId>", "bootcamp:<bootcampId>:<classId>" — one string rather than a multi-column
// unique index, because a pathway certificate has no class and MySQL treats NULLs as distinct.
//
// certificateNumber is the readable reference printed on the certificate (DF-2026-000123);
// verifyToken is the unguessable string in the QR / verification link, so a number read off a
// printed certificate can't be used to look other people's certificates up.
//
// snapshot freezes what the certificate says (learner, title and hub names, the signatory, and
// for a pathway or bootcamp the courses it was earned on) at issue time — renaming a course or
// changing the signatory later doesn't rewrite a certificate already handed out. A certificate is
// revoked (status, never a delete), so its verification link says "withdrawn" rather than
// "not found"; revokeReason is set when a member of staff revoked it by hand.
//
// `certificate_settings` — one row per workspace (admin): who signs its certificates.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("certificates"))) {
    await knex.schema.createTable("certificates", (table) => {
      id(table);
      table.string("certificateNumber", 30).notNullable();
      table.string("verifyToken", 64).notNullable();
      table.string("kind", 20).notNullable().defaultTo("course");
      table.string("identityKey", 120).notNullable();
      fk(table, "learnerId").notNullable();
      // The course, pathway or bootcamp this certificate is for.
      fk(table, "subjectId").notNullable();
      fk(table, "courseId").nullable();
      fk(table, "classId").nullable();
      fk(table, "hubId").nullable();
      fk(table, "reportId").nullable();
      fk(table, "ownerAdminId").nullable();
      table.enu("status", ["issued", "revoked"]).notNullable().defaultTo("issued");
      table.datetime("issuedAt").notNullable();
      table.string("issuedBy", 36).nullable();
      table.datetime("revokedAt").nullable();
      table.string("revokeReason", 300).nullable();
      table.json("snapshot").nullable();
      timestamps(table);
      table.unique(["certificateNumber"]);
      table.unique(["verifyToken"]);
      table.unique(["learnerId", "identityKey"]);
      table.index("learnerId");
      table.index("classId");
      table.index("hubId");
      table.index("ownerAdminId");
    });
  }

  if (!(await knex.schema.hasTable("certificate_settings"))) {
    await knex.schema.createTable("certificate_settings", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      table.string("signatoryName", 150).nullable();
      table.string("signatoryTitle", 150).nullable();
      // A stored /uploads path or an absolute URL, like every other image field.
      table.string("signatureImage", 500).nullable();
      timestamps(table);
      table.unique(["ownerAdminId"]);
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("certificate_settings");
  await knex.schema.dropTableIfExists("certificates");
};
