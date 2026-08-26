const { id, timestamps } = require("../helpers");

// Backs sequential INV-YYYY-000001 / RCT-YYYY-000001 numbering (see billing.model.js's
// nextNumber) — one row per (scope, year), incremented atomically via an
// INSERT ... ON DUPLICATE KEY UPDATE upsert rather than app-level ids, since ids here are
// app-generated UUIDs with no DB auto-increment to lean on.
exports.up = async function up(knex) {
  await knex.schema.createTable("billing_number_sequences", (table) => {
    id(table);
    table.enu("scope", ["invoice", "receipt"]).notNullable();
    table.integer("year").notNullable();
    table.integer("lastNumber").notNullable().defaultTo(0);
    timestamps(table);
    table.unique(["scope", "year"]);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("billing_number_sequences");
};
