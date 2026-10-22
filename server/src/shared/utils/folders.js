const { z } = require("zod");
const db = require("../../config/db");
const { createRecord, updateRecord, firstOrNull } = require("./model.utils");

// Folders on a list page (Courses, Assessments): named groups an admin files their records into.
// A record sits in at most one folder (its `folderId`); a folder is only a label in one admin's
// workspace, so nothing else about a record depends on it. Deleting a folder takes its records
// out of it; it never deletes a record.
//
//   folderService({ table: "course_folders", itemTable: "courses", noun: "course", countKey: "courseCount" })
//
// Each folder in a list carries `itemCount` (and `countKey`, when given, with the same number).

const folderSchema = z.object({
  name: z.string().trim().min(1, "Give the folder a name").max(120, "Folder names are at most 120 characters"),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Choose a colour").optional().nullable(),
  description: z.string().trim().max(2000, "Keep the description under 2000 characters").optional().nullable(),
  // An uploaded image URL (from /api/uploads/image) — absolute, or a path on this API.
  coverImage: z.string().trim().max(2048).regex(/^(https?:\/\/|\/)/, "Upload an image").optional().nullable().or(z.literal("")),
});

function fail(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}

function parseOrFail(schema, input) {
  const parsed = schema.safeParse(input || {});
  if (!parsed.success) fail(parsed.error.issues[0]?.message || "Invalid details");
  return parsed.data;
}

function folderService({ table, itemTable, noun, countKey = null }) {
  const plural = `${noun}s`;
  const idsKey = `${noun}Ids`;
  const idsSchema = z.object({
    [idsKey]: z.array(z.string().min(1)).min(1, `Choose at least one ${noun}`).max(500),
  });

  async function ownFolder(ownerAdminId, id) {
    const folder = await firstOrNull(db(table).where({ id, ownerAdminId }));
    if (!folder) fail("Folder not found", 404);
    return folder;
  }

  async function assertNameFree(ownerAdminId, name, excludeId = null) {
    let query = db(table).where({ ownerAdminId }).whereRaw("LOWER(name) = ?", [name.toLowerCase()]);
    if (excludeId) query = query.whereNot({ id: excludeId });
    if (await query.first()) fail(`You already have a folder called "${name}"`, 409);
  }

  const withCount = (folder, count) => ({ ...folder, itemCount: count, ...(countKey ? { [countKey]: count } : {}) });

  return {
    // The admin's folders (A–Z), each with how many of their records are in it.
    async list(ownerAdminId) {
      const folders = await db(table).where({ ownerAdminId }).orderBy("name", "asc");
      if (!folders.length) return [];
      const counts = await db(itemTable).where({ ownerAdminId }).whereIn("folderId", folders.map((f) => f.id))
        .groupBy("folderId").select("folderId").count({ count: "*" });
      const byFolder = new Map(counts.map((row) => [row.folderId, Number(row.count)]));
      return folders.map((folder) => withCount(folder, byFolder.get(folder.id) || 0));
    },

    async create(ownerAdminId, input) {
      const data = parseOrFail(folderSchema, input);
      await assertNameFree(ownerAdminId, data.name);
      const folder = await createRecord(db, table, {
        ownerAdminId, name: data.name, color: data.color || null, description: data.description || null, coverImage: data.coverImage || null,
      });
      return withCount(folder, 0);
    },

    async update(ownerAdminId, id, input) {
      await ownFolder(ownerAdminId, id);
      const data = parseOrFail(folderSchema.partial(), input);
      const patch = {};
      if (data.name !== undefined) {
        await assertNameFree(ownerAdminId, data.name, id);
        patch.name = data.name;
      }
      if (data.color !== undefined) patch.color = data.color || null;
      if (data.description !== undefined) patch.description = data.description || null;
      if (data.coverImage !== undefined) patch.coverImage = data.coverImage || null;
      return updateRecord(db, table, id, patch);
    },

    // The folder goes; its records stay, just outside any folder.
    async remove(ownerAdminId, id) {
      await ownFolder(ownerAdminId, id);
      await db(itemTable).where({ ownerAdminId, folderId: id }).update({ folderId: null });
      await db(table).where({ id, ownerAdminId }).del();
      return { deleted: true };
    },

    // Puts records in this folder (moving them out of any other). Only the admin's own records.
    async addItems(ownerAdminId, id, input) {
      await ownFolder(ownerAdminId, id);
      const ids = parseOrFail(idsSchema, input)[idsKey];
      const own = await db(itemTable).where({ ownerAdminId }).whereIn("id", ids).pluck("id");
      if (own.length !== new Set(ids).size) fail(`Some of those ${plural} aren't in your workspace`, 404);
      await db(itemTable).whereIn("id", own).update({ folderId: id });
      return { moved: own.length };
    },

    async removeItem(ownerAdminId, id, itemId) {
      await ownFolder(ownerAdminId, id);
      const count = await db(itemTable).where({ id: itemId, ownerAdminId, folderId: id }).update({ folderId: null });
      if (!count) fail(`That ${noun} isn't in this folder`, 404);
      return { removed: true };
    },
  };
}

module.exports = { folderService };
