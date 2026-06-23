import api from "../../../services/api";

const base = (curriculumId) => `/api/curricula/${curriculumId}/academic-years`;

export const academicYearApi = {
  getAll:       (curriculumId)              => api.get(base(curriculumId)).then((r) => r.data.data),
  create:       (curriculumId, data)        => api.post(base(curriculumId), data).then((r) => r.data.data),
  edit:         (curriculumId, yearId, data)=> api.put(`${base(curriculumId)}/${yearId}`, data).then((r) => r.data.data),
  changeStatus: (curriculumId, yearId, status) =>
    api.patch(`${base(curriculumId)}/${yearId}/status`, { status }).then((r) => r.data.data),
};
