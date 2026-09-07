import api from "../../../../services/api";

const BASE = "/api/auth/admins";

// No GET here on purpose — the backend deliberately never lists other admins (each admin is its
// own tenant now; seeing who else exists would itself be a cross-tenant leak). This module is
// create-only.
export const adminsApi = {
  createAdmin: (data) =>
    api.post(BASE, data).then((r) => r.data.data),
};
