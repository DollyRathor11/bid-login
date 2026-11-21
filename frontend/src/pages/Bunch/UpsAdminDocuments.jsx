import { useEffect, useRef, useState } from "react";
import { upsRequest } from "../Ups/upsApi";

function DocumentActions({ bidId, document, localContent }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function open(download) {
    setBusy(download ? "download" : "view"); setError("");
    const preview = download ? null : window.open("about:blank", "_blank");
    if (preview) preview.opener = null;
    try {
      const url = document.url || (await upsRequest(`ups-bids/${bidId}/generate-docs/`, { method: "POST", body: JSON.stringify({ doc_type: document.id, local_content: localContent }) })).pdf_url;
      if (download) {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Unable to download document.");
        const objectUrl = URL.createObjectURL(await response.blob());
        const link = window.document.createElement("a"); link.href = objectUrl; link.download = `${document.id}.pdf`; link.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
      } else if (preview) preview.location.replace(url);
      else window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) { preview?.close(); setError(err.message); } finally { setBusy(""); }
  }
  return <div className="shrink-0"><div className="flex gap-2">
    <button type="button" disabled={!!busy} onClick={() => open(false)} className="rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 disabled:opacity-50">{busy === "view" ? "Opening..." : "View File"}</button>
    <button type="button" disabled={!!busy} onClick={() => open(true)} className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm disabled:opacity-50">{busy === "download" ? "Downloading..." : "Download"}</button>
  </div>{error && <p role="alert" className="mt-1 max-w-48 text-xs text-red-600">{error}</p>}</div>;
}

export default function UpsAdminDocuments({ bid, schema, localContent }) {
  const [open, setOpen] = useState(false);
  const panel = useRef(null);
  useEffect(() => {
    const close = event => { if (!panel.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, []);
  const docs = [...schema.documents.filter(doc => bid.selected_general_docs.includes(doc.id)), ...(schema.analyser_documents || []).filter(doc => bid.selected_analyser_docs?.includes(doc.id)), ...(bid.upload_document ? [{ id: "bid_document", label: "Bid Document", url: bid.upload_document }] : [])];
  return <section className="my-5"><h2 className="mb-2 text-sm font-medium text-gray-700">Compliance Documents</h2>
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <div className="flex min-h-[74px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm">{bid.atc_special_document ? <div className="flex w-full flex-wrap items-center justify-between gap-3"><b>Special Document</b><DocumentActions bidId={bid.id} document={{ id: "special_document", url: bid.atc_special_document }} /></div> : <span className="text-gray-400">No Special Document</span>}</div>
      <div ref={panel} className="relative min-w-0">
        <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)} className={`flex min-h-[74px] w-full items-center justify-between gap-3 rounded-lg border p-4 ${open ? "border-orange-500 bg-orange-50 ring-1 ring-orange-500" : "border-gray-200 bg-white hover:border-orange-400"}`}>
          <span className="flex items-center gap-3"><span aria-hidden="true" className="rounded-full bg-orange-100 p-2 text-orange-600">▣</span><span className="text-left"><span className="block text-sm font-bold text-gray-800">Bid Documents</span><span className="block text-xs text-gray-500">General certificates and analyser documents</span></span></span><span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">{docs.length} Items</span>
        </button>
        {open && <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-orange-100 bg-orange-50 px-4 py-3"><span className="text-sm font-semibold text-orange-800">Approved Bid Documents</span><span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">{docs.length} Total</span></div>
          <div className="max-h-80 divide-y divide-gray-100 overflow-y-auto">{docs.map(doc => <div key={doc.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-green-50"><span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs text-white">✓</span><span className="min-w-24 flex-1 text-sm font-medium uppercase text-gray-800">{doc.label}</span><DocumentActions bidId={bid.id} document={doc} /></div>)}{!docs.length && <p className="p-8 text-center text-sm text-gray-500">No documents selected.</p>}</div>
          <div className="border-t bg-gray-50 px-4 py-2 text-right"><button type="button" onClick={() => setOpen(false)} className="px-3 py-1 text-xs font-medium text-gray-500">Close Panel</button></div>
        </div>}
      </div>
      <div className="flex min-h-[74px] flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4"><div className="flex items-center gap-3"><span aria-hidden="true" className="rounded-full bg-green-100 p-2 text-green-600">▤</span><div><h3 className="text-sm font-bold text-gray-800">Make in India</h3><p className="text-xs text-gray-500">Model: {bid.model_number || "—"}</p></div></div><DocumentActions bidId={bid.id} document={{ id: "make_in_india" }} localContent={localContent} /></div>
    </div>
  </section>;
}
