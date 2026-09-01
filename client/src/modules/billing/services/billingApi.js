import api from "../../../services/api";

const BASE = "/api/billing";

export const billingApi = {
  list: () => api.get(BASE).then((r) => r.data),
  get: (id) => api.get(`${BASE}/${id}`).then((r) => r.data.data),
  create: (data) => api.post(BASE, data).then((r) => r.data.data),
  update: (id, data) => api.patch(`${BASE}/${id}`, data).then((r) => r.data.data),
  issue: (id) => api.post(`${BASE}/${id}/issue`).then((r) => r.data.data),
  cancel: (id) => api.post(`${BASE}/${id}/cancel`).then((r) => r.data.data),
  pay: (id, data) => api.post(`${BASE}/${id}/payments`, data).then((r) => r.data.data),
  previewBulk: (data) => api.post(`${BASE}/batches/preview`, data).then((r) => r.data.data),
  createBulk: (data) => api.post(`${BASE}/batches`, data).then((r) => r.data.data),
  listBatches: () => api.get(`${BASE}/batches`).then((r) => r.data),
  listReceipts: () => api.get(`${BASE}/receipts`).then((r) => r.data),
  getReceipt: (invoiceId, paymentId) => api.get(`${BASE}/${invoiceId}/payments/${paymentId}`).then((r) => r.data.data),
  getStatement: (payerType, payerId, params = {}) => api.get(`${BASE}/statements/${payerType}/${payerId}`, { params }).then((r) => r.data.data),
  listCustomers: () => api.get(`${BASE}/customers`).then((r) => r.data),
  getCustomer: (hubId) => api.get(`${BASE}/customers/${hubId}`).then((r) => r.data.data),
};
