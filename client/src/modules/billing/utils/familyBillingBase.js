// Where a learner-role login's own billing pages live: a parent's in their portal (/parent), a TOT
// learner's (an educator in training, who pays for their own training) in the learner portal.
export const familyBillingBase = (user) => (user?.learningAsEducator ? "/learner-portal" : "/parent");
