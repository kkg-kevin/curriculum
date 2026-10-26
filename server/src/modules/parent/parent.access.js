// A parent login is a learner-role session on an email account; a child signs in with their own
// username (see scope.middleware.js's learner branch). The parent sees every child of theirs
// (req.ownLearners) but only watches: the work is the child's, done on the child's own login.
const isParent = (user) => user?.role === "learner" && !user.username;

// Only a parent login reaches /api/parent.
function parentOnly(req, res, next) {
  if (isParent(req.user)) return next();
  return res.status(403).json({ success: false, message: "This is for parent accounts." });
}

// On the routes where a learner starts, saves or submits work — a parent can see it, not do it.
function notAsParent(req, res, next) {
  if (!isParent(req.user)) return next();
  const name = req.ownLearner?.firstName || "Your child";
  return res.status(403).json({
    success: false,
    code: "PARENT_VIEW_ONLY",
    message: `${name} does this on their own login — parents can follow the work and results but not do it for them.`,
  });
}

module.exports = { isParent, parentOnly, notAsParent };
