import api from "../../../../services/api";

const BASE = "/api/auth/admins";

// No GET here on purpose — the backend deliberately never lists other admins (each admin is its
// own tenant now; seeing who else exists would itself be a cross-tenant leak). This module is
// create-only.
export const adminsApi = {
  createAdmin: (data) =>
    api.post(BASE, data).then((r) => r.data.data),
  // See reassign-owner.service.js on the backend — moves a hub/curriculum/course/assessment the
  // caller currently owns to a different admin, identified by email (there's no admin list to
  // pick from, same reasoning as the comment above).
  reassignOwner: (data) =>
    api.post("/api/admin-tools/reassign-owner", data).then((r) => r.data.data),
};
