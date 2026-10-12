const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { Transform } = require("stream");
const { pipeline } = require("stream/promises");
const { assertDocumentAllowed, UPLOAD_DIR, DOCUMENT_MAX_BYTES } = require("./upload.middleware");

// A large file sent in pieces. One request for a whole video has to finish inside every timeout
// between the browser and this process (the client's, the host's, Node's own 5 minutes), which a
// slow connection cannot do; a piece of a few MB always can, and a dropped connection costs one
// piece instead of the whole file.
//
// Each upload is two files in INCOMING_DIR: <id>.part, the bytes so far, and <id>.json, what the
// file is and whose it is. The size of the .part file IS the progress — there is no counter kept
// anywhere else to fall out of step with it. A dot-folder, so express.static never serves it.
const INCOMING_DIR = path.join(UPLOAD_DIR, ".incoming");
const CHUNK_BYTES = 5 * 1024 * 1024;
// An upload nobody has added to for this long is abandoned, and its files are removed.
const STALE_MS = 24 * 60 * 60 * 1000;
const SWEEP_EVERY_MS = 60 * 60 * 1000;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

fs.mkdirSync(INCOMING_DIR, { recursive: true });

const partPath = (id) => path.join(INCOMING_DIR, `${id}.part`);
const metaPath = (id) => path.join(INCOMING_DIR, `${id}.json`);

function fail(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

const notFound = () => fail(404, "This upload was not found. Start it again.");

// One request at a time per upload — two pieces written at once would interleave.
const busy = new Set();
async function withLock(id, fn) {
  if (busy.has(id)) throw fail(409, "This upload is busy. Try again.");
  busy.add(id);
  try {
    return await fn();
  } finally {
    busy.delete(id);
  }
}

// Someone else's upload answers exactly like one that doesn't exist.
async function loadMeta(id, userId) {
  if (!ID_PATTERN.test(String(id))) throw notFound();
  let meta;
  try {
    meta = JSON.parse(await fsp.readFile(metaPath(id), "utf8"));
  } catch {
    throw notFound();
  }
  if (meta.userId !== userId) throw notFound();
  return meta;
}

async function receivedBytes(id) {
  try {
    return (await fsp.stat(partPath(id))).size;
  } catch {
    return 0;
  }
}

function describe(id, meta, received) {
  return { uploadId: id, size: meta.size, receivedBytes: meta.completed ? meta.size : received, chunkSize: CHUNK_BYTES, completed: Boolean(meta.completed) };
}

let lastSweepAt = 0;
async function sweepStale() {
  if (Date.now() - lastSweepAt < SWEEP_EVERY_MS) return;
  lastSweepAt = Date.now();
  const names = await fsp.readdir(INCOMING_DIR);
  for (const name of names.filter((n) => n.endsWith(".json"))) {
    const id = name.slice(0, -".json".length);
    if (busy.has(id)) continue;
    // The .part file is touched by every piece; the .json alone is left once an upload completes.
    const stat = await fsp.stat(partPath(id)).catch(() => fsp.stat(metaPath(id)).catch(() => null));
    if (stat && Date.now() - stat.mtimeMs < STALE_MS) continue;
    await fsp.rm(partPath(id), { force: true });
    await fsp.rm(metaPath(id), { force: true });
  }
}

const UploadService = {
  // Refuses a file that is too large or the wrong type before any of it is sent.
  async start(userId, { filename, mimeType, size }) {
    const name = path.basename(String(filename || "")).slice(0, 255);
    const bytes = Number(size);
    if (!name) throw fail(400, "The file has no name.");
    if (!Number.isInteger(bytes) || bytes <= 0) throw fail(400, "The file is empty.");
    if (bytes > DOCUMENT_MAX_BYTES) {
      throw fail(413, `This file is too large. Files can be up to ${Math.round(DOCUMENT_MAX_BYTES / (1024 * 1024))} MB.`);
    }
    const type = String(mimeType || "").slice(0, 150);
    assertDocumentAllowed(type, name);

    sweepStale().catch(() => {});

    const id = crypto.randomUUID();
    const meta = { userId, filename: name, mimeType: type, size: bytes, createdAt: new Date().toISOString() };
    await fsp.writeFile(partPath(id), "");
    await fsp.writeFile(metaPath(id), JSON.stringify(meta));
    return describe(id, meta, 0);
  },

  async status(userId, id) {
    const meta = await loadMeta(id, userId);
    return describe(id, meta, await receivedBytes(id));
  },

  // Appends one piece, read straight off the request. `offset` is where the client believes the
  // piece starts; anything but the real end of the file so far is refused (409) and answered with
  // where the file really ends, so a piece that arrived twice, or not at all, is never written in
  // the wrong place. A connection lost halfway leaves the bytes that did arrive — they are the
  // start of the same piece, and the client carries on from there.
  async append(userId, id, offset, stream) {
    const meta = await loadMeta(id, userId);
    return withLock(id, async () => {
      const received = await receivedBytes(id);
      if (meta.completed || !Number.isInteger(offset) || offset !== received) {
        const err = fail(409, "This piece does not follow what has been received so far.");
        err.upload = describe(id, meta, received);
        throw err;
      }

      const allowed = Math.min(CHUNK_BYTES, meta.size - received);
      let taken = 0;
      const limit = new Transform({
        transform(chunk, encoding, done) {
          taken += chunk.length;
          done(taken > allowed ? fail(413, "This piece is larger than expected.") : null, chunk);
        },
      });
      try {
        await pipeline(stream, limit, fs.createWriteStream(partPath(id), { flags: "a" }));
      } catch (err) {
        // Too much was sent: put the file back as it was. (A dropped connection is left as it is.)
        if (err.statusCode === 413) await fsp.truncate(partPath(id), received).catch(() => {});
        throw err;
      }
      return describe(id, meta, await receivedBytes(id));
    });
  },

  // Moves the finished file in with every other upload and answers in the same shape as the
  // one-request document upload. Safe to ask twice: the answer is kept, so a client that never
  // heard the first reply gets the same file back, not an error.
  async complete(userId, id) {
    const meta = await loadMeta(id, userId);
    if (meta.completed) return meta.completed;
    return withLock(id, async () => {
      const received = await receivedBytes(id);
      if (received !== meta.size) {
        const err = fail(409, "This upload is not finished yet.");
        err.upload = describe(id, meta, received);
        throw err;
      }
      const storedName = `${crypto.randomUUID()}${path.extname(meta.filename)}`;
      await fsp.rename(partPath(id), path.join(UPLOAD_DIR, storedName));
      const completed = { url: `/uploads/${storedName}`, filename: meta.filename, mimeType: meta.mimeType, size: meta.size };
      await fsp.writeFile(metaPath(id), JSON.stringify({ ...meta, completed }));
      return completed;
    });
  },

  // Gives up on an upload that has not been completed. A completed one is left alone — its file
  // is already in use.
  async cancel(userId, id) {
    const meta = await loadMeta(id, userId);
    if (meta.completed) return;
    // Cancelling usually cuts a piece off mid-way; give that request a moment to let go.
    for (let waited = 0; busy.has(id) && waited < 5000; waited += 50) await new Promise((resolve) => setTimeout(resolve, 50));
    await withLock(id, async () => {
      await fsp.rm(partPath(id), { force: true, maxRetries: 3 });
      await fsp.rm(metaPath(id), { force: true, maxRetries: 3 });
    });
  },
};

module.exports = UploadService;
