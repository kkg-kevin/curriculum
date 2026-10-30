const db = require("../../config/db");

// How a learner came to be on record, for the staff learner page's "Joined via" — worked out
// from what each sign-up already keeps, nothing stored for it:
//   a website bootcamp enrolment   its lead (learnerId + bootcampId)
//   Home Learning                  their household enrolment (household.source website | admin)
//   a Tech Club                    their membership child row (membership.source website | admin)
//   a website shop order           the order that created them (within minutes of the learner)
//   an educator in training (TOT)  learners.teacherId
//   anything else                  added in the system — who, from the activity log's create entry
// `note` is what the family told us that has no column on the learner (Home Learning / Tech Club
// "current school or grade").
const SAME_SIGNUP_MS = 10 * 60 * 1000;

const addedByParent = (placementNotes) => String(placementNotes || "").startsWith("Added by parent.");

function parentSays(placementNotes) {
  const match = String(placementNotes || "").match(/Parent says:\s*(.+)$/);
  return match ? match[1].trim() : null;
}

async function originOf(learner) {
  if (!learner) return null;
  if (learner.teacherId) return { via: "system", kind: "tot", title: "Educator in training (TOT)", detail: null, at: learner.createdAt, note: null };

  const lead = await db("leads").where({ learnerId: learner.id }).whereNotNull("bootcampId").orderBy("createdAt").first();
  if (lead) {
    const bootcamp = await db("bootcamps").where({ id: lead.bootcampId }).first("name");
    const tookDiagnostic = /Diagnostic attempt:/.test(lead.message || "");
    return {
      via: "website", kind: "bootcamp", title: "Website — bootcamp enrolment", detail: bootcamp?.name || null, at: lead.createdAt,
      note: tookDiagnostic ? "Took the website diagnostic before enrolling" : null,
    };
  }

  // Separate lookups, no joins — these tables don't all share one collation.
  const enrolment = await db("home_learning_enrollments").where({ learnerId: learner.id }).first("householdId", "placementNotes");
  const household = enrolment ? await db("home_learning_households").where({ id: enrolment.householdId }).first("source", "createdAt", "packageId") : null;
  const homeLearning = household && {
    ...household,
    placementNotes: enrolment.placementNotes,
    packageName: household.packageId ? (await db("home_learning_packages").where({ id: household.packageId }).first("name"))?.name : null,
  };
  if (homeLearning) {
    const website = homeLearning.source === "website";
    return {
      via: website ? "website" : "system", kind: "home_learning",
      title: addedByParent(homeLearning.placementNotes) ? "Home Learning — added by the parent" : website ? "Website — Home Learning sign-up" : "Home Learning — added by staff",
      detail: homeLearning.packageName || null, at: learner.createdAt, note: parentSays(homeLearning.placementNotes),
    };
  }

  const child = await db("club_membership_children").where({ learnerId: learner.id }).first("membershipId", "placementNotes");
  const membership = child ? await db("club_memberships").where({ id: child.membershipId }).first("source", "createdAt", "hubId") : null;
  const club = membership && {
    ...membership,
    placementNotes: child.placementNotes,
    hubName: (await db("learning_hubs").where({ id: membership.hubId }).first("name"))?.name || null,
  };
  if (club) {
    const website = club.source === "website";
    return {
      via: website ? "website" : "system", kind: "tech_club",
      title: addedByParent(club.placementNotes) ? "Tech Club — added by the parent" : website ? "Website — Tech Club sign-up" : "Tech Club — added by staff",
      detail: club.hubName || null, at: learner.createdAt, note: parentSays(club.placementNotes),
    };
  }

  const order = await db("orders").where({ learnerId: learner.id }).orderBy("createdAt").first("orderNumber", "createdAt");
  if (order && Math.abs(new Date(order.createdAt) - new Date(learner.createdAt)) <= SAME_SIGNUP_MS) {
    return { via: "website", kind: "shop", title: "Website — shop order", detail: order.orderNumber, at: order.createdAt, note: null };
  }

  const created = await db("audit_log")
    .where({ entityType: "learners", entityId: learner.id, action: "create" })
    .orderBy("createdAt")
    .first("actorName", "path");
  const bulk = /bulk-import/.test(created?.path || "");
  return {
    via: "system", kind: bulk ? "import" : "staff",
    title: bulk ? "Added in the system — spreadsheet import" : "Added in the system",
    detail: created?.actorName ? `by ${created.actorName}` : null, at: learner.createdAt, note: null,
  };
}

module.exports = { originOf };
