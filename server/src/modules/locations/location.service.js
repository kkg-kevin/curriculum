const LocationModel = require("./location.model");

const LocationService = {
  async createLocation(data) {
    return LocationModel.create(data);
  },

  async getAllLocations(filters) {
    return LocationModel.findAll(filters);
  },

  async getLocationById(id) {
    const record = LocationModel.findById(id);
    if (!record) {
      const err = new Error("Location not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async updateLocation(id, data) {
    const record = LocationModel.update(id, data);
    if (!record) {
      const err = new Error("Location not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async deleteLocation(id) {
    const deleted = LocationModel.delete(id);
    if (!deleted) {
      const err = new Error("Location not found");
      err.statusCode = 404;
      throw err;
    }
    return { message: "Location deleted successfully" };
  },
};

module.exports = LocationService;
