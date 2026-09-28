import api from "./api";

export const uploadApi = {
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append("image", file);
    return api
      .post("/api/uploads/image", formData, { headers: { "Content-Type": "multipart/form-data" } })
      // The server returns a relative path (e.g. "/uploads/xyz.png"); resolve it against the
      // API origin, not the app's own origin, since the two run on different ports/hosts.
      .then((r) => new URL(r.data.data.url, api.defaults.baseURL).toString());
  },

  uploadDocument: (file) => {
    const formData = new FormData();
    formData.append("document", file);
    return api
      // The shared API client has a short timeout for normal requests. File uploads need a
      // longer window, especially on slower connections (the server accepts files up to 500 MiB).
      .post("/api/uploads/document", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 10 * 60 * 1000,
      })
      .then((r) => ({
        ...r.data.data,
        url: new URL(r.data.data.url, api.defaults.baseURL).toString(),
      }));
  },
};
