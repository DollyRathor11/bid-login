(() => {
  const STATE_KEY = "gemRepresentationReplySync";
  const STOP_KEY = "gemRepresentationReplyStop";
  const STALE_MS = 120000;
  const startButton = document.getElementById("replies-start");
  const stopButton = document.getElementById("replies-stop");
  const copyButton = document.getElementById("replies-copy");
  const output = document.getElementById("replies-state");
  let last = null;

  function render(sync) {
    last = sync || null;
    const active = ["starting", "running"].includes(sync?.status) && Date.now() - Number(sync?.updatedAt || 0) < STALE_MS;
    startButton.disabled = active;
    startButton.textContent = active ? "Scan running..." : "Scan Representation Replies";
    stopButton.disabled = !active;
    output.className = `sync-state ${sync?.status || ""}`;
    if (!sync) {
      output.textContent = "Ready. Only bids still waiting for a reply are checked.";
      return;
    }
    const details = sync.total ? ` (${sync.checked || 0}/${sync.total} checked · ${sync.saved || 0} replies saved)` : "";
    output.textContent = `${sync.message || sync.status}${details}`;
  }

  const refresh = () => chrome.storage.local.get(STATE_KEY, (stored) => render(stored[STATE_KEY]));

  startButton.addEventListener("click", () => {
    startButton.disabled = true;
    output.className = "sync-state";
    output.textContent = "Starting...";
    chrome.runtime.sendMessage({ type: "START_GEM_REPRESENTATION_REPLIES" }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        startButton.disabled = false;
        output.className = "sync-state failed";
        output.textContent = chrome.runtime.lastError?.message || response?.error || "Unable to start.";
        return;
      }
      refresh();
    });
  });

  stopButton.addEventListener("click", () => {
    stopButton.disabled = true;
    chrome.storage.local.set({ [STOP_KEY]: true });
  });

  copyButton.addEventListener("click", async () => {
    const lines = [output.textContent || ""];
    const problems = last?.problems || [];
    if (problems.length) lines.push("", `Bids without a saved reply (${problems.length}):`);
    for (const item of problems) lines.push(`- ${item.bidNo}: ${item.reason}`);
    await navigator.clipboard.writeText(lines.join("\n"));
    copyButton.textContent = "Copied";
    window.setTimeout(() => { copyButton.textContent = "Copy status"; }, 1200);
  });

  refresh();
  window.setInterval(refresh, 1000);
})();
