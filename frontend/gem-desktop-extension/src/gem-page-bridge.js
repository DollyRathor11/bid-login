document.addEventListener("acxxel-gem-select-option", (event) => {
  const choiceId = event.detail?.choiceId;
  if (!choiceId) return;
  const choice = document.querySelector(`[data-acxxel-choice-id="${CSS.escape(choiceId)}"]`);
  if (!choice) return;

  const row = choice.closest(".ui-select-choices-row") || choice;
  const clickable = row.querySelector(".ui-select-choices-row-inner, a, button") || row;
  let selected = false;
  try {
    if (window.angular) {
      const angularTarget = row.matches("[ng-click], [data-ng-click]")
        ? row
        : row.querySelector("[ng-click], [data-ng-click]") || clickable;
      const rowScope = window.angular.element(row).scope()
        || window.angular.element(angularTarget).scope();
      const repeatNode = row.closest("[ng-repeat], [data-ng-repeat]");
      const repeatExpression = repeatNode?.getAttribute("ng-repeat")
        || repeatNode?.getAttribute("data-ng-repeat")
        || "";
      const itemName = repeatExpression.match(/^\s*([\w$]+)\s+in\s+/)?.[1];
      const item = (itemName && rowScope?.[itemName])
        ?? rowScope?.item
        ?? rowScope?.$item;
      let selectScope = rowScope;
      while (selectScope && !selectScope.$select) selectScope = selectScope.$parent;
      if (selectScope?.$select && item !== undefined) {
        selectScope.$evalAsync(() => {
          selectScope.$select.select(item, selectScope.$select.skipFocusser);
        });
        selected = true;
      } else {
        window.angular.element(angularTarget).triggerHandler("click");
        window.angular.element(angularTarget).scope()?.$root?.$evalAsync();
        selected = true;
      }
    } else {
      clickable.click();
      selected = true;
    }
  } finally {
    document.dispatchEvent(new CustomEvent("acxxel-gem-option-selected", {
      detail: { choiceId, selected },
    }));
  }
});

document.addEventListener("acxxel-gem-click-control", (event) => {
  const clickId = event.detail?.clickId;
  if (!clickId) return;
  const marked = document.querySelector(`[data-acxxel-click-id="${CSS.escape(clickId)}"]`);
  if (!marked) return;
  const target = marked.closest("[ng-click], [data-ng-click], a, button, [role=button]") || marked;
  let clicked = false;
  try {
    if (window.jQuery && (marked.hasAttribute("data-acxxel-jquery-click") || target.matches?.(".view_reason, [class*=clarif]"))) {
      window.jQuery(target).trigger("click");
      clicked = true;
    } else if (window.angular) {
      const angularTarget = target.closest("[ng-click], [data-ng-click]")
        || target.querySelector?.("[ng-click], [data-ng-click]")
        || target;
      const expression = angularTarget.getAttribute?.("ng-click")
        || angularTarget.getAttribute?.("data-ng-click")
        || "";
      const scope = window.angular.element(angularTarget).scope()
        || window.angular.element(angularTarget).isolateScope?.();
      if (scope && expression) {
        scope.$evalAsync(expression);
        clicked = true;
      } else {
        window.angular.element(angularTarget).triggerHandler("click");
        scope?.$root?.$evalAsync();
        clicked = true;
      }
    }
    // Do not fire a second native click after Angular/jQuery already handled the
    // control. Double-clicking pagination can launch overlapping page requests.
    if (!clicked) {
      target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      HTMLElement.prototype.click.call(target);
      clicked = true;
    }
  } finally {
    document.dispatchEvent(new CustomEvent("acxxel-gem-control-clicked", {
      detail: { clickId, clicked },
    }));
  }
});

document.addEventListener("acxxel-gem-select-value", (event) => {
  const controlId = event.detail?.controlId;
  const wanted = String(event.detail?.value ?? "").trim();
  const label = String(event.detail?.label ?? "");
  if (!controlId || !wanted || !window.angular) return;
  const target = document.querySelector(
    `[data-acxxel-control-id="${CSS.escape(controlId)}"]`
  );
  let selected = false;
  try {
    const normalize = (value) => String(value ?? "")
      .toLowerCase()
      .replace(/\bwindows\b/g, "window")
      .replace(/\byears?\b/g, "")
      .replace(/[^a-z0-9]+/g, "");
    const itemText = (item) => {
      if (item === null || item === undefined) return "";
      if (typeof item !== "object") return String(item);
      const preferredKeys = [
        "name", "label", "text", "value", "description", "title",
        "option", "display", "display_name",
      ];
      const preferred = preferredKeys
        .map((key) => item[key])
        .filter((value) => value !== undefined && value !== null)
        .join(" ");
      if (preferred) return preferred;
      return Object.values(item)
        .filter((value) => ["string", "number", "boolean"].includes(typeof value))
        .join(" ");
    };
    let scope = window.angular.element(target).scope();
    while (scope && !scope.$select) scope = scope.$parent;
    const select = scope?.$select;
    const wantedNormalized = normalize(wanted);
    const items = [
      ...(Array.isArray(select?.items) ? select.items : []),
      ...(Array.isArray(select?.parserResult?.source) ? select.parserResult.source : []),
    ];
    const exactItems = items.filter((item) => normalize(itemText(item)) === wantedNormalized);
    const partialItems = items.filter((item) => {
      const normalized = normalize(itemText(item));
      return normalized && wantedNormalized
        && (normalized.includes(wantedNormalized) || wantedNormalized.includes(normalized));
    });
    let selectedItem = exactItems.length === 1
      ? exactItems[0]
      : partialItems.length === 1 ? partialItems[0] : undefined;
    if (wanted === "__FIRST_NON_PLACEHOLDER__") {
      const validItems = items.filter((item) => {
        const text = normalize(itemText(item));
        return text && !/^(?:select|none)$/.test(text);
      });
      if (validItems.length === 1) selectedItem = validItems[0];
    }
    if (
      selectedItem === undefined
      && /graphics type/i.test(label)
      && /^integrated$/i.test(wanted)
    ) {
      const integratedItems = items.filter((item) => {
        const text = normalize(itemText(item));
        return text
          && !/select|dedicated|discrete/.test(text)
          && (/integrated|onboard/.test(text) || items.length === 2);
      });
      if (integratedItems.length === 1) selectedItem = integratedItems[0];
    }
    if (select && selectedItem !== undefined) {
      scope.$evalAsync(() => select.select(selectedItem, select.skipFocusser));
      selected = true;
    }
  } finally {
    document.dispatchEvent(new CustomEvent("acxxel-gem-value-selected", {
      detail: { controlId, selected },
    }));
  }
});

// Jump the seller-bid list straight to a saved page (used when a disqualified
// scan resumes after a reload). GeM's list uses jQuery simplePagination
// (#page-N links); an Angular pager is handled as a fallback. The content
// script verifies the rendered cards afterwards, so a no-op here is harmless.
document.addEventListener("acxxel-gem-select-page", (event) => {
  const requestId = event.detail?.requestId;
  const page = Number(event.detail?.page || 0);
  if (!requestId) return;
  let method = "";
  try {
    if (Number.isInteger(page) && page > 0) {
      const $ = window.jQuery;
      if ($?.fn?.pagination) {
        const pager = [...document.querySelectorAll("*")]
          .find((node) => $(node).data("pagination"));
        if (pager) {
          const total = Number($(pager).pagination("getPagesCount") || 0);
          if (!total || page <= total) {
            $(pager).pagination("selectPage", page);
            method = "simplePagination";
          }
        }
      }
      if (!method && window.angular) {
        const pagers = document.querySelectorAll(
          "[uib-pagination], [pagination], [dir-pagination-controls], ul[class*=pagination]"
        );
        for (const node of pagers) {
          const element = window.angular.element(node);
          const scope = element.isolateScope?.() || element.scope();
          if (typeof scope?.selectPage === "function") {
            scope.$evalAsync(() => scope.selectPage(page));
            method = "angular";
            break;
          }
          if (typeof scope?.setCurrent === "function") {
            scope.$evalAsync(() => scope.setCurrent(page));
            method = "angular";
            break;
          }
        }
      }
    }
  } catch {
    method = "";
  } finally {
    document.dispatchEvent(new CustomEvent("acxxel-gem-page-selected", {
      detail: { requestId, selected: Boolean(method), method },
    }));
  }
});

// All Bids search (Representation Replies). GeM binds its search with jQuery
// and checks event.which === 13; an Enter dispatched from the content script
// always has which 0, so the search is run here with jQuery's own events.
document.addEventListener("acxxel-gem-search", (event) => {
  const { searchId, buttonId, value } = event.detail || {};
  const input = searchId && document.querySelector(`[data-acxxel-search-id="${CSS.escape(searchId)}"]`);
  const button = buttonId && document.querySelector(`[data-acxxel-search-button-id="${CSS.escape(buttonId)}"]`);
  const done = [];
  try {
    if (input) {
      const $ = window.jQuery;
      if ($) {
        $(input).val(value).trigger("input").trigger("change").trigger("keyup");
        for (const type of ["keydown", "keypress", "keyup"]) {
          $(input).trigger($.Event(type, { which: 13, keyCode: 13, key: "Enter" }));
        }
        done.push("jQuery Enter");
        if (button) {
          $(button).trigger("click");
          done.push("jQuery click");
        }
      } else {
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.form?.requestSubmit?.();
        if (button) button.click();
        done.push("no jQuery: native events");
      }
    }
  } finally {
    document.dispatchEvent(new CustomEvent("acxxel-gem-searched", {
      detail: { searchId, done: done.join(" + ") || "search box not found by the page bridge" },
    }));
  }
});

// Representation Replies: GeM opens the replies ("Publish Representations")
// in a new window. While armed, the next window.open is caught instead: its
// address is handed back, or, for a window GeM fills with document.write, the
// written HTML. Nothing is opened; the arming ends after 20 seconds.
document.addEventListener("acxxel-gem-capture-open", (event) => {
  const captureId = event.detail?.captureId;
  if (!captureId) return;
  const original = window.open;
  let finished = false;
  let html = "";
  const finish = (detail) => {
    if (finished) return;
    finished = true;
    window.open = original;
    document.dispatchEvent(new CustomEvent("acxxel-gem-open-captured", { detail: { captureId, ...detail } }));
  };
  window.open = function captureOpen(url) {
    let address = "";
    try { address = url ? new URL(String(url), location.href).href : ""; } catch { address = String(url || ""); }
    if (address && !/^about:blank/i.test(address)) {
      finish({ url: address });
      return null;
    }
    // A blank window that GeM writes into: collect what it writes.
    const fakeDocument = {
      open() { return fakeDocument; },
      write(...parts) { html += parts.join(""); },
      writeln(...parts) { html += `${parts.join("")}\n`; },
      close() { finish({ html }); },
      body: null,
    };
    setTimeout(() => finish({ html }), 3000);
    return { document: fakeDocument, focus() {}, close() {}, print() {}, closed: false, location: { href: "about:blank" } };
  };
  setTimeout(() => finish({}), 20000);
});
