const { folderService } = require("../../shared/utils/folders");

// Course folders (Courses page): named groups an admin files their courses into. A course sits in
// at most one folder (courses.folderId); a folder is only a label in one admin's workspace, so
// nothing else about a course — curricula, sessions, classes, the learner/educator views —
// depends on it. Deleting a folder takes its courses out of it; it never deletes a course.
// The rules are shared with assessment folders — see shared/utils/folders.js.

const folders = folderService({ table: "course_folders", itemTable: "courses", noun: "course", countKey: "courseCount" });

const CourseFolderService = {
  list: folders.list,
  create: folders.create,
  update: folders.update,
  remove: folders.remove,
  addCourses: folders.addItems,
  removeCourse: folders.removeItem,
};

module.exports = CourseFolderService;
