// Digifunzi Connect for every learner (26 Nov 2026 — the user's choice): no parent's switch and no
// age limit. Every learner with their own login who is at a hub becomes a member now (members made
// later on arrival — connect.store.js's ensureMember); members a parent had switched off are
// switched back on (a "Former member" whose data was deleted gets their short name back).
// No table changes. connect_members.consentMethod "automatic" marks these.
const { generateId } = require("../../shared/utils/model.utils");
const R = require("../../modules/connect/connect.rules");

exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("connect_members"))) return;
  const now = new Date();
  const off = await knex("connect_members").where({ status: "off" }).select("id", "learnerId", "displayName");
  for (const m of off) {
    const learner = await knex("learners").where({ id: m.learnerId }).first("firstName", "lastName");
    await knex("connect_members").where({ id: m.id }).update({
      status: "active", withdrawnAt: null, consentMethod: "automatic", consentAt: now, updatedAt: now,
      ...(m.displayName === "Former member" && learner ? { displayName: R.shortName(learner.firstName, learner.lastName) } : {}),
    });
  }
  const have = new Set(await knex("connect_members").pluck("learnerId"));
  const learners = (await knex("learners").whereNotNull("username").whereNull("teacherId").select("id", "firstName", "lastName", "username"))
    .filter((l) => !have.has(l.id));
  for (const l of learners) {
    const link = await knex("learner_hub_links").where({ learnerId: l.id }).orderByRaw("status = 'active' DESC").first("hubId");
    const hub = link ? await knex("learning_hubs").where({ id: link.hubId }).first("ownerAdminId") : null;
    if (!hub?.ownerAdminId) continue; // made on arrival if they ever get a workspace
    const user = await knex("users").whereRaw("LOWER(username) = ?", [String(l.username).toLowerCase()]).first("id");
    try {
      await knex("connect_members").insert({
        id: generateId(), ownerAdminId: hub.ownerAdminId, learnerId: l.id, userId: user?.id || null, status: "active",
        consentMethod: "automatic", consentAt: now, directMessages: true, photoAllowed: false,
        displayName: R.shortName(l.firstName, l.lastName), avatar: JSON.stringify(R.defaultAvatar(l.id)),
        interests: JSON.stringify([]), skills: JSON.stringify([]), showCertificates: true, createdAt: now, updatedAt: now,
      });
    } catch (err) {
      if (err.code !== "ER_DUP_ENTRY") throw err;
    }
  }
};

// Nothing to undo: who was switched off by a parent isn't kept apart.
exports.down = async function down() {};
