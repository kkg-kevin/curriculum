const AcademicYearGroupModel   = require("./academic-year-groups.model");
const AcademicYearVersionModel = require("./academic-year-versions.model");

const AcademicYearService = {
  /* ── Read ──────────────────────────────────────────────────────────── */

  async getAll(curriculumId) {
    const groups   = await AcademicYearGroupModel.findByCurriculumId(curriculumId);
    const versions = await AcademicYearVersionModel.findByCurriculumId(curriculumId);

    // Attach versions to their group, newest version first
    const enriched = groups
      .map((g) => {
        const gVersions = versions
          .filter((v) => v.yearGroupId === g.id)
          .sort((a, b) => b.versionNumber - a.versionNumber);
        return { ...g, versions: gVersions };
      })
      // Sort groups newest start date first
      .sort((a, b) => {
        if (!a.startDate && !b.startDate) return 0;
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return new Date(b.startDate) - new Date(a.startDate);
      });

    const publishedVersion = versions.find((v) => v.status === "published") || null;

    return { groups: enriched, publishedVersion };
  },

  /* ── Create year group ─────────────────────────────────────────────── */

  async createGroup(curriculumId, data) {
    const { label, startDate, endDate, periods } = data;
    if (!label || !label.trim()) {
      throw Object.assign(new Error("Year label is required"), { statusCode: 400 });
    }

    // Date validation: new year cannot start before the current published year ends
    const published = await AcademicYearVersionModel.findPublished(curriculumId);
    if (published && startDate) {
      const pubGroup = await AcademicYearGroupModel.findById(published.yearGroupId);
      if (pubGroup && pubGroup.endDate && startDate < pubGroup.endDate) {
        throw Object.assign(
          new Error(
            `New year must start after the current published year ends (${pubGroup.endDate})`
          ),
          { statusCode: 400 }
        );
      }
    }

    const group = await AcademicYearGroupModel.create({
      curriculumId,
      label: label.trim(),
      startDate: startDate || null,
      endDate:   endDate   || null,
    });

    const version = await AcademicYearVersionModel.create({
      yearGroupId:   group.id,
      curriculumId,
      versionNumber: 1,
      status:        "draft",
      isCurrent:     true,
      periods:       periods || [],
    });

    return { group, version };
  },

  /* ── Create new version (edit = new draft) ─────────────────────────── */

  async createVersion(curriculumId, groupId, data) {
    const group = await AcademicYearGroupModel.findById(groupId);
    if (!group || group.curriculumId !== curriculumId) {
      throw Object.assign(new Error("Academic year not found"), { statusCode: 404 });
    }

    const existing    = await AcademicYearVersionModel.findByGroupId(groupId);
    const nextVersion = existing.length
      ? Math.max(...existing.map((v) => v.versionNumber)) + 1
      : 1;

    // Demote all versions in this group from isCurrent
    await AcademicYearVersionModel.setGroupNotCurrent(groupId);

    const version = await AcademicYearVersionModel.create({
      yearGroupId:   groupId,
      curriculumId,
      versionNumber: nextVersion,
      status:        "draft",
      isCurrent:     true,
      periods:       data.periods || [],
    });

    return version;
  },

  /* ── Change version status ─────────────────────────────────────────── */

  async changeStatus(curriculumId, groupId, versionId, status) {
    if (!["draft", "published", "inactive"].includes(status)) {
      throw Object.assign(new Error("Invalid status"), { statusCode: 400 });
    }

    const version = await AcademicYearVersionModel.findById(versionId);
    if (!version || version.curriculumId !== curriculumId || version.yearGroupId !== groupId) {
      throw Object.assign(new Error("Version not found"), { statusCode: 404 });
    }

    if (status === "published") {
      // Retire any currently published version across ALL groups in this curriculum
      const allVersions = await AcademicYearVersionModel.findByCurriculumId(curriculumId);
      await Promise.all(
        allVersions
          .filter((v) => v.id !== versionId && v.status === "published")
          .map((v) => AcademicYearVersionModel.update(v.id, { status: "inactive" }))
      );

      // Make this version isCurrent within its group (demote siblings)
      await AcademicYearVersionModel.setGroupNotCurrent(groupId);

      return AcademicYearVersionModel.update(versionId, { status: "published", isCurrent: true });
    }

    // draft / inactive — just update status, isCurrent stays as-is
    return AcademicYearVersionModel.update(versionId, { status });
  },
};

module.exports = AcademicYearService;
