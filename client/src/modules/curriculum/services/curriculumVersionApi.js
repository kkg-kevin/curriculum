import api from "../../../services/api";

const base = (cid) => `/api/curricula/${cid}/versions`;

export const curriculumVersionApi = {
  getAll:       (cid)              => api.get(base(cid)).then((r) => r.data.data),
  create:       (cid, data)        => api.post(base(cid), data).then((r) => r.data.data),
  edit:         (cid, vId, data)   => api.put(`${base(cid)}/${vId}`, data).then((r) => r.data.data),
  changeStatus: (cid, vId, status) => api.patch(`${base(cid)}/${vId}/status`, { status }).then((r) => r.data.data),
};
