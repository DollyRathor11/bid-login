import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { bunchAdminPath, bunchProductPath, bunchReviewItems } from "../../utils/bunchNavigation";
import "./BunchReviewHeader.css";
import { upsRequest } from "../Ups/upsApi";

const PRODUCTS = { desktop: "Desktop", aio: "AIO", workstation: "Workstation", printer: "Printer", multifunction_printer: "Multifunction Printer", toner: "Toner", ups: "UPS" };

export default function BunchReviewHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const context = location.state?.bunchReview;
  const headerRef = useRef(null);
  const isAdmin = context?.role === "admin";
  const bidNo = context?.bidNo;
  const requestKey = JSON.stringify([bidNo, location.key]);
  const [result, setResult] = useState({ key: "", items: [], error: "" });

  useEffect(() => {
    if (!bidNo) return;
    const controller = new AbortController();
    upsRequest(`bunch-bids/?${new URLSearchParams({ bid_no: bidNo })}`, { signal: controller.signal })
      .then(data => {
        if (controller.signal.aborted) return;
        const group = data.results.find(group => group.bid_no.trim().toLowerCase() === bidNo.trim().toLowerCase());
        if (!isAdmin && context.submitted) {
          const next = group?.items.find(item => item.status === "pending" || item.status === "re-analyze");
          if (next) navigate(bunchProductPath(next.product, next.id), { replace: true, state: {
            bunchReview: { bidNo, product: next.product, id: next.id, returnTo: context.returnTo },
          } });
          else navigate(context.returnTo || "/analyser-dashboard/bunch?status=pending", { replace: true });
          return;
        }
        setResult({ key: requestKey, items: bunchReviewItems(group?.items || [], context, location.search), error: group ? "" : "This bunch bid is no longer available." });
      })
      .catch(error => { if (!controller.signal.aborted) setResult({ key: requestKey, items: [], error: error.message }); });
    return () => controller.abort();
  }, [bidNo, requestKey, isAdmin, context, location.search, navigate]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header || !isAdmin) return;
    const update = () => document.documentElement.style.setProperty("--bunch-review-header-height", `${header.getBoundingClientRect().height + 8}px`);
    const observer = new ResizeObserver(update);
    observer.observe(header); update();
    return () => { observer.disconnect(); document.documentElement.style.removeProperty("--bunch-review-header-height"); };
  }, [isAdmin, bidNo]);

  if (!context) return null;
  const loading = result.key !== requestKey;
  return <section ref={headerRef} aria-label="Bunch bid product review" className={`sticky top-0 border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6 ${isAdmin ? "z-[70]" : "z-40"}`}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><span className="mr-2 text-xs text-slate-500">Bunch Bid</span><strong className="break-words text-sm text-blue-700">{bidNo}</strong></div>
      <button type="button" onClick={() => navigate(context.returnTo || (isAdmin ? "/admin-dashboard/bunch-bid-approval" : "/analyser-dashboard/bunch"))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">← Back</button>
    </div>
    {loading ? <p className="text-xs text-slate-500">Loading products...</p> : result.error ? <p role="alert" className="text-xs text-red-600">{result.error}</p> : <div className="flex flex-wrap gap-2" role="group" aria-label="Switch product form">
      {result.items.map((item, index) => {
        const kind = item.product_kind || item.product;
        const count = result.items.filter(row => (row.product_kind || row.product) === kind).length;
        const number = result.items.slice(0, index + 1).filter(row => (row.product_kind || row.product) === kind).length;
        const active = item.product === context.product && String(item.id) === String(context.id);
        const sent = item.status === "pending" && item.can_review;
        return <button type="button" key={`${item.product}-${item.id}`} aria-pressed={active} disabled={isAdmin && !item.can_review} title={isAdmin && !item.can_review ? "Awaiting analyser submission" : undefined}
          onClick={() => { if (!active) navigate(isAdmin ? bunchAdminPath(item.product, item.id, item.status) : bunchProductPath(item.product, item.id), { replace: true, state: {
            bunchReview: { bidNo, product: item.product, id: item.id, returnTo: context.returnTo, ...(isAdmin ? { role: "admin", reviewStatus: context.reviewStatus || item.status } : {}) },
            readOnly: item.status === "approved" || item.status === "rejected" || sent,
            showGemUpload: item.status === "approved",
          } }); }}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300"}`}>
          {PRODUCTS[kind] || item.product}{count > 1 ? ` ${number}` : ""}
          {sent && !isAdmin && <span className={`rounded px-1.5 py-0.5 text-[9px] ${active ? "bg-white/20" : "bg-blue-100 text-blue-700"}`}>Sent to Admin</span>}
        </button>;
      })}
    </div>}
  </section>;
}
