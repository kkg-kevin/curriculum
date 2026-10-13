import api from "../../../../services/api";

const BASE = "/api/admin-tools/users";

// Every login in this workspace — owner, staff, supervisors, curriculum admins, hubs, educators,
// learners and parents — with what it is attached to, when it was last used and whether it is
// switched on. Owner-only, like the staff routes beside it (collaboratorsApi.js).
export const workspaceUsersApi = {
  list: () => api.get(BASE).then((r) => r.data.data),
  setActive: (id, active) => api.patch(`${BASE}/${id}`, { active }).then((r) => r.data.data),
};
