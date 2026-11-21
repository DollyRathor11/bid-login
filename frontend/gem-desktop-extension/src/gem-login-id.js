// Remembers which GeM User Id last logged in on GeM's login page (never the
// password). Some GeM data is shown only to the login that created it, so a
// scan of it (My Representation) checks this before starting.
(() => {
  const USER_ID_LABEL = /gem\s+user\s+id|user\s*id|login\s*id/i;

  function userIdField() {
    if (!document.querySelector('input[type="password"]')) return null;
    return [...document.querySelectorAll('input:not([type]), input[type="text"], input[type="email"]')].find((input) => {
      const label = (input.id && document.querySelector(`label[for="${CSS.escape(input.id)}"]`))
        || input.closest("label")
        || input.parentElement?.closest("div, td, li")?.querySelector("label");
      const hint = [label?.textContent, input.name, input.id, input.placeholder, input.getAttribute("aria-label")]
        .filter(Boolean).join(" ");
      return USER_ID_LABEL.test(hint) && !/otp|captcha|mobile/i.test(`${input.name} ${input.id}`);
    }) || null;
  }

  function remember() {
    const value = String(userIdField()?.value || "").trim();
    if (value) chrome.storage.local.set({ gemLoginUserId: value, gemLoginUserIdAt: Date.now() });
  }

  document.addEventListener("submit", remember, true);
  document.addEventListener("click", (event) => {
    const control = event.target.closest?.('button, input[type="submit"], input[type="button"], a');
    if (control && !/cancel|resend|forgot|reset/i.test(control.textContent || control.value || "")) remember();
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter") remember();
  }, true);
})();
