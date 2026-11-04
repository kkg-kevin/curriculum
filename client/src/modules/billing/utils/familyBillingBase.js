// Where a learner-role login's own billing pages live: a parent's in their portal (/parent), an
// educator in training's (TOT) in the teacher portal's "My learning", where they pay for their own
// training (EducatorLearningAuth counts them as a learner there).
export const familyBillingBase = (user) => (user?.learningAsEducator ? "/teacher-portal/learning" : "/parent");
