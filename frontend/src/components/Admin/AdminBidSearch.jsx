import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export function BidSearchForm({ initialQuery = "" }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);
  return <form onSubmit={event => {
    event.preventDefault();
    if (query.trim().length >= 3) navigate(`/admin-dashboard/bid-search?q=${encodeURIComponent(query.trim())}`);
  }} className="flex min-w-[240px] flex-1 items-center gap-2">
    <input aria-label="Search bid number" value={query} onChange={event => setQuery(event.target.value)} required minLength={3} maxLength={100}
      placeholder="Search bid number..."
      className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-blue-500" />
    <button type="submit" className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700">Search</button>
  </form>;
}

export default function AdminBidSearch() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const query = params.get("q") || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ((sessionStorage.getItem("role") || localStorage.getItem("role")) !== "admin") {
      navigate("/", { replace: true });
      return;
    }
    const controller = new AbortController();
    setError("");
    setData(null);
    setLoading(true);
    async function load() { try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token") || "";
      const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/dashboard/bid-search/?q=${encodeURIComponent(query.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to search bids. Please try again.");
      if (!controller.signal.aborted) setData(result);
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
    }
    load();
    return () => controller.abort();
  }, [query, navigate]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <button onClick={() => navigate("/admin-dashboard")} className="mb-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm shadow-sm">← Back</button>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-900">Bid Search Results</h1>
        <div className="w-full sm:max-w-md"><BidSearchForm key={query} initialQuery={query} /></div>
      </div>
      <p className="mt-2 text-xs text-slate-500">Track user, analyser and approval status across all products.</p>
      <div aria-live="polite">
        {loading && <p className="mt-4 text-sm text-slate-500">Searching bids...</p>}
        {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
        {data && !data.results.length && <p className="mt-4 text-sm text-slate-600">No bid found for this number.</p>}
        {data?.results.length > 0 && <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800 text-white"><tr>{["Bid No.", "Product", "Submitted By", "Assigned User", "Analyser", "Current Stage", "Status"].map(label => <th key={label} className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr></thead>
            <tbody>{data.results.map(row => <tr key={row.key} className="border-t border-slate-100">
              {[row.bid_no, row.product, row.user || "Not submitted", row.assigned_user || "Not recorded", row.analyser || "Not recorded", row.stage, row.status].map((value, index) => <td key={index} className="px-4 py-3 text-slate-700">{value}</td>)}
            </tr>)}</tbody>
          </table>
        </div>}
        {data?.truncated && <p className="mt-3 text-xs text-amber-700">More bids match this search. Enter the full bid number to narrow the results.</p>}
      </div>
    </section>
    </main>
  );
}
