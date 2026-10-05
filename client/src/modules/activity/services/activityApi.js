import api from "../../../services/api";

const BASE = "/api/audit";

// The activity log (server/src/modules/audit/): who did what, when. Read-only — the server has
// no route that changes or removes an entry.
const clean = (filters) => Object.fromEntries(Object.entries(filters || {}).filter(([, value]) => value !== "" && value != null));

export const activityApi = {
  // { items, hasMore, page } — newest first.
  list: (filters, page = 1) => api.get(BASE, { params: { ...clean(filters), page, pageSize: 50 } }).then((r) => r.data.data),
  // { actors: [{ id, name, email, role, lastActiveAt, entries }], modules, retentionDays }
  facets: () => api.get(`${BASE}/facets`).then((r) => r.data.data),
  // The same entries as a spreadsheet file.
  exportCsv: (filters) => api.get(`${BASE}/export.csv`, { params: clean(filters), responseType: "blob", timeout: 60000 }).then((r) => r.data),
};
