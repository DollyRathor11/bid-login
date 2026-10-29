import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL;
const PRODUCTS = [["desktop", "Desktop"], ["aio", "AIO"], ["workstation", "Workstation"], ["printer", "Printer"], ["toner", "Toner"]];

export default function AllBidsApproval() {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const token = sessionStorage.getItem("token") || localStorage.getItem("token") || "";
        const lists = await Promise.all(PRODUCTS.map(async ([key, label]) => {
          const response = await fetch(`${API}/${key}-bids/list/?status=approved&role=admin`, {
            signal: controller.signal, headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) throw new Error(`Unable to load approved ${label} bids.`);
          const data = await response.json();
          if (!Array.isArray(data)) throw new Error(`Invalid ${label} bid response.`);
          return data.map(bid => ({ ...bid, productKey: key, productLabel: label }));
        }));
        if (controller.signal.aborted) return;
        setBids(lists.flat().sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)));
        setError("");
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, []);

  const query = search.trim().toLowerCase();
  const rows = bids.filter(bid => [bid.bid_no, bid.dept_name, bid.productLabel, bid.model_number, bid.model, bid.analyser_username, bid.analyser_name, bid.analyser].some(value => String(value || "").toLowerCase().includes(query)));
  const dateLabel = value => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">All Bids Approval</h2>
        <p className="mt-1 text-sm text-slate-500">Approved bids across Desktop, AIO, Workstation, Printer and Toner.</p>
      </div>
      {!loading && !error && <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">{bids.length} Approved</span>}
      <input aria-label="Search approved bids" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search bid, model, product or analyser..." className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 sm:max-w-sm" />
    </div>
    {error && <div role="alert" className="m-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-slate-800 text-xs uppercase text-white"><tr>{["S.No.", "Product", "Analyser", "Department", "Bid No.", "Model", "Submitted On", "Status"].map(label => <th key={label} className="px-4 py-4">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? <tr><td colSpan={8} className="p-12 text-center text-slate-400">Loading approved bids...</td></tr> : !error && rows.length === 0 ? <tr><td colSpan={8} className="p-12 text-center text-slate-400">No approved bids found.</td></tr> : !error && rows.map((bid, index) => <tr key={`${bid.productKey}-${bid.id}`} className="hover:bg-slate-50">
            <td className="px-4 py-4">{index + 1}</td>
            <td className="px-4 py-4"><span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{bid.productLabel}</span></td>
            <td className="px-4 py-4">{bid.analyser_username || bid.analyser_name || bid.analyser || bid.analyzed_by || "—"}</td>
            <td className="max-w-48 break-words px-4 py-4">{bid.dept_name || "—"}</td>
            <td className="max-w-60 break-words px-4 py-4 font-semibold text-blue-600">{bid.bid_no || "—"}</td>
            <td className="max-w-48 break-words px-4 py-4">{bid.model_number || bid.model || bid.model_no || "—"}</td>
            <td className="whitespace-nowrap px-4 py-4">{dateLabel(bid.created_at)}</td>
            <td className="px-4 py-4"><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Approved</span></td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </section>;
}
