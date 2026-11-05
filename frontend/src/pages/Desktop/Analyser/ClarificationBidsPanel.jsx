import { useEffect, useState } from "react";
import { FaEye, FaTrash } from "react-icons/fa";

const API_BASE = import.meta.env.VITE_API_URL;
const authHeader = () => ({ Authorization: `Bearer ${sessionStorage.getItem("token") || localStorage.getItem("token") || ""}` });
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-");
const formatDateTime = (value) => (value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-");

// GeM popup rows are stored as they were read, so the columns follow
// whatever headings that popup had.
function PopupRowsTable({ title, rows, emptyText }) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-sm font-bold text-sky-800">{title}</h3>
      <div className="overflow-x-auto border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-300 text-gray-900">
            <tr>
              {columns.map((column) => <th key={column} className="px-3 py-3 font-semibold">{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-b border-gray-100 align-top">
                {columns.map((column) => <td key={column} className="whitespace-pre-line px-3 py-3 text-gray-700">{row[column] || "-"}</td>)}
              </tr>
            ))}
            {!rows.length && (
              <tr><td className="py-10 text-center text-gray-500">{emptyText}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClarificationHistoryModal({ bid, onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" onMouseDown={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-5">
          <h2 className="text-base font-bold text-sky-800">Clarification History</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-2xl font-bold text-gray-400 hover:text-gray-700">&times;</button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-6">
          <div className="mb-6 grid grid-cols-1 gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Bid No.", bid.bid_no || "-"],
              ["Department Name And Address", bid.department || "-"],
              ["Clarification Date", formatDateTime(bid.clarification_at)],
              ["Last Date for Seller Response", formatDateTime(bid.last_response_date)],
              ["Items", bid.item_name || "-"],
              ["Clarification Status", bid.clarification_status || (bid.is_pending ? "Pending Clarification" : "Clarification")],
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p>
              </div>
            ))}
          </div>
          <PopupRowsTable
            title="Clarification History"
            rows={bid.history || []}
            emptyText="Clarification history has not been synced from GeM yet."
          />
          {bid.is_pending && (
            <PopupRowsTable
              title="Clarification Request Details"
              rows={bid.request_details || []}
              emptyText="Clarification request details have not been synced from GeM yet."
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function ClarificationBidsPanel() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  const deleteIds = async (ids, confirmText) => {
    if (!ids.length || !window.confirm(confirmText)) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/gem/clarification-results/`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ ids }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Selected bids could not be deleted.");
      const deletedIds = new Set(payload.deleted_ids || ids);
      setRows((current) => current.filter((item) => !deletedIds.has(item.id)));
      setSelectedIds((current) => new Set([...current].filter((id) => !deletedIds.has(id))));
      if (selected && deletedIds.has(selected.id)) setSelected(null);
    } catch (err) {
      setError(err.message || "Selected bids could not be deleted.");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(`${API_BASE}/gem/clarification-results/`, { headers: authHeader() });
        const contentType = response.headers.get("content-type") || "";
        const payload = contentType.includes("application/json") ? await response.json() : {};
        if (!response.ok) {
          throw new Error(payload.error || `Clarification bids could not be loaded (HTTP ${response.status}).`);
        }
        if (active) setRows(payload.results || []);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    const timer = window.setInterval(load, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  if (loading) return <div className="py-16 text-center text-sm font-medium text-gray-500">Loading clarification bids...</div>;
  if (error) return <div className="m-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;

  const pendingCount = rows.filter((row) => row.is_pending).length;
  const visibleRows = filter === "pending" ? rows.filter((row) => row.is_pending) : rows;

  return (
    <div className="bg-white">
      <div className="flex min-h-[76px] flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-5 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-lg font-bold text-slate-900">Clarification Bid</h2>
          <div className="flex overflow-hidden rounded border border-slate-300 text-sm font-semibold">
            {[["all", `All (${rows.length})`], ["pending", `Pending Clarification (${pendingCount})`]].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => { setFilter(key); setSelectedIds(new Set()); }}
                className={`px-3 py-1.5 ${filter === key ? "bg-slate-800 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {selectedIds.size > 0 && (
          <button
            type="button"
            onClick={() => deleteIds([...selectedIds], `Permanently delete ${selectedIds.size} selected clarification bid(s) from the database?`)}
            disabled={deleting}
            className="inline-flex min-h-9 items-center gap-2 rounded bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FaTrash aria-hidden="true" />
            {deleting ? "Deleting..." : `Delete Selected (${selectedIds.size})`}
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
      <table className="min-w-[1040px] w-full text-left">
        <thead className="bg-slate-800 text-[11px] uppercase tracking-wider text-white">
          <tr>
            <th className="w-12 px-4 py-4">S.No.</th>
            <th className="w-48 px-4 py-4">Bid No.</th>
            <th className="px-4 py-4">Department Name And Address</th>
            <th className="w-44 px-4 py-4">Clarification Date</th>
            <th className="w-44 px-4 py-4">Last Date</th>
            <th className="w-56 px-4 py-4">Items</th>
            <th className="w-52 px-4 py-4">Clarification Status</th>
            <th className="w-28 px-4 py-4 text-center">
              <div className="flex items-center justify-center gap-3">
                <input
                  type="checkbox"
                  aria-label="Select all clarification bids"
                  checked={visibleRows.length > 0 && selectedIds.size === visibleRows.length}
                  onChange={(event) => setSelectedIds(event.target.checked ? new Set(visibleRows.map((row) => row.id)) : new Set())}
                  className="h-4 w-4 accent-red-600"
                />
                <span>Action</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, index) => (
            <tr key={row.id} className="border-b border-gray-100 align-top hover:bg-gray-50">
              <td className="px-4 py-4 text-sm font-bold text-gray-700">{index + 1}</td>
              <td className="px-4 py-4 text-sm font-bold text-blue-700">{row.bid_no}</td>
              <td className="px-4 py-4 text-sm text-gray-700">{row.department || "-"}</td>
              <td className="px-4 py-4 text-sm text-gray-700">{formatDate(row.clarification_at)}</td>
              <td className={`px-4 py-4 text-sm ${row.is_pending && row.last_response_date ? "font-bold text-red-600" : "text-gray-700"}`}>
                {row.is_pending ? formatDateTime(row.last_response_date) : "-"}
              </td>
              <td className="px-4 py-4 text-sm font-medium text-gray-800">{row.item_name || "-"}</td>
              <td className="px-4 py-4">
                <button
                  type="button"
                  onClick={() => setSelected(row)}
                  className={`inline-flex items-center gap-1.5 text-left font-bold ${row.is_pending ? "text-amber-600 hover:text-amber-800" : "text-sky-700 hover:text-sky-900"}`}
                >
                  <span>{row.is_pending ? "Pending Clarification" : row.clarification_status || "Clarification"}</span>
                  <FaEye className="shrink-0 text-lg text-blue-600" aria-hidden="true" />
                </button>
              </td>
              <td className="px-4 py-4 text-center">
                <div className="flex items-center justify-center gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Select bid ${row.bid_no}`}
                    checked={selectedIds.has(row.id)}
                    onChange={(event) => setSelectedIds((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(row.id);
                      else next.delete(row.id);
                      return next;
                    })}
                    className="h-4 w-4 accent-red-600"
                  />
                  <button
                    type="button"
                    onClick={() => deleteIds([row.id], `Permanently delete bid ${row.bid_no} from the database?`)}
                    className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                    title="Permanently delete from database"
                    aria-label={`Permanently delete bid ${row.bid_no}`}
                  >
                    <FaTrash className="text-sm" aria-hidden="true" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {visibleRows.length === 0 && (
            <tr><td colSpan="8" className="py-16 text-center text-sm text-gray-500">
              {filter === "pending" ? "No pending clarifications." : "No clarification bids have been synced from GeM yet."}
            </td></tr>
          )}
        </tbody>
      </table>
      </div>
      {selected && <ClarificationHistoryModal bid={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
