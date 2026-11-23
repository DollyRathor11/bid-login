const PRODUCTS = { desktop: "Desktop", aio: "AIO", workstation: "Workstation", printer: "Printer", multifunction_printer: "Multifunction Printer", toner: "Toner", ups: "UPS" };
const STATUSES = {
  pending: { label: "Pending", badge: "bg-amber-100 text-amber-700", button: "bg-amber-600 hover:bg-amber-700" },
  approved: { label: "Approved", badge: "bg-emerald-100 text-emerald-700", button: "bg-emerald-600 hover:bg-emerald-700" },
  "re-analyze": { label: "Re-Analyze", badge: "bg-rose-100 text-rose-700", button: "bg-blue-600 hover:bg-blue-700" },
  rejected: { label: "Rejected", badge: "bg-red-100 text-red-800", button: "bg-blue-600 hover:bg-blue-700" },
};
const productName = item => PRODUCTS[item.product_kind || item.product] || item.product;

export default function BunchBidCard({ group, serialNumber, onView, role = "analyser", dashboard = false }) {
  const item = (dashboard && group.items.find(item => item.status === group.status))
    || (role === "admin" && group.items.find(item => item.can_review)) || group.items[0];
  if (!item) return null;
  const status = STATUSES[dashboard ? group.status : item.status] || STATUSES.pending;
  const waiting = role === "admin" && !item.can_review;
  const date = item.end_date ? new Date(item.end_date) : null;
  const endDate = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return <tr className="bg-white hover:bg-slate-50">
      <td className="border-b border-slate-100 px-2 py-4 text-sm font-semibold text-slate-800">{serialNumber}</td>
      <td className="border-b border-slate-100 px-2 py-4"><button type="button" disabled={waiting} onClick={() => onView(item)} className="break-words text-left text-sm font-bold text-blue-600 hover:underline disabled:cursor-default">{group.bid_no}</button>
      </td>
      <td title={item.dept_name} className="break-words border-b border-slate-100 px-2 py-4 text-sm font-semibold text-slate-800">{item.dept_name || "—"}</td>
      <td className="border-b border-slate-100 px-2 py-4 text-sm font-semibold text-slate-800">{item.qty}</td>
      <td className="break-words border-b border-slate-100 px-2 py-4 text-sm font-semibold text-slate-800">{(role === "admin" ? item.analyser_username : item.user) || "—"}</td>
      <td className="border-b border-slate-100 px-2 py-4 text-sm font-semibold text-slate-800">{endDate}</td>
      <td className="border-b border-slate-100 px-2 py-4"><span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${status.badge}`}>{waiting ? "Awaiting Analysis" : status.label}</span></td>
      <td className="border-b border-slate-100 px-2 py-4"><button type="button" disabled={waiting} onClick={() => onView(item)} aria-label={`View ${productName(item)} bid ${group.bid_no}`} className={`rounded px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40 ${status.button}`}>View</button></td>
  </tr>;
}
