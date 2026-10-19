/* eslint-disable no-console */
// Folds every admin's separate workspace into ONE organisation whose admins all work on the same
// content (see the 20261013110000_add_organisation_to_users.js migration and
// shared/utils/organisation.js).
//
//   node src/scripts/mergeOrganisation.js                 report only — changes nothing
//   node src/scripts/mergeOrganisation.js --apply         do it (take a database backup first)
//   node src/scripts/mergeOrganisation.js --base a@b.com  use this admin as the base instead
//
// The same two runs are `npm run org:merge:report` and `npm run org:merge:apply`, which cPanel's
// "Run JS script" button can start with the app's own environment variables. That button can't
// pass --base, so the base can also be named in the ORG_BASE_EMAIL environment variable.
//
// The BASE admin is the one whose data stays exactly as it is, and whose user id becomes the
// organisation's key. By default it is the admin the public website reads (PUBLIC_CONTENT_ADMIN_ID),
// so the website needs no configuration change; without that setting, pass --base.
//
// For every other admin:
//   - everything they own is re-owned to the organisation;
//   - a Settings entry the organisation already has under the same name — a competency (and its
//     indicators), pathway, system level, item or staff role — is MERGED into the organisation's:
//     theirs is removed and everything that pointed at it (in any table, including ids held
//     inside JSON) is re-pointed at the organisation's. The organisation's own wording, order,
//     stock and permissions are the ones kept. An indicator only they had moves across;
//   - content that may genuinely differ — a curriculum, course, assessment, bootcamp or
//     competition with a name the organisation already uses — is kept and renamed with that
//     admin's first name in brackets, e.g. "Robotics 1 (Ken)", for a person to tidy up later;
//   - settings an organisation has one of (email settings, certificate signatory, claim rates)
//     keep the BASE admin's; the others' are dropped (kept only if the base has none);
//   - nothing of theirs is published by the merge: anything of theirs "for sale" goes back to
//     internal, their pathways' public diagnostics are switched off, and their curricula are
//     marked merged-in so the website keeps showing the base's;
//   - sharing connections between the admins are removed (there is nothing left to share);
//   - they become an admin of the organisation.
//
// Report-only runs the whole thing inside a transaction and rolls it back, so the report is what
// --apply would really do. Safe to run again after a merge: there is nothing left to fold in.
require("dotenv").config();
const db = require("../config/db");
const env = require("../config/env");

const APPLY = process.argv.includes("--apply");
const baseFlag = process.argv.indexOf("--base");
const BASE_EMAIL = baseFlag > -1 ? process.argv[baseFlag + 1] : process.env.ORG_BASE_EMAIL || null;

// Every column that says which admin a row belongs to.
const OWNER_COLUMNS = [
  ["access_roles", "ownerAdminId"], ["assessments", "ownerAdminId"], ["audit_log", "ownerAdminId"],
  ["bootcamp_hubs", "ownerAdminId"], ["bootcamps", "ownerAdminId"], ["certificates", "ownerAdminId"],
  ["club_membership_children", "ownerAdminId"], ["club_memberships", "ownerAdminId"], ["club_packages", "ownerAdminId"],
  ["competencies", "ownerAdminId"], ["competition_hubs", "ownerAdminId"], ["competitions", "ownerAdminId"],
  ["course_folders", "ownerAdminId"], ["courses", "ownerAdminId"], ["curricula", "ownerAdminId"], ["drafts", "ownerAdminId"], ["event_games", "ownerAdminId"],
  ["home_learning_enrollments", "ownerAdminId"], ["home_learning_households", "ownerAdminId"],
  ["home_learning_packages", "ownerAdminId"], ["hub_visits", "ownerAdminId"], ["items", "ownerAdminId"],
  ["learning_hubs", "ownerAdminId"], ["pathway_templates", "ownerAdminId"], ["shared_imports", "ownerAdminId"],
  ["system_levels", "ownerAdminId"], ["teacher_claims", "ownerAdminId"],
  ["learners", "createdByAdminId"], ["teachers", "createdByAdminId"], ["users", "invitedByAdminId"],
];

// One row per organisation — the base admin's is the one kept.
const SINGLETONS = ["certificate_settings", "claim_settings", "email_settings"];

// Settings entries: one per name in an organisation (`also` is a second column that makes a name
// distinct). A same-named one is merged into the organisation's, not kept twice.
const CATALOGUES = [
  { table: "competencies" }, { table: "pathway_templates" }, { table: "system_levels" },
  { table: "items", also: "kind" }, { table: "access_roles" },
];

// Content whose name an organisation can only use once, but which may genuinely differ between
// two admins — kept, and renamed when the name is taken.
const NAMED = [
  { table: "curricula" }, { table: "courses" }, { table: "assessments" },
  { table: "bootcamps" }, { table: "competitions" },
  { table: "home_learning_packages", column: "slug", slug: true },
  { table: "club_packages", column: "slug", slug: true },
  { table: "course_folders" },
];

// Tables the id rewrite leaves alone: bookkeeping with no content ids in it.
const NOT_REWRITTEN = new Set(["knex_migrations", "knex_migrations_lock", "user_sessions", "revoked_tokens"]);

// Tables whose rows can be switched "for sale" onto the public website.
const SELLABLE = ["assessments", "items", "bootcamps", "competitions", "curricula"];

const ROLLBACK = new Error("report only");
const lower = (value) => String(value || "").trim().toLowerCase();

async function hasColumn(trx, table, column) {
  return (await trx.schema.hasTable(table)) && trx.schema.hasColumn(table, column);
}

async function columnLength(trx, table, column) {
  const [rows] = await trx.raw(
    "select character_maximum_length len from information_schema.columns where table_schema = database() and table_name = ? and column_name = ?",
    [table, column]
  );
  return Number(rows[0]?.len || rows[0]?.LEN || 255);
}

// Swaps every id in `idMap` (a merged-away Settings entry -> the organisation's) wherever it
// appears: id columns, and ids held inside JSON or text. Returns { table: rows changed }.
async function rewriteIds(trx, idMap) {
  if (idMap.size === 0) return {};
  const pattern = new RegExp([...idMap.keys()].join("|"), "g");
  const [columns] = await trx.raw(
    "select table_name t, column_name c, column_key k from information_schema.columns where table_schema = database() and data_type in ('char','varchar','tinytext','text','mediumtext','longtext','json')"
  );
  const byTable = new Map();
  for (const row of columns) {
    const table = row.t || row.T;
    const column = row.c || row.C;
    if (NOT_REWRITTEN.has(table) || column === "id") continue;
    byTable.set(table, [...(byTable.get(table) || []), column]);
  }
  const changed = {};
  for (const [table, cols] of byTable) {
    if (!(await trx.schema.hasColumn(table, "id"))) continue;
    const ids = await trx(table).pluck("id");
    for (let i = 0; i < ids.length; i += 200) {
      const rows = await trx(table).whereIn("id", ids.slice(i, i + 200)).select("id", ...cols);
      for (const row of rows) {
        const update = {};
        for (const col of cols) {
          const value = row[col];
          if (value == null) continue;
          const text = typeof value === "string" ? value : JSON.stringify(value);
          pattern.lastIndex = 0;
          if (!pattern.test(text)) continue;
          update[col] = text.replace(pattern, (match) => idMap.get(match));
        }
        if (Object.keys(update).length) {
          await trx(table).where({ id: row.id }).update(update);
          changed[table] = (changed[table] || 0) + 1;
        }
      }
    }
  }
  return changed;
}

async function main() {
  const report = [];
  const say = (line = "") => report.push(line);

  try {
    await db.transaction(async (trx) => {
      const admins = await trx("users").where({ role: "admin" }).orderBy("createdAt", "asc");
      let base = null;
      if (BASE_EMAIL) base = admins.find((a) => lower(a.email) === lower(BASE_EMAIL));
      else if (env.PUBLIC_CONTENT_ADMIN_ID) base = admins.find((a) => a.id === env.PUBLIC_CONTENT_ADMIN_ID);
      if (!base) {
        throw new Error(
          BASE_EMAIL
            ? `No admin with the email ${BASE_EMAIL}`
            : "PUBLIC_CONTENT_ADMIN_ID is not set to an admin on this installation — pass --base <admin email>, or set ORG_BASE_EMAIL"
        );
      }
      const others = admins.filter((a) => a.id !== base.id && (a.organisationId || a.id) !== base.id);
      const joined = admins.filter((a) => a.id !== base.id && a.organisationId === base.id);

      say(`Organisation base: ${base.name} <${base.email}>  (key ${base.id})`);
      if (joined.length) say(`Already in the organisation: ${joined.map((a) => a.email).join(", ")}`);
      say(`Admins to fold in: ${others.length ? others.map((a) => `${a.name} <${a.email}>`).join(", ") : "none"}`);
      say();

      const idMap = new Map(); // a merged-away Settings entry's id -> the organisation's
      for (const admin of others) {
        const tag = (String(admin.name || "").trim().split(/\s+/)[0] || admin.email.split("@")[0]).slice(0, 20);
        say(`── ${admin.name} <${admin.email}> ──`);

        // 0. Settings entries the organisation already has → merged into the organisation's.
        for (const { table, also } of CATALOGUES) {
          if (!(await hasColumn(trx, table, "ownerAdminId"))) continue;
          const key = (row) => `${also ? `${row[also] || ""}|` : ""}${lower(row.name)}`;
          const ours = new Map((await trx(table).where({ ownerAdminId: base.id })).map((row) => [key(row), row]));
          const merged = [];
          let indicatorsMoved = 0;
          for (const row of await trx(table).where({ ownerAdminId: admin.id })) {
            const match = ours.get(key(row));
            if (!match) continue;
            idMap.set(row.id, match.id);
            merged.push(row.name);
            if (table === "competencies") {
              const ourIndicators = new Map((await trx("competency_indicators").where({ competencyId: match.id })).map((i) => [lower(i.name), i]));
              for (const indicator of await trx("competency_indicators").where({ competencyId: row.id })) {
                const same = ourIndicators.get(lower(indicator.name));
                if (same) {
                  idMap.set(indicator.id, same.id);
                  await trx("competency_indicators").where({ id: indicator.id }).del();
                } else {
                  await trx("competency_indicators").where({ id: indicator.id }).update({ competencyId: match.id });
                  indicatorsMoved += 1;
                }
              }
            }
            await trx(table).where({ id: row.id }).del();
          }
          if (merged.length) {
            say(`   merge   ${table}: ${merged.length} same-named now use the organisation's${indicatorsMoved ? ` (${indicatorsMoved} indicator(s) only they had were added to it)` : ""}`);
          }
        }

        // 1. Content names the organisation already uses → keep both, rename this admin's.
        for (const { table, column = "name", also, slug } of NAMED) {
          if (!(await hasColumn(trx, table, "ownerAdminId")) || !(await hasColumn(trx, table, column))) continue;
          const max = await columnLength(trx, table, column);
          const key = (row) => `${also ? `${row[also] || ""}|` : ""}${lower(row[column])}`;
          const taken = new Set((await trx(table).where({ ownerAdminId: base.id })).map(key));
          for (const row of await trx(table).where({ ownerAdminId: admin.id })) {
            if (!taken.has(key(row))) { taken.add(key(row)); continue; }
            let renamed;
            for (let n = 1; ; n += 1) {
              const suffix = slug ? `-${lower(tag).replace(/[^a-z0-9]+/g, "-")}${n > 1 ? `-${n}` : ""}` : ` (${tag}${n > 1 ? ` ${n}` : ""})`;
              renamed = `${String(row[column]).trim().slice(0, max - suffix.length).trim()}${suffix}`;
              if (!taken.has(key({ ...row, [column]: renamed }))) break;
            }
            taken.add(key({ ...row, [column]: renamed }));
            await trx(table).where({ id: row.id }).update({ [column]: renamed });
            say(`   rename  ${table}: "${row[column]}" -> "${renamed}"`);
          }
        }

        // 2. System levels keep one running order: this admin's follow the organisation's.
        if (await hasColumn(trx, "system_levels", "sequence")) {
          const last = Number((await trx("system_levels").where({ ownerAdminId: base.id }).max({ max: "sequence" }).first())?.max || 0);
          const theirs = await trx("system_levels").where({ ownerAdminId: admin.id }).orderBy("sequence", "asc");
          for (let i = 0; i < theirs.length; i += 1) await trx("system_levels").where({ id: theirs[i].id }).update({ sequence: last + i + 1 });
          if (theirs.length) say(`   system levels: ${theirs.length} placed after the organisation's ${last}`);
        }

        // 3. Nothing of theirs goes public by being merged.
        for (const table of SELLABLE) {
          if (!(await hasColumn(trx, table, "saleStatus")) || !(await hasColumn(trx, table, "ownerAdminId"))) continue;
          const n = await trx(table).where({ ownerAdminId: admin.id, saleStatus: "for_sale" }).update({ saleStatus: "internal" });
          if (n) say(`   ${table}: ${n} taken off sale (set them for sale again if they should be on the website)`);
        }
        const curriculumIds = await trx("curricula").where({ ownerAdminId: admin.id }).pluck("id");
        if (curriculumIds.length) {
          const n = await trx("pathways").whereIn("curriculumId", curriculumIds).where({ publicDiagnosticEnabled: true }).update({ publicDiagnosticEnabled: false });
          if (n) say(`   pathways: ${n} public diagnostic(s) switched off`);
          if (await hasColumn(trx, "curricula", "mergedFromAdminId")) {
            await trx("curricula").whereIn("id", curriculumIds).whereNull("mergedFromAdminId").update({ mergedFromAdminId: admin.id });
          }
        }

        // 4. One-per-organisation settings: the base's are kept.
        for (const table of SINGLETONS) {
          if (!(await hasColumn(trx, table, "ownerAdminId"))) continue;
          const theirs = await trx(table).where({ ownerAdminId: admin.id }).first();
          if (!theirs) continue;
          if (await trx(table).where({ ownerAdminId: base.id }).first()) {
            await trx(table).where({ ownerAdminId: admin.id }).del();
            say(`   ${table}: dropped (the organisation keeps the base admin's)`);
          } else {
            await trx(table).where({ ownerAdminId: admin.id }).update({ ownerAdminId: base.id });
            say(`   ${table}: kept (the base admin had none)`);
          }
        }

        // 5. Everything they own now belongs to the organisation.
        const moved = [];
        for (const [table, column] of OWNER_COLUMNS) {
          if (!(await hasColumn(trx, table, column))) continue;
          const n = await trx(table).where({ [column]: admin.id }).update({ [column]: base.id });
          if (n) moved.push(`${table} ${n}`);
        }
        say(`   moved   ${moved.length ? moved.join(", ") : "nothing"}`);

        // 6. They are an admin of the organisation.
        await trx("users").where({ id: admin.id }).update({ organisationId: base.id });
        say();
      }

      // Everything that pointed at a merged-away Settings entry now points at the organisation's.
      const repointed = await rewriteIds(trx, idMap);
      const repointedTables = Object.entries(repointed).map(([table, n]) => `${table} ${n}`);
      if (idMap.size) {
        say(`Settings entries merged: ${idMap.size}. Rows re-pointed at the organisation's: ${repointedTables.length ? repointedTables.join(", ") : "none"}`);
        say();
      }

      // Sharing between admins who are now one organisation has nothing left to do.
      const memberIds = [base.id, ...others.map((a) => a.id), ...joined.map((a) => a.id)];
      if (await trx.schema.hasTable("admin_connections")) {
        const n = await trx("admin_connections").whereIn("requesterAdminId", memberIds).whereIn("recipientAdminId", memberIds).del();
        if (n) say(`Sharing connections between these admins removed: ${n}`);
      }

      // Things a person has to look at afterwards.
      const followUps = [];
      if (await hasColumn(trx, "learning_hubs", "isHomeLearning")) {
        const hubs = await trx("learning_hubs").where({ ownerAdminId: base.id, isHomeLearning: true }).select("name");
        if (hubs.length > 1) followUps.push(`${hubs.length} Home Learning hubs now exist (${hubs.map((h) => h.name).join(", ")}) — the system uses one; move the families into one and remove the other.`);
      }
      const dupes = async (table, label) => {
        const [rows] = await trx.raw(`select count(*) n from ${table} where ownerAdminId = ? and name regexp ' \\\\([^)]+\\\\)$'`, [base.id]);
        const n = Number(rows[0]?.n || rows[0]?.N || 0);
        if (n) followUps.push(`${n} ${label} carry a bracketed name — review each: keep, rename or delete.`);
      };
      await dupes("curricula", "curricula");
      await dupes("courses", "courses");
      await dupes("assessments", "assessments");
      if (others.length) followUps.push("Where a staff role, system level, competency, pathway or item had the same name, the base admin's version was kept — check permissions under Settings → People & sharing → Roles & access.");
      if (followUps.length) {
        say("To review afterwards:");
        followUps.forEach((line) => say(` - ${line}`));
        say();
      }

      const adminCount = Number((await trx("users").where({ role: "admin" }).andWhere((q) => q.where({ id: base.id }).orWhere({ organisationId: base.id })).count({ n: "*" }).first()).n);
      say(`Result: one organisation with ${adminCount} admin(s).`);
      if (!APPLY) throw ROLLBACK;
    });
    console.log(report.join("\n"));
    console.log("\nAPPLIED.");
  } catch (err) {
    if (err !== ROLLBACK) throw err;
    console.log(report.join("\n"));
    console.log("\nREPORT ONLY — nothing was changed. Run again with --apply to do it (take a database backup first).");
  }
}

main()
  .catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => db.destroy());
