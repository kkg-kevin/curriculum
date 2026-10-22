const { folderService } = require("../../shared/utils/folders");

// Assessment folders (Assessments page): named groups an admin files their assessments into, the
// same way as course folders. An assessment sits in at most one folder (assessments.folderId); a
// folder is only a label in one admin's workspace, so issuing, taking and grading an assessment
// never depend on it. Deleting a folder takes its assessments out of it; it never deletes one.

const folders = folderService({ table: "assessment_folders", itemTable: "assessments", noun: "assessment", countKey: "assessmentCount" });

const AssessmentFolderService = {
  list: folders.list,
  create: folders.create,
  update: folders.update,
  remove: folders.remove,
  addAssessments: folders.addItems,
  removeAssessment: folders.removeItem,
};

module.exports = AssessmentFolderService;
