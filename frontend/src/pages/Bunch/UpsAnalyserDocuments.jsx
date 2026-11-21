import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FaCheckCircle, FaFileAlt, FaLayerGroup } from "react-icons/fa";
import { upsRequest } from "../Ups/upsApi";
import "../Ups/UpsDocumentUpload.css";

export default function UpsAnalyserDocuments() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [bid, setBid] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [generating, setGenerating] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([upsRequest(`ups-bids/${id}/`, { signal: controller.signal }), upsRequest("ups-bids/schema/", { signal: controller.signal })])
      .then(([bid, schema]) => {
        if (controller.signal.aborted) return;
        setBid(bid); setDocuments(schema.analyser_documents || []); setSelected(bid.selected_analyser_docs || []);
      }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [id]);

  const canSubmit = bid?.analysis_saved_at && ["complete", "re-analyze"].includes(bid.status);
  const reviewPath = `/analyser-dashboard/bunch/ups/${id}`;
  const back = () => navigate(reviewPath, { replace: true, state: location.state });
  const toggle = docId => setSelected(previous => previous.includes(docId) ? previous.filter(id => id !== docId) : [...previous, docId]);

  async function preview(docId) {
    setGenerating(docId); setError("");
    const previewWindow = window.open("about:blank", "_blank");
    if (previewWindow) previewWindow.opener = null;
    try {
      const result = await upsRequest(`ups-bids/${id}/generate-docs/`, { method: "POST", body: JSON.stringify({ doc_type: docId }) });
      const response = await fetch(result.pdf_url, { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to open the generated PDF.");
      const url = URL.createObjectURL(await response.blob());
      if (previewWindow) previewWindow.location.href = url;
      else { const link = document.createElement("a"); link.href = url; link.target = "_blank"; link.rel = "noopener"; link.click(); }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setSelected(previous => [...new Set([...previous, docId])]);
    } catch (error) { previewWindow?.close(); setError(error.message); } finally { setGenerating(""); }
  }

  async function submit(event) {
    event.preventDefault(); setSubmitting(true); setError("");
    try {
      await upsRequest(`ups-bids/${id}/review/`, { method: "POST", body: JSON.stringify({ action: "send_admin", selected_analyser_docs: selected }) });
      navigate(reviewPath, { replace: true, state: { ...location.state, readOnly: true,
        ...(location.state?.bunchReview ? { bunchReview: { ...location.state.bunchReview, submitted: true } } : {}),
      } });
    } catch (error) { setError(error.message); } finally { setSubmitting(false); }
  }

  return <main className="flex min-h-[80vh] items-center justify-center bg-slate-50 p-4 sm:p-6">
    <section className="ups-document-upload">
      <header className="ups-document-header"><div className="ups-document-header-icon"><FaFileAlt /></div><div><h1 className="text-[15px] font-bold text-slate-900">General Documents</h1><p>Generate &amp; Review · Bid #{bid?.bid_no || "—"}</p></div></header>
      <form onSubmit={submit} className="ups-document-body">
        {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!bid ? <p className="py-6 text-sm text-slate-500">{error ? "Documents could not be loaded." : "Loading analyser documents..."}</p> : <>
          {!canSubmit && <p className="mb-4 text-sm text-slate-500">{bid.analysis_saved_at ? "This bid has already been sent for admin review." : "Go back to the review form and click Next first."}</p>}
          <button type="button" onClick={() => setModal(true)} className="ups-document-option ups-document-general mb-6 w-full" disabled={submitting}>
            {selected.length > 0 && <span className="ups-document-count">{selected.length}</span>}<span className="ups-document-icon"><FaLayerGroup /></span><span><strong>Analyser Documents</strong><small>{selected.length ? `${selected.length} selected` : "Select or View PDFs"}</small></span>
          </button>
          {selected.length > 0 && <section className="ups-document-selected" aria-label="Selected analyser documents">{documents.filter(doc => selected.includes(doc.id)).map(doc => <div key={doc.id} className="ups-document-selection ups-document-selection-general"><span>{doc.label}</span><button type="button" aria-label={`Remove ${doc.label}`} disabled={submitting} onClick={() => toggle(doc.id)}>×</button></div>)}</section>}
          <button type="submit" className="ups-document-submit" disabled={!canSubmit || submitting}><FaCheckCircle />{submitting ? "Submitting to Admin..." : "Accept & Send to Admin"}</button>
        </>}
        <button type="button" disabled={submitting} onClick={back} className="mt-3 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-slate-50">← Back to Review</button>
      </form>
    </section>
    {modal && <div className="ups-document-overlay" onClick={event => { if (event.target === event.currentTarget) setModal(false); }}><section role="dialog" aria-modal="true" aria-labelledby="ups-analyser-docs-heading" className="ups-general-modal">
      <header className="ups-general-header"><div><h2 id="ups-analyser-docs-heading">Analyser Documents</h2><p>Select documents to submit. Use View PDF to preview.</p></div><button type="button" onClick={() => setModal(false)} aria-label="Close analyser documents">×</button></header>
      <div className="ups-general-toolbar"><span>{selected.length} of {documents.length} selected</span><div><button type="button" disabled={submitting} onClick={() => setSelected(documents.map(doc => doc.id))}>Select All</button><button type="button" disabled={submitting} onClick={() => setSelected([])}>Clear</button></div></div>
      {error && <p role="alert" className="m-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      <div className="ups-general-list">{documents.map(doc => <div key={doc.id} className="ups-general-row"><label><input type="checkbox" disabled={submitting} checked={selected.includes(doc.id)} onChange={() => toggle(doc.id)} /><span>{doc.label}</span></label><button type="button" disabled={!!generating || submitting} onClick={() => preview(doc.id)} className="ups-general-view">{generating === doc.id ? "Generating..." : "View PDF"}</button></div>)}</div>
      <footer className="ups-general-footer"><button type="button" onClick={() => setModal(false)}>Save Selection</button></footer>
    </section></div>}
  </main>;
}
