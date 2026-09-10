const { id, fk, timestamps } = require("../helpers");

// Competitions — an independent domain, a sibling of Curriculum / Programs, NOT a flag on
// `curricula`. A competition is an EVENT (a theme, a set of tracks, dates, a register CTA),
// not a curriculum: it shares almost none of the Grade→Subject→Module→Topic→Session structure,
// versioning, or competency framework, so bolting an `isCompetition` flag onto `curricula`
// would force every curriculum query and most of the authoring UI to special-case it.
//
// `programId` is an OPTIONAL soft link (no DB FK, same posture as the rest of this schema):
// a competition CAN belong to a Program (e.g. "End-of-Bootcamp Showcase"), and then the
// Program view lists it — but it can also stand entirely alone.
//
// `tracks` is a JSON array of { id, name, subtitle, description, highlights[], registerUrl,
// knowMoreUrl } — the Track 1 / Track 2 / Track 3 cards on the public site. Embedded rather
// than a child table because a track has no life outside its competition and is only ever
// read/written as part of the whole competition document (same call-site shape as
// curricula.classes / assessments.items).

exports.up = async function up(knex) {
  await knex.schema.createTable("competitions", (t) => {
    id(t);
    // Multi-tenant scope — same as curricula/programs/assessments (see the owner-admin-id
    // migrations). A competition is authored by, and visible to, one admin's tenant.
    fk(t, "ownerAdminId").notNullable();
    t.index("ownerAdminId");
    // Optional link to a Program this competition belongs to. Soft reference, no FK.
    fk(t, "programId").nullable();
    t.index("programId");

    t.string("name", 150).notNullable();
    // The paragraph under the title on the public site.
    t.text("description").nullable();
    // "Codeavour 8.0 International", "Term 2 2026", … — a free-text edition/season label.
    t.string("edition", 120).nullable();
    // individual | pairs | team — how entrants compete (display only for now).
    t.enu("format", ["individual", "pairs", "team"]).nullable();
    // "Ages 8–16", "Primary & Secondary" — free-text age/level band.
    t.string("level", 120).nullable();
    // one_off | annual | termly — cadence label.
    t.enu("cadence", ["one_off", "annual", "termly"]).nullable();
    // Event window (plain "YYYY-MM-DD" strings, same convention as programs.startDate).
    t.string("startDate", 10).nullable();
    t.string("endDate", 10).nullable();
    // A single cover/hero image (a stored /uploads path or an absolute URL).
    t.string("coverImage", 500).nullable();

    // draft  — being set up, hidden everywhere outside the module
    // open   — live, registration accepted (shows on the public site)
    // closed — event finished / registration shut
    t.enu("status", ["draft", "open", "closed"]).notNullable().defaultTo("draft");

    // Whether it appears on the public marketing site (africa.digifunzi.com/competitions).
    // Independent of status so an admin can prepare a live-but-not-yet-public competition.
    t.boolean("isPublic").notNullable().defaultTo(false);

    // The Track cards. JSON array — see the module comment above for the shape.
    t.json("tracks").nullable();

    timestamps(t);
    t.index("status");
    t.index("createdAt");
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("competitions");
};
