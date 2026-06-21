const SupplementaryModel = require("./supplementary.model");

const notFound = () => {
  const err = new Error("Supplementary curriculum not found");
  err.statusCode = 404;
  return err;
};

const SupplementaryService = {
  async getAll(filters)  { return SupplementaryModel.findAll(filters); },
  async create(data)     { return SupplementaryModel.create(data); },

  async getById(id) {
    const record = SupplementaryModel.findById(id);
    if (!record) throw notFound();
    return record;
  },

  async update(id, data) {
    const record = SupplementaryModel.update(id, data);
    if (!record) throw notFound();
    return record;
  },

  async delete(id) {
    const deleted = SupplementaryModel.delete(id);
    if (!deleted) throw notFound();
    return { message: "Supplementary curriculum deleted" };
  },

  async updateGrades(id, grades) {
    const record = SupplementaryModel.update(id, { grades });
    if (!record) throw notFound();
    return record;
  },

};

module.exports = SupplementaryService;
