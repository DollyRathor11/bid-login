import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { visibleApprovedDownloads } from "../../utils/approvedDownloads";
import { UPS_API, upsRequest } from "../Ups/upsApi";

const productNames = { desktop: "Desktop", aio: "AIO", workstation: "Workstation", printer: "Printer", multifunction_printer: "Multifunction Printer", toner: "Toner", ups: "UPS" };
const approvedDownloads = [
  ["manufacturer_auth", "MAF Certificate"],
  ["experience_certificate", "Experience Certificate"],
  ["past_performance", "Past Performance"],
  ["oem_annual_turnover", "OEM Annual Turnover"],
  ["make_in_india", "Make in India"],
  ["atc_acceptance_letter", "ATC Acceptance Letter"],
  ["approved_atc_documents", "ATC Documents"],
  ["approved_all_documents", "All Documents"],
];

function productDownloads(bid) {
  if (bid.product !== "ups") return visibleApprovedDownloads(approvedDownloads, bid);
  const selected = [...(bid.selected_general_docs || []), ...(bid.selected_analyser_docs || [])];
  const library = selected.filter(id => id.startsWith("library:"));
  const hasLocalContent = bid.local_content != null && bid.local_content !== "";
  const definitions = [
    ...library.map(id => [id, id.slice("library:".length).replace(/\.pdf$/i, "")]),
    ...approvedDownloads,
  ];
  const downloads = visibleApprovedDownloads(definitions, { ...bid, selected_general_docs: selected.filter(id => !id.startsWith("library:")) })
    .filter(([id]) => {
      if (id === "make_in_india") return hasLocalContent;
      if (id === "approved_all_documents") return selected.length > 0 || hasLocalContent || !!bid.atc_special_document;
      return true;
    });
  if (bid.upload_document) downloads.unshift(["bid_document", "Bid Document", bid.upload_document]);
  return downloads;
}

export default function ApprovedBunchDownloads() {
  const [params] = useSearchParams();
  const { state } = useLocation();
  const bidNo = params.get("bid_no") || "";
  const [result, setResult] = useState(null);
  const [downloading, setDownloading] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const bids = result?.bidNo === bidNo ? result.bids : null;
  const error = downloadError || (result?.bidNo === bidNo ? result.error : "");

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const query = new URLSearchParams({ bid_no: bidNo, status: "approved" });
    async function load() {
      try {
        if (!bidNo.trim()) throw new Error("Select a bunch bid to see its documents.");
        const data = await upsRequest(`bunch-bids/?${query}`, options);
        const items = (data.results[0]?.items || []).filter(item => item.status === "approved");
        const bids = await Promise.all(items.map(async item => item.product === "ups" ? item : {
          ...await upsRequest(`${item.product}-bids/${item.id}/`, options),
          id: item.id, product: item.product, product_kind: item.product_kind, model_number: item.model_number,
        }));
        if (!controller.signal.aborted) setResult({ bidNo, bids });
      } catch (err) {
        if (!controller.signal.aborted) setResult({ bidNo, error: err.message });
      }
    }
    load();
    return () => controller.abort();
  }, [bidNo]);

  async function download(bid, docId, attachment) {
    setDownloading(`${bid.product}-${bid.id}-${docId}`);
    setDownloadError("");
    try {
      const link = document.createElement("a");
      const label = docId.replace(/^library:/, "").replace(/\.pdf$/i, "");
      link.download = `${bidNo.replace(/[^a-zA-Z0-9_-]/g, "_")}_${bid.product}_${bid.id}_${label}.pdf`;
      if (attachment) {
        const response = await fetch(attachment);
        if (!response.ok) throw new Error("The bid document could not be downloaded.");
        const url = URL.createObjectURL(await response.blob());
        link.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } else {
        const data = await upsRequest(`${bid.product}-bids/${bid.id}/generate-docs/`, {
          method: "POST", body: JSON.stringify({ doc_type: docId }),
        });
        if (!data.pdf_url) throw new Error("The document could not be generated.");
        const query = new URLSearchParams({ path: data.pdf_url, name: link.download });
        link.href = `${UPS_API}/generated-docs/download/?${query}`;
      }
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) { setDownloadError(err.message); }
    finally { setDownloading(""); }
  }

  return <main className="mx-auto max-w-4xl p-4 sm:p-6">
    <div className="mb-5 flex items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-black text-slate-800">Download Docs for the Bid</h1>
        <p className="mt-1 text-sm text-slate-500">Bid No: <strong className="text-slate-700">{bidNo}</strong></p>
      </div>
      <Link to={state?.returnTo || "/analyser-dashboard/bunch?status=approved"} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">Back</Link>
    </div>
    {error && <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {!bids && !error && <p>Loading documents...</p>}
    {bids?.length === 0 && <p>No approved products found for this bunch bid.</p>}
    {bids?.map(bid => <section key={`${bid.product}-${bid.id}`} className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b border-slate-200 px-5 py-3 font-bold text-slate-800">{productNames[bid.product_kind || bid.product]} {bid.model_number}</h2>
      <div className="grid grid-cols-[1fr_auto] bg-slate-800 px-5 py-4 text-xs font-bold uppercase tracking-wider text-white">
        <span>Document</span><span>Action</span>
      </div>
      {productDownloads(bid).map(([docId, label, attachment]) => <div key={docId} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-0">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <button type="button" disabled={!!downloading} onClick={() => download(bid, docId, attachment)}
          className="min-w-28 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-blue-700 disabled:opacity-50">
          {downloading === `${bid.product}-${bid.id}-${docId}` ? "Downloading..." : "Download"}
        </button>
      </div>)}
    </section>)}
  </main>;
}
