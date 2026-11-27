import { useState } from "react";
import BunchBidCard from "./BunchBidCard";
import { upsRequest } from "../Ups/upsApi";

const TABS = [
  { key: "pending", label: "Pending", icon: "⌛", color: "text-amber-600", badge: "bg-amber-100 text-amber-700" },
  { key: "approved", label: "Approved", icon: "✅", color: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700" },
  { key: "re-analyze", label: "Re-Analyze", icon: "⚠️", color: "text-rose-600", badge: "bg-rose-100 text-rose-700" },
  { key: "rejected", label: "Rejected", icon: "⛔", color: "text-red-800", badge: "bg-red-100 text-red-800" },
];

export default function AnalyserBunchList({ data, loading, error, status, onStatus, onPage, onView, onDeleted, role = "analyser", dashboard = false }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const approvedActions = role === "analyser" && status === "approved";
  const adminDelete = role === "admin" && status === "approved";
  const headers = ["S.No.", "Bid No", "Department", "Qty", role === "admin" ? "Analyser" : "Submitted By", "End Date", "Status", "Action"];
  if (approvedActions) headers.push("Approved Details For Bidding", "Download Docs for the Bid", "Delete");
  const tabs = dashboard ? [{ key: "all", label: "All", color: "text-blue-600" }, ...TABS] : TABS;
  const groups = (data?.results || []).map(group => ({ ...group, items: group.items.filter(item => dashboard || status === "all" || item.status === status) })).filter(group => group.items.length);
  const pageIds = adminDelete ? groups.map(group => group.bid_no)
    : approvedActions ? groups.flatMap(group => group.items.filter(item => item.can_delete).map(item => item.id)) : [];
  const selected = pageIds.filter(id => selectedIds.has(id));
  const allSelected = pageIds.length > 0 && selected.length === pageIds.length;
  const select = (ids, checked) => setSelectedIds(current => {
    const next = new Set(current);
    ids.forEach(id => checked ? next.add(id) : next.delete(id));
    return next;
  });
  const changePage = page => {
    setSelectedIds(new Set());
    setDeleteError("");
    onPage(page);
  };
  async function deleteBids(ids, label) {
    if (!ids.length || deleting || !window.confirm(`Permanently delete ${label}?`)) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const path = adminDelete ? "bunch-bids/delete-approved/"
        : ids.length === 1 ? `ups-bids/${ids[0]}/delete-approved/` : "ups-bids/bulk-delete-approved/";
      const body = adminDelete ? JSON.stringify({ bid_numbers: ids }) : ids.length > 1 ? JSON.stringify({ ids }) : undefined;
      await upsRequest(path, { method: "DELETE", body });
      select(ids, false);
      onDeleted();
    } catch (err) { setDeleteError(err.message); }
    finally { setDeleting(false); }
  }
  const deletion = { selectedIds, select, deleteBids, deleting };
  return <section aria-label={role === "admin" ? "Bunch Bid Approval" : "Bunch Bids"} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
    <div role="tablist" aria-label="Bunch bid status" className="flex gap-2 overflow-x-auto bg-gray-50 px-6 pt-4">
      {tabs.map(tab => <button type="button" role="tab" aria-selected={status === tab.key} key={tab.key} onClick={() => { setSelectedIds(new Set()); setDeleteError(""); onStatus(tab.key); }}
        className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-4 text-sm font-medium transition ${status === tab.key ? `border-current bg-white ${tab.color}` : "border-transparent text-slate-500 hover:bg-white"}`}><span aria-hidden="true">{tab.icon}</span>{tab.label}</button>)}
    </div>
    {selected.length > 0 && <div className="flex justify-end px-5 py-3">
      <button type="button" disabled={deleting} onClick={() => deleteBids(selected, adminDelete
        ? `the approved products of ${selected.length} selected bunch bids` : `${selected.length} selected UPS bids`)}
        className="rounded-md bg-red-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
        {deleting ? "Deleting..." : `Delete Selected (${selected.length})`}
      </button>
    </div>}
    {(approvedActions || adminDelete) && deleteError && <p role="alert" className="mx-6 my-4 text-sm text-red-700">{deleteError}</p>}
    {error && <p role="alert" className="mx-6 my-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    <div className="overflow-x-auto"><table className={`w-full table-fixed border-separate border-spacing-0 text-left ${approvedActions ? "min-w-[1170px]" : adminDelete ? "min-w-[1000px]" : "min-w-[850px]"}`}>
      <colgroup>{(approvedActions ? [4, 14, 13, 5, 10, 9, 8, 6, 11, 12, 8] : [6, 16, 18, 6, 15, 13, 13, adminDelete ? 16 : 13]).map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
      <thead><tr className="bg-slate-800">{headers.map(label => <th key={label} className={`border-b border-slate-700 px-2 py-4 text-[11px] font-bold uppercase tracking-wider text-white ${approvedActions ? "" : "whitespace-nowrap"}`}>
        {label === "Delete" || (adminDelete && label === "Action") ? <label className="flex items-center justify-center gap-2">
          <input type="checkbox" aria-label={`Select all approved ${adminDelete ? "bunch" : "UPS"} bids on this page`} className="h-4 w-4 accent-red-600"
            ref={input => { if (input) input.indeterminate = selected.length > 0 && !allSelected; }}
            checked={allSelected} disabled={!pageIds.length || deleting} onChange={event => select(pageIds, event.target.checked)} />
          {label}
        </label> : label}
      </th>)}</tr></thead>
      <tbody>{loading ? <tr><td colSpan={headers.length} className="p-12 text-center text-sm text-slate-400">Loading bids...</td></tr>
        : !error && !groups.length ? <tr><td colSpan={headers.length} className="p-12 text-center text-sm text-slate-400">No {TABS.find(tab => tab.key === status)?.label.toLowerCase() || "matching"} bunch bids found.</td></tr>
          : !error && groups.map((group, index) => <BunchBidCard key={group.bid_no} group={group} serialNumber={((data?.page || 1) - 1) * 10 + index + 1}
            onView={onView} role={role} dashboard={dashboard} approvedActions={approvedActions} adminDelete={adminDelete} deletion={deletion} />)}
      </tbody>
    </table></div>
    {!loading && !error && data?.pages > 1 && <nav aria-label="Bunch bid pagination" className="flex justify-center gap-2 p-5">
      <button disabled={data.page <= 1} onClick={() => changePage(data.page - 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Prev</button>
      {Array.from({ length: Math.min(4, data.pages) }, (_, i) => Math.min(Math.max(1, data.page - 1), Math.max(1, data.pages - 3)) + i).map(page => <button key={page} onClick={() => changePage(page)} className={`rounded-lg border px-3 py-2 text-sm ${page === data.page ? "bg-blue-600 text-white" : ""}`}>{page}</button>)}
      <button disabled={data.page >= data.pages} onClick={() => changePage(data.page + 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Next</button>
    </nav>}
  </section>;
}
