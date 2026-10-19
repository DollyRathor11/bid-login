// The bid number, opening the GeM bid PDF in a new tab when a link is known.
export function GemBidNo({ bidNo, links, fallback = "" }) {
  const url = links?.[bidNo];
  if (!url) return bidNo || fallback;
  return (
    <a href={url} target="_blank" rel="noreferrer" title="Open GeM bid PDF"
      onClick={(event) => event.stopPropagation()}
      className="underline decoration-blue-300 underline-offset-2 hover:text-blue-800">
      {bidNo}
    </a>
  );
}
