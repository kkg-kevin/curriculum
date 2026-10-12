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

// Every other kind of file. Also the server's own limit (upload.middleware.js's
// DOCUMENT_MAX_BYTES) — keep the two in step.
export const DOCUMENT_MAX_MB = 500;
const DOCUMENT_MAX_BYTES = DOCUMENT_MAX_MB * 1024 * 1024;
// Up to this size a file goes up in one request, as it always has; above it, in pieces.
const SINGLE_REQUEST_MAX_BYTES = 5 * 1024 * 1024;
// How long one request (a small file, or one piece of a large one) may take. A 5 MB piece needs
// about 80 seconds on a 0.5 Mbps connection.
const PIECE_TIMEOUT_MS = 3 * 60 * 1000;
const MAX_FAILURES_IN_A_ROW = 6;

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

  // Any other file (documents, audio, video, ZIP, code). A small one goes up in one request; a
  // large one in pieces, so a slow connection never has to finish the whole file inside one
  // request's time limit, and a dropped connection carries on from where it stopped.
  //
  // `onProgress({ loaded, total, percent })` is called as the file goes up; `signal` (an
  // AbortSignal) cancels it — the error then has `cancelled: true`. Most screens want
  // hooks/useFileUpload.js, which looks after both.
  uploadDocument: async (file, { onProgress, signal } = {}) => {
    if (file.size > DOCUMENT_MAX_BYTES) return reject(`${file.name} is larger than ${DOCUMENT_MAX_MB} MB. Choose a smaller file.`);
    const report = (loaded) => onProgress?.({ loaded, total: file.size, percent: file.size ? Math.min(100, Math.round((loaded / file.size) * 100)) : 100 });
    try {
      const data = file.size <= SINGLE_REQUEST_MAX_BYTES ? await uploadWhole(file, report, signal) : await uploadInPieces(file, report, signal);
      report(file.size);
      // The server returns a relative path; resolve it against the API origin (see uploadImage).
      return { ...data, url: new URL(data.url, api.defaults.baseURL).toString() };
    } catch (err) {
      if (signal?.aborted) throw cancelledError();
      throw err;
    }
  },
};

/* ── Sending a file ─────────────────────────────────────────────────────────────────────── */

function cancelledError() {
  const err = new Error("Upload cancelled.");
  err.cancelled = true;
  return err;
}

function uploadWhole(file, report, signal) {
  const formData = new FormData();
  formData.append("document", file);
  return api
    .post("/api/uploads/document", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: PIECE_TIMEOUT_MS,
      signal,
      onUploadProgress: (e) => report(Math.min(e.loaded, file.size)),
    })
    .then((r) => r.data.data);
}

// Which upload a file belongs to, remembered in this browser so that choosing the same file again
// — after a failure, or after the page was closed — carries on instead of starting over.
const resumeKey = (file) => `upload:${file.name}:${file.size}:${file.lastModified}`;
const remember = (key, uploadId) => { try { localStorage.setItem(key, uploadId); } catch { /* storage unavailable */ } };
const forget = (key) => { try { localStorage.removeItem(key); } catch { /* storage unavailable */ } };
const recall = (key) => { try { return localStorage.getItem(key); } catch { return null; } };

const getSession = (uploadId, signal) => api.get(`/api/uploads/sessions/${uploadId}`, { signal }).then((r) => r.data.data);

// Worth another try: the request never got an answer (dropped connection, timeout), the server
// was busy or briefly unavailable, or the piece turned out not to line up (409 — ask where the
// upload stands and carry on). Anything else (signed out, refused, not found) will not change.
const canRetry = (err) => !err.statusCode || err.statusCode >= 500 || [408, 409, 429].includes(err.statusCode);

function wait(ms, signal) {
  return new Promise((resolve, rejectWait) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); rejectWait(cancelledError()); }, { once: true });
  });
}

async function uploadInPieces(file, report, signal) {
  const key = resumeKey(file);
  let session = null;
  const earlier = recall(key);
  if (earlier) {
    // Gone (cancelled, or abandoned for a day) or not this file after all: start afresh.
    session = await getSession(earlier, signal).catch(() => null);
    if (session && session.size !== file.size) session = null;
  }
  if (!session) {
    session = await api
      .post("/api/uploads/sessions", { filename: file.name, mimeType: file.type, size: file.size }, { signal })
      .then((r) => r.data.data);
    remember(key, session.uploadId);
  }

  const { uploadId, chunkSize } = session;
  let offset = session.receivedBytes;
  let failures = 0;
  report(offset);

  // Runs `send` until it works, pausing longer after each failure in a row and checking with the
  // server where the upload stands before going again.
  const attempt = async (send) => {
    for (;;) {
      try {
        const result = await send();
        failures = 0;
        return result;
      } catch (err) {
        if (signal?.aborted) throw cancelledError();
        if (err.statusCode === 404) forget(key);
        if (!canRetry(err)) throw err;
        failures += 1;
        if (failures > MAX_FAILURES_IN_A_ROW) {
          throw new Error("The connection kept dropping, so the upload stopped. Choose the same file again to carry on from where it got to.");
        }
        await wait(Math.min(1000 * 2 ** (failures - 1), 15000), signal);
        const now = await getSession(uploadId, signal).catch(() => null);
        if (now) { offset = now.receivedBytes; report(offset); }
      }
    }
  };

  try {
    while (offset < file.size) {
      const start = offset;
      const piece = file.slice(start, start + chunkSize);
      const result = await attempt(() => {
        // Another failure may have moved `offset` since this piece was cut; cut it again if so.
        if (offset !== start) return { receivedBytes: offset };
        return api
          .post(`/api/uploads/sessions/${uploadId}/chunks`, piece, {
            params: { offset: start },
            headers: { "Content-Type": "application/octet-stream" },
            timeout: PIECE_TIMEOUT_MS,
            signal,
            onUploadProgress: (e) => report(Math.min(start + e.loaded, file.size)),
          })
          .then((r) => r.data.data);
      });
      offset = result.receivedBytes;
      report(offset);
    }
    const done = await attempt(() => api.post(`/api/uploads/sessions/${uploadId}/complete`, {}, { signal }).then((r) => r.data.data));
    forget(key);
    return done;
  } catch (err) {
    // Cancelled on purpose: nothing to come back to, so the server can drop what it has.
    if (signal?.aborted) {
      forget(key);
      api.delete(`/api/uploads/sessions/${uploadId}`).catch(() => {});
    }
    throw err;
  }
}
