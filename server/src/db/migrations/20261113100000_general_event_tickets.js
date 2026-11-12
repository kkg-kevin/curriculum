// General events' tickets (13 Nov 2026 — modules/general-events/): every registration with a place
// carries a ticket — a short code (general-event.rules.js's newTicketCode, "EV-7K3M9Q") shown in the
// emails, on the website's registration page and as a QR code that opens the portal's check-in.
// UNIQUE, so a scanned or typed code names one registration. Registrations made before are given
// one here.
const crypto = require("crypto");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I — read out at the door
const code = () => `EV-${Array.from(crypto.randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join("")}`;

exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("general_event_registrations", "ticketCode"))) {
    await knex.schema.alterTable("general_event_registrations", (t) => {
      t.string("ticketCode", 16).nullable();
      t.unique(["ticketCode"]);
    });
  }
  const missing = await knex("general_event_registrations").whereNull("ticketCode").select("id");
  const used = new Set();
  for (const { id } of missing) {
    let next = code();
    while (used.has(next)) next = code();
    used.add(next);
    await knex("general_event_registrations").where({ id }).update({ ticketCode: next });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("general_event_registrations", "ticketCode")) {
    await knex.schema.alterTable("general_event_registrations", (t) => {
      t.dropUnique(["ticketCode"]);
      t.dropColumn("ticketCode");
    });
  }
};
