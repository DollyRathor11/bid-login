import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AdminUpsReviewForm from "./AdminUpsReviewForm";
import AnalyserBunchList from "./AnalyserBunchList";
import AnalyserUpsReviewForm from "./AnalyserUpsReviewForm";
import { bunchAdminPath, bunchProductPath } from "../../utils/bunchNavigation";
import { upsRequest } from "../Ups/upsApi";

export function UpsReview({ bidId, role, onClose, onSaved, onNext, embedded = false }) {
  const [schema, setSchema] = useState(null);
  const [bid, setBid] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const action = role === "admin" ? "approved" : "save_analysis";
  const [form, setForm] = useState({});
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([upsRequest("ups-bids/schema/", { signal: controller.signal }), upsRequest(`ups-bids/${bidId}/`, { signal: controller.signal })])
      .then(([s, b]) => { setSchema(s); setBid(b); setForm({ ...b, note: role === "admin" ? b.admin_note : b.analyser_note }); })
      .catch(err => { if (err.name !== "AbortError") setError(err.message); });
    return () => controller.abort();
  }, [bidId, role]);
  const canEdit = bid && (role === "admin" ? ["analyzed", "approved"].includes(bid.status) : ["complete", "re-analyze"].includes(bid.status));
  async function submit(event, decision = action, note) {
    event?.preventDefault(); setSaving(true); setError("");
    try {
      const payload = { ...form, action: decision, note: note ?? form.note };
      if (role === "admin") delete payload.local_content;
      const updated = await upsRequest(`ups-bids/${bidId}/review/`, { method: "POST", body: JSON.stringify(payload) });
      setBid(updated);
      if (role === "analyser") { onNext?.(updated); }
      else { onSaved(updated); if (!embedded) onClose(); }
    return updated;
    } catch (err) { setError(err.message); return null; } finally { setSaving(false); }
  }
  if (role === "analyser") return <AnalyserUpsReviewForm bidId={bidId} bid={bid} schema={schema} form={form} setForm={setForm}
    canEdit={canEdit} saving={saving} error={error} submit={submit} onClose={onClose} embedded={embedded}
    generalDocuments={bid && schema ? schema.documents.filter(d => bid.selected_general_docs.includes(d.id)).map(d => <DocumentLink key={d.id} bidId={bidId} document={d} />) : null} />;
  return <AdminUpsReviewForm bid={bid} schema={schema} form={form} setForm={setForm} canEdit={canEdit} saving={saving} error={error} embedded={embedded} onClose={onClose}
    onAction={(decision, note) => submit(null, decision, note)}
 />;
}

function DocumentLink({ bidId, document }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function view() {
    setBusy(true); setError("");
    try {
      const data = await upsRequest(`ups-bids/${bidId}/generate-docs/`, { method: "POST", body: JSON.stringify({ doc_type: document.id }) });
      const a = window.document.createElement("a"); a.href = data.pdf_url; a.target = "_blank"; a.rel = "noopener"; a.click();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div><button type="button" disabled={busy} onClick={view} className="text-left hover:underline">{busy ? "Opening..." : document.label}</button>{error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}</div>;
}

export default function BunchBids({ role = "analyser" }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState({ key: "", data: null, error: "" });
  const [revision, setRevision] = useState(0);
  const status = ["all", "pending", "approved", "re-analyze", "rejected"].includes(params.get("status")) ? params.get("status") : "pending";
  const page = params.get("page") || "1";
  const search = params.get("q") || "";
  const query = new URLSearchParams({ q: search, status, page });
  for (const key of ["dashboard", "user", "analyser"]) {
    if (params.has(key)) query.set(key, params.get(key));
  }
  const requestQuery = query.toString();
  const requestKey = JSON.stringify([role, requestQuery, revision]);
  const loading = result.key !== requestKey;
  const data = loading ? null : result.data;
  const error = loading ? "" : result.error;
  const change = values => { const next = new URLSearchParams(params); Object.entries(values).forEach(([key, value]) => next.set(key, value)); setParams(next); };
  useEffect(() => {
    if ((sessionStorage.getItem("role") || localStorage.getItem("role")) !== role) { navigate("/", { replace: true }); return; }
    const controller = new AbortController();
    upsRequest(`bunch-bids/?${requestQuery}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult({ key: requestKey, data, error: "" }); })
      .catch(error => { if (error.name !== "AbortError") setResult({ key: requestKey, data: null, error: error.message }); });
    return () => controller.abort();
  }, [role, requestQuery, requestKey, navigate]);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => { window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh); }, [refresh]);
  const base = role === "admin" ? "/admin-dashboard/bunch-bid-approval" : "/analyser-dashboard/bunch";
  return <main className={role === "admin" ? "min-h-screen bg-gray-50 p-4" : ""}>
    {role === "admin" && <button type="button" onClick={() => navigate("/admin-dashboard")} className="mb-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm">← Back</button>}
    <AnalyserBunchList data={data} loading={loading} error={error} status={status} role={role} dashboard={params.get("dashboard") === "1"}
      onStatus={status => change({ status, page: "1" })} onPage={page => change({ page: String(page) })} onDeleted={refresh}
      onView={row => navigate(role === "admin" ? bunchAdminPath(row.product, row.id, row.status) : bunchProductPath(row.product, row.id), { state: {
        bunchReview: { bidNo: row.bid_no, product: row.product, id: row.id, role, reviewStatus: status, returnTo: `${base}?${params}` },
        readOnly: row.status === "approved" || row.status === "rejected" || (row.status === "pending" && row.can_review),
        showGemUpload: row.status === "approved",
      } })} />
  </main>;
}
