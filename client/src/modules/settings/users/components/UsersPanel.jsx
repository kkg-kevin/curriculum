import { Link } from "react-router-dom";
import { useWorkspaceUsers, useSetUserActive } from "../hooks/useWorkspaceUsers";
import UsersTable from "./UsersTable";

// Settings → People & sharing → Users: every login in this workspace except parents and learners
// (those are Learners → Parent & learner logins) — admins, staff, supervisors, curriculum admins,
// hubs and educators. Read-only apart from the sign-in switch — people are still added and edited
// where they always were (Staff, Educators, Learning Hubs).
export default function UsersPanel() {
  const { data, isLoading, isError } = useWorkspaceUsers();
  const { mutate: setActive, isPending } = useSetUserActive();
  return (
    <UsersTable
      data={data}
      isLoading={isLoading}
      isError={isError}
      setActive={setActive}
      isPending={isPending}
      heading="Users"
      description={<>
        Everyone with a login in this workspace, apart from parents and learners — they&apos;re in{" "}
        <Link to="/learners?tab=logins" style={{ color: "#2e7db5", fontWeight: 700 }}>Learners → Parent &amp; learner logins</Link>.
      </>}
    />
  );
}
