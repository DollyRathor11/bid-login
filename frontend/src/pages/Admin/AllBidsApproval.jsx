import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useGemBidLinks } from "../../utils/gemBidLinks";
import { GemBidNo } from "../../utils/GemBidNo";

const API = import.meta.env.VITE_API_URL;
const PAGE_SIZE = 10;
const TABS = [
  { key: "pending", label: "Pending", icon: "⌛", color: "text-amber-600", badge: "bg-amber-100 text-amber-700" },
  { key: "re-analyze", label: "Re-Analyze", icon: "⚠", color: "text-rose-600", badge: "bg-rose-100 text-rose-700" },
  { key: "approved", label: "Approved", icon: "✓", color: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700" },
  { key: "rejected", label: "Rejected", icon: "⛔", color: "text-red-800", badge: "bg-red-100 text-red-800" },
];
const PRODUCTS = [["desktop", "Desktop"], ["aio", "AIO"], ["workstation", "Workstation"], ["printer", "Printer"], ["toner", "Toner"]];

export default function AllBidsApproval() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const activeTab = TABS.find(tab => tab.key === params.get("status")) || TABS[0];
  const [bids, setBids] = useState([]);
  const gemBidLinks = useGemBidLinks(bids);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if ((sessionStorage.getItem("role") || localStorage.getItem("role")) !== "admin") {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      setBids([]);
      try {
        const token = sessionStorage.getItem("token") || localStorage.getItem("token") || "";
        const lists = await Promise.all(PRODUCTS.map(async ([key, label]) => {
          const response = await fetch(`${API}/${key}-bids/list/?status=${activeTab.key}&role=admin`, {
            signal: controller.signal, headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) throw new Error(`Unable to load ${activeTab.label} ${label} bids.`);
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
  }, [activeTab.key]);

  const query = search.trim().toLowerCase();
  const rows = bids.filter(bid => [bid.bid_no, bid.dept_name, bid.productLabel, bid.model_number, bid.model, bid.analyser_username, bid.analyser_name, bid.analyser].some(value => String(value || "").toLowerCase().includes(query)));
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const visibleRows = rows.slice(offset, offset + PAGE_SIZE);
  const firstPage = Math.min(Math.max(1, currentPage - 1), Math.max(1, pageCount - 3));
  const pageNumbers = Array.from({ length: Math.min(4, pageCount) }, (_, index) => firstPage + index);
  const dateLabel = value => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  return <main className="min-h-screen w-full bg-slate-50 p-4 sm:p-6">
    <button type="button" onClick={() => navigate("/admin-dashboard")} className="mb-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100">← Back</button>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">All Bids Products Approval</h2>
        <p className="mt-1 text-sm text-slate-500">Desktop, AIO, Workstation, Printer and Toner bids in one place.</p>
      </div>
      <input aria-label="Search bids" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search bid, model, product or analyser..." className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 sm:max-w-sm" />
    </div>
    <div role="tablist" aria-label="Bid approval status" className="flex gap-2 overflow-x-auto bg-slate-50 px-5 pt-3">
      {TABS.map(tab => <button type="button" role="tab" aria-selected={activeTab.key === tab.key} key={tab.key} onClick={() => { setParams({ status: tab.key }); setPage(1); }} className={`whitespace-nowrap border-b-2 px-5 py-4 text-sm font-semibold ${activeTab.key === tab.key ? `rounded-t-xl border-current bg-white shadow-sm ${tab.color}` : "border-transparent text-slate-500 hover:bg-white"}`}><span aria-hidden="true" className="mr-2">{tab.icon}</span>{tab.label}</button>)}
    </div>
    {error && <div role="alert" className="m-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-slate-800 text-xs uppercase text-white"><tr>{["S.No.", "Product", "Analyser", "Department", "Bid No.", "Model", "Submitted On", "Status", "Action"].map(label => <th key={label} className="px-4 py-4">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? <tr><td colSpan={9} className="p-12 text-center text-slate-400">Loading bids...</td></tr> : !error && rows.length === 0 ? <tr><td colSpan={9} className="p-12 text-center text-slate-400">No {activeTab.label.toLowerCase()} bids found.</td></tr> : !error && visibleRows.map((bid, index) => <tr key={`${bid.productKey}-${bid.id}`} className="hover:bg-slate-50">
            <td className="px-4 py-4">{offset + index + 1}</td>
            <td className="px-4 py-4"><span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{bid.productLabel}</span></td>
            <td className="px-4 py-4">{bid.analyser_username || bid.analyser_name || bid.analyser || bid.analyzed_by || "—"}</td>
            <td className="max-w-48 break-words px-4 py-4">{bid.dept_name || "—"}</td>
            <td className="max-w-60 break-words px-4 py-4 font-semibold text-blue-600"><GemBidNo bidNo={bid.bid_no} links={gemBidLinks} fallback="—" /></td>
            <td className="max-w-48 break-words px-4 py-4">{bid.model_number || bid.model || bid.model_no || "—"}</td>
            <td className="whitespace-nowrap px-4 py-4">{dateLabel(bid.created_at)}</td>
            <td className="px-4 py-4"><span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${activeTab.badge}`}>{activeTab.label}</span></td>
            <td className="px-4 py-4"><button type="button" onClick={() => navigate(`/admin-dashboard/${bid.productKey}-bid-approval?status=${activeTab.key}&bid=${bid.id}`)} className="rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">View</button></td>
          </tr>)}
        </tbody>
      </table>
    </div>
    {!loading && !error && rows.length > 0 && <div className="flex flex-col items-center justify-center gap-3 border-t border-slate-200 px-5 py-4">
      <nav aria-label="Approved bids pagination" className="flex items-center gap-2">
        <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Prev</button>
        {pageNumbers.map(number => <button type="button" key={number} aria-label={`Page ${number}`} aria-current={number === currentPage ? "page" : undefined} onClick={() => setPage(number)} className={`min-w-9 rounded-lg border px-3 py-2 text-sm font-semibold ${number === currentPage ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{number}</button>)}
        <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
      </nav>
    </div>}
  </section>
  </main>;
}
