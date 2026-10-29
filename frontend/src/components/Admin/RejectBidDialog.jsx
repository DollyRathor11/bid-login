import { useEffect, useRef, useState } from "react";

// "Reject Bid" asks the admin for a reason first. The reason is saved as the
// bid's admin note, which the analyser sees on the rejected bid.
export default function RejectBidDialog({ open, submitting, onCancel, onConfirm }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const textareaRef = useRef(null);
  // Held in a ref so a parent re-render (new inline onCancel) doesn't rerun
  // the effect below and wipe the reason being typed.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return undefined;
    setReason("");
    setError("");
    textareaRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") onCancelRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  const submit = () => {
    const text = reason.trim();
    if (!text) {
      setError("Please enter the reason for rejecting this bid.");
      textareaRef.current?.focus();
      return;
    }
    onConfirm(text);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-bid-title"
        className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bg-red-900 px-5 py-3">
          <h2 id="reject-bid-title" className="text-sm font-bold uppercase tracking-wide text-white">⛔ Reject Bid</h2>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-gray-600">
            The bid moves to the Rejected section. The analyser will see this reason.
          </p>
          <label htmlFor="reject-bid-reason" className="block text-sm font-bold text-gray-800">
            Reason for rejection <span className="text-red-600">*</span>
          </label>
          <textarea
            id="reject-bid-reason"
            ref={textareaRef}
            value={reason}
            onChange={(event) => { setReason(event.target.value); setError(""); }}
            rows={4}
            placeholder="e.g. Quoted price is below our minimum margin"
            className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-700"
          />
          {error && <p className="text-xs font-semibold text-red-700">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t px-5 py-3">
          <button type="button" onClick={onCancel}
            className="rounded-md bg-gray-200 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300">
            Cancel
          </button>
          <button type="button" disabled={submitting} onClick={submit}
            className="rounded-md bg-red-900 px-5 py-2 text-sm font-semibold text-white hover:bg-red-950 disabled:bg-red-700">
            {submitting ? "Rejecting..." : "Reject Bid"}
          </button>
        </div>
      </div>
    </div>
  );
}
