import { getActiveLearnerId } from "../learner-portal/utils/activeLearner";

// A parent login: a learner-role session on an email account (a child signs in with a username).
export const isParentUser = (user) => user?.role === "learner" && !!user?.email && !user?.username;

export const childPath = (childId, rest = "") => `/parent/children/${childId}${rest}`;

// Where a /learner-portal address (a bookmark, a notification link, the role's home) takes a
// parent: the same thing in the parent portal, for the child named in ?child= (else the one last
// looked at).
export function parentPathFor(pathname, search) {
  const params = new URLSearchParams(search);
  const child = params.get("child") || getActiveLearnerId();
  const rest = pathname.replace(/^\/learner-portal/, "");
  const forChild = (suffix) => (child ? childPath(child, suffix) : "/parent");
  let match;
  if ((match = rest.match(/^\/assessments\/([^/]+)/))) return forChild(`/assessments/${match[1]}`);
  if ((match = rest.match(/^\/reports\/([^/]+)/))) return forChild(`/reports/${match[1]}`);
  if ((match = rest.match(/^\/certificates\/([^/]+)/))) return forChild(`/certificates/${match[1]}`);
  if (/^\/(assessments|reports|progress)/.test(rest)) return forChild("");
  if (/^\/(invoices|receipts|statement|family)/.test(rest)) return `/parent${rest}`;
  if (rest === "/timetable") return "/parent/timetable";
  if (rest === "/profile") return "/parent/account";
  return params.get("child") ? childPath(params.get("child")) : "/parent";
}
