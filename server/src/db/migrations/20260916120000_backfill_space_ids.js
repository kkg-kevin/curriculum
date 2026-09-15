const { randomUUID } = require("crypto");

// learning-hub.service.js's withSpaceIds only assigns a space entry an id the next time that
// hub is created/updated WITH a spaces[] key in the payload - a hub whose spaces were set before
// that change shipped, and hasn't been re-saved since, has spaces[] entries with no id at all.
// hub-visit.service.js's resolveSpace does a strict `s.id === spaceId` match, so a legacy space
// with no id can never be logged against - it fails with a generic "Space not found on this hub"
// error that looks like a missing space rather than a missing id. This one-time data migration
// backfills every existing learning_hubs row's spaces[] entries that are missing an id, so
// hub-visit logging works immediately for hubs configured before this feature existed, without
// waiting for an admin to happen to re-save that hub's settings first.
exports.up = async function up(knex) {
  const rows = await knex("learning_hubs").select("id", "spaces").whereNotNull("spaces");
  for (const row of rows) {
    if (!Array.isArray(row.spaces) || row.spaces.length === 0) continue;
    let changed = false;
    const spaces = row.spaces.map((space) => {
      if (space.id) return space;
      changed = true;
      return { ...space, id: randomUUID() };
    });
    if (changed) {
      await knex("learning_hubs").where({ id: row.id }).update({ spaces: JSON.stringify(spaces), updatedAt: new Date() });
    }
  }
};

// Not reversible - the ids assigned here (and any real hub_visits/learner_hub_links rows that
// come to reference them after this migration runs) can't be un-backfilled without knowing
// which ids were freshly assigned vs already present. A no-op down matches how this repo treats
// other one-time backfills (see CLAUDE.md: the old JSON-file->MySQL loaders were removed once
// their one-time job was done, not made reversible).
exports.down = async function down() {};
