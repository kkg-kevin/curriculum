import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiLock, FiRepeat, FiUnlock } from "react-icons/fi";
import { T, cardStyle } from "../../learner-portal/components/profile/theme";
import { pathwaySubscriptionApi } from "../../pathway-subscriptions/services/pathwaySubscriptionApi";
import { formatDay, pricePer } from "../../../utils/billingPeriods";

// A parent's pathway subscriptions (website plans — pathway-subscriptions/): each one's state, when
// its courses are open until, what's owed, and Renew for a paused or cancelled one (raises a new
// period's invoice from today and opens it to pay). Hidden when they have none.
const LOOK = {
  pending: { text: "Waiting for the first payment", bg: "#FFFBEB", color: "#B45309" },
  active: { text: "Active — renews automatically", bg: "#ECFDF5", color: "#047857" },
  paused: { text: "Paused — courses locked", bg: "#F3F4F6", color: "#4B5563" },
  cancelled: { text: "Ended", bg: "#F3F4F6", color: "#6B7280" },
};

export default function ParentSubscriptions() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["pathway-subscriptions", "mine"], queryFn: pathwaySubscriptionApi.mine });
  const subs = Array.isArray(data) ? data : [];
  const renew = useMutation({
    mutationFn: (id) => pathwaySubscriptionApi.renewMine(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["pathway-subscriptions"] });
      if (result?.invoice?.id) {
        toast.success("Renewal invoice ready — pay it to open the courses again");
        navigate(`/parent/invoices/${result.invoice.id}`);
      }
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Couldn't renew — please contact us"),
  });
  if (!subs.length) return null;

  return (
    <div style={{ ...cardStyle({ padding: "18px 20px" }) }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800, color: T.ink }}>Pathway subscriptions</h2>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "100%" }}>
        {subs.map((sub) => {
          const look = LOOK[sub.status] || LOOK.pending;
          const open = sub.invoices.find((inv) => ["issued", "partially_paid", "overdue"].includes(inv.status));
          return (
            <div key={sub.id} style={{ border: "1px solid #EEF1F5", borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: "1 1 240px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 14, color: T.ink }}>{sub.pathwayName}</strong>
                  <span style={{ padding: "2px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, background: look.bg, color: look.color }}>{look.text}</span>
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 12.5, color: T.inkMuted }}>
                  {sub.children.map((c) => c.name.split(" ")[0]).join(", ")} · {pricePer(sub.amount, sub.billingPeriod)}
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 12.5, color: sub.accessOpen ? "#047857" : "#B45309", display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600 }}>
                  {sub.accessOpen ? <FiUnlock size={12} /> : <FiLock size={12} />}
                  {sub.accessOpen ? `Courses open until ${formatDay(sub.accessUntil)}` : sub.status === "pending" ? "Courses open once the first payment is in" : "Courses locked — progress is kept"}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {open && <Link to={`/parent/invoices/${open.id}`} style={{ padding: "8px 13px", borderRadius: 9, border: "1px solid #D1D5DB", color: "#25476a", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>Pay {open.invoiceNumber}</Link>}
                {["paused", "cancelled"].includes(sub.status) && (
                  <button type="button" disabled={renew.isPending} onClick={() => renew.mutate(sub.id)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9, border: 0, background: "#25476a", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                    <FiRepeat size={12} /> {renew.isPending ? "Renewing…" : "Renew"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
