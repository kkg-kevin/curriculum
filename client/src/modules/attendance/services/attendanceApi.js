import api from "../../../services/api";

const BASE = "/api/attendance";

export const attendanceApi = {
  mark:          (payload)        => api.post(`${BASE}/mark`, payload).then((r) => r.data.data),
  getByClassDate: (classId, date) => api.get(BASE, { params: { classId, date } }).then((r) => r.data),
  getHistory:    (params)         => api.get(`${BASE}/history`, { params }).then((r) => r.data),
};
