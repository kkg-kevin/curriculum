import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { can } from "../../../hooks/usePermissions";
import HouseholdDetail from "../components/HouseholdDetail";
import LinkedExpenses from "../../expenses/components/LinkedExpenses";
import { panelStyle } from "../components/ui";
import { useHouseholdActions, useHouseholds, usePackages, usePickLists } from "../hooks/useHomeLearning";

const TABS = ["children", "billing", "details"];

// One Home Learning family (/home-learning/:id): opened from the list. ?tab= picks the section;
// ?place=<learnerId> opens "Add a child" with that learner chosen (after Add household).
export default function HouseholdPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { households, isLoading, isError } = useHouseholds();
  const { packages } = usePackages();
  const { curricula, educators, availableLearners } = usePickLists(households);
  const { actions, pending } = useHouseholdActions(id);
  const household = households.find((h) => h.id === id);

  const tab = TABS.includes(searchParams.get("tab")) ? searchParams.get("tab") : "children";
  const setTab = (next) => setSearchParams((params) => {
    const out = new URLSearchParams(params);
    if (next === "children") out.delete("tab"); else out.set("tab", next);
    out.delete("place");
    return out;
  }, { replace: true, state: location.state });
  // Back to the list as it was left (search, filters, sort), when we came from it.
  const backTo = `/home-learning${location.state?.from || ""}`;
  const back = <Link to={backTo} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#25476a", textDecoration: "none", justifySelf: "start" }}><FiArrowLeft size={14} /> Home Learning</Link>;

  return <div style={{ width: "100%", fontFamily: "Inter, sans-serif", color: "#111827", display: "grid", gridTemplateColumns: "100%", gap: 14 }}>
    {back}
    {isLoading
      ? <div style={{ ...panelStyle, color: "#6B7280" }}>Loading the household…</div>
      : isError || !household
        ? <div style={{ ...panelStyle, color: "#6B7280" }}>This household couldn&apos;t be found — it may have been declined or removed. <Link to="/home-learning" style={{ color: "#25476a", fontWeight: 700 }}>Back to all households</Link></div>
        : <HouseholdDetail
          key={household.id}
          household={household}
          packages={packages}
          curricula={curricula}
          educators={educators}
          availableLearners={availableLearners}
          canBill={can(user, "billing", "create")}
          canApprove={can(user, "billing", "edit")}
          canDecline={can(user, "home-learning", "delete")}
          actions={actions}
          pending={pending}
          prefillLearnerId={searchParams.get("place") || undefined}
          tab={tab}
          onTab={setTab}
          onDeclined={() => navigate(backTo)}
        />}
    {/* What the team claimed for this family (transport to their home, materials). */}
    {household && <LinkedExpenses type="household" id={household.id} title="Expenses for this family" />}
  </div>;
}
