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
      .post("/api/uploads/document", formData, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => ({
        ...r.data.data,
        url: new URL(r.data.data.url, api.defaults.baseURL).toString(),
      }));
  },
};
