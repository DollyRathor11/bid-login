// Representation Replies: GeM publishes the department's replies on the public
// All Bids page (View Representation), where they are visible without a login.
// Only the bids we made a representation on are searched by bid number, so the
// thousands of All Bids pages are never walked. This only reads; it submits
// nothing on GeM.
(() => {
  const STATE_KEY = "gemRepresentationReplySync";
  const STOP_KEY = "gemRepresentationReplyStop";
  const MODAL_SELECTOR = ".modal, [role=dialog], .modal-content, .ngdialog-content, .ui-dialog";
  const CONTROL_SELECTOR = "a, button, [role=button], [onclick], [ng-click]";
  const CLOSE_SELECTOR = '.close, [data-dismiss="modal"], [data-bs-dismiss="modal"], [aria-label="Close" i]';

  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();

  // cellRows: the table's rows as arrays of cell text, header row included.
  // Section spans several rows, so a shorter row belongs to the section above.
  function parseReplyRows(cellRows) {
    const headerIndex = cellRows.findIndex((cells) => (
      cells.some((cell) => /^query/i.test(clean(cell))) && cells.some((cell) => /^reply/i.test(clean(cell)))
    ));
    if (headerIndex < 0) return [];
    const header = cellRows[headerIndex].map(clean);
    const queryColumn = header.findIndex((cell) => /^query/i.test(cell));
    const replyColumn = header.findIndex((cell) => /^reply/i.test(cell));
    const rows = [];
    let section = "";
    for (const cells of cellRows.slice(headerIndex + 1)) {
      const offset = header.length - cells.length;
      if (offset < 0 || offset > queryColumn) continue;
      if (!offset && queryColumn > 0) section = clean(cells[0]) || section;
      const query = String(cells[queryColumn - offset] || "").trim();
      const reply = String(cells[replyColumn - offset] || "").trim();
      if (query && reply) rows.push({ section, query, reply });
    }
    return rows;
  }

  const publishedOn = (value) => (
    clean(value).match(/response\s+publication\s+date\s*:?\s*(\d{1,2}-\d{1,2}-\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?)/i)?.[1] || ""
  );

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { parseReplyRows, publishedOn };
  }
  if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) return;

  let running = false;
  const nodeText = (node) => clean(node?.textContent);
  const visible = (node) => {
    const box = node?.getBoundingClientRect?.();
    if (!box || box.width <= 0 || box.height <= 0) return false;
    const style = getComputedStyle(node);
    return style.visibility !== "hidden" && style.display !== "none";
  };
  // Hidden tabs throttle timers, so the service worker does the waiting.
  const sleep = async (ms) => {
    try {
      await chrome.runtime.sendMessage({ type: "GEM_SYNC_WAKE", ms });
    } catch {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
  };
  async function waitFor(read, ms) {
    const end = Date.now() + ms;
    for (;;) {
      const value = read();
      if (value || Date.now() >= end) return value;
      await sleep(250);
    }
  }
  const hasBidNo = (value, bidNo) => {
    const at = value.toUpperCase().indexOf(bidNo.toUpperCase());
    return at >= 0 && !/\d/.test(value[at + bidNo.length] || "");
  };

  // A box whose form goes to another address (the header's Marketplace search
  // posts to mkp.gem.gov.in/search) would take the tab away from All Bids.
  const leavesAllBids = (input) => {
    const action = input.form?.getAttribute("action");
    if (!action || /^(?:#|javascript:)/i.test(action)) return false;
    try {
      const target = new URL(action, location.href);
      return target.origin !== location.origin || !target.pathname.startsWith("/all-bids");
    } catch {
      return true;
    }
  };

  // All Bids' own bid search, never the site header's Marketplace search.
  function searchBox() {
    const candidates = [...document.querySelectorAll('input[type="search"], input[type="text"], input:not([type])')]
      .filter((input) => {
        const label = `${input.placeholder} ${input.id} ${input.name} ${input.getAttribute("aria-label") || ""}`;
        return visible(input) && !input.readOnly
          && /search|keyword|bid/i.test(label) && !/date/i.test(label)
          && !input.closest("header, nav, .navbar, .header, #header, .top-header, .main-header")
          && !leavesAllBids(input);
      });
    const bidLabel = (input) => /bid|ra\s*no/i.test(`${input.placeholder} ${input.id} ${input.name} ${input.getAttribute("aria-label") || ""}`);
    return candidates.find(bidLabel) || candidates[0] || null;
  }

  const describe = (node) => clean(`${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""} ${nodeText(node) || node.value || ""}`).slice(0, 60);

  // Only a control that says "search" next to the box is clicked (never a plain
  // link that could leave All Bids); otherwise Enter is pressed in the box.
  // Returns what was done, for the status line.
  function searchBid(bidNo) {
    const input = searchBox();
    if (!input) throw new Error("The search box of the GeM All Bids page was not found.");
    input.focus();
    input.value = bidNo;
    for (const type of ["input", "change", "keyup"]) input.dispatchEvent(new Event(type, { bubbles: true }));
    const scope = input.closest(".input-group, form") || input.parentElement;
    const button = [...(scope?.querySelectorAll('button, input[type="submit"], input[type="button"], [id*="search" i], [class*="search" i]') || [])]
      .filter((node) => node !== input && !node.contains(input) && visible(node) && !(node.matches("a[href]") && !/^(?:#|javascript:)/i.test(node.getAttribute("href"))))
      .find((node) => /search/i.test(`${node.id} ${node.className} ${nodeText(node)} ${node.value || ""} ${node.title || ""}`)
        || node.querySelector?.('[class*="search" i]'));
    if (button) {
      button.click();
      return `clicked ${describe(button)}`;
    }
    for (const type of ["keydown", "keypress", "keyup"]) {
      input.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
    }
    return `pressed Enter in ${describe(input)}`;
  }

  // The bid's card: the largest block around its number holding one bid only.
  function bidCard(bidNo) {
    const label = [...document.querySelectorAll("a, strong, b, span, p, h1, h2, h3, h4, h5, h6, td")]
      .find((node) => visible(node) && !node.closest(MODAL_SELECTOR) && hasBidNo(nodeText(node), bidNo));
    if (!label) return null;
    let card = label;
    while (card.parentElement && card.parentElement !== document.body
      && (nodeText(card.parentElement).match(/bid\s*no\b/gi) || []).length <= 1) {
      card = card.parentElement;
    }
    return card;
  }

  const controlIn = (root, pattern) => [...(root?.querySelectorAll(CONTROL_SELECTOR) || [])]
    .find((node) => visible(node) && pattern.test(nodeText(node))) || null;
  const REPRESENTATION_LINK = /^view\s+representations?$/i;
  const openModals = () => [...document.querySelectorAll(MODAL_SELECTOR)].filter(visible);
  const representationLink = (card) => controlIn(card, REPRESENTATION_LINK)
    || openModals().map((modal) => controlIn(modal, REPRESENTATION_LINK)).find(Boolean) || null;

  function replyTable(bidNo) {
    return [...document.querySelectorAll("table")].find((table) => {
      if (!visible(table)) return false;
      const head = nodeText(table.querySelector("tr"));
      return /query/i.test(head) && /reply/i.test(head)
        && hasBidNo(nodeText(table.closest(MODAL_SELECTOR) || document.body), bidNo);
    }) || null;
  }

  async function closeModals() {
    for (const modal of openModals()) {
      const close = [...modal.querySelectorAll(`${CLOSE_SELECTOR}, button, a`)]
        .find((node) => visible(node) && (node.matches(CLOSE_SELECTOR) || /^(?:close|×)$/i.test(nodeText(node))));
      close?.click();
    }
    if (await waitFor(() => !openModals().length, 2500)) return;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, which: 27, bubbles: true }));
    await waitFor(() => !openModals().length, 1500);
  }

  async function readReplies(bidNo, step) {
    await closeModals();
    if (!bidCard(bidNo)) {
      await step("searching GeM");
      await step(`searching GeM (${searchBid(bidNo)})`);
    }
    const card = await waitFor(() => bidCard(bidNo), 12000);
    if (!card) return { outcome: "not_found" };
    let link = representationLink(card);
    if (!link) {
      // GeM can reveal View Representation only after View Corrigendum is opened.
      const corrigendum = controlIn(card, /^view\s+corrigendum$/i);
      if (corrigendum) {
        await step("opening View Corrigendum");
        corrigendum.click();
        link = await waitFor(() => representationLink(bidCard(bidNo)), 4000);
      }
    }
    if (!link) {
      await closeModals();
      return { outcome: "no_link" };
    }
    await step("opening View Representation");
    link.click();
    const table = await waitFor(() => replyTable(bidNo), 10000);
    if (!table) {
      await closeModals();
      return { outcome: "no_table" };
    }
    for (const more of [...table.querySelectorAll("a, span, button")]) {
      if (visible(more) && /^read\s+more$/i.test(nodeText(more))) more.click();
    }
    await sleep(300);
    const cellRows = [...table.querySelectorAll("tr")].map((row) => (
      [...row.querySelectorAll(":scope > td, :scope > th")]
        .map((cell) => String(cell.innerText || cell.textContent || "").replace(/\s*(?:\.\.\.|…)?\s*read\s+(?:more|less)\s*$/i, "").trim())
    ));
    const rows = parseReplyRows(cellRows);
    const published = publishedOn(nodeText(table.closest(MODAL_SELECTOR) || document.body));
    await closeModals();
    return { outcome: rows.length ? "read" : "no_reply", rows, published };
  }

  const OUTCOME_NOTES = {
    not_found: "not found in All Bids search",
    no_link: "no View Representation link on the bid",
    no_table: "representation popup did not load",
    no_reply: "no reply published yet",
    no_match: "replies published, but none matched our representation text",
    timeout: "GeM did not answer within a minute; skipped",
  };
  // One bid never holds the scan for more than this.
  const BID_TIMEOUT_MS = 60000;
  // GeM's search can reload the page, which ends this script: the tab keeps
  // the run in sessionStorage and the reloaded page carries on from storage.
  const RUN_MARK = "acxxelReplyRun";
  const RESUME_WITHIN_MS = 180000;

  async function run(bidNumbers, resume = null) {
    const counts = { checked: 0, saved: 0, linked: 0, found: 0, ...(resume?.counts || {}) };
    const problems = resume?.problems || [];
    const total = resume?.total || bidNumbers.length;
    let pending = [...bidNumbers];
    const startedAt = Date.now();
    let checkedNow = 0;
    // Reloads met on the current bid; one that keeps reloading the page is skipped.
    let resumes = resume && resume.resumeBid === pending[0] ? Number(resume.resumes || 0) + 1 : resume ? 1 : 0;
    const report = (status, message) => chrome.storage.local.set({ [STATE_KEY]: {
      status, message, total, ...counts, counts, problems, pending,
      resumeBid: pending[0] || "", resumes, updatedAt: Date.now(),
    } });
    if (resumes > 2 && pending.length) {
      problems.push({ bidNo: pending[0], reason: "GeM page kept reloading on this bid; skipped" });
      counts.checked += 1;
      pending = pending.slice(1);
      resumes = 0;
    }
    const finish = () => {
      try { sessionStorage.removeItem(RUN_MARK); } catch { /* storage blocked */ }
      chrome.runtime.sendMessage({ type: "GEM_REPRESENTATION_REPLIES_DONE" }).catch(() => {});
    };
    try { sessionStorage.setItem(RUN_MARK, "1"); } catch { /* storage blocked */ }
    try {
      await waitFor(searchBox, 15000);
      while (pending.length) {
        const bidNo = pending[0];
        if ((await chrome.storage.local.get(STOP_KEY))[STOP_KEY]) {
          await report("stopped", `Stopped after ${counts.checked} of ${total} bids. Replies already read are saved.`);
          finish();
          return;
        }
        const speed = checkedNow ? `, about ${Math.round((Date.now() - startedAt) / checkedNow / 1000)}s per bid` : "";
        const label = `Checking ${bidNo} (${counts.checked + 1} of ${total}${speed})`;
        await report("running", `${label}...`);
        const step = (text) => report("running", `${label}: ${text}...`);
        let timer = null;
        const result = await Promise.race([
          readReplies(bidNo, step),
          new Promise((resolve) => { timer = setTimeout(() => resolve({ outcome: "timeout" }), BID_TIMEOUT_MS); }),
        ]).finally(() => clearTimeout(timer));
        if (result.outcome === "timeout") await closeModals();
        let outcome = result.outcome;
        if (outcome !== "not_found") counts.found += 1;
        if (!["not_found", "no_link"].includes(outcome)) counts.linked += 1;
        if (outcome === "read") {
          const response = await chrome.runtime.sendMessage({
            type: "SAVE_GEM_REPRESENTATION_REPLIES",
            results: [{ bid_no: bidNo, published_on: result.published, rows: result.rows }],
          });
          if (!response?.ok) throw new Error(`${bidNo}: reply could not be saved (${response?.error || "no response"}).`);
          counts.saved += Number(response.replies || 0);
          if (!response.replies) outcome = "no_match";
        }
        if (OUTCOME_NOTES[outcome]) problems.push({ bidNo, reason: OUTCOME_NOTES[outcome] });
        counts.checked += 1;
        pending = pending.slice(1);
        resumes = 0;
        checkedNow += 1;
        const perBid = Math.round((Date.now() - startedAt) / checkedNow / 1000);
        await report("running", `Checked ${bidNo} (${counts.checked} of ${total}, about ${perBid}s per bid).`);
        await sleep(300);
      }
      // Every found bid without the link usually means GeM is showing the
      // logged-in view of All Bids.
      const hint = counts.found && !counts.linked
        ? " No bid showed View Representation: log out of GeM, or run this from a Chrome profile not logged in to GeM."
        : "";
      await report("complete", `Done. Checked ${counts.checked} bids; ${counts.saved} replies saved.${hint}`);
      finish();
    } catch (error) {
      // The tab stays open so the page can be looked at.
      try { sessionStorage.removeItem(RUN_MARK); } catch { /* storage blocked */ }
      await report("failed", `${error.message || "Representation Replies failed."} Replies already read are saved.`);
    } finally {
      running = false;
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "RUN_GEM_REPRESENTATION_REPLIES") return undefined;
    if (running) {
      sendResponse({ ok: false, error: "Representation Replies is already running." });
      return undefined;
    }
    running = true;
    run(message.bidNumbers || []);
    sendResponse({ ok: true });
    return undefined;
  });

  // This tab's run was cut off by a page reload: carry on with the bids left.
  (async () => {
    let marked = false;
    try { marked = sessionStorage.getItem(RUN_MARK) === "1"; } catch { /* storage blocked */ }
    if (!marked || running) return;
    const { [STATE_KEY]: state } = await chrome.storage.local.get(STATE_KEY);
    const fresh = state?.status === "running" && Date.now() - Number(state.updatedAt || 0) < RESUME_WITHIN_MS;
    if (!fresh || !Array.isArray(state.pending) || !state.pending.length) {
      try { sessionStorage.removeItem(RUN_MARK); } catch { /* storage blocked */ }
      return;
    }
    running = true;
    run(state.pending, state);
  })();
})();
