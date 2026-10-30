import { useEffect, useState } from "react";
import { useGemBidLinks } from "../../utils/gemBidLinks";
import { GemBidNo } from "../../utils/GemBidNo";

// Analyser dashboard's "Pending at Admin" section: the logged-in analyser's
// own bids of this product that wait for Admin's pricing (approval).
const API_URL = import.meta.env.VITE_API_URL;
const token = () => sessionStorage.getItem("token") || localStorage.getItem("token") || "";
const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function usePendingAtAdmin(product) {
  const [state, setState] = useState({ rows: [], loading: true, error: "" });
  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/analyser/pending-at-admin/?product=${product}`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Bids pending at Admin could not be loaded.");
        if (active) setState({ rows: data.results || [], loading: false, error: "" });
      })
      .catch((error) => { if (active) setState({ rows: [], loading: false, error: error.message }); });
    return () => { active = false; };
  }, [product]);
  return state;
}

const formatDate = (value) => (value ? dateFormat.format(new Date(value)) : "—");

export function PendingAtAdminTab({ product, active, onClick }) {
  const { rows } = usePendingAtAdmin(product);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-4 px-2 text-sm font-semibold transition-all flex items-center gap-2 outline-none focus:outline-none focus-visible:outline-none ${
        active ? "text-violet-600 border-b-2 border-violet-600" : "text-gray-500 hover:text-gray-700"
      }`}
    >
      <span>🕒</span>
      Pending at Admin
      {rows.length > 0 && (
        <span className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold leading-none text-white shadow-sm">
          {rows.length > 99 ? "99+" : rows.length}
        </span>
      )}
    </button>
  );
}

export default function PendingAtAdmin({ product }) {
  const { rows, loading, error } = usePendingAtAdmin(product);
  const gemBidLinks = useGemBidLinks(rows);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="w-full overflow-x-auto">
      <p className="px-6 pt-4 text-sm text-slate-500">
        Your bids sent to Admin that are still waiting for pricing (approval).
      </p>
      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">⚠️ {error}</div>
      )}
      <table className="mt-3 w-full table-fixed text-left border-separate border-spacing-0">
        <colgroup>
          <col className="w-[7%]" />
          <col className="w-[18%]" />
          <col className="w-[22%]" />
          <col className="w-[18%]" />
          <col className="w-[9%]" />
          <col className="w-[13%]" />
          <col className="w-[13%]" />
        </colgroup>
        <thead>
          <tr className="bg-slate-800 text-white">
            {["S.No.", "Bid No", "Department", "Model", "Qty", "Submitted On", "End Date"].map((head) => (
              <th key={head} className="px-3 py-4 text-center text-[11px] font-bold uppercase tracking-wide">{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">Loading...</td></tr>
          )}
          {!loading && !rows.length && !error && (
            <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">No bids are waiting for Admin's pricing.</td></tr>
          )}
          {!loading && rows.map((row, index) => {
            const ended = row.end_date && row.end_date < today;
            return (
              <tr key={row.id} className="bg-white hover:bg-gray-50">
                <td className="border-b border-gray-100 px-3 py-4 text-center text-sm font-bold text-gray-700">{index + 1}</td>
                <td className="border-b border-gray-100 px-3 py-4 text-center text-sm font-bold text-blue-600 break-all">
                  <GemBidNo bidNo={row.bid_no} links={gemBidLinks} fallback="—" />
                </td>
                <td className="truncate border-b border-gray-100 px-3 py-4 text-center text-sm text-gray-700" title={row.dept_name}>{row.dept_name || "—"}</td>
                <td className="break-all border-b border-gray-100 px-3 py-4 text-center text-sm text-gray-700">{row.model || "—"}</td>
                <td className="border-b border-gray-100 px-3 py-4 text-center text-sm text-gray-700">{row.qty ?? "—"}</td>
                <td className="border-b border-gray-100 px-3 py-4 text-center text-sm text-gray-700">{formatDate(row.submitted_on)}</td>
                <td className={`border-b border-gray-100 px-3 py-4 text-center text-sm font-semibold ${ended ? "text-red-600" : "text-gray-800"}`}
                  title={ended ? "End date has passed" : undefined}>
                  {formatDate(row.end_date)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
