const { z } = require("zod");
const db = require("../../config/db");
const { createRecord, updateRecord, firstOrNull } = require("../../shared/utils/model.utils");

// Course folders (Courses page): named groups an admin files their courses into. A course sits in
// at most one folder (courses.folderId); a folder is only a label in one admin's workspace, so
// nothing else about a course — curricula, sessions, classes, the learner/educator views —
// depends on it. Deleting a folder takes its courses out of it; it never deletes a course.

const TABLE = "course_folders";

const folderSchema = z.object({
  name: z.string().trim().min(1, "Give the folder a name").max(120, "Folder names are at most 120 characters"),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Choose a colour").optional().nullable(),
  description: z.string().trim().max(2000, "Keep the description under 2000 characters").optional().nullable(),
  // An uploaded image URL (from /api/uploads/image) — absolute, or a path on this API.
  coverImage: z.string().trim().max(2048).regex(/^(https?:\/\/|\/)/, "Upload an image").optional().nullable().or(z.literal("")),
});
const courseIdsSchema = z.object({
  courseIds: z.array(z.string().min(1)).min(1, "Choose at least one course").max(500),
});

function fail(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}

function parseOrFail(schema, input) {
  const parsed = schema.safeParse(input || {});
  if (!parsed.success) fail(parsed.error.issues[0]?.message || "Invalid details");
  return parsed.data;
}

async function ownFolder(ownerAdminId, id) {
  const folder = await firstOrNull(db(TABLE).where({ id, ownerAdminId }));
  if (!folder) fail("Folder not found", 404);
  return folder;
}

async function assertNameFree(ownerAdminId, name, excludeId = null) {
  let query = db(TABLE).where({ ownerAdminId }).whereRaw("LOWER(name) = ?", [name.toLowerCase()]);
  if (excludeId) query = query.whereNot({ id: excludeId });
  if (await query.first()) fail(`You already have a folder called "${name}"`, 409);
}

const CourseFolderService = {
  // The admin's folders (A–Z), each with how many of their courses are in it.
  async list(ownerAdminId) {
    const folders = await db(TABLE).where({ ownerAdminId }).orderBy("name", "asc");
    if (!folders.length) return [];
    const counts = await db("courses").where({ ownerAdminId }).whereIn("folderId", folders.map((f) => f.id))
      .groupBy("folderId").select("folderId").count({ count: "*" });
    const byFolder = new Map(counts.map((row) => [row.folderId, Number(row.count)]));
    return folders.map((folder) => ({ ...folder, courseCount: byFolder.get(folder.id) || 0 }));
  },

  async create(ownerAdminId, input) {
    const data = parseOrFail(folderSchema, input);
    await assertNameFree(ownerAdminId, data.name);
    const folder = await createRecord(db, TABLE, {
      ownerAdminId, name: data.name, color: data.color || null, description: data.description || null, coverImage: data.coverImage || null,
    });
    return { ...folder, courseCount: 0 };
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
    return updateRecord(db, TABLE, id, patch);
  },

  // The folder goes; its courses stay, just outside any folder.
  async remove(ownerAdminId, id) {
    await ownFolder(ownerAdminId, id);
    await db("courses").where({ ownerAdminId, folderId: id }).update({ folderId: null });
    await db(TABLE).where({ id, ownerAdminId }).del();
    return { deleted: true };
  },

  // Puts courses in this folder (moving them out of any other). Only the admin's own courses.
  async addCourses(ownerAdminId, id, input) {
    await ownFolder(ownerAdminId, id);
    const { courseIds } = parseOrFail(courseIdsSchema, input);
    const own = await db("courses").where({ ownerAdminId }).whereIn("id", courseIds).pluck("id");
    if (own.length !== new Set(courseIds).size) fail("Some of those courses aren't in your workspace", 404);
    await db("courses").whereIn("id", own).update({ folderId: id });
    return { moved: own.length };
  },

  async removeCourse(ownerAdminId, id, courseId) {
    await ownFolder(ownerAdminId, id);
    const count = await db("courses").where({ id: courseId, ownerAdminId, folderId: id }).update({ folderId: null });
    if (!count) fail("That course isn't in this folder", 404);
    return { removed: true };
  },
};

module.exports = CourseFolderService;
