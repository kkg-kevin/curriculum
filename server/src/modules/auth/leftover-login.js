const db = require("../../config/db");
const UserSessionModel = require("./user-session.model");

// A login is tied to the person it belongs to only through a record that points at it (see
// admin-tools/workspace-users.service.js for the same links): an educator's or hub's email, a
// learner's username or guardian email, or the workspace that invited a staff member or
// supervisor. Deleting that record leaves the login behind, invisible everywhere in the app but
// still holding its email — so inviting that email as someone new was refused with "already
// registered". A login like that is a leftover, and its email can be given to someone else.

async function matches(table, column, value) {
  if (!value) return false;
  return !!(await db(table).whereRaw("LOWER(??) = ?", [column, value.toLowerCase()]).first("id"));
}

async function isLeftoverLogin(user) {
  switch (user.role) {
    case "teacher":
      return !(await matches("teachers", "email", user.email));
    case "school":
      return !(await matches("learning_hubs", "email", user.email));
    case "learner":
      if (user.username) return !(await matches("learners", "username", user.username));
      return !(await matches("learners", "guardianEmail", user.email))
        && !(await matches("home_learning_households", "guardianEmail", user.email));
    // An Account Manager / Training Lead (account-roles.js): still named on some hub.
    case "hubLead":
      return !(await db("learning_hubs").where({ accountManagerId: user.id }).orWhere({ trainingLeadId: user.id }).first("id"));
    case "collaborator":
    case "supervisor": {
      // The workspace that invited them — an admin's own id, or an organisation's key.
      const key = user.invitedByAdminId;
      if (!key) return true;
      const admin = await db("users").where({ role: "admin" }).andWhere((q) => q.where({ id: key }).orWhere({ organisationId: key })).first("id");
      return !admin;
    }
    // Admins and curriculum admins are never treated as leftovers.
    default:
      return false;
  }
}

// Removes `user` when it's a leftover, so its email is free again. True when it did.
// A login that also holds another role (account-roles.js) whose record still exists isn't a
// leftover — it is still somebody's educator, hub or parent login.
async function releaseIfLeftover(user) {
  if (!user || !(await isLeftoverLogin(user))) return false;
  const { extraRolesOf } = require("./account-roles");
  for (const role of extraRolesOf(user)) {
    if (!(await isLeftoverLogin({ ...user, role }))) return false;
  }
  await UserSessionModel.deleteByUserId(user.id);
  await db("users").where({ id: user.id }).del();
  return true;
}

module.exports = { isLeftoverLogin, releaseIfLeftover };
