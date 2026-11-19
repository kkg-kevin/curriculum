// Parent–mentor check-ins (19 Nov 2026): a round kept its class's educators as they were when it
// was published, so an educator added to the class afterwards couldn't see its check-ins. New
// links now join the class's running rounds (MentorCheckinService.addEducatorToClassRounds); this
// does the same once for educators already added — every round still running (window not over)
// gets each active educator its class has now. No notices are sent from here. Ended rounds are
// left as they were.
// Plain queries per table, no joins (the newer tables have a different collation).

const parse = (value) => {
  if (Array.isArray(value)) return value;
  try { const out = JSON.parse(value); return Array.isArray(out) ? out : []; } catch { return []; }
};

exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("mentor_checkin_rounds"))) return;
  // Today in Kenya (UTC+3), as the app reckons it.
  const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rounds = await knex("mentor_checkin_rounds").where({ status: "published" }).where("windowEnd", ">=", today).select("id", "classId", "educatorIds");
  for (const round of rounds) {
    const linked = await knex("class_course_teacher_links").where({ classId: round.classId }).distinct("teacherId").pluck("teacherId");
    if (!linked.length) continue;
    const active = await knex("teachers").whereIn("id", linked).where((w) => w.whereNull("status").orWhereNotIn("status", ["inactive", "removed"])).pluck("id");
    const current = parse(round.educatorIds);
    const missing = active.filter((teacherId) => !current.includes(teacherId));
    if (!missing.length) continue;
    await knex("mentor_checkin_rounds").where({ id: round.id }).update({ educatorIds: JSON.stringify([...current, ...missing]), updatedAt: new Date() });
  }
};

// Nothing to undo: who was added can't be told apart from who was there, and they are the class's
// educators either way.
exports.down = async function down() {};
