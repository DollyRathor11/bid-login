import useDailyActivity from "../../hooks/useDailyActivity";
import { useEffect, useState } from "react";
import DailyActivityChart from "../../components/DailyActivityChart";
import "./UserDashboard.css";
import { useNavigate } from "react-router-dom";
import { FaFileInvoiceDollar, FaHourglassHalf, FaThumbsUp, FaThumbsDown, FaClipboardList, FaBan } from "react-icons/fa";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";

const API = import.meta.env.VITE_API_URL;
const PRODUCTS = [["all", "All Bids"], ["desktop", "Desktop"], ["aio", "AIO"], ["workstation", "Workstation"], ["printer", "Printer"], ["toner", "Toner"]];

export default function UserDashboard() {
  const [product, setProduct] = useState("all");
  const activity = useDailyActivity(product);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const token = sessionStorage.getItem("token") || localStorage.getItem("token") || "";
        const response = await fetch(`${API}/user/dashboard/?product=${product}`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load your dashboard.");
        if (!controller.signal.aborted) { setData(result); setError(""); }
      } catch (err) {
        if (!controller.signal.aborted && err.name !== "AbortError") { setError(err.message); setData(null); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    const interval = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [product]);

  const stats = data?.stats;
  const cards = [
    { label: "Total Bids", value: stats?.total, Icon: FaFileInvoiceDollar, color: "from-blue-500 to-blue-600" },
    { label: "Pending Bids", value: stats?.pending, Icon: FaHourglassHalf, color: "from-amber-400 to-amber-500" },
    { label: "Approved Bids", value: stats?.approved, Icon: FaThumbsUp, color: "from-emerald-500 to-emerald-600" },
    { label: "Re-Analyze", value: stats?.reAnalyze, Icon: FaThumbsDown, color: "from-rose-500 to-rose-600" },
    { label: "Rejected Bids", value: stats?.rejected, Icon: FaBan, color: "from-red-800 to-red-950" },
    { label: "Bids Assigned to User", value: data?.assigned, Icon: FaClipboardList, color: "from-teal-500 to-teal-600", onClick: () => navigate("/user/bid-to-be-participated") },
  ];
  const ratio = [
    { name: "Pending", value: stats?.pending || 0, color: "#f59e0b" },
    { name: "Approved", value: stats?.approved || 0, color: "#10b981" },
    { name: "Re-Analyze", value: stats?.reAnalyze || 0, color: "#f43f5e" },
    { name: "Rejected", value: stats?.rejected || 0, color: "#7f1d1d" },
  ];

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <select aria-label="Filter your bids by product" value={product} onChange={event => setProduct(event.target.value)} className="min-w-[190px] rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm">
        {PRODUCTS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    <div className="user-dashboard-cards">
      {cards.map(({ label, value, Icon, color, onClick }, index) => {
        const Tag = onClick ? "button" : "div";
        return <Tag key={label} {...(onClick ? { type: "button", onClick } : {})} className={`user-dashboard-card ${index < 3 ? "user-dashboard-card-top" : "user-dashboard-card-bottom"} relative flex min-h-[100px] min-w-0 items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-br ${color} p-5 text-left text-white shadow-md ${onClick ? "transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2" : ""}`}>
          <div aria-hidden="true" className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
          <div aria-hidden="true" className="absolute -bottom-6 -right-1 h-16 w-16 rounded-full bg-white/10" />
          <span className="relative shrink-0 rounded-xl bg-white/80 p-3 text-2xl shadow-inner" style={{ color: label === "Total Bids" ? "#2563eb" : label === "Pending Bids" ? "#f59e0b" : label === "Approved Bids" ? "#059669" : onClick ? "#0d9488" : "#e11d48" }}><Icon /></span>
          <div className="relative"><p className="text-4xl font-extrabold leading-none">{loading ? "…" : value ?? "—"}</p><p className="mt-1 text-sm font-medium">{label}</p></div>
        </Tag>;
      })}
    </div>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="min-w-0 rounded-2xl border-2 border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="mb-6 border-l-4 border-blue-600 pl-3 text-base font-extrabold uppercase text-slate-800">Daily Activity</h2>
        <DailyActivityChart {...activity} />
      </section>
      <section className="min-w-0 rounded-2xl border-2 border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="mb-6 border-l-4 border-indigo-600 pl-3 text-base font-extrabold uppercase text-slate-800">Status Ratio</h2>
        {!loading && !error && stats?.total > 0 ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={ratio} dataKey="value" nameKey="name" innerRadius={65} outerRadius={100} paddingAngle={3}>{ratio.map(item => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div> : <div className="flex h-72 items-center justify-center text-sm text-slate-400">{loading ? "Loading..." : error ? "Status unavailable" : "No submitted bids for this selection."}</div>}
      </section>
    </div>
  </div>;
}
