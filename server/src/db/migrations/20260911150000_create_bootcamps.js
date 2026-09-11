const { id, fk, timestamps } = require("../helpers");
const { randomUUID } = require("crypto");

// Bootcamps — an independent domain, a sibling of Curriculum / Events / Competitions, NOT a
// flag on `curricula` anymore. Until now a "bootcamp" was an Event curriculum
// (curricula.isEvent = true) with sale/marketing columns bolted directly onto that same row
// (see 20260910093200_add_sale_fields_to_curricula.js), which meant a bootcamp could never
// exist without being an Event. This migration extracts those columns into their own table —
// a bootcamp is now a standalone sellable listing, exactly like a competition.
//
// `eventId` is an OPTIONAL soft link (no DB FK, same posture as competitions.eventId): a
// bootcamp CAN belong to an Event (so its "upcoming runs" show that Event's real hub
// deployments), but it can also stand entirely alone.
//
// Every existing for-sale event-curriculum is copied into a bootcamps row here, with its
// `eventId` set back to the curriculum it came from — this preserves today's "upcoming runs"
// display exactly for existing bootcamps. The 11 sale columns are then dropped from `curricula`.

exports.up = async function up(knex) {
  await knex.schema.createTable("bootcamps", (t) => {
    id(t);
    // Multi-tenant scope — same as curricula/events/competitions.
    fk(t, "ownerAdminId").notNullable();
    t.index("ownerAdminId");
    // Optional link to an Event this bootcamp belongs to. Soft reference, no FK.
    fk(t, "eventId").nullable();
    t.index("eventId");

    t.string("name", 150).notNullable();
    // The paragraph under the title on the public site.
    t.text("description").nullable();
    // Short marketing line under the name (was curricula.saleTagline).
    t.string("tagline", 200).nullable();
    // A single cover/hero image (a stored /uploads path or an absolute URL).
    t.string("coverImage", 500).nullable();

    // holiday | weekend | after_school | online.
    t.enu("format", ["holiday", "weekend", "after_school", "online"]).nullable();
    // "1 week", "2 weekends" — free-text duration label.
    t.string("durationLabel", 60).nullable();
    t.integer("ageMin").unsigned().nullable();
    t.integer("ageMax").unsigned().nullable();
    // Whole currency units, no fractional pricing (was curricula.priceAmount).
    t.integer("priceAmount").unsigned().nullable();
    t.string("priceCurrency", 8).notNullable().defaultTo("KES");
    t.string("priceNote", 300).nullable();
    // Bullet points on the public card/detail page.
    t.json("highlights").nullable();

    // internal — not shown anywhere public. for_sale — appears on the public marketing site
    // (africa.digifunzi.com/bootcamps). No separate isPublic flag (unlike competitions, which
    // also has a draft/open/closed workflow) — saleStatus alone gates visibility, matching the
    // exact semantics the old curricula.saleStatus column already had.
    t.enu("saleStatus", ["internal", "for_sale"]).notNullable().defaultTo("internal");
    t.index("saleStatus");

    timestamps(t);
    t.index("createdAt");
  });

  // Carry over every existing for-sale event-curriculum as a real Bootcamp row, linked back to
  // its source curriculum so "upcoming runs" keeps working exactly as it does today.
  const rows = await knex("curricula").where({ isEvent: true, saleStatus: "for_sale" });
  for (const r of rows) {
    // eslint-disable-next-line no-await-in-loop
    await knex("bootcamps").insert({
      id: randomUUID(),
      ownerAdminId: r.ownerAdminId,
      eventId: r.id,
      name: r.name,
      description: r.description,
      tagline: r.saleTagline,
      coverImage: r.coverImage,
      format: r.saleFormat,
      durationLabel: r.durationLabel,
      ageMin: r.ageMin,
      ageMax: r.ageMax,
      priceAmount: r.priceAmount,
      priceCurrency: r.priceCurrency,
      priceNote: r.priceNote,
      // mysql2 auto-parses JSON columns on read (r.highlights is already a real array here)
      // but does not auto-serialize a JS array on write — must re-stringify for this raw insert.
      highlights: JSON.stringify(r.highlights || []),
      saleStatus: r.saleStatus,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }

  await knex.schema.alterTable("curricula", (t) => {
    t.dropColumn("saleStatus");
    t.dropColumn("coverImage");
    t.dropColumn("priceAmount");
    t.dropColumn("priceCurrency");
    t.dropColumn("priceNote");
    t.dropColumn("saleTagline");
    t.dropColumn("saleFormat");
    t.dropColumn("durationLabel");
    t.dropColumn("ageMin");
    t.dropColumn("ageMax");
    t.dropColumn("highlights");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("curricula", (t) => {
    t.enu("saleStatus", ["internal", "for_sale"]).notNullable().defaultTo("internal");
    t.string("coverImage", 500).nullable();
    t.integer("priceAmount").unsigned().nullable();
    t.string("priceCurrency", 8).notNullable().defaultTo("KES");
    t.string("priceNote", 300).nullable();
    t.string("saleTagline", 200).nullable();
    t.enu("saleFormat", ["holiday", "weekend", "after_school", "online"]).nullable();
    t.string("durationLabel", 60).nullable();
    t.integer("ageMin").unsigned().nullable();
    t.integer("ageMax").unsigned().nullable();
    t.json("highlights").nullable();
  });

  // Best-effort reversal: only rows that still carry a link back to their source curriculum can
  // be restored — a bootcamp created standalone after this migration (no eventId) has nowhere
  // to go back to and is left in the bootcamps table, dropped along with it below.
  const rows = await knex("bootcamps").whereNotNull("eventId");
  for (const r of rows) {
    // eslint-disable-next-line no-await-in-loop
    await knex("curricula").where({ id: r.eventId }).update({
      saleStatus: r.saleStatus,
      coverImage: r.coverImage,
      priceAmount: r.priceAmount,
      priceCurrency: r.priceCurrency,
      priceNote: r.priceNote,
      saleTagline: r.tagline,
      saleFormat: r.format,
      durationLabel: r.durationLabel,
      ageMin: r.ageMin,
      ageMax: r.ageMax,
      highlights: JSON.stringify(r.highlights || []),
    });
  }

  await knex.schema.dropTableIfExists("bootcamps");
};
