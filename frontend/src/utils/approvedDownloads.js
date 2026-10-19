// "Download Docs for the bid" (analyser, approved bids) lists only what the
// bid carries: the documents chosen on it, Make in India (an approved bid
// always has it), ATC Documents when an ATC document was chosen, and the
// bundles. The backend builds All Documents from the same choice.
const NON_ATC = new Set([
  "manufacturer_auth", "experience_certificate", "past_performance",
  "oem_annual_turnover", "make_in_india", "atc_acceptance_letter",
]);

function chosenDocuments(bid) {
  const raw = bid?.selected_general_docs;
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function visibleApprovedDownloads(downloads, bid) {
  const chosen = chosenDocuments(bid);
  // Opened without the bid (e.g. after a page refresh): keep the full list.
  if (!bid || chosen === null) return downloads;
  const chosenSet = new Set([...chosen, "make_in_india"]);
  const hasAtc = chosen.some((id) => !NON_ATC.has(id)) || Boolean(bid.atc_special_document);
  return downloads.filter(([docId]) => {
    if (docId === "approved_atc_documents") return hasAtc;
    if (NON_ATC.has(docId)) return chosenSet.has(docId);
    return true;
  });
}
