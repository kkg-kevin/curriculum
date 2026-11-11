// Website TOT sign-ups made before the "in_training" status existed (20261104090000) were saved as
// Active educators, so they showed in the educator lists as well as Learners → TOT learners
// (tot/tot.people.js hides only In-training trainees). This puts them where every later sign-up
// is: In training. Picked out exactly: an Active educator whose own learner record came from a
// website bootcamp sign-up (an enquiry tied to that record, interestedIn "bootcamp"), and who has
// never been given anything to teach (no class course, no Home Learning family). Educators an admin
// enrolled in TOT, or who teach, are left alone. Make Active on their page puts one back.
//
// Separate lookups, no joins — these tables don't all share one collation.

exports.up = async (knex) => {
  const trainees = await knex("learners").whereNotNull("teacherId").select("id", "teacherId");
  for (const learner of trainees) {
    const teacher = await knex("teachers").where({ id: learner.teacherId }).first("id", "status");
    if (!teacher || teacher.status !== "active") continue;
    const fromWebsite = await knex("leads").where({ learnerId: learner.id, interestedIn: "bootcamp" }).first("id");
    if (!fromWebsite) continue;
    const teaches = await knex("class_course_teacher_links").where({ teacherId: teacher.id }).first("id");
    if (teaches) continue;
    const family = await knex("home_learning_enrollments").where({ educatorId: teacher.id }).first("id");
    if (family) continue;
    await knex("teachers").where({ id: teacher.id }).update({ status: "in_training", updatedAt: new Date() });
  }
};

// Nothing to undo safely: an admin may have made some of them Active again since.
exports.down = async () => {};
