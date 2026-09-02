const PublicBootcampModel = require("./public-bootcamp.model");
const PublicProjectModel = require("./public-project.model");
const { slugify } = require("../../shared/utils/slugify");

// Appends -2, -3, ... only if the base slug collides with a different record (own id excluded,
// so re-saving a record without changing its name never bumps its own slug).
async function uniqueSlug(findBySlug, name, excludeId) {
  const base = slugify(name) || "item";
  let slug = base;
  let n = 2;
  for (;;) {
    const existing = await findBySlug(slug);
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${n++}`;
  }
}

const PublicSiteService = {
  // ---- Bootcamps --------------------------------------------------------------
  async createBootcamp(data) {
    const slug = await uniqueSlug(PublicBootcampModel.findBySlug, data.name);
    return PublicBootcampModel.create({ ...data, slug });
  },

  listBootcamps(filters) {
    return PublicBootcampModel.findAll(filters);
  },

  getBootcamp(idOrSlug) {
    return PublicBootcampModel.findByIdOrSlug(idOrSlug);
  },

  async updateBootcamp(id, data) {
    const patch = { ...data };
    if (data.name) patch.slug = await uniqueSlug(PublicBootcampModel.findBySlug, data.name, id);
    const record = await PublicBootcampModel.update(id, patch);
    if (!record) {
      const err = new Error("Bootcamp not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async deleteBootcamp(id) {
    const ok = await PublicBootcampModel.delete(id);
    if (!ok) {
      const err = new Error("Bootcamp not found");
      err.statusCode = 404;
      throw err;
    }
  },

  // ---- Projects -----------------------------------------------------------------
  async createProject(data) {
    const slug = await uniqueSlug(PublicProjectModel.findBySlug, data.name);
    return PublicProjectModel.create({ ...data, slug });
  },

  listProjects(filters) {
    return PublicProjectModel.findAll(filters);
  },

  getProject(idOrSlug) {
    return PublicProjectModel.findByIdOrSlug(idOrSlug);
  },

  async updateProject(id, data) {
    const patch = { ...data };
    if (data.name) patch.slug = await uniqueSlug(PublicProjectModel.findBySlug, data.name, id);
    const record = await PublicProjectModel.update(id, patch);
    if (!record) {
      const err = new Error("Project not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async deleteProject(id) {
    const ok = await PublicProjectModel.delete(id);
    if (!ok) {
      const err = new Error("Project not found");
      err.statusCode = 404;
      throw err;
    }
  },
};

module.exports = PublicSiteService;
