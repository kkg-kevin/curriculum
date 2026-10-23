import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FiChevronDown, FiChevronUp, FiPrinter } from "react-icons/fi";
import { useOrders, useOrder, useSetOrderStatus } from "../hooks/useBilling";
import { cardStyle, buttonStyle, inputStyle, formatMoney } from "./shared";
import { LoadingState, EmptyState } from "./PageStates";

// Billing → Orders: what families bought on the website — Store goods and Projects (server:
// modules/orders). An order is paid through its invoice like anything else (Payment step, To
// confirm, M-Pesa); once paid, staff prepare it and mark it ready for pickup or dispatched, then
// completed. Projects are given to the child automatically when the order is paid.

const VIEWS = [
  { key: "open", label: "Open" },
  { key: "awaiting_payment", label: "Awaiting payment" },
  { key: "paid", label: "Paid" },
  { key: "preparing", label: "Being prepared" },
  { key: "ready_for_pickup", label: "Ready for pickup" },
  { key: "dispatched", label: "Dispatched" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

const LOOK = {
  awaiting_payment: { bg: "#FFF7ED", color: "#C2410C" },
  paid: { bg: "#EFF6FF", color: "#1D4ED8" },
  preparing: { bg: "#FFFBEB", color: "#B45309" },
  ready_for_pickup: { bg: "#ECFDF5", color: "#047857" },
  dispatched: { bg: "#ECFDF5", color: "#047857" },
  completed: { bg: "#F3F4F6", color: "#374151" },
  cancelled: { bg: "#FEF2F2", color: "#B91C1C" },
};

const ACTION_LABEL = {
  preparing: "Start preparing",
  ready_for_pickup: "Ready for pickup",
  dispatched: "Mark dispatched",
  completed: "Mark completed",
  cancelled: "Cancel order",
};

const KIND_LABEL = { store_item: "Store", project: "Project", project_kit: "Kit" };
const formatDateTime = (value) => (value ? new Date(value).toLocaleString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const subtleButton = { ...buttonStyle, padding: "8px 12px", background: "#F3F4F6", color: "#374151" };
const escape = (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function Pill({ status, label }) {
  const look = LOOK[status] || LOOK.completed;
  return <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 999, background: look.bg, color: look.color, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>{label}</span>;
}

function fulfilmentText(order) {
  if (order.fulfilment === "pickup") return `Pickup${order.pickupHub ? ` · ${order.pickupHub.name}` : ""}`;
  if (order.fulfilment === "delivery") return `Delivery · ${[order.delivery?.address, order.delivery?.town, order.delivery?.county].filter(Boolean).join(", ")}`;
  return "Nothing to send (project access only)";
}

// A plain packing slip in a new window, for the person packing the order.
function printPackingSlip(order) {
  const win = window.open("", "_blank", "width=720,height=900");
  if (!win) return;
  const rows = order.items.filter((i) => i.kind !== "project").map((i) => `<tr><td>${escape(i.name)}</td><td style="text-align:right">${i.quantity}</td><td style="width:60px"></td></tr>`).join("");
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Packing slip ${escape(order.orderNumber)}</title>
    <style>body{font-family:Arial,sans-serif;padding:32px;color:#111}h1{font-size:20px;margin:0 0 4px}p{margin:2px 0;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:18px}td,th{border-bottom:1px solid #ddd;padding:8px;font-size:13px;text-align:left}</style></head>
    <body><h1>Packing slip — ${escape(order.orderNumber)}</h1>
    <p>${escape(formatDateTime(order.createdAt))}</p>
    <p style="margin-top:12px"><strong>${escape(order.customer.name)}</strong> · ${escape(order.customer.phone)} · ${escape(order.customer.email)}</p>
    <p>${escape(fulfilmentText(order))}</p>
    ${order.delivery?.note ? `<p>Note: ${escape(order.delivery.note)}</p>` : ""}
    <table><thead><tr><th>Item</th><th style="text-align:right">Qty</th><th>Packed</th></tr></thead><tbody>${rows}</tbody></table>
    <script>window.onload=function(){window.print()}</script></body></html>`);
  win.document.close();
}

function OrderDetail({ id }) {
  const { data: order, isLoading } = useOrder(id);
  const { mutate: setStatus, isPending } = useSetOrderStatus();
  const [note, setNote] = useState("");
  if (isLoading || !order) return <div style={{ padding: "12px 20px", fontSize: 12, color: "#6B7280" }}>Loading…</div>;

  const act = (status) => {
    if (status === "cancelled" && !window.confirm(`Cancel ${order.orderNumber}?${order.invoice?.amountPaid > 0 ? " It has been paid — arrange the refund yourself." : " Its unpaid invoice is cancelled too."}`)) return;
    setStatus({ id: order.id, status, note: note.trim() || null }, { onSuccess: () => setNote("") });
  };

  return (
    <div style={{ padding: "4px 20px 16px", display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}>
      <div>
        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 800, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>Items</p>
        <div style={{ border: "1px solid #F3F4F6", borderRadius: 10 }}>
          {order.items.map((i) => (
            <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderBottom: "1px solid #F3F4F6" }}>
              {i.image ? <img src={i.image} alt="" style={{ width: 38, height: 38, objectFit: "cover", borderRadius: 6 }} /> : <span style={{ width: 38, height: 38, borderRadius: 6, background: "#F3F4F6" }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{i.name}</div>
                <div style={{ fontSize: 11.5, color: "#6B7280" }}>{KIND_LABEL[i.kind]} · {i.quantity} × {formatMoney(i.unitPrice, order.currency)}</div>
              </div>
              <strong style={{ fontSize: 13 }}>{formatMoney(i.lineTotal, order.currency)}</strong>
            </div>
          ))}
          {order.deliveryFee > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", fontSize: 12.5, color: "#374151" }}><span>Delivery</span><span>{formatMoney(order.deliveryFee, order.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", fontSize: 13.5, fontWeight: 900, color: "#111827", background: "#F9FAFB" }}><span>Total</span><span>{formatMoney(order.total, order.currency)}</span></div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12.5, color: "#374151" }}>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 800, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>Customer</p>
          <div><strong>{order.customer.name}</strong></div>
          <div>{order.customer.phone} · {order.customer.email}</div>
        </div>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 800, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>How it reaches them</p>
          <div>{fulfilmentText(order)}</div>
          {order.delivery?.note && <div style={{ color: "#6B7280" }}>Note: {order.delivery.note}</div>}
        </div>
        {order.childName && (
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 800, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>Projects for</p>
            <div>
              {order.learner ? <Link to={`/learners/${order.learner.id}/view`} style={{ color: "#25476a", fontWeight: 700, textDecoration: "none" }}>{order.childName}</Link> : order.childName}
              {order.learner?.username ? <span style={{ color: "#6B7280" }}> · @{order.learner.username}</span> : null}
            </div>
            <div style={{ color: "#6B7280" }}>{order.status === "awaiting_payment" ? "Given to the child once the order is paid." : "Given to the child — they're in their learner portal."}</div>
          </div>
        )}
        {order.invoice && (
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 800, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>Payment</p>
            <Link to={`/billing/${order.invoice.id}`} style={{ color: "#25476a", fontWeight: 700, textDecoration: "none" }}>{order.invoice.invoiceNumber}</Link>
            <span style={{ color: "#6B7280" }}> · {formatMoney(order.invoice.amountPaid, order.currency)} paid of {formatMoney(order.invoice.total, order.currency)} · {order.invoice.status.replace(/_/g, " ")}</span>
            {order.status === "awaiting_payment" && <div style={{ color: "#6B7280" }}>Payments families report wait in Billing → To confirm; you can also record one on the invoice.</div>}
          </div>
        )}
      </div>

      <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 8 }}>
        {order.next.length > 0 && (
          <>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Note for the family (optional) — e.g. courier and tracking number" style={{ ...inputStyle, padding: "8px 10px", maxWidth: 520 }} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {order.next.filter((s) => s !== "cancelled").map((s) => (
                <button key={s} type="button" disabled={isPending} onClick={() => act(s)} style={{ ...buttonStyle, padding: "8px 12px", background: s === "completed" ? "#047857" : "#25476a" }}>{ACTION_LABEL[s]}</button>
              ))}
              {order.items.some((i) => i.kind !== "project") && <button type="button" onClick={() => printPackingSlip(order)} style={subtleButton}><FiPrinter size={13} /> Packing slip</button>}
              {order.next.includes("cancelled") && <button type="button" disabled={isPending} onClick={() => act("cancelled")} style={{ ...subtleButton, color: "#B91C1C", marginLeft: "auto" }}>Cancel order</button>}
            </div>
          </>
        )}
        <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>
          {order.history.map((h) => `${h.status.replace(/_/g, " ")} ${formatDateTime(h.at)}${h.note ? ` (${h.note})` : ""}`).join(" → ")}
        </div>
      </div>
    </div>
  );
}

export default function OrdersPanel() {
  const [searchParams] = useSearchParams();
  const [view, setView] = useState("open");
  const [openId, setOpenId] = useState(searchParams.get("order"));
  const { data, isLoading, isError } = useOrders({ status: searchParams.get("order") && view === "open" ? "all" : view });
  const counts = data?.counts || {};
  const orders = data?.orders || [];
  const openCount = ["awaiting_payment", "paid", "preparing", "ready_for_pickup", "dispatched"].reduce((n, s) => n + (counts[s] || 0), 0);

  useEffect(() => { if (searchParams.get("order")) setOpenId(searchParams.get("order")); }, [searchParams]);

  return (
    <section style={{ ...cardStyle, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6" }}>
        <h2 style={{ margin: 0, fontSize: 15 }}>Website orders</h2>
        <p style={{ margin: "4px 0 12px", fontSize: 12.5, color: "#6B7280" }}>
          Store items and projects bought on the website. Once an order is paid, prepare it and mark it ready for pickup or dispatched. Projects reach the child by themselves when it's paid.
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {VIEWS.map((v) => {
            const count = v.key === "open" ? openCount : counts[v.key];
            return (
              <button key={v.key} type="button" onClick={() => setView(v.key)} style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${view === v.key ? "#25476a" : "#E5E7EB"}`, background: view === v.key ? "#25476a" : "#fff", color: view === v.key ? "#fff" : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {v.label}{v.key !== "all" && count ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>
      </div>
      {isLoading ? <LoadingState label="Loading orders…" inline />
        : isError ? <p style={{ padding: 20, color: "#B91C1C", fontSize: 13 }}>Orders could not be loaded.</p>
          : orders.length === 0 ? <EmptyState title={view === "open" ? "No open orders" : "Nothing here"} subtitle={view === "open" ? "Orders placed on the website show up here." : ""} />
            : orders.map((o) => {
              const open = openId === o.id;
              return (
                <div key={o.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <button type="button" onClick={() => setOpenId(open ? null : o.id)} style={{ width: "100%", display: "grid", gridTemplateColumns: "minmax(180px, 1.2fr) minmax(160px, 1.4fr) auto auto", gap: 14, alignItems: "center", padding: "14px 20px", border: 0, background: open ? "#F8FAFC" : "transparent", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 13, color: "#111827" }}>{o.orderNumber}</strong>
                        <Pill status={o.status} label={o.statusLabel} />
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>{formatDateTime(o.createdAt)} · {o.customer.name}</div>
                    </div>
                    <div style={{ fontSize: 12, color: "#374151", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {o.items.map((i) => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join(", ")}
                    </div>
                    <strong style={{ fontSize: 14, color: "#111827", whiteSpace: "nowrap" }}>{formatMoney(o.total, o.currency)}</strong>
                    {open ? <FiChevronUp color="#6B7280" /> : <FiChevronDown color="#6B7280" />}
                  </button>
                  {open && <OrderDetail id={o.id} />}
                </div>
              );
            })}
    </section>
  );
}
