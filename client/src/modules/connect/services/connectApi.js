import api from "../../../services/api";
import { prepareImageForUpload } from "../../../utils/imageResize";

const BASE = "/api/connect";
const data = (r) => r.data.data;
const qs = (params = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
};

// Digifunzi Connect (server: modules/connect/). Learners take part from their own login; parents
// switch it on and see who their child talks to; admins, staff and moderator educators moderate.
export const connectApi = {
  me: () => api.get(`${BASE}/me`).then(data),
  counts: () => api.get(`${BASE}/me/counts`).then(data),
  updateProfile: (body) => api.put(`${BASE}/me/profile`, body).then(data),
  achievements: () => api.get(`${BASE}/me/achievements`).then(data),
  blocks: () => api.get(`${BASE}/me/blocks`).then(data),

  // Pictures are made smaller in the browser first (the server still checks and cleans them).
  async upload(file) {
    const prepared = file.type?.startsWith("image/") && file.type !== "image/gif" ? await prepareImageForUpload(file) : file;
    const form = new FormData();
    form.append("file", prepared, file.name);
    return api.post(`${BASE}/files`, form, { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 }).then(data);
  },

  people: (params) => api.get(`${BASE}/people${qs(params)}`).then(data),
  person: (id) => api.get(`${BASE}/people/${id}`).then(data),
  personPosts: (id, cursor) => api.get(`${BASE}/people/${id}/posts${qs({ cursor })}`).then(data),
  connect: (id) => api.post(`${BASE}/people/${id}/connect`).then(data),
  disconnect: (id) => api.delete(`${BASE}/people/${id}/connect`).then(data),
  block: (id, on) => (on ? api.post(`${BASE}/people/${id}/block`) : api.delete(`${BASE}/people/${id}/block`)).then(data),
  mute: (id, on) => (on ? api.post(`${BASE}/people/${id}/mute`) : api.delete(`${BASE}/people/${id}/mute`)).then(data),
  connections: () => api.get(`${BASE}/connections`).then(data),
  respondConnection: (id, accept) => api.post(`${BASE}/connections/${id}/${accept ? "accept" : "decline"}`).then(data),

  posts: (params) => api.get(`${BASE}/posts${qs(params)}`).then(data),
  post: (id) => api.get(`${BASE}/posts/${id}`).then(data),
  createPost: (body) => api.post(`${BASE}/posts`, body).then(data),
  updatePost: (id, body) => api.put(`${BASE}/posts/${id}`, body).then(data),
  deletePost: (id) => api.delete(`${BASE}/posts/${id}`).then(data),
  removePost: (id, reason) => api.post(`${BASE}/posts/${id}/remove`, { reason }).then(data),
  pin: (id, on) => (on ? api.post(`${BASE}/posts/${id}/pin`) : api.delete(`${BASE}/posts/${id}/pin`)).then(data),
  share: (id, body) => api.post(`${BASE}/posts/${id}/share`, body).then(data),
  react: (id, kind) => (kind ? api.put(`${BASE}/posts/${id}/reaction`, { kind }) : api.delete(`${BASE}/posts/${id}/reaction`)).then(data),
  comment: (postId, body) => api.post(`${BASE}/posts/${postId}/comments`, body).then(data),
  editComment: (id, body) => api.put(`${BASE}/comments/${id}`, { body }).then(data),
  deleteComment: (id, reason) => api.delete(`${BASE}/comments/${id}${qs({ reason })}`).then(data),

  communities: (params) => api.get(`${BASE}/communities${qs(params)}`).then(data),
  community: (slug) => api.get(`${BASE}/communities/by-slug/${slug}`).then(data),
  communityPosts: (id, params) => api.get(`${BASE}/communities/${id}/posts${qs(params)}`).then(data),
  createCommunity: (body) => api.post(`${BASE}/communities`, body).then(data),
  updateCommunity: (id, body) => api.put(`${BASE}/communities/${id}`, body).then(data),
  archiveCommunity: (id, archive) => api.post(`${BASE}/communities/${id}/${archive ? "archive" : "restore"}`).then(data),
  setModerators: (id, userIds) => api.put(`${BASE}/communities/${id}/moderators`, { userIds }).then(data),
  join: (id) => api.post(`${BASE}/communities/${id}/join`).then(data),
  leave: (id) => api.delete(`${BASE}/communities/${id}/join`).then(data),
  communityMembers: (id) => api.get(`${BASE}/communities/${id}/members`).then(data),
  inviteToCommunity: (id, memberIds) => api.post(`${BASE}/communities/${id}/invite`, { memberIds }).then(data),
  setMembership: (id, memberId, action) => api.post(`${BASE}/communities/${id}/members/${memberId}/${action}`).then(data),

  conversations: () => api.get(`${BASE}/conversations`).then(data),
  startConversation: (body) => api.post(`${BASE}/conversations`, body).then(data),
  messages: (id, params) => api.get(`${BASE}/conversations/${id}/messages${qs(params)}`).then(data),
  send: (id, body) => api.post(`${BASE}/conversations/${id}/messages`, body).then(data),
  markRead: (id) => api.post(`${BASE}/conversations/${id}/read`).then(data),
  muteConversation: (id, muted) => api.put(`${BASE}/conversations/${id}/mute`, { muted }).then(data),
  leaveConversation: (id) => api.post(`${BASE}/conversations/${id}/leave`).then(data),
  deleteMessage: (id) => api.delete(`${BASE}/messages/${id}`).then(data),

  projects: (params) => api.get(`${BASE}/projects${qs(params)}`).then(data),
  project: (id) => api.get(`${BASE}/projects/${id}`).then(data),
  createProject: (body) => api.post(`${BASE}/projects`, body).then(data),
  updateProject: (id, body) => api.put(`${BASE}/projects/${id}`, body).then(data),
  deleteProject: (id) => api.delete(`${BASE}/projects/${id}`).then(data),
  inviteToProject: (id, memberIds) => api.post(`${BASE}/projects/${id}/invite`, { memberIds }).then(data),
  answerInvite: (id, accept) => api.post(`${BASE}/projects/${id}/invitation/${accept ? "accept" : "decline"}`).then(data),
  requestJoin: (id) => api.post(`${BASE}/projects/${id}/request`).then(data),
  teamAction: (id, memberId, action) => api.post(`${BASE}/projects/${id}/members/${memberId}/${action}`).then(data),
  editTeamMember: (id, memberId, body) => api.put(`${BASE}/projects/${id}/members/${memberId}`, body).then(data),
  addMilestone: (id, body) => api.post(`${BASE}/projects/${id}/milestones`, body).then(data),
  editMilestone: (id, mid, body) => api.put(`${BASE}/projects/${id}/milestones/${mid}`, body).then(data),
  deleteMilestone: (id, mid) => api.delete(`${BASE}/projects/${id}/milestones/${mid}`).then(data),
  addUpdate: (id, body) => api.post(`${BASE}/projects/${id}/updates`, body).then(data),
  deleteUpdate: (id, uid) => api.delete(`${BASE}/projects/${id}/updates/${uid}`).then(data),
  showcase: (id, body) => api.post(`${BASE}/projects/${id}/showcase`, { body }).then(data),
  moderateProject: (id, action, reason) => api.post(`${BASE}/projects/${id}/moderate/${action}`, { reason }).then(data),

  challenges: (view) => api.get(`${BASE}/challenges${qs({ view })}`).then(data),
  challenge: (id) => api.get(`${BASE}/challenges/${id}`).then(data),
  competitionOptions: () => api.get(`${BASE}/challenges/competition-options`).then(data),
  createChallenge: (body) => api.post(`${BASE}/challenges`, body).then(data),
  updateChallenge: (id, body) => api.put(`${BASE}/challenges/${id}`, body).then(data),
  deleteChallenge: (id) => api.delete(`${BASE}/challenges/${id}`).then(data),
  publishChallenge: (id) => api.post(`${BASE}/challenges/${id}/publish`).then(data),
  closeChallenge: (id) => api.post(`${BASE}/challenges/${id}/close`).then(data),
  enter: (id, body) => api.post(`${BASE}/challenges/${id}/enter`, body).then(data),
  saveEntry: (id, entryId, body) => api.put(`${BASE}/challenges/${id}/entries/${entryId}`, body).then(data),
  withdrawEntry: (id, entryId) => api.delete(`${BASE}/challenges/${id}/entries/${entryId}`).then(data),
  award: (id, entryId, body) => api.put(`${BASE}/challenges/${id}/entries/${entryId}/award`, body).then(data),

  report: (body) => api.post(`${BASE}/reports`, body).then(data),

  admin: {
    overview: () => api.get(`${BASE}/admin/overview`).then(data),
    reports: (status) => api.get(`${BASE}/admin/reports${qs({ status })}`).then(data),
    reportContext: (id) => api.get(`${BASE}/admin/reports/${id}/context`).then(data),
    decide: (id, body) => api.post(`${BASE}/admin/reports/${id}/decision`, body).then(data),
    waiting: () => api.get(`${BASE}/admin/waiting`).then(data),
    approve: (id) => api.post(`${BASE}/admin/posts/${id}/approve`).then(data),
    reject: (id, reason) => api.post(`${BASE}/admin/posts/${id}/reject`, { reason }).then(data),
    members: (params) => api.get(`${BASE}/admin/members${qs(params)}`).then(data),
    suspend: (id, body) => api.post(`${BASE}/admin/members/${id}/suspend`, body).then(data),
    restore: (id) => api.post(`${BASE}/admin/members/${id}/restore`).then(data),
    consentCandidates: (q) => api.get(`${BASE}/admin/consent-candidates${qs({ q })}`).then(data),
    recordConsent: (body) => api.post(`${BASE}/admin/consent`, body).then(data),
    history: (page) => api.get(`${BASE}/admin/history${qs({ page })}`).then(data),
    settings: () => api.get(`${BASE}/admin/settings`).then(data),
    saveSettings: (body) => api.put(`${BASE}/admin/settings`, body).then(data),
  },

  parent: {
    children: () => api.get(`${BASE}/parent/children`).then(data),
    consent: (learnerId, body) => api.post(`${BASE}/parent/children/${learnerId}/consent`, body).then(data),
    switches: (learnerId, body) => api.put(`${BASE}/parent/children/${learnerId}/switches`, body).then(data),
    withdraw: (learnerId, deleteData) => api.post(`${BASE}/parent/children/${learnerId}/withdraw`, { deleteData }).then(data),
    activity: (learnerId) => api.get(`${BASE}/parent/children/${learnerId}/activity`).then(data),
    block: (learnerId, memberId) => api.post(`${BASE}/parent/children/${learnerId}/blocks`, { memberId }).then(data),
    unblock: (learnerId, memberId) => api.delete(`${BASE}/parent/children/${learnerId}/blocks/${memberId}`).then(data),
  },
};

// A signed file link from the API → a full address on the API's host.
export const mediaUrl = (path) => (path && path.startsWith("/") ? `${api.defaults.baseURL}${path}` : path);
