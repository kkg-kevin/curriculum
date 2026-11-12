const { id, fk, timestamps } = require("../helpers");

// General events (12 Nov 2026) — Events → General events (modules/general-events/): events anyone
// can come to (a bootcamp's showcase, an open day, a talk), shown on the website (its own Events
// section and a pop-up) and to everyone signed in to the system (a pop-up at sign-in). People
// register; each registration from outside the system is also an enquiry (leads.source "event"),
// so the team can follow them up.
//
//   general_events                 the event: what, when (Kenyan date + time), where (hub / venue /
//                                  online link), capacity + waiting list, the pop-ups, and the
//                                  price (null = free; paid events are a later step — see
//                                  general-event.rules.js's isFree)
//   general_event_registrations    one person (and the people they bring): contact, the optional
//                                  "about you" answers, consent, status registered | waitlisted |
//                                  cancelled, arrived (check-in), a private token for their link
//   general_event_popup_states     a signed-in person's "not now" on an event's pop-up
//   leads.source                   + event (with leads.generalEventId)
//
// New tables have the server's newer collation — never SQL-join them to the older ones.

const OLD_SOURCES = ["enroll", "contact", "diagnostic"];
const NEW_SOURCES = [...OLD_SOURCES, "event"];
const enumSql = (values) => values.map((v) => `'${v}'`).join(", ");

exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("general_events"))) {
    await knex.schema.createTable("general_events", (t) => {
      id(t);
      fk(t, "ownerAdminId").notNullable();
      t.string("title", 200).notNullable();
      t.string("slug", 220).notNullable();
      t.string("kind", 30).notNullable().defaultTo("showcase"); // showcase | open_day | workshop | talk | other
      t.string("tagline", 300).nullable();
      t.text("description", "mediumtext").nullable(); // rich text (HTML)
      t.string("coverImage", 500).nullable();
      t.json("images").nullable(); // [url]
      t.date("startDate").notNullable(); // Kenyan calendar date
      t.string("startTime", 5).notNullable(); // "HH:MM", Kenyan time
      t.date("endDate").nullable(); // null = the same day
      t.string("endTime", 5).nullable();
      t.string("format", 12).notNullable().defaultTo("in_person"); // in_person | online | hybrid
      fk(t, "hubId").nullable();
      t.string("venueName", 200).nullable();
      t.string("venueAddress", 300).nullable();
      t.string("mapUrl", 500).nullable();
      t.string("meetingLink", 500).nullable(); // only ever sent to people registered
      fk(t, "bootcampId").nullable(); // e.g. the bootcamp a showcase is for
      t.integer("capacity").nullable(); // people (a registration's partySize counts); null = no limit
      t.boolean("waitlistOn").notNullable().defaultTo(true);
      t.integer("maxPartySize").notNullable().defaultTo(5);
      t.boolean("registrationOpen").notNullable().defaultTo(true);
      t.date("registrationClosesOn").nullable();
      t.boolean("askAboutYou").notNullable().defaultTo(true); // the optional second step
      t.string("status", 12).notNullable().defaultTo("draft"); // draft | published | cancelled
      t.boolean("isPublic").notNullable().defaultTo(true); // on the website
      t.boolean("websitePopup").notNullable().defaultTo(true);
      t.boolean("systemPopup").notNullable().defaultTo(true);
      t.json("systemAudience").nullable(); // null = everyone signed in; else [role group]
      t.date("popupFrom").nullable(); // null = from publishing
      t.date("popupUntil").nullable(); // null = until it starts
      t.decimal("priceAmount", 12, 2).nullable(); // null = free (paid events: later)
      t.string("priceCurrency", 3).notNullable().defaultTo("KES");
      t.string("cancelReason", 500).nullable();
      t.datetime("cancelledAt").nullable();
      t.datetime("publishedAt").nullable();
      fk(t, "createdBy").nullable();
      timestamps(t);
      t.index(["ownerAdminId", "status"]);
      t.index("slug");
      t.index("startDate");
    });
  }

  if (!(await knex.schema.hasTable("general_event_registrations"))) {
    await knex.schema.createTable("general_event_registrations", (t) => {
      id(t);
      fk(t, "eventId").notNullable();
      fk(t, "ownerAdminId").notNullable();
      t.string("name", 150).notNullable();
      t.string("email", 255).notNullable();
      t.string("phone", 40).notNullable();
      t.integer("partySize").notNullable().defaultTo(1); // them + the people they bring
      t.string("status", 12).notNullable().defaultTo("registered"); // registered | waitlisted | cancelled
      // "About you" (optional second step)
      t.string("personType", 20).nullable(); // parent | school | educator | student | other
      t.string("organisation", 200).nullable();
      t.json("childrenAges").nullable(); // [number]
      t.json("interests").nullable(); // [programme key]
      t.string("heardFrom", 40).nullable();
      t.datetime("detailsAt").nullable();
      t.boolean("marketingConsent").notNullable().defaultTo(false);
      // Where they came from
      t.string("source", 20).notNullable().defaultTo("website"); // website | website_popup | system | system_popup | walk_in | staff
      fk(t, "userId").nullable(); // signed in when registering
      fk(t, "leadId").nullable(); // the enquiry made for them
      t.json("visitSource").nullable();
      t.string("referralCode", 30).nullable();
      t.string("token", 64).notNullable(); // their private link (manage, add details, cancel)
      // On the day
      t.datetime("attendedAt").nullable();
      fk(t, "checkedInBy").nullable();
      // Paid events (later): the invoice for their ticket(s)
      fk(t, "invoiceId").nullable();
      t.datetime("cancelledAt").nullable();
      t.datetime("promotedAt").nullable(); // moved off the waiting list
      timestamps(t);
      t.unique(["eventId", "email"]);
      t.unique(["token"]);
      t.index("eventId");
      t.index("userId");
      t.index("email");
    });
  }

  if (!(await knex.schema.hasTable("general_event_popup_states"))) {
    await knex.schema.createTable("general_event_popup_states", (t) => {
      id(t);
      fk(t, "userId").notNullable();
      fk(t, "eventId").notNullable();
      t.datetime("hiddenUntil").nullable();
      timestamps(t);
      t.unique(["userId", "eventId"]);
    });
  }

  await knex.raw(`ALTER TABLE leads MODIFY source ENUM(${enumSql(NEW_SOURCES)}) NOT NULL`);
  if (!(await knex.schema.hasColumn("leads", "generalEventId"))) {
    await knex.schema.alterTable("leads", (t) => {
      fk(t, "generalEventId").nullable();
      t.index("generalEventId");
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("leads", "generalEventId")) {
    await knex.schema.alterTable("leads", (t) => { t.dropIndex("generalEventId"); t.dropColumn("generalEventId"); });
  }
  await knex("leads").where({ source: "event" }).update({ source: "contact" });
  await knex.raw(`ALTER TABLE leads MODIFY source ENUM(${enumSql(OLD_SOURCES)}) NOT NULL`);
  await knex.schema.dropTableIfExists("general_event_popup_states");
  await knex.schema.dropTableIfExists("general_event_registrations");
  await knex.schema.dropTableIfExists("general_events");
};
