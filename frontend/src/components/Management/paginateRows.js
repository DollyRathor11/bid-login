// Post Bid lists show 15 bids per page.
export const POST_BID_PAGE_SIZE = 15;

export function paginate(rows, page) {
  const pageCount = Math.max(1, Math.ceil(rows.length / POST_BID_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const offset = (currentPage - 1) * POST_BID_PAGE_SIZE;
  return { pageCount, currentPage, offset, pageRows: rows.slice(offset, offset + POST_BID_PAGE_SIZE) };
}
