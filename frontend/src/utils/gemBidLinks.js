import { useEffect, useState } from "react";

// GeM bid PDF links for the bids on an admin approval page. Only bids that
// came from Bid To Be Participated have one (the scan saved it there).
const API_URL = import.meta.env.VITE_API_URL;
const token = () => sessionStorage.getItem("token") || localStorage.getItem("token") || "";

export function useGemBidLinks(bids) {
  const [links, setLinks] = useState({});
  const key = [...new Set((bids || []).map((bid) => bid?.bid_no).filter(Boolean))].sort().join("|");

  useEffect(() => {
    if (!key) return undefined;
    let active = true;
    fetch(`${API_URL}/gem/bid-links/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ bid_nos: key.split("|") }),
    })
      .then((response) => (response.ok ? response.json() : { links: {} }))
      .then((data) => { if (active) setLinks(data.links || {}); })
      .catch(() => {});
    return () => { active = false; };
  }, [key]);

  return links;
}
