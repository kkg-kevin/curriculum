// Educators gain an "in_training" status: someone who joined through a website TOT bootcamp and
// isn't teaching yet. They sign in and learn in "My learning" like anyone, but can't be given a
// class or Home Learning family (so they never claim) until an admin makes them Active.
exports.up = (knex) =>
  knex.raw("ALTER TABLE teachers MODIFY status ENUM('active','inactive','on_leave','in_training') NOT NULL DEFAULT 'active'");

exports.down = async (knex) => {
  await knex("teachers").where({ status: "in_training" }).update({ status: "active" });
  await knex.raw("ALTER TABLE teachers MODIFY status ENUM('active','inactive','on_leave') NOT NULL DEFAULT 'active'");
};
