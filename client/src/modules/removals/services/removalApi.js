import api from "../../../services/api";

// Removing a person — deactivate → hand over their work → delete (server modules/removals/).
// `kind`: "teacher" | "hub" | "supervisor" | "affiliate".
const base = (kind, id) => `/api/removals/${kind}/${id}`;

export const removalApi = {
  plan: (kind, id) => api.get(base(kind, id)).then((r) => r.data.data),
  deactivate: (kind, id) => api.post(`${base(kind, id)}/deactivate`).then((r) => r.data.data),
  // { to, overrides: { [itemKey]: id | "cancel" | "none" } }
  transfer: (kind, id, body) => api.post(`${base(kind, id)}/transfer`, body).then((r) => r.data.data),
  remove: (kind, id) => api.delete(base(kind, id)).then((r) => r.data.data),
};
