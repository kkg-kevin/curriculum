const SystemLevelModel = require("./system-level.model");
const CurriculumModel = require("../../curriculum/curriculum.model");

// The name-uniqueness check below (findAll + compare) isn't atomic with the INSERT/UPDATE that
// follows it — two requests racing the same name (e.g. a double-clicked "+ Add Level") can both
// pass the check before either write lands, producing duplicate rows. The DB's own UNIQUE index
// on system_levels.name (see migration 20260827100000) is the real backstop; this just turns
// mysql2's raw ER_DUP_ENTRY into the same friendly 409 the pre-check already gives, so a race
// loser gets a normal error message instead of a raw SQL one.
function isDuplicateNameError(err) {
  return err?.code === "ER_DUP_ENTRY";
}

function duplicateNameError() {
  const err = new Error("A system level with this name already exists");
  err.statusCode = 409;
  return err;
}

// Unlike the Pathway catalog (copied into a curriculum on import, so the catalog and a
// curriculum's copy are independent afterward), a curriculum's classes[] reference a System
// Level by id directly and permanently — deleting one out from under a curriculum that still
// maps a grade onto it would leave that grade pointing at nothing. Block it instead.
async function assertNotInUse(id) {
  const curricula = await CurriculumModel.findAll();
  const inUse = curricula.some((c) => (c.classes || []).some((cls) => cls.systemLevelId === id));
  if (inUse) {
    const err = new Error("This level is mapped to a grade in at least one curriculum and can't be deleted");
    err.statusCode = 409;
    throw err;
  }
}

const SystemLevelService = {
  async getSystemLevels() {
    return SystemLevelModel.findAll();
  },

  async createSystemLevel(data) {
    const existing = await SystemLevelModel.findAll();
    if (existing.some((l) => l.name.toLowerCase() === data.name.toLowerCase())) {
      throw duplicateNameError();
    }
    try {
      return await SystemLevelModel.create(data);
    } catch (err) {
      if (isDuplicateNameError(err)) throw duplicateNameError();
      throw err;
    }
  },

  async updateSystemLevel(id, data) {
    const level = await SystemLevelModel.findById(id);
    if (!level) {
      const err = new Error("System level not found");
      err.statusCode = 404;
      throw err;
    }
    if (data.name) {
      const all = await SystemLevelModel.findAll();
      const others = all.filter((l) => l.id !== id);
      if (others.some((l) => l.name.toLowerCase() === data.name.toLowerCase())) {
        throw duplicateNameError();
      }
    }
    try {
      return await SystemLevelModel.update(id, data);
    } catch (err) {
      if (isDuplicateNameError(err)) throw duplicateNameError();
      throw err;
    }
  },

  async deleteSystemLevel(id) {
    const level = await SystemLevelModel.findById(id);
    if (!level) {
      const err = new Error("System level not found");
      err.statusCode = 404;
      throw err;
    }
    await assertNotInUse(id);
    await SystemLevelModel.delete(id);
  },

  async reorderSystemLevels(orderedIds) {
    return SystemLevelModel.reorder(orderedIds);
  },
};

module.exports = SystemLevelService;
