import { useEffect, useState } from "react";
import { FaEye, FaTrash } from "react-icons/fa";

const API_BASE = import.meta.env.VITE_API_URL;
const authHeader = () => ({ Authorization: `Bearer ${sessionStorage.getItem("token") || localStorage.getItem("token") || ""}` });
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-");
const formatDateTime = (value) => (value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-");

function RepresentationsModal({ bid, onClose }) {
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
          <h2 className="text-base font-bold text-sky-800">My Representations</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-2xl font-bold text-gray-400 hover:text-gray-700">&times;</button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-6">
          <div className="mb-6 grid grid-cols-1 gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Bid No.", bid.bid_no || "-"],
              ["Department Name And Address", bid.department || "-"],
              ["Items", bid.item_name || "-"],
              ["Quantity", bid.quantity ?? "-"],
              ["Start Date", formatDateTime(bid.start_date)],
              ["End Date", formatDateTime(bid.end_date)],
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-300 text-gray-900">
                <tr>
                  <th className="w-48 px-3 py-3 font-semibold">Bid Section</th>
                  <th className="px-3 py-3 font-semibold">Query/Representation</th>
                  <th className="w-44 px-3 py-3 font-semibold">Submitted On</th>
                </tr>
              </thead>
              <tbody>
                {(bid.representations || []).map((row, index) => (
                  <tr key={index} className="border-b border-gray-100 align-top">
                    <td className="px-3 py-3 text-gray-700">{row.bid_section || "-"}</td>
                    <td className="whitespace-pre-line px-3 py-3 text-gray-700">{row.representation}</td>
                    <td className="px-3 py-3 text-gray-700">{row.submitted_on || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RepresentationBidsPanel() {
  const [rows, setRows] = useState([]);
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
      const response = await fetch(`${API_BASE}/gem/representation-results/`, {
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
        const response = await fetch(`${API_BASE}/gem/representation-results/`, { headers: authHeader() });
        const contentType = response.headers.get("content-type") || "";
        const payload = contentType.includes("application/json") ? await response.json() : {};
        if (!response.ok) {
          throw new Error(payload.error || `Representation bids could not be loaded (HTTP ${response.status}).`);
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

  if (loading) return <div className="py-16 text-center text-sm font-medium text-gray-500">Loading representation bids...</div>;
  if (error) return <div className="m-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;

  return (
    <div className="bg-white">
      <div className="flex min-h-[76px] flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-5 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-lg font-bold text-slate-900">My Representation</h2>
          <span className="rounded border border-slate-300 bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white">
            Bids ({rows.length})
          </span>
        </div>
        {selectedIds.size > 0 && (
          <button
            type="button"
            onClick={() => deleteIds([...selectedIds], `Permanently delete ${selectedIds.size} selected representation bid(s) from the database?`)}
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
            <th className="w-56 px-4 py-4">Items</th>
            <th className="w-36 px-4 py-4">End Date</th>
            <th className="w-40 px-4 py-4">Submitted On</th>
            <th className="w-40 px-4 py-4">Representations</th>
            <th className="w-28 px-4 py-4 text-center">
              <div className="flex items-center justify-center gap-3">
                <input
                  type="checkbox"
                  aria-label="Select all representation bids"
                  checked={rows.length > 0 && selectedIds.size === rows.length}
                  onChange={(event) => setSelectedIds(event.target.checked ? new Set(rows.map((row) => row.id)) : new Set())}
                  className="h-4 w-4 accent-red-600"
                />
                <span>Action</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className="border-b border-gray-100 align-top hover:bg-gray-50">
              <td className="px-4 py-4 text-sm font-bold text-gray-700">{index + 1}</td>
              <td className="px-4 py-4 text-sm font-bold text-blue-700">{row.bid_no}</td>
              <td className="px-4 py-4 text-sm text-gray-700">{row.department || "-"}</td>
              <td className="px-4 py-4 text-sm font-medium text-gray-800">{row.item_name || "-"}</td>
              <td className="px-4 py-4 text-sm text-gray-700">{formatDate(row.end_date)}</td>
              <td className="px-4 py-4 text-sm text-gray-700">{formatDateTime(row.submitted_at)}</td>
              <td className="px-4 py-4">
                <button
                  type="button"
                  onClick={() => setSelected(row)}
                  className="inline-flex items-center gap-1.5 text-left font-bold text-sky-700 hover:text-sky-900"
                >
                  <span>{(row.representations || []).length} Representation{(row.representations || []).length === 1 ? "" : "s"}</span>
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
          {rows.length === 0 && (
            <tr><td colSpan="8" className="py-16 text-center text-sm text-gray-500">
              No representations yet. Log in to GeM with the Representation ID and click My Representation in the extension.
            </td></tr>
          )}
        </tbody>
      </table>
      </div>
      {selected && <RepresentationsModal bid={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
