import { useEffect, useState } from "react";
import { useGemBidLinks } from "../../utils/gemBidLinks";
import { GemBidNo } from "../../utils/GemBidNo";

// Bids the analyser has sent to admin that admin has not priced yet (the
// admin Pending section), across all five products. View only.
const API = import.meta.env.VITE_API_URL;
const PAGE_SIZE = 10;
const PRODUCTS = [["desktop", "Desktop"], ["aio", "AIO"], ["workstation", "Workstation"], ["printer", "Printer"], ["toner", "Toner"]];

export default function AdminPricingPending() {
  const [bids, setBids] = useState([]);
  const gemBidLinks = useGemBidLinks(bids);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const lists = await Promise.all(PRODUCTS.map(async ([key, label]) => {
          const response = await fetch(`${API}/${key}-bids/list/?status=pending&role=admin`, { signal: controller.signal });
          if (!response.ok) throw new Error(`Unable to load ${label} bids.`);
          const data = await response.json();
          if (!Array.isArray(data)) throw new Error(`Invalid ${label} bid response.`);
          return data.map(bid => ({ ...bid, productKey: key, productLabel: label }));
        }));
        const time = bid => new Date(bid.updated_at || bid.created_at || 0).getTime() || 0;
        setBids(lists.flat().sort((a, b) => time(a) - time(b)));
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message || "Unable to load bids.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, []);

  const counts = Object.fromEntries(PRODUCTS.map(([key]) => [key, bids.filter(bid => bid.productKey === key).length]));
  const query = search.trim().toLowerCase();
  const rows = bids
    .filter(bid => product === "all" || bid.productKey === product)
    .filter(bid => [bid.bid_no, bid.dept_name, bid.productLabel, bid.model_number, bid.model, bid.analyser_username, bid.analyser_name, bid.analyser].some(value => String(value || "").toLowerCase().includes(query)));
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const visibleRows = rows.slice(offset, offset + PAGE_SIZE);
  const firstPage = Math.min(Math.max(1, currentPage - 1), Math.max(1, pageCount - 3));
  const pageNumbers = Array.from({ length: Math.min(4, pageCount) }, (_, index) => firstPage + index);
  const dateLabel = value => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  const chip = (key, label, count) => <button type="button" key={key} aria-pressed={product === key} onClick={() => { setProduct(key); setPage(1); }}
    className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold ${product === key ? "border-amber-500 bg-amber-500 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
    {label} <span className="ml-1 opacity-80">({count})</span>
  </button>;

  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Pricing Pending at Admin</h2>
        <p className="mt-1 text-sm text-slate-500">Bids sent to admin that are still waiting for pricing.</p>
      </div>
      {!loading && !error && <span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">{bids.length} Pending at Admin</span>}
      <input aria-label="Search bids" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search bid, model, product or analyser..." className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500 sm:max-w-sm" />
    </div>
    <div className="flex gap-2 overflow-x-auto bg-slate-50 px-5 py-3">
      {chip("all", "All", bids.length)}
      {PRODUCTS.map(([key, label]) => chip(key, label, counts[key]))}
    </div>
    {error && <div role="alert" className="m-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-slate-800 text-xs uppercase text-white"><tr>{["S.No.", "Product", "Analyser", "Department", "Bid No.", "Model", "Sent to Admin", "Status"].map(label => <th key={label} className="px-4 py-4">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? <tr><td colSpan={8} className="p-12 text-center text-slate-400">Loading bids...</td></tr> : !error && rows.length === 0 ? <tr><td colSpan={8} className="p-12 text-center text-slate-400">No bids are waiting for admin pricing.</td></tr> : !error && visibleRows.map((bid, index) => <tr key={`${bid.productKey}-${bid.id}`} className="hover:bg-slate-50">
            <td className="px-4 py-4">{offset + index + 1}</td>
            <td className="px-4 py-4"><span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{bid.productLabel}</span></td>
            <td className="px-4 py-4">{bid.analyser_username || bid.analyser_name || bid.analyser || bid.analyzed_by || "—"}</td>
            <td className="max-w-48 break-words px-4 py-4">{bid.dept_name || "—"}</td>
            <td className="max-w-60 break-words px-4 py-4 font-semibold text-blue-600"><GemBidNo bidNo={bid.bid_no} links={gemBidLinks} fallback="—" /></td>
            <td className="max-w-48 break-words px-4 py-4">{bid.model_number || bid.model || bid.model_no || "—"}</td>
            <td className="whitespace-nowrap px-4 py-4">{dateLabel(bid.updated_at || bid.created_at)}</td>
            <td className="px-4 py-4"><span className="whitespace-nowrap rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Pricing Pending</span></td>
          </tr>)}
        </tbody>
      </table>
    </div>
    {!loading && !error && rows.length > 0 && <div className="flex flex-col items-center justify-center gap-3 border-t border-slate-200 px-5 py-4">
      <nav aria-label="Pending at admin pagination" className="flex items-center gap-2">
        <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Prev</button>
        {pageNumbers.map(number => <button type="button" key={number} aria-label={`Page ${number}`} aria-current={number === currentPage ? "page" : undefined} onClick={() => setPage(number)} className={`min-w-9 rounded-lg border px-3 py-2 text-sm font-semibold ${number === currentPage ? "border-amber-500 bg-amber-500 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{number}</button>)}
        <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
      </nav>
    </div>}
  </section>;
}
