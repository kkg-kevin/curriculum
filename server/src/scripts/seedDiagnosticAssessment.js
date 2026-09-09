// One-off operational script: creates a sample, fully auto-gradable quiz assessment (every item
// kind AUTO_GRADABLE_KINDS supports — see grading.utils.js) owned by PUBLIC_CONTENT_ADMIN_ID, so
// it's immediately available to pick as a Pathway's diagnosticAssessmentId in the admin portal's
// Curriculum > Pathways panel. Assign it there, check "Offer this diagnostic to anonymous
// visitors on the public website", and set an age range — see
// Guide/WEBSITE_INTEGRATION_CONTRACT.md §3.8 for the full public-diagnostic feature this unlocks.
//
// Usage (from server/):
//   node src/scripts/seedDiagnosticAssessment.js

require("dotenv").config();

const env = require("../config/env");
const db = require("../config/db");
const AssessmentModel = require("../modules/assessments/assessment.model");

const items = [
  {
    id: "item-1",
    kind: "mcqSingle",
    question: "<p>Which block makes a Quarky robot move forward?</p>",
    points: 1,
    options: ["Move forward", "Turn left", "Wait 1 second", "Set colour"],
    correctAnswer: "Move forward",
  },
  {
    id: "item-2",
    kind: "trueFalse",
    question: "<p>A loop lets you repeat the same blocks without copying them.</p>",
    points: 1,
    options: ["True", "False"],
    correctAnswer: "True",
  },
  {
    id: "item-3",
    kind: "mcqMultiple",
    question: "<p>Which of these are sensors a robot might use? (choose all that apply)</p>",
    points: 2,
    options: ["Ultrasonic sensor", "Light bulb", "Line sensor", "Speaker"],
    correctAnswer: "Ultrasonic sensor,Line sensor",
  },
  {
    id: "item-4",
    kind: "ordering",
    question: "<p>Put these steps in the order you would follow to program a robot to avoid an obstacle.</p>",
    points: 2,
    // sequence IS the correct order — public-diagnostic.service.js shuffles it before sending
    // to an anonymous visitor, so AssessmentTaker never sees the real order in advance.
    sequence: ["Read the sensor", "Check if something is close", "Stop or turn", "Move forward again"],
  },
  {
    id: "item-5",
    kind: "matching",
    question: "<p>Match each block to what it controls.</p>",
    points: 2,
    pairs: [
      { left: "Motor block", right: "Movement" },
      { left: "LED block", right: "Lights" },
    ],
  },
  {
    id: "item-6",
    kind: "fillBlank",
    question: "<p>Fill in the blank: A ____ repeats a set of blocks a number of times.</p>",
    points: 1,
    blanks: ["loop"],
  },
];

async function run() {
  if (!env.PUBLIC_CONTENT_ADMIN_ID) {
    console.error("PUBLIC_CONTENT_ADMIN_ID is not set in server/.env — cannot seed.");
    process.exitCode = 1;
    return;
  }
  // env.js only checks this var is SET, never that it resolves to a real row — a stale/typo'd
  // id here would otherwise silently create an assessment no admin can ever log in and see
  // (exactly what happened the first time this script ran against a since-removed admin id).
  const owner = await db("users").where({ id: env.PUBLIC_CONTENT_ADMIN_ID, role: "admin" }).first();
  if (!owner) {
    console.error(`PUBLIC_CONTENT_ADMIN_ID (${env.PUBLIC_CONTENT_ADMIN_ID}) does not match any admin user — cannot seed.`);
    process.exitCode = 1;
    return;
  }

  const record = await AssessmentModel.create({
    ownerAdminId: env.PUBLIC_CONTENT_ADMIN_ID,
    name: "Robotics Starting-Point Diagnostic",
    type: "quiz",
    structureType: "structured",
    description:
      "A short, auto-graded diagnostic used to place a learner at the right starting course in a Robotics-style pathway.",
    instructions: "Answer as many as you can — there is no time limit and no wrong-answer penalty.",
    items,
  });

  console.log("Created assessment:", { id: record.id, name: record.name, ownerAdminId: record.ownerAdminId });
  console.log(
    "\nNext: Curriculum > Pathways panel (as this admin) > pick a pathway with courses > " +
      "Diagnostic Assessment > select \"Robotics Starting-Point Diagnostic\" > check " +
      '"Offer this diagnostic to anonymous visitors on the public website" > Save. ' +
      "Also set that pathway's age range to include the age you'll test with."
  );
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exitCode = 1;
});
