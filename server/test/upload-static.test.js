const test = require("node:test");
const assert = require("node:assert/strict");
const { setUploadHeaders, isActiveContent } = require("../src/modules/uploads/upload.static");

function headersFor(file) {
  const headers = {};
  setUploadHeaders({ setHeader: (name, value) => { headers[name] = value; } }, file);
  return headers;
}

test("HTML, SVG and XML uploads are sent as sandboxed downloads", () => {
  for (const file of ["a.html", "a.HTM", "pic.svg", "data.xml", "page.xhtml"]) {
    assert.equal(isActiveContent(file), true, file);
    assert.deepEqual(headersFor(`/uploads/${file}`), { "Content-Disposition": "attachment", "Content-Security-Policy": "sandbox" });
  }
});

test("photos, videos, PDFs and other files are served exactly as before", () => {
  for (const file of ["a.png", "a.jpg", "clip.mp4", "doc.pdf", "notes.docx", "code.py", "app.js", "project.sb3", "noextension"]) {
    assert.deepEqual(headersFor(`/uploads/${file}`), {}, file);
  }
});
