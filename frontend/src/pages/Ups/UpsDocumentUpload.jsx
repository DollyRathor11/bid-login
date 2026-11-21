import { useState } from "react";
import { FaCheckCircle, FaFileAlt, FaLayerGroup, FaTimes, FaCloudUploadAlt } from "react-icons/fa";
import "./UpsDocumentUpload.css";

export default function UpsDocumentUpload({ bidNo, documents, selectedDocs, special, upload, saving, onSubmit, onGeneral, onSelectedDocs, onSpecial, onUpload }) {
  const [specialOpen, setSpecialOpen] = useState(false);
  const selected = documents.filter(document => selectedDocs.includes(document.id));

  return <>
    <section className="ups-document-upload">
      <header className="ups-document-header">
        <div className="ups-document-header-icon"><FaFileAlt /></div>
        <div><h2>Document Upload</h2><p>Final Step · Bid #{bidNo || "—"}</p></div>
      </header>
      <form onSubmit={onSubmit} className="ups-document-body">
        <div className="ups-document-options">
          <button type="button" onClick={onGeneral} className="ups-document-option ups-document-general" disabled={saving}>
            {selected.length > 0 && <span className="ups-document-count">{selected.length}</span>}
            <span className="ups-document-icon"><FaLayerGroup /></span>
            <span><strong>General Documents</strong><small>{selected.length ? `${selected.length} selected` : "Select Certificates"}</small></span>
          </button>
          <button type="button" onClick={() => setSpecialOpen(true)} className="ups-document-option ups-document-special" disabled={saving}>
            {(special || upload) && <span className="ups-document-count"><FaCheckCircle /></span>}
            <span className="ups-document-icon"><FaFileAlt /></span>
            <span><strong>Special Document</strong><small>{special ? "1 file uploaded" : "No file uploaded"}</small></span>
          </button>
        </div>

        {(selected.length > 0 || special || upload) && <section className="ups-document-selected" aria-label="Selected documents">
          <h3>SELECTED DOCUMENTS</h3>
          {selected.map(document => <div key={document.id} className="ups-document-selection ups-document-selection-general">
            <span title={document.label}>{document.label}</span>
            <button type="button" aria-label={`Remove ${document.label}`} disabled={saving} onClick={() => onSelectedDocs(selectedDocs.filter(id => id !== document.id))}><FaTimes /></button>
          </div>)}
          {[[special, "ATC Special Document", onSpecial], [upload, "Bid Document", onUpload]].filter(([file]) => file).map(([file, label, change]) => <div key={label} className="ups-document-selection ups-document-selection-special">
            <span title={file.name}>{label} · {file.name}</span><button type="button" aria-label={`Remove ${label}`} disabled={saving} onClick={() => change(null)}><FaTimes /></button>
          </div>)}
        </section>}

        <button type="submit" disabled={saving} className="ups-document-submit"><FaCheckCircle />{saving ? "Submitting Bid..." : "Forward to Analyser"}</button>
      </form>
    </section>

    {specialOpen && <div className="ups-document-overlay" onClick={event => { if (event.target === event.currentTarget) setSpecialOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="ups-special-title" className="ups-document-modal">
        <header className="ups-document-modal-header"><div><h2 id="ups-special-title">Special Document</h2><p>Upload the ATC / special document for this bid.</p></div><button type="button" aria-label="Close upload popup" onClick={() => setSpecialOpen(false)}><FaTimes /></button></header>
        <div className="ups-document-modal-body">
          <label className="ups-document-file"><FaCloudUploadAlt /><strong>Upload Special Document</strong><span>PDF · Maximum 20 MB</span>
            <input type="file" accept="application/pdf,.pdf" onChange={event => onSpecial(event.target.files?.[0] || null)} />
          </label>
          {special && <p className="ups-document-filename">{special.name}</p>}
          <details className="ups-document-bid-file"><summary>Bid Document (Optional)</summary><label>Upload bid PDF · Maximum 20 MB<input type="file" accept="application/pdf,.pdf" onChange={event => onUpload(event.target.files?.[0] || null)} /></label>{upload && <p>{upload.name}</p>}</details>
          <button type="button" onClick={() => setSpecialOpen(false)} className="ups-document-submit">Done</button>
        </div>
      </section>
    </div>}
  </>;
}
