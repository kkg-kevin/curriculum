// Every course id assigned anywhere in a version's content (any period, any grade).
function collectCourseIds(content) {
  const ids = new Set();
  (content || []).forEach((period) => {
    (period.classes || []).forEach((cls) => {
      (cls.courses || []).forEach((c) => ids.add(c.id));
    });
  });
  return ids;
}

module.exports = { collectCourseIds };
