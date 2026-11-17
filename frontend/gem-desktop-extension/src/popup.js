const state = document.getElementById("state");
const message = document.getElementById("message");
const syncButton = document.getElementById("sync-bids");
const clarificationButton = document.getElementById("sync-clarifications");
const counterOfferButton = document.getElementById("sync-counter-offers");
const counterOfferState = document.getElementById("counter-offer-state");
const pauseCounterOfferButton = document.getElementById("pause-counter-offers");
const retryCounterOfferButton = document.getElementById("retry-counter-offers");
const copyCounterOfferStatus = document.getElementById("copy-counter-offer-status");
const pauseSyncButton = document.getElementById("pause-sync");
const retrySyncButton = document.getElementById("retry-sync");
const syncState = document.getElementById("sync-state");
const copySyncStatus = document.getElementById("copy-sync-status");
const opportunityButton = document.getElementById("sync-opportunities");
const pauseOpportunityButton = document.getElementById("pause-opportunities");
const copyOpportunityStatus = document.getElementById("copy-opportunity-status");
const retryOpportunityButton = document.getElementById("retry-opportunities");
const opportunityState = document.getElementById("opportunity-state");
const TERMINAL_STATUS_TTL_MS = 15_000;
const TERMINAL_STATUSES = new Set(["failed", "stopped", "authentication_required"]);
const ACTIVE_SCAN_STATUSES = new Set(["running", "starting", "paused", "recovering"]);
// Retry Scan is always shown. On a scan that is still running (or stuck) it
// reloads the GeM tab and continues at the saved page; on a failed or stopped
// scan it restarts from that page.
let opportunityRunning = false;
const clearingStateKeys = new Set();
let acxxelConnected = false;
let lastSyncState = null;
document.getElementById("version").textContent = `v${chrome.runtime.getManifest().version}`;

function visibleSyncState(sync, storageKey) {
  const updatedAt = Number(sync?.updatedAt || 0);
  // Keep incomplete disqualified scans and their bid-level reasons visible,
  // and a Bid To Be Participated scan that Retry Scan can still continue.
  if (storageKey === "gemBidSync" || sync?.retry) return sync;
  const expired = TERMINAL_STATUSES.has(sync?.status)
    && updatedAt > 0
    && Date.now() - updatedAt >= TERMINAL_STATUS_TTL_MS;
  if (!expired) return sync;
  if (!clearingStateKeys.has(storageKey)) {
    clearingStateKeys.add(storageKey);
    chrome.storage.local.remove(storageKey, () => clearingStateKeys.delete(storageKey));
  }
  return null;
}

function showSyncState(sync) {
  sync = visibleSyncState(sync, "gemBidSync");
  lastSyncState = sync;
  syncState.className = `sync-state ${sync?.status || ""}`;
  if (!acxxelConnected) {
    syncState.className = "sync-state authentication_required";
    syncState.textContent = "Acxxel session is not connected. Open any logged-in Acxxel page and refresh it once.";
  } else if (!sync) {
    syncState.textContent = "Ready to scan. Refresh the GeM page if required.";
  } else {
    const details = [];
    if (sync.page) details.push(`Page ${sync.page}`);
    if (sync.pending?.length) details.push(`${sync.pending.length} pending retry`);
    if (sync.status !== "idle" && Number.isFinite(sync.checked)) details.push(`${sync.checked} checked`);
    if (sync.status !== "idle" && Number.isFinite(sync.saved)) details.push(`${sync.saved} saved`);
    if (sync.status !== "idle" && Number.isFinite(sync.rejected) && sync.rejected > 0) details.push(`${sync.rejected} not saved`);
    const updated = sync.updatedAt ? new Date(sync.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
    syncState.textContent = `${sync.message || sync.status}${details.length ? ` (${details.join(" · ")})` : ""}${updated ? ` · Updated ${updated}` : ""}`;
  }
  // The Counter Offer scan runs on the same seller-list scanner but has its
  // own section: each section shows only its own scan's progress.
  const counterOffer = sync?.mode === "counteroffer";
  if (counterOffer) {
    counterOfferState.className = syncState.className;
    counterOfferState.textContent = syncState.textContent;
    syncState.className = "sync-state";
    syncState.textContent = "Ready to scan. Refresh the GeM page if required.";
  } else {
    counterOfferState.className = acxxelConnected ? "sync-state" : syncState.className;
    counterOfferState.textContent = acxxelConnected ? "Ready to scan Counter Offer." : syncState.textContent;
  }
  const active = ACTIVE_SCAN_STATUSES.has(sync?.status);
  const paused = sync?.status === "paused";
  const retryable = ["failed", "stopped"].includes(sync?.status);

  // Both buttons drive the same seller-list scan; the running one shows its state.
  const runningLabel = paused
    ? "Sync paused..."
    : sync?.status === "recovering" ? "Recovering scan..." : "Scan running...";
  const mode = sync?.mode || "disqualified";
  syncButton.disabled = !acxxelConnected || active;
  syncButton.textContent = active && mode === "disqualified" ? runningLabel : "Scan Disqualified Bid";
  clarificationButton.disabled = !acxxelConnected || active;
  clarificationButton.textContent = active && mode === "clarification" ? runningLabel : "Scan Clarification";
  counterOfferButton.disabled = !acxxelConnected || active;
  counterOfferButton.textContent = active && mode === "counteroffer" ? runningLabel : "Scan Counter Offer";

  const pausable = active && !["starting", "recovering"].includes(sync?.status);
  pauseSyncButton.hidden = false;
  pauseSyncButton.disabled = !pausable || counterOffer;
  pauseSyncButton.textContent = paused && !counterOffer ? "Resume Sync" : "Pause Sync";
  pauseCounterOfferButton.disabled = !pausable || !counterOffer;
  pauseCounterOfferButton.textContent = paused && counterOffer ? "Resume Scan" : "Pause Scan";

  retrySyncButton.hidden = !retryable || counterOffer;
  retrySyncButton.disabled = false;
  retryCounterOfferButton.hidden = !retryable || !counterOffer;
  retryCounterOfferButton.disabled = false;
}

function showOpportunityState(sync) {
  sync = visibleSyncState(sync, "gemOpportunitySync");
  opportunityState.className = `sync-state ${sync?.status || ""}`;
  if (!acxxelConnected) {
    opportunityState.className = "sync-state authentication_required";
    opportunityState.textContent = "Acxxel session is not connected. Open any logged-in Acxxel page and refresh it once.";
  } else if (!sync) {
    opportunityState.textContent = "Ready to scan. Refresh the GeM page if required.";
  } else {
    const details = [];
    if (sync.page) details.push(`Page ${sync.page}`);
    if (sync.status !== "idle" && Number.isFinite(sync.checked)) details.push(`${sync.checked} checked`);
    if (sync.status !== "idle" && Number.isFinite(sync.saved)) details.push(`${sync.saved} saved`);
    const updated = sync.updatedAt ? new Date(sync.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
    opportunityState.textContent = `${sync.message || sync.status}${details.length ? ` (${details.join(" · ")})` : ""}${updated ? ` · Updated ${updated}` : ""}`;
  }
  const active = ACTIVE_SCAN_STATUSES.has(sync?.status);
  const paused = sync?.status === "paused";
  opportunityButton.disabled = !acxxelConnected || active;
  opportunityButton.textContent = paused
    ? "Scan paused..."
    : sync?.status === "recovering" ? "Recovering scan..."
      : active ? "Scan running..." : "Scan Bid To Be Participated";
  pauseOpportunityButton.hidden = false;
  pauseOpportunityButton.disabled = !active || ["starting", "recovering"].includes(sync?.status);
  pauseOpportunityButton.textContent = paused ? "Resume Scan" : "Pause Scan";

  opportunityRunning = active;
  retryOpportunityButton.hidden = false;
  retryOpportunityButton.disabled = !acxxelConnected || !sync?.retry?.page || sync?.status === "complete";
  retryOpportunityButton.title = retryOpportunityButton.disabled
    ? "No unfinished scan to retry."
    : `Continue the scan at page ${sync.retry.page}.`;
}

function preventConcurrentScans(bidSync, opportunitySync) {
  const bidActive = ACTIVE_SCAN_STATUSES.has(bidSync?.status);
  const opportunityActive = ACTIVE_SCAN_STATUSES.has(opportunitySync?.status);
  if (bidActive) {
    opportunityButton.disabled = true;
    retryOpportunityButton.disabled = true;
  }
  if (opportunityActive) {
    syncButton.disabled = true;
    clarificationButton.disabled = true;
    counterOfferButton.disabled = true;
    retrySyncButton.disabled = true;
    retryCounterOfferButton.disabled = true;
  }
}

function refreshSyncState() {
  chrome.runtime.sendMessage({ type: "GET_GEM_BID_SYNC_STATE" }, (response) => {
    if (!chrome.runtime.lastError && response?.ok) {
      acxxelConnected = Boolean(response.connected);
      state.textContent = acxxelConnected ? "Connected" : "Disconnected";
      message.textContent = acxxelConnected ? "" : "Open any logged-in Acxxel page and refresh it once.";
      showSyncState(response.gemBidSync);
      showOpportunityState(response.gemOpportunitySync);
      preventConcurrentScans(response.gemBidSync, response.gemOpportunitySync);
    }
  });
}

function startListScan(mode) {
  syncButton.disabled = true;
  clarificationButton.disabled = true;
  counterOfferButton.disabled = true;
  syncState.textContent = mode === "clarification" ? "Starting GeM clarification sync..."
    : mode === "counteroffer" ? "Starting GeM counter offer sync..." : "Starting GeM bid sync...";
  chrome.runtime.sendMessage({ type: "START_GEM_BID_SYNC", mode }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      syncState.className = "sync-state failed";
      syncState.textContent = chrome.runtime.lastError?.message || response?.error || "Unable to start sync.";
      syncButton.disabled = false;
      clarificationButton.disabled = false;
      counterOfferButton.disabled = false;
      return;
    }
    syncState.className = "sync-state";
    syncState.textContent = "Sync started. You may close this popup.";
    window.setTimeout(refreshSyncState, 300);
  });
}

syncButton.addEventListener("click", () => startListScan("disqualified"));
clarificationButton.addEventListener("click", () => startListScan("clarification"));
counterOfferButton.addEventListener("click", () => startListScan("counteroffer"));

opportunityButton.addEventListener("click", () => {
  opportunityButton.disabled = true;
  opportunityState.textContent = "Starting Bid To Be Participated scan...";
  chrome.runtime.sendMessage({ type: "START_GEM_OPPORTUNITY_SYNC" }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      opportunityState.className = "sync-state failed";
      opportunityState.textContent = chrome.runtime.lastError?.message || response?.error || "Unable to start Bid To Be Participated scan.";
      opportunityButton.disabled = false;
      return;
    }
    window.setTimeout(refreshSyncState, 300);
  });
});

pauseOpportunityButton.addEventListener("click", () => {
  const resuming = pauseOpportunityButton.textContent === "Resume Scan";
  pauseOpportunityButton.disabled = true;
  chrome.runtime.sendMessage({ type: resuming ? "RESUME_GEM_OPPORTUNITY_SYNC" : "PAUSE_GEM_OPPORTUNITY_SYNC" }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      pauseOpportunityButton.disabled = false;
      opportunityState.className = "sync-state failed";
      opportunityState.textContent = chrome.runtime.lastError?.message || response?.error || `Unable to ${resuming ? "resume" : "pause"} scan.`;
      return;
    }
    window.setTimeout(refreshSyncState, 200);
  });
});

// The Disqualified/Clarification section and the Counter Offer section drive
// the same seller-list scanner, each with its own Pause / Retry / Copy.
function pauseListScan(button, output, labels) {
  const resuming = button.textContent === labels.resume;
  button.disabled = true;
  button.textContent = resuming ? "Resuming..." : "Pausing...";
  chrome.runtime.sendMessage({ type: resuming ? "RESUME_GEM_BID_SYNC" : "PAUSE_GEM_BID_SYNC" }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      button.disabled = false;
      button.textContent = resuming ? labels.resume : labels.pause;
      output.className = "sync-state failed";
      output.textContent = chrome.runtime.lastError?.message || response?.error
        || `Unable to ${resuming ? "resume" : "pause"} sync.`;
      return;
    }
    window.setTimeout(refreshSyncState, 200);
  });
}

function retryListScan(button, output, label) {
  button.disabled = true;
  button.textContent = "Retrying...";
  output.textContent = "Retrying from the saved page...";
  chrome.runtime.sendMessage({ type: "START_GEM_BID_SYNC", resume: true }, (response) => {
    button.textContent = label;
    if (chrome.runtime.lastError || !response?.ok) {
      button.disabled = false;
      output.className = "sync-state failed";
      output.textContent = chrome.runtime.lastError?.message || response?.error || "Unable to retry sync.";
      return;
    }
    window.setTimeout(refreshSyncState, 300);
  });
}

async function copyListScanStatus(button, output) {
  const lines = [output.textContent || ""];
  const pending = lastSyncState?.pending;
  if (Array.isArray(pending) && pending.length) {
    lines.push("", `Pending bids (${pending.length}${pending.length > 25 ? ", first 25 shown" : ""}):`);
    for (const item of pending.slice(0, 25)) {
      lines.push(`- ${item.bidNo} (page ${item.page}): ${item.reason || "unknown reason"}`);
    }
  }
  await navigator.clipboard.writeText(lines.join("\n"));
  button.textContent = "Copied";
  window.setTimeout(() => { button.textContent = "Copy status"; }, 1200);
}

pauseSyncButton.addEventListener("click", () => pauseListScan(pauseSyncButton, syncState, { pause: "Pause Sync", resume: "Resume Sync" }));
pauseCounterOfferButton.addEventListener("click", () => pauseListScan(pauseCounterOfferButton, counterOfferState, { pause: "Pause Scan", resume: "Resume Scan" }));
retrySyncButton.addEventListener("click", () => retryListScan(retrySyncButton, syncState, "Retry Sync"));
retryCounterOfferButton.addEventListener("click", () => retryListScan(retryCounterOfferButton, counterOfferState, "Retry Scan"));

retryOpportunityButton.addEventListener("click", () => {
  retryOpportunityButton.disabled = true;
  retryOpportunityButton.textContent = "Retrying...";
  opportunityState.textContent = "Retrying Bid To Be Participated scan from the saved page...";
  // A running (or stuck) scan is restarted by reloading its tab.
  const type = opportunityRunning ? "FORCE_RETRY_GEM_OPPORTUNITY_SYNC" : "START_GEM_OPPORTUNITY_SYNC";
  chrome.runtime.sendMessage({ type, resume: true }, (response) => {
    retryOpportunityButton.textContent = "Retry Scan";
    if (chrome.runtime.lastError || !response?.ok) {
      retryOpportunityButton.disabled = false;
      opportunityState.className = "sync-state failed";
      opportunityState.textContent = chrome.runtime.lastError?.message || response?.error || "Unable to retry scan.";
      return;
    }
    window.setTimeout(refreshSyncState, 300);
  });
});

window.setInterval(refreshSyncState, 1000);

copySyncStatus.addEventListener("click", () => copyListScanStatus(copySyncStatus, syncState));
copyCounterOfferStatus.addEventListener("click", () => copyListScanStatus(copyCounterOfferStatus, counterOfferState));

copyOpportunityStatus.addEventListener("click", async () => {
  await navigator.clipboard.writeText(opportunityState.textContent || "");
  copyOpportunityStatus.textContent = "Copied";
  window.setTimeout(() => { copyOpportunityStatus.textContent = "Copy status"; }, 1200);
});

chrome.runtime.sendMessage({ type: "GET_STATE" }, (result) => {
  if (!result?.ok) {
    acxxelConnected = false;
    state.textContent = "Disconnected";
    message.textContent = result?.error || "Open Acxxel and log in again.";
    showSyncState(null);
    showOpportunityState(null);
    return;
  }
  acxxelConnected = Boolean(result.connected);
  state.textContent = acxxelConnected ? "Connected" : "Disconnected";
  showSyncState(result.gemBidSync);
  showOpportunityState(result.gemOpportunitySync);
  preventConcurrentScans(result.gemBidSync, result.gemOpportunitySync);
  if (!acxxelConnected) {
    message.textContent = "Open any logged-in Acxxel page and refresh it once.";
    return;
  }
});
