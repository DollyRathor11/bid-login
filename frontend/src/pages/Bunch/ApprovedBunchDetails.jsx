import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import letterhead from "../../assets/documents/letterhead.png";
import signature from "../../assets/documents/signature.jpeg";
import { UPS_API, upsRequest } from "../Ups/upsApi";
import "../Documents/document-print.css";

const formatPrice = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function ApprovedBunchDetails() {
  const [params] = useSearchParams();
  const { state } = useLocation();
  const bidNo = params.get("bid_no") || "";
  const [result, setResult] = useState(null);
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const items = result?.bidNo === bidNo ? result.items : null;
  const error = downloadError || (result?.bidNo === bidNo ? result.error : "");

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ bid_no: bidNo, format: "json" });
    upsRequest(`bunch-bids/approved-price-paper/?${query}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult({ bidNo, items: data.items }); })
      .catch(err => { if (!controller.signal.aborted) setResult({ bidNo, error: err.message }); });
    return () => controller.abort();
  }, [bidNo]);

  async function downloadPdf() {
    setDownloading(true);
    setDownloadError("");
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token") || "";
      const query = new URLSearchParams({ bid_no: bidNo });
      const response = await fetch(`${UPS_API}/bunch-bids/approved-price-paper/?${query}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to download approved details.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${bidNo.replace(/[^a-zA-Z0-9_-]/g, "_")}_approved_details_for_bidding.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) { setDownloadError(err.message); }
    finally { setDownloading(false); }
  }

  return <div className="approved-details-view min-h-screen bg-gray-50">
    <div className="print-toolbar mx-auto flex w-[210mm] items-center justify-between gap-3 py-4">
      <Link to={state?.returnTo || "/analyser-dashboard/bunch?status=approved"} className="rounded-md border bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm">Back</Link>
      <div className="flex gap-3">
        <button type="button" onClick={downloadPdf} disabled={!items || downloading} className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {downloading ? "Downloading..." : "Download"}
        </button>
        <button type="button" onClick={() => window.print()} disabled={!items} className="rounded-md bg-slate-800 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">Print</button>
      </div>
    </div>
    {error && <p role="alert" className="print-toolbar mx-auto w-[210mm] rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {!items && !error && <p className="print-status text-center">Preparing approved details...</p>}
    {items && <main className="print-document">
      {items.map(item => <section key={`${item.product}-${item.id}`} className="a4-page approved-bidding-page mb-6 print:mb-0 print:break-before-page print:first:break-before-auto">
        <img className="letterhead" src={letterhead} alt="Laps N Tabs Technology Pvt. Ltd." />
        <h1>APPROVED DETAILS FOR BIDDING</h1>
        <table className="approved-bidding-table">
          <tbody>
            <tr><th>Bid No.</th><td>{item.bid_no}</td></tr>
            <tr><th>Product</th><td>{item.product_name}</td></tr>
            <tr><th>Model No.</th><td>{item.model_number || "-"}</td></tr>
            <tr><th>Final Price</th><td>{item.final_price ? formatPrice.format(Number(item.final_price)) : "-"}</td></tr>
          </tbody>
        </table>
        <div className="approved-bidding-footer">
          <strong>Auth. Signatory For Laps N Tabs Technology Pvt. Ltd.</strong>
          <strong className="company-line">For Laps N Tabs Technology Pvt. Ltd.</strong>
          <img src={signature} alt="Authorized signature" />
          <strong>Name:- Devank Rastogi</strong>
          <strong>Designation:- Director</strong>
          <span>Email:- <u>lapsntabs123@gmail.com</u></span>
          <span>Contact No.:- 9918200166</span>
        </div>
      </section>)}
    </main>}
  </div>;
}
