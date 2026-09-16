// A diagnostic assessment per pathway included in a bootcamp — each pathway in
// bootcamps.pathwayIds carries its OWN diagnostic, e.g. a bootcamp bundling a Robotics pathway
// and a Coding pathway can offer a different placement quiz for each. Same "JSON column on the
// parent record" shape as pathwayIds/coursePricing rather than a join table (see that migration's
// own comment for why). Array of { pathwayId, assessmentId } rather than an object keyed by
// pathwayId, so it can be validated/iterated the same way coursePricing is.
exports.up = async function (knex) {
  await knex.schema.alterTable("bootcamps", (table) => {
    table.json("pathwayDiagnostics").nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("bootcamps", (table) => {
    table.dropColumn("pathwayDiagnostics");
  });
};
