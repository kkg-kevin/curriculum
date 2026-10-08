import api from "./api";
import { prepareImageForUpload } from "../utils/imageResize";

// The image rules, in one place for every image field. The size is the server's own limit
// (server: upload.middleware.js's IMAGE_MAX_BYTES) — keep the two in step.
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
export const IMAGE_MAX_MB = 10;
const IMAGE_MAX_BYTES = IMAGE_MAX_MB * 1024 * 1024;
// A picture too big to even resize in the browser without it struggling.
const IMAGE_MAX_ORIGINAL_BYTES = 40 * 1024 * 1024;
/** The one line shown under an image field. */
export const IMAGE_UPLOAD_HINT = `PNG, JPEG, GIF or WEBP, up to ${IMAGE_MAX_MB} MB. Large photos are resized for you.`;

function reject(message) {
  return Promise.reject(new Error(message));
}

export const uploadApi = {
  // Checks the type, shrinks a large photo in the browser (utils/imageResize.js), checks what is
  // left against the limit, then uploads it — so every caller gets the same rules and the same
  // plain-language errors, and nobody waits on an upload the server was always going to refuse.
  uploadImage: async (file) => {
    if (!IMAGE_TYPES.includes(file.type)) return reject(`${file.name}: only PNG, JPEG, GIF and WEBP images can be uploaded.`);
    if (file.size > IMAGE_MAX_ORIGINAL_BYTES) return reject(`${file.name} is too large to upload. Choose a picture under 40 MB.`);

    const prepared = await prepareImageForUpload(file);
    if (prepared.size > IMAGE_MAX_BYTES) return reject(`${file.name} is larger than ${IMAGE_MAX_MB} MB. Choose a smaller picture.`);

    const formData = new FormData();
    formData.append("image", prepared);
    return api
      .post("/api/uploads/image", formData, { headers: { "Content-Type": "multipart/form-data" }, timeout: 2 * 60 * 1000 })
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
