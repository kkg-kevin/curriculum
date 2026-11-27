import api from "../../../services/api";
import { prepareImageForUpload } from "../../../utils/imageResize";

const BASE = "/api/expenses";
const data = (r) => r.data.data;

// Expenses (server: modules/expenses/). Everyone who works for the organisation — admins, staff,
// educators, supervisors — claims their own; admins, staff with Expenses and supervisors review.
export const expensesApi = {
  mine: () => api.get(`${BASE}/mine`).then(data),
  options: () => api.get(`${BASE}/options`).then(data),
  review: () => api.get(`${BASE}/review`).then(data),
  get: (id) => api.get(`${BASE}/${id}`).then(data),
  create: (body) => api.post(BASE, body).then(data),
  update: (id, body) => api.put(`${BASE}/${id}`, body).then(data),
  remove: (id) => api.delete(`${BASE}/${id}`).then(data),
  submit: (id) => api.post(`${BASE}/${id}/submit`).then(data),
  withdraw: (id) => api.post(`${BASE}/${id}/withdraw`).then(data),
  decide: (id, body) => api.post(`${BASE}/${id}/decision`, body).then(data),
  pay: (id, body) => api.post(`${BASE}/${id}/pay`, body).then(data),
  settings: () => api.get(`${BASE}/settings`).then(data),
  // What an expense was for (server expense.links.js): the picker, a record's expenses, spending
  // per record.
  linkOptions: (type, q) => api.get(`${BASE}/link-options`, { params: { type, q } }).then(data),
  linked: (type, id) => api.get(`${BASE}/linked`, { params: { type, id } }).then(data),
  byLink: (params) => api.get(`${BASE}/by-link`, { params }).then(data),
  saveSettings: (body) => api.put(`${BASE}/settings`, body).then(data),

  // Proof: a photo (shrunk in the browser when large) or a PDF, up to 10 MB.
  uploadProof: async (file) => {
    const isImage = /^image\/(jpeg|png|webp|gif)$/.test(file.type);
    const isOther = /^(image\/hei[cf]|application\/pdf)$/.test(file.type) || /\.(pdf|heic|heif)$/i.test(file.name);
    if (!isImage && !isOther) throw new Error(`${file.name}: proof must be a photo (JPG, PNG, WEBP, HEIC) or a PDF.`);
    const prepared = isImage ? await prepareImageForUpload(file) : file;
    if (prepared.size > MAX_BYTES) throw new Error(`${file.name} is larger than 10 MB. Take a smaller photo, or send a PDF.`);
    const form = new FormData();
    form.append("file", prepared, file.name);
    return api.post(`${BASE}/files`, form, { headers: { "Content-Type": "multipart/form-data" }, timeout: 2 * 60 * 1000 }).then(data);
  },

  // A proof file as a blob (the files are private — they're fetched with the session, never by a
  // public address).
  fileBlob: (id) => api.get(`${BASE}/files/${id}`, { responseType: "blob" }).then((r) => r.data),
};

const MAX_BYTES = 10 * 1024 * 1024;

export const STATUS = {
  draft: { label: "Draft", tone: "neutral" },
  pending_supervisor: { label: "With supervisor", tone: "waiting" },
  pending_admin: { label: "Waiting for approval", tone: "waiting" },
  approved: { label: "Approved — to pay", tone: "info" },
  paid: { label: "Paid", tone: "strong" },
  returned: { label: "Sent back to change", tone: "waiting" },
  rejected: { label: "Declined", tone: "danger" },
};

// Where a linked record opens in the admin app (shown as links only to people who see the team's
// expenses; an educator's own claim just names it).
export const LINK_PATHS = {
  household: (id) => `/home-learning/${id}`,
  club: (id) => `/tech-clubs?membership=${id}`,
  lead: (id) => `/enquiries?lead=${id}`,
  class: (id) => `/classes/${id}/view`,
  hub: (id) => `/learning-hubs/${id}/view`,
  mentor_booking: (id) => `/mentor-bookings/${id}`,
  bootcamp: (id) => `/events/bootcamps/${id}/view`,
  competition: (id) => `/events/competitions/${id}/view`,
  general_event: (id) => `/events/general/${id}`,
  qa_visit: (id) => `/qa/visits/${id}`,
  hub_checkin: (id) => `/checkins/sessions/${id}`,
  mentor_checkin: (id) => `/mentor-checkins/meetings/${id}`,
};
export const GENERAL_LINK = "general";

export const METHOD = { mpesa: "M-Pesa", bank: "Bank transfer", cash: "Cash", other: "Other" };

export const ACTION_WORD = {
  created: "Started the claim",
  submitted: "Sent it",
  resubmitted: "Sent it again",
  withdrew: "Took it back",
  edited: "Changed it",
  approved: "Approved",
  returned: "Sent it back",
  rejected: "Declined",
  paid: "Paid it back",
};

export const formatMoney = (n, currency = "KES") => `${currency === "KES" ? "KSh" : currency} ${Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
export const formatDay = (d) => (d ? new Date(String(d).length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const formatWhen = (d) => (d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
// A validation error's first problem ("Say what the expense was for") beats its "Validation failed".
export const errorOf = (err, fallback = "Something went wrong") => err?.response?.data?.errors?.[0]?.message || err?.response?.data?.message || err?.message || fallback;
// Today in Kenya, "YYYY-MM-DD".
export const kenyaToday = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
