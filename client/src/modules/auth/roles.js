import { FiBriefcase, FiBookOpen, FiHome, FiUsers, FiShield, FiLayers, FiUserCheck } from "react-icons/fi";

// How each role is shown when one login holds several (an admin who also teaches — see the
// server's modules/auth/account-roles.js): the sign-in "How do you want to sign in?" step and the
// header's role switcher.
export const ROLE_META = {
  admin: { label: "Admin", hint: "Run your workspace", icon: FiBriefcase },
  teacher: { label: "Educator", hint: "Your classes, sessions and claims", icon: FiBookOpen },
  school: { label: "Learning hub", hint: "Your hub's learners, educators and classes", icon: FiHome },
  learner: { label: "Parent", hint: "Your children's learning and reports", icon: FiUsers },
  collaborator: { label: "Staff", hint: "Your workspace, with your role's access", icon: FiUserCheck },
  supervisor: { label: "Supervisor", hint: "Your educators' claims", icon: FiShield },
  curriculumAdmin: { label: "Curriculum admin", hint: "Curriculum content", icon: FiLayers },
};

export const roleMeta = (role) => ROLE_META[role] || { label: role, hint: "", icon: FiUserCheck };
