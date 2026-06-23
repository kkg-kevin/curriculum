import api from "../../../services/api";

const base = (curriculumId) => `/api/curricula/${curriculumId}/academic-years`;

export const academicYearApi = {
  // GET all groups with their versions
  getAll: (curriculumId) =>
    api.get(base(curriculumId)).then((r) => r.data.data),

  // POST create a new year group (with initial draft version)
  createGroup: (curriculumId, data) =>
    api.post(base(curriculumId), data).then((r) => r.data.data),

  // POST create a new version (edit = new draft) under a group
  createVersion: (curriculumId, groupId, data) =>
    api.post(`${base(curriculumId)}/${groupId}/versions`, data).then((r) => r.data.data),

  // PATCH change a version's status
  changeStatus: (curriculumId, groupId, versionId, status) =>
    api
      .patch(`${base(curriculumId)}/${groupId}/versions/${versionId}/status`, { status })
      .then((r) => r.data.data),
};
