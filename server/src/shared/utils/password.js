const path = require("path");
const { Worker } = require("worker_threads");
const bcrypt = require("bcryptjs");

// Password hashing and checking, kept off the main thread.
//
// bcryptjs is plain JavaScript: each hash or check is tens of milliseconds of work that, run on
// the main thread, holds up every other request while it happens — so a class signing in together
// slowed the whole API down. The same bcryptjs calls run here in a couple of worker threads
// instead. The hashes are unchanged (same library, same format), so every existing password keeps
// working.
//
// If a worker can't be started or dies, the call falls back to bcryptjs on the main thread —
// slower, never refused.
const WORKER_FILE = path.join(__dirname, "password.worker.js");
const WORKER_COUNT = Math.max(1, Number(process.env.PASSWORD_WORKERS) || 2);

const workers = [];
let nextWorker = 0;
let nextId = 1;

function startWorker() {
  const worker = new Worker(WORKER_FILE);
  const entry = { worker, pending: new Map(), dead: false };
  const fail = (err) => {
    entry.dead = true;
    for (const { reject } of entry.pending.values()) reject(err);
    entry.pending.clear();
  };
  worker.on("message", ({ id, result, error }) => {
    const call = entry.pending.get(id);
    if (!call) return;
    entry.pending.delete(id);
    if (entry.pending.size === 0) worker.unref();
    if (error) call.reject(new Error(error));
    else call.resolve(result);
  });
  worker.on("error", fail);
  worker.on("exit", () => fail(new Error("Password worker stopped")));
  // An idle worker is never the reason the process stays alive (scripts such as seedAdmin.js
  // must still exit): it is held only while it has work — see runInWorker and the handler above.
  // After the listeners: adding a "message" listener would undo an earlier unref.
  worker.unref();
  return entry;
}

function pickWorker() {
  const index = nextWorker++ % WORKER_COUNT;
  if (!workers[index] || workers[index].dead) workers[index] = startWorker();
  return workers[index];
}

function runInWorker(op, args) {
  return new Promise((resolve, reject) => {
    const entry = pickWorker();
    const id = nextId++;
    entry.pending.set(id, { resolve, reject });
    entry.worker.ref();
    entry.worker.postMessage({ id, op, args });
  });
}

async function run(op, args) {
  try {
    return await runInWorker(op, args);
  } catch {
    return op === "hash" ? bcrypt.hash(...args) : bcrypt.compare(...args);
  }
}

module.exports = {
  hash: (password, rounds) => run("hash", [password, rounds]),
  compare: (password, passwordHash) => run("compare", [password, passwordHash]),
};
