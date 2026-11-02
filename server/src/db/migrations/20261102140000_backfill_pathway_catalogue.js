const crypto = require("crypto");

// Settings → Pathways now shows the pathways curricula actually use (pathway-template.service.js's
// getDirectory). Courses and assessments are tagged from the workspace's pathway catalogue
// (pathway_templates), which only gained an entry when a pathway was made in a curriculum from
// late Sep 2026 — so pathways made before then (or copied in) can't be picked as a tag. This adds
// a catalogue entry for every curriculum pathway name a workspace uses that has none: the name,
// description and colour of its most recently edited row, no courses. Additive only — nothing is
// changed or deleted, and running it again adds nothing.
exports.up = async function up(knex) {
  const rows = await knex("pathways")
    .join("curricula", "curricula.id", "pathways.curriculumId")
    .whereNotNull("curricula.ownerAdminId")
    .select("pathways.name", "pathways.description", "pathways.color", "pathways.updatedAt", "curricula.ownerAdminId")
    .orderBy("pathways.updatedAt", "desc");
  const templates = await knex("pathway_templates").select("name", "ownerAdminId");
  const key = (owner, name) => `${owner}::${String(name || "").trim().toLowerCase()}`;
  const have = new Set(templates.map((t) => key(t.ownerAdminId, t.name)));
  const now = new Date();
  for (const row of rows) {
    const k = key(row.ownerAdminId, row.name);
    if (!String(row.name || "").trim() || have.has(k)) continue;
    have.add(k);
    await knex("pathway_templates").insert({
      id: crypto.randomUUID(),
      name: String(row.name).trim(),
      description: row.description || "",
      color: row.color || "#25476a",
      courses: JSON.stringify([]),
      ownerAdminId: row.ownerAdminId,
      createdAt: now,
      updatedAt: now,
    });
  }
};

// Nothing to undo safely: an added entry may have been used (tagged on a course) since.
exports.down = async function down() {};
