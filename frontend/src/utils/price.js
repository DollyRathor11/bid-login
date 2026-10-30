// Value for a price input: an unset price (blank, 0, "0.00") shows as empty
// so the field's "Price" placeholder is visible instead of a 0.
export function priceInputValue(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (text === "" || (!Number.isNaN(Number(text)) && Number(text) === 0)) return "";
  // Prices are shown in whole rupees: "104000.00" -> "104000".
  if (!Number.isNaN(Number(text))) return String(Math.round(Number(text)));
  return value;
}

// A component set to "None" costs nothing, so its price box reads "00".
export function componentPriceValue(choice, price) {
  return choice === "None" ? "00" : priceInputValue(price);
}

// The first [component, price field] pair whose component is chosen (anything
// but "None") but still has no price; null when every chosen one is priced.
export function findUnpricedComponent(values, pairs) {
  return pairs.find(([name, priceName]) => {
    const choice = String(values?.[name] ?? "").trim();
    const price = Number(String(values?.[priceName] ?? "").replace(/,/g, "").trim());
    return choice !== "" && choice !== "None" && !(price > 0);
  }) || null;
}
