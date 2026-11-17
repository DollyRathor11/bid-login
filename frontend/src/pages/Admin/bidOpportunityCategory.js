const CATEGORY_PATTERNS = [
  ["entry_mid_desktop", /^entry\s+and\s+mid\s+level\s+deskto(?:p(?:\s+com(?:p(?:uter)?)?)?)?$/i],
  ["high_end_desktop", /^high\s+end\s+deskto(?:p(?:\s+com(?:p(?:uter)?)?)?)?$/i],
  ["aio", /^all\s+in\s+one\s+pc(?:\s*\(v2\))?$/i],
  ["workstation", /^fixed\s+computer\s+workstation(?:\s*\(v\d+\))?$/i],
  ["toner", /^toner\s+cartridges?\s*(?:\/|and)\s*ink\s+cartridges?$/i],
  ["printer", /^a4\b(?=[\s\S]*(?:multifunction|\bmfp\b))(?=[\s\S]*(?:printer|\bp\b))[\s\S]*$/i],
];

// UPS is allowed only inside a bunch, and only under these exact GeM names.
const BUNCH_ONLY_PATTERNS = [
  /^line\s+interactive\s+ups\s+with\s+avr\s*\(v2\)$/i,
  /^online\s+ups\s*\(\s*(?:≤|<=|&le;|<|\?|�)\s*10\s*kva\s*\)\s+with(?:out)?\s+battery\s+conforming\s+to\s+is\s+16242\s*\(\s*part\s+1\s*\)$/i,
];

const cleanItem = (value) => String(value || "")
  .replace(/[\u0900-\u097f][\s\S]*$/, "")
  .replace(/\s*\(Q\d+\)\s*/gi, "")
  .replace(/\s*,\s*/g, ", ")
  .trim()
  .replace(/^,|,$/g, "")
  .trim();

export const itemCategory = (row) => {
  const raw = String(row.product_name || "");
  if (/(?:\(\s*PAC\s*Only\s*\)|\bPAC\s*Only\b)/i.test(raw)) return "other";
  const categories = cleanItem(raw).split(/\s*,\s*/).map((value) => value.trim()).filter(Boolean);
  const matched = categories.map((category) => CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(category))?.[0]);
  // A bunch bid (several item categories) is shown as Bunch Bid when every
  // category is ours or a UPS and at least one is ours.
  if (categories.length > 1) {
    const allowed = categories.every((category, index) => (
      matched[index] || BUNCH_ONLY_PATTERNS.some((pattern) => pattern.test(category))
    ));
    return allowed && matched.some(Boolean) ? "bunch_bid" : "other";
  }
  return matched[0] || "other";
};

export const isSupportedOpportunity = (row) => itemCategory(row) !== "other";

