import BunchBidCard from "./BunchBidCard";

const TABS = [
  { key: "pending", label: "Pending", icon: "⌛", color: "text-amber-600", badge: "bg-amber-100 text-amber-700" },
  { key: "approved", label: "Approved", icon: "✅", color: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700" },
  { key: "re-analyze", label: "Re-Analyze", icon: "⚠️", color: "text-rose-600", badge: "bg-rose-100 text-rose-700" },
  { key: "rejected", label: "Rejected", icon: "⛔", color: "text-red-800", badge: "bg-red-100 text-red-800" },
];

export default function AnalyserBunchList({ data, loading, error, status, onStatus, onPage, onView, role = "analyser" }) {
  const groups = (data?.results || []).map(group => ({ ...group, items: group.items.filter(item => status === "all" || item.status === status) })).filter(group => group.items.length);
  return <section aria-label={role === "admin" ? "Bunch Bid Approval" : "Bunch Bids"} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
    <div role="tablist" aria-label="Bunch bid status" className="flex gap-2 overflow-x-auto bg-gray-50 px-6 pt-4">
      {TABS.map(tab => <button type="button" role="tab" aria-selected={status === tab.key} key={tab.key} onClick={() => onStatus(tab.key)}
        className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-4 text-sm font-medium transition ${status === tab.key ? `border-current bg-white ${tab.color}` : "border-transparent text-slate-500 hover:bg-white"}`}><span aria-hidden="true">{tab.icon}</span>{tab.label}</button>)}
    </div>
    {error && <p role="alert" className="mx-6 my-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    <div className="overflow-x-auto"><table className="w-full min-w-[850px] table-fixed border-separate border-spacing-0 text-left">
      <colgroup>{[6, 16, 18, 6, 15, 13, 13, 13].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
      <thead><tr className="bg-slate-800">{["S.No.", "Bid No", "Department", "Qty", role === "admin" ? "Analyser" : "Submitted By", "End Date", "Status", "Action"].map(label => <th key={label} className="whitespace-nowrap border-b border-slate-700 px-2 py-4 text-[11px] font-bold uppercase tracking-wider text-white">{label}</th>)}</tr></thead>
      <tbody>{loading ? <tr><td colSpan={8} className="p-12 text-center text-sm text-slate-400">Loading bids...</td></tr>
        : !error && !groups.length ? <tr><td colSpan={8} className="p-12 text-center text-sm text-slate-400">No {TABS.find(tab => tab.key === status)?.label.toLowerCase() || "matching"} bunch bids found.</td></tr>
          : !error && groups.map((group, index) => <BunchBidCard key={group.bid_no} group={group} serialNumber={((data?.page || 1) - 1) * 10 + index + 1} onView={onView} role={role} />)}
      </tbody>
    </table></div>
    {!loading && !error && data?.pages > 1 && <nav aria-label="Bunch bid pagination" className="flex justify-center gap-2 p-5">
      <button disabled={data.page <= 1} onClick={() => onPage(data.page - 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Prev</button>
      {Array.from({ length: Math.min(4, data.pages) }, (_, i) => Math.min(Math.max(1, data.page - 1), Math.max(1, data.pages - 3)) + i).map(page => <button key={page} onClick={() => onPage(page)} className={`rounded-lg border px-3 py-2 text-sm ${page === data.page ? "bg-blue-600 text-white" : ""}`}>{page}</button>)}
      <button disabled={data.page >= data.pages} onClick={() => onPage(data.page + 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Next</button>
    </nav>}
  </section>;
}
