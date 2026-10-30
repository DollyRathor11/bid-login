import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGemBidLinks } from "../../utils/gemBidLinks";
import { GemBidNo } from "../../utils/GemBidNo";

// The logged-in analyser's own bids that they sent to admin and admin has not
// priced yet, across the products they work on. Each opens for editing.
const API = import.meta.env.VITE_API_URL;
const token = () => sessionStorage.getItem("token") || localStorage.getItem("token") || "";
const PAGE_SIZE = 10;
const PRODUCTS = [["desktop", "Desktop"], ["aio", "AIO"], ["workstation", "Workstation"], ["printer", "Printer"], ["toner", "Toner"]];

export default function AdminPricingPending() {
  const navigate = useNavigate();
  const [bids, setBids] = useState([]);
  const gemBidLinks = useGemBidLinks(bids);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [product, setProduct] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`${API}/analyser/pending-at-admin/`, {
          headers: { Authorization: `Bearer ${token()}` },
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Unable to load bids.");
        const labels = Object.fromEntries(PRODUCTS);
        const time = bid => new Date(bid.submitted_on || 0).getTime() || 0;
        setError("");
        setBids((data.results || [])
          .map(bid => ({ ...bid, productKey: bid.product, productLabel: labels[bid.product] || bid.product }))
          .sort((a, b) => time(b) - time(a)));
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message || "Unable to load bids.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    // Reload every 30 seconds and on returning to the tab, so a bid admin has
    // approved meanwhile drops off the list.
    load();
    const timer = setInterval(load, 30000);
    window.addEventListener("focus", load);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, []);

  const counts = Object.fromEntries(PRODUCTS.map(([key]) => [key, bids.filter(bid => bid.productKey === key).length]));
  // Only the products this analyser has bids waiting in.
  const workedProducts = PRODUCTS.filter(([key]) => counts[key] > 0);
  const editBid = bid => navigate(`/analyser-dashboard/${bid.productKey}/bid/${bid.id}`, { state: { readOnly: false, hideTicks: true } });
  const rows = bids
    .filter(bid => product === "all" || bid.productKey === product);
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
    <div className="flex gap-2 overflow-x-auto bg-slate-50 px-5 py-3">
      {chip("all", "All", bids.length)}
      {workedProducts.map(([key, label]) => chip(key, label, counts[key]))}
    </div>
    {error && <div role="alert" className="m-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-slate-800 text-xs uppercase text-white"><tr>{["S.No.", "Product", "Department", "Bid No.", "Model", "Qty", "Sent to Admin", "End Date", "Action"].map(label => <th key={label} className="px-4 py-4">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? <tr><td colSpan={9} className="p-12 text-center text-slate-400">Loading bids...</td></tr> : !error && rows.length === 0 ? <tr><td colSpan={9} className="p-12 text-center text-slate-400">No bids are waiting for admin pricing.</td></tr> : !error && visibleRows.map((bid, index) => <tr key={`${bid.productKey}-${bid.id}`} className="hover:bg-slate-50">
            <td className="px-4 py-4">{offset + index + 1}</td>
            <td className="px-4 py-4"><span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{bid.productLabel}</span></td>
            <td className="max-w-48 break-words px-4 py-4">{bid.dept_name || "—"}</td>
            <td className="max-w-60 break-words px-4 py-4 font-semibold text-blue-600"><GemBidNo bidNo={bid.bid_no} links={gemBidLinks} fallback="—" /></td>
            <td className="max-w-48 break-words px-4 py-4">{bid.model || "—"}</td>
            <td className="px-4 py-4">{bid.qty ?? "—"}</td>
            <td className="whitespace-nowrap px-4 py-4">{dateLabel(bid.submitted_on)}</td>
            <td className="whitespace-nowrap px-4 py-4">{dateLabel(bid.end_date).split(",")[0]}</td>
            <td className="px-4 py-4">
              <button type="button" onClick={() => editBid(bid)} className="rounded bg-amber-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-amber-700">Edit</button>
            </td>
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
