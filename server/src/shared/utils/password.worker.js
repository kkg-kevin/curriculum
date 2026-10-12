const { parentPort } = require("worker_threads");
const bcrypt = require("bcryptjs");

// One password hash or check per message — see password.js. The synchronous calls are the point:
// this thread has nothing else to do, and they are quicker than the chunked asynchronous ones.
parentPort.on("message", ({ id, op, args }) => {
  try {
    const result = op === "hash" ? bcrypt.hashSync(...args) : bcrypt.compareSync(...args);
    parentPort.postMessage({ id, result });
  } catch (err) {
    parentPort.postMessage({ id, error: err.message });
  }
});
