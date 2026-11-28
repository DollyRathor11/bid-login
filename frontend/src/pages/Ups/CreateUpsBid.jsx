import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import UpsConfig from "./UpsConfig";
import UpsDocumentUpload from "./UpsDocumentUpload";
import { getUpsFields, UPS_API, upsRequest, upsButtonClass } from "./upsApi";

const TYPES = ["line_interactive", "online_with_battery", "online_without_battery"];
const CERTIFICATE_NAMES = new Map([
  ["BIS-UT1200E-letter", "BIS Certification Letter"],
  ["Cyber Power -GST", "GST Registration Certificate"],
  ["Cyberpower _PAN_card-Revised", "Company PAN Card"],
  ["E-Wast Authorization_Certificate", "E-Waste Authorisation Certificate"],
  ["IEC-2023042506 Test Report_BU1000E", "IEC Test Report"],
  ["Incorporation certificate-CPSI (1)", "Certificate of Incorporation"],
  ["ISO 45001 (1)", "ISO 45001 Certification"],
  ["ISO Certificate - Cyber Power Systems India Pvt Ltd", "ISO Certification"],
  ["ISO14000-202012", "ISO 14000 Environmental Management Certificate"],
  ["ISO9000-202012", "ISO 9000 Quality Management Certificate"],
  ["MOFSET - PWM Technology Declaration - BU600E BU1000E", "MOSFET and PWM Technology Declaration"],
  ["Product Test Report -BU1000E-IN", "Product Test Report"],
  ["Revised Service Escalation Matrix (1)", "Service Support Escalation Matrix"],
  ["RoHS Declaration of Compliancefor BU series", "RoHS Declaration of Compliance – BU Series"],
  ["SLA Cyberpower Service Agreement Copy", "Service Level Agreement (SLA)"],
  ["Turnover Certificate for 3 years", "Turnover Certificate – Last Three Financial Years"],
  ["Turnover Certificate FY 2024-25 (1)", "Turnover Certificate – FY 2024–25"],
]);
const META = [["bid_no", "Bid Number"], ["dept_name", "Department Name"], ["organization", "Organization Name"], ["address", "Address"], ["qty", "Quantity"], ["pincode", "Buyer Pincode"]];
const bidInputClass = "w-full bg-white border border-gray-400 text-gray-900 rounded px-3 py-[6px] text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
const sessionKey = () => `ups-draft-${sessionStorage.getItem("user_id") || sessionStorage.getItem("user_username") || localStorage.getItem("user_id") || localStorage.getItem("user_username") || "user"}`;

function loadDraft() {
  try { return JSON.parse(sessionStorage.getItem(sessionKey()) || "null"); } catch { return null; }
}

export default function CreateUpsBid() {
  const navigate = useNavigate();
  const [schema, setSchema] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(loadDraft);
  const [meta, setMeta] = useState(() => loadDraft() || { qty: "", bid_no: "", dept_name: "", organization: "", address: "", pincode: "", atc: "", start_date: "", end_date: "" });
  const [type, setType] = useState(() => loadDraft()?.ups_type || TYPES[0]);
  const [configs, setConfigs] = useState(() => { const d = loadDraft(); return d ? { [d.ups_type]: d.specs } : {}; });
  const [docs, setDocs] = useState([]);
  const [upload, setUpload] = useState(null);
  const [special, setSpecial] = useState(null);
  const [previewing, setPreviewing] = useState("");
  const [modal, setModal] = useState("");
  const specs = configs[type] || {};
  const updateSpecs = value => setConfigs(prev => ({ ...prev, [type]: value }));

  useEffect(() => {
    if ((sessionStorage.getItem("role") || localStorage.getItem("role")) !== "user") { navigate("/", { replace: true }); return; }
    const controller = new AbortController();
    upsRequest("ups-bids/schema/", { signal: controller.signal }).then(setSchema).catch(err => { if (err.name !== "AbortError") setError(err.message); });
    return () => controller.abort();
  }, [navigate]);

  async function saveConfiguration(event) {
    event.preventDefault();
    setError(""); setSaving(true);
    try {
      const result = await upsRequest(draft?.id ? `ups-bids/${draft.id}/save/` : "ups-bids/create/", { method: "POST", body: JSON.stringify({ ...meta, ups_type: type, specs }) });
      setDraft(result);
      sessionStorage.setItem(sessionKey(), JSON.stringify(result));
      setStep(3);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function previewDocument(id) {
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      setError("Allow pop-ups for this site to view the PDF.");
      return;
    }
    tab.opener = null;
    setPreviewing(id); setError("");
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token") || "";
      const response = await fetch(`${UPS_API}/ups-bids/${draft.id}/generate-docs/`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ doc_type: id }),
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to open this document.");
      }
      if (tab.closed) return;
      const url = URL.createObjectURL(await response.blob());
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      tab.location.replace(url);
    } catch (err) { tab.close(); setError(err.message); } finally { setPreviewing(""); }
  }

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const body = new FormData();
      body.append("selected_general_docs", JSON.stringify(docs));
      if (upload) body.append("upload_document", upload);
      if (special) body.append("atc_special_document", special);
      await upsRequest(`ups-bids/${draft.id}/documents/`, { method: "POST", body });
      sessionStorage.removeItem(sessionKey());
      window.alert("UPS bid submitted successfully. It is now available in Bunch Bids for analysis.");
      navigate("/user/dashboard", { replace: true, state: { upsSubmitted: true } });
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  const back = () => { setError(""); if (step > 1) setStep(step - 1); else navigate("/user"); };
  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
      <div className="flex items-center gap-5"><button type="button" disabled={saving} onClick={back} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold">Back</button><h1 className="text-lg font-bold">Create UPS Bid</h1><span className="text-sm font-semibold text-blue-600">Step {step} of 4</span></div>
      <div className="hidden h-1.5 w-1/3 overflow-hidden rounded-full bg-slate-100 sm:block"><div className="h-full bg-blue-600" style={{ width: `${step * 25}%` }} /></div>
    </header>
    <div className="mx-auto max-w-[1600px] p-4 sm:p-8">
      {error && <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!schema ? <p>{error ? "UPS form could not be loaded. Refresh to try again." : "Loading UPS form..."}</p> : <>
        {step === 1 && <form onSubmit={e => { e.preventDefault(); setError(""); setStep(2); }} className="mx-auto w-full max-w-[600px] rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3"><h2 className="text-lg font-semibold text-gray-800">Create UPS Bid</h2></div>
          <div className="space-y-4">
            {META.slice(0, 4).map(([key, label]) => <div key={key}>
              <label htmlFor={`ups-bid-${key}`} className="mb-1 block text-sm font-normal text-gray-800">{label}</label>
              <input id={`ups-bid-${key}`} required type="text" placeholder={`Enter ${label}`} value={meta[key] || ""}
                onChange={e => setMeta({ ...meta, [key]: e.target.value })} className={bidInputClass}
                maxLength={key === "bid_no" ? 150 : key === "address" ? 5000 : 255} />
            </div>)}
            <div className="grid grid-cols-2 gap-4">
              {META.slice(4).map(([key, label]) => <div key={key}>
                <label htmlFor={`ups-bid-${key}`} className="mb-1 block text-sm font-normal text-gray-800">{label}</label>
                <input id={`ups-bid-${key}`} required type={key === "qty" ? "number" : "text"} placeholder={`Enter ${label}`}
                  inputMode={key === "pincode" ? "numeric" : undefined} min={key === "qty" ? 1 : undefined} step={key === "qty" ? 1 : undefined}
                  maxLength={key === "pincode" ? 6 : undefined} pattern={key === "pincode" ? "[1-9][0-9]{5}" : undefined}
                  value={meta[key] || ""} onChange={e => setMeta({ ...meta, [key]: key === "pincode" ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value })}
                  className={`${bidInputClass} ${key === "qty" ? "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" : ""}`} />
              </div>)}
            </div>
            <div><label htmlFor="ups-bid-atc" className="mb-1 block text-sm font-normal text-gray-800">ATC Details</label>
              <textarea id="ups-bid-atc" rows={6} value={meta.atc || ""} onChange={e => setMeta({ ...meta, atc: e.target.value })}
                placeholder="Type ATC details here..." className="w-full resize-none rounded border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="pt-2"><button type="submit" className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">Submit & Next</button></div>
          </div>
        </form>}
        {step === 2 && <form onSubmit={saveConfiguration} className="container mx-auto mt-4 max-w-6xl px-4">
          <div className="mb-4 flex items-center gap-3 border-b pb-2 pt-2"><h2 className="text-lg font-semibold text-gray-800">Create UPS Configuration</h2></div>
          <div role="tablist" aria-label="UPS type" className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-4">{TYPES.map(key => <button type="button" role="tab" aria-selected={type === key} disabled={saving} key={key} onClick={() => setType(key)} className={`rounded-lg px-5 py-3 text-sm font-semibold ${type === key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-blue-50"}`}>{schema.types[key].label}</button>)}</div>
          <UpsConfig schema={schema} type={type} specs={specs} onChange={updateSpecs} disabled={saving} modelNumber={meta.model_number} onModelChange={model_number => setMeta(previous => ({ ...previous, model_number }))}>
            {[["start_date", "Bid Start Date"], ["end_date", "Bid End Date"]].map(([key, label]) => <div key={key}>
              <label htmlFor={`ups-${key}`} className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
              <input id={`ups-${key}`} type="date" disabled={saving} min={key === "end_date" ? meta.start_date || undefined : undefined}
                value={meta[key] || ""} onChange={e => setMeta({ ...meta, [key]: e.target.value })}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
            </div>)}
          </UpsConfig>
          <div className="flex items-center justify-start"><button disabled={saving} className="mb-10 mt-8 flex items-center gap-2 whitespace-nowrap rounded-md bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700 active:scale-95 disabled:bg-blue-400">{saving ? "Saving..." : "View Bid Products at a Glance"}<span aria-hidden="true">→</span></button></div>
        </form>}
        {step === 3 && <section className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-semibold">Bid Products at a Glance</h2>
          <p className="mb-4 text-sm font-semibold text-blue-600">{meta.bid_no} · {schema.types[type].label} · Quantity: {meta.qty}</p>
          <dl className="divide-y divide-slate-100">{getUpsFields(schema, type, specs).filter(f => specs[f.key]?.length).map(f => <div key={f.key} className="grid grid-cols-2 gap-4 py-3 text-sm"><dt className="text-slate-500">{f.label}</dt><dd>{Array.isArray(specs[f.key]) ? specs[f.key].join(", ") : specs[f.key]}</dd></div>)}</dl>
          <div className="mt-6 flex justify-end"><button onClick={() => setStep(4)} className={upsButtonClass}>Next: Documents</button></div>
        </section>}
        {step === 4 && <UpsDocumentUpload bidNo={meta.bid_no} documents={schema.documents} selectedDocs={docs}
          special={special} upload={upload} saving={saving} onSubmit={submit} onGeneral={() => setModal("general")}
          onSelectedDocs={setDocs} onSpecial={setSpecial} onUpload={setUpload} />}
      </>}
    </div>
    {modal === "general" && schema && <div className="ups-document-overlay" onClick={event => { if (event.target === event.currentTarget) setModal(""); }}><section role="dialog" aria-modal="true" aria-labelledby="ups-docs-heading" className="ups-general-modal">
      <header className="ups-general-header"><div><h2 id="ups-docs-heading">General Certificates</h2><p>Select the documents to submit. Use View PDF to preview.</p></div><button type="button" aria-label="Close general certificates" onClick={() => setModal("")}>×</button></header>
      <div className="ups-general-toolbar"><span>{docs.length} of {schema.documents.length} selected</span><div><button type="button" onClick={() => setDocs(schema.documents.map(d => d.id))}>Select All</button><button type="button" onClick={() => setDocs([])}>Clear</button></div></div>
      <div className="ups-general-list">{schema.documents.map(d => <div key={d.id} className="ups-general-row"><label><input type="checkbox" checked={docs.includes(d.id)} onChange={e => setDocs(e.target.checked ? [...docs, d.id] : docs.filter(id => id !== d.id))} /><span className="ups-certificate-name" title={CERTIFICATE_NAMES.get(d.label) || d.label}>{CERTIFICATE_NAMES.get(d.label) || d.label}</span></label><button type="button" disabled={!!previewing} onClick={() => previewDocument(d.id)} className="ups-general-view"><svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>{previewing === d.id ? "Opening..." : "View PDF"}</button></div>)}</div>
      <footer className="ups-general-footer"><button type="button" onClick={() => setModal("")}>Save Selection</button></footer>
    </section></div>}
  </main>;
}
