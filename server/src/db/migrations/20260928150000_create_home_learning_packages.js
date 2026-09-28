const { randomUUID } = require("crypto");
const { id, fk, timestamps } = require("../helpers");

// Home Learning packages become records an admin manages (Home Learning → Packages) instead of
// prices hard-coded in both the backend and the website. A published package is served to the
// website by GET /api/public/home-learning/packages; a household is sold one package.
//
// Pricing per package: `monthlyAmount` covers `childrenIncluded` children. When
// `allowExtraChildren` is on, each child beyond that adds `extraChildAmount`, up to `maxChildren`.
//
// Seeds the three packages the website used to hard-code — for every admin that already has
// households, plus the public-content admin — with the website's old ids as slugs
// (one-child / three-children / five-children), so existing ?package= links and enquiries keep
// resolving. Existing households are linked to the matching seeded package by child count.
const SEED = [
  { slug: "one-child", name: "One child", childrenIncluded: 1, monthlyAmount: 8000, allowExtraChildren: false, extraChildAmount: null, maxChildren: 1, sortOrder: 1 },
  { slug: "three-children", name: "Three children", childrenIncluded: 3, monthlyAmount: 15000, allowExtraChildren: false, extraChildAmount: null, maxChildren: 3, sortOrder: 2 },
  { slug: "five-children", name: "Five children", childrenIncluded: 5, monthlyAmount: 24000, allowExtraChildren: true, extraChildAmount: 7000, maxChildren: 20, sortOrder: 3 },
];

exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("home_learning_packages"))) {
    await knex.schema.createTable("home_learning_packages", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      table.string("name", 150).notNullable();
      table.string("slug", 160).notNullable();
      table.string("summary", 300).nullable();
      table.text("description").nullable();
      table.integer("childrenIncluded").notNullable();
      table.integer("monthlyAmount").notNullable();
      table.boolean("allowExtraChildren").notNullable().defaultTo(false);
      table.integer("extraChildAmount").nullable();
      table.integer("maxChildren").notNullable();
      table.json("features").nullable();
      table.string("badge", 40).nullable();
      table.boolean("isPublished").notNullable().defaultTo(false);
      table.string("status", 20).notNullable().defaultTo("active");
      table.integer("sortOrder").notNullable().defaultTo(0);
      timestamps(table);
      table.unique(["ownerAdminId", "slug"]);
      table.index(["ownerAdminId", "isPublished", "status"]);
    });
  }
  if (!(await knex.schema.hasColumn("home_learning_households", "packageId"))) {
    await knex.schema.alterTable("home_learning_households", (table) => {
      table.string("packageId", 36).nullable();
      table.index("packageId");
    });
  }

  const owners = new Set((await knex("home_learning_households").distinct("ownerAdminId")).map((r) => r.ownerAdminId));
  if (process.env.PUBLIC_CONTENT_ADMIN_ID) owners.add(process.env.PUBLIC_CONTENT_ADMIN_ID);
  const now = new Date();
  for (const ownerAdminId of owners) {
    const existing = await knex("home_learning_packages").where({ ownerAdminId }).first();
    if (existing) continue;
    const rows = SEED.map((pkg) => ({
      id: randomUUID(), ownerAdminId, ...pkg,
      summary: `Monthly Home Learning for ${pkg.childrenIncluded} ${pkg.childrenIncluded === 1 ? "child" : "children"}.`,
      description: null, features: JSON.stringify([]), badge: null, isPublished: true, status: "active",
      createdAt: now, updatedAt: now,
    }));
    await knex("home_learning_packages").insert(rows);
    const households = await knex("home_learning_households").where({ ownerAdminId }).whereNull("packageId");
    for (const household of households) {
      const match = [...rows].reverse().find((pkg) => household.childCount >= pkg.childrenIncluded && (household.childCount === pkg.childrenIncluded || pkg.allowExtraChildren));
      if (match) await knex("home_learning_households").where({ id: household.id }).update({ packageId: match.id, planCode: match.slug.slice(0, 30) });
    }
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("home_learning_households", "packageId")) {
    await knex.schema.alterTable("home_learning_households", (table) => {
      table.dropIndex("packageId");
      table.dropColumn("packageId");
    });
  }
  await knex.schema.dropTableIfExists("home_learning_packages");
};
