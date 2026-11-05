import { useEffect, useRef } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../../context/AuthContext";
import { ROLE_HOME } from "../../../routes/RoleRoute";

// An educator's own training is a sign-in of its own (5 Nov 2026 — the server's account-roles.js
// TOT_LEARNER_ROLE): the learner portal as their TOT learner record, never inside the teacher
// portal. Signed in as Educator, a link into their learning — /learner-portal/… (notifications,
// billing emails) or an old /teacher-portal/learning/… one — switches the session to TOT learner
// and opens the same page there. Someone not in training goes to their own home.
export const learnerPortalPathFor = (pathname, search = "") =>
  `${pathname.replace(/^\/teacher-portal\/learning/, "/learner-portal")}${search}`;

export default function TotLearnerHandoff() {
  const { user, switchRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const started = useRef(false);
  const canLearn = (user?.roles || []).includes("totLearner");
  const target = learnerPortalPathFor(location.pathname, location.search);

  useEffect(() => {
    if (!canLearn || started.current) return;
    started.current = true;
    switchRole("totLearner")
      .then(() => {
        toast.success("Now signed in as TOT learner");
        navigate(target, { replace: true });
      })
      .catch((err) => {
        toast.error(err?.message || "Couldn't open your training. Please try again.");
        navigate(ROLE_HOME[user?.role] || "/", { replace: true });
      });
  }, [canLearn, switchRole, navigate, target, user?.role]);

  if (!canLearn) return <Navigate to={ROLE_HOME[user?.role] || "/"} replace />;
  return <div style={{ padding: "60px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14, fontFamily: "Inter, sans-serif" }}>Opening your training…</div>;
}
