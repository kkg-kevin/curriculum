import api from "../../../services/api";

const BASE = "/api/billing";

export const billingApi = {
  list: () => api.get(BASE).then((r) => r.data),
  get: (id) => api.get(`${BASE}/${id}`).then((r) => r.data.data),
  create: (data) => api.post(BASE, data).then((r) => r.data.data),
  update: (id, data) => api.patch(`${BASE}/${id}`, data).then((r) => r.data.data),
  issue: (id) => api.post(`${BASE}/${id}/issue`).then((r) => r.data.data),
  cancel: (id) => api.post(`${BASE}/${id}/cancel`).then((r) => r.data.data),
  // Emails (or re-emails) an issued invoice to its payer — see billing.service.js's emailInvoice.
  email: (id) => api.post(`${BASE}/${id}/email`).then((r) => r.data.data),
  pay: (id, data) => api.post(`${BASE}/${id}/payments`, data).then((r) => r.data.data),
  previewBulk: (data) => api.post(`${BASE}/batches/preview`, data).then((r) => r.data.data),
  createBulk: (data) => api.post(`${BASE}/batches`, data).then((r) => r.data.data),
  listBatches: () => api.get(`${BASE}/batches`).then((r) => r.data),
  listReceipts: () => api.get(`${BASE}/receipts`).then((r) => r.data),
  getReceipt: (invoiceId, paymentId) => api.get(`${BASE}/${invoiceId}/payments/${paymentId}`).then((r) => r.data.data),
  getStatement: (payerType, payerId, params = {}) => api.get(`${BASE}/statements/${payerType}/${payerId}`, { params }).then((r) => r.data.data),
  listCustomers: () => api.get(`${BASE}/customers`).then((r) => r.data),
  getCustomer: (hubId) => api.get(`${BASE}/customers/${hubId}`).then((r) => r.data.data),
  // M-Pesa (modules/payments/mpesa on the server): whether it's on, the "enter your PIN" prompt,
  // and Billing → M-Pesa (payments to match).
  mpesaStatus: () => api.get(`${BASE}/mpesa/status`).then((r) => r.data.data),
  mpesaPay: (invoiceId, data) => api.post(`${BASE}/${invoiceId}/mpesa`, data).then((r) => r.data.data),
  // "Pay now" on the payment-pending screen — the account's own sign-up invoice.
  mpesaPayPending: (data) => api.post("/api/auth/pending-payment/mpesa", data).then((r) => r.data.data),
  mpesaRequest: (requestId) => api.get(`${BASE}/mpesa/requests/${requestId}`).then((r) => r.data.data),
  mpesaTransactions: (params = {}) => api.get(`${BASE}/mpesa/transactions`, { params }).then((r) => r.data.data),
  mpesaFailedRequests: () => api.get(`${BASE}/mpesa/failed-requests`).then((r) => r.data.data),
  mpesaAllocate: (id, invoice) => api.post(`${BASE}/mpesa/transactions/${id}/allocate`, { invoice }).then((r) => r.data.data),
  mpesaIgnore: (id, note) => api.post(`${BASE}/mpesa/transactions/${id}/ignore`, { note }).then((r) => r.data.data),
  // Ask Safaricom about a payment / send it back to the payer — both answered later by Safaricom.
  mpesaCheck: (id) => api.post(`${BASE}/mpesa/transactions/${id}/check`).then((r) => r.data.data),
  mpesaReverse: (id, note) => api.post(`${BASE}/mpesa/transactions/${id}/reverse`, { note }).then((r) => r.data.data),
  // An M-Pesa statement (the CSV file's text): what would be added, then adding it.
  mpesaStatementPreview: (csv) => api.post(`${BASE}/mpesa/statement/preview`, csv, { headers: { "Content-Type": "text/csv" } }).then((r) => r.data.data),
  mpesaStatementImport: (csv) => api.post(`${BASE}/mpesa/statement/import`, csv, { headers: { "Content-Type": "text/csv" } }).then((r) => r.data.data),
  // Billing → Orders: website Store and Project orders (server: modules/orders).
  orders: (params = {}) => api.get(`${BASE}/orders`, { params }).then((r) => r.data.data),
  order: (id) => api.get(`${BASE}/orders/${id}`).then((r) => r.data.data),
  setOrderStatus: (id, data) => api.post(`${BASE}/orders/${id}/status`, data).then((r) => r.data.data),
  // Billing → To confirm: families' "I've paid" notices from the website's Payment step
  // (server: payments/payment-notices.service.js).
  paymentNotices: (params = {}) => api.get(`${BASE}/payment-notices`, { params }).then((r) => r.data.data),
  confirmPaymentNotice: (id, data) => api.post(`${BASE}/payment-notices/${id}/confirm`, data).then((r) => r.data.data),
  rejectPaymentNotice: (id, reason) => api.post(`${BASE}/payment-notices/${id}/reject`, { reason }).then((r) => r.data.data),
  // Home Learning packages — Billing → Packages.
  listPackages: () => api.get(`${BASE}/packages`).then((r) => r.data.data),
  createPackage: (data) => api.post(`${BASE}/packages`, data).then((r) => r.data.data),
  updatePackage: (id, data) => api.put(`${BASE}/packages/${id}`, data).then((r) => r.data.data),
  deletePackage: (id) => api.delete(`${BASE}/packages/${id}`).then((r) => r.data.data),
  // Estate Tech Club packages — Billing → Packages, beside the Home Learning ones.
  listClubPackages: () => api.get(`${BASE}/club-packages`).then((r) => r.data.data),
  createClubPackage: (data) => api.post(`${BASE}/club-packages`, data).then((r) => r.data.data),
  updateClubPackage: (id, data) => api.put(`${BASE}/club-packages/${id}`, data).then((r) => r.data.data),
  deleteClubPackage: (id) => api.delete(`${BASE}/club-packages/${id}`).then((r) => r.data.data),
};
