/** Injected scripts for general page interaction (any site, not only WebMCP). */

function runInspectPage(maxLength = 4000) {
  function queryAll(selector: string): HTMLElement[] {
    const els: HTMLElement[] = [];
    try {
      const topEls = document.querySelectorAll(selector);
      for (let a = 0; a < topEls.length; a++) {
        els.push(topEls[a] as HTMLElement);
      }
    } catch {}
    try {
      const iframes = document.querySelectorAll("iframe");
      for (let f = 0; f < iframes.length; f++) {
        try {
          const doc = iframes[f].contentDocument || iframes[f].contentWindow?.document;
          if (doc) {
            const subEls = doc.querySelectorAll(selector);
            for (let s = 0; s < subEls.length; s++) {
              els.push(subEls[s] as HTMLElement);
            }
          }
        } catch {}
      }
    } catch {}
    return els;
  }

  function label(el: HTMLElement): string {
    let labelEl: HTMLElement | null = null;
    const doc = el.ownerDocument || document;
    if (el.id) {
      labelEl = doc.querySelector('label[for="' + el.id + '"]') as HTMLElement | null;
    }
    if (!labelEl) {
      labelEl = el.closest("label") as HTMLElement | null;
    }
    const labelText = labelEl ? (labelEl.textContent || "").replace(/\s+/g, " ").trim() : "";
    return (
      el.getAttribute("aria-label") ||
      labelText.slice(0, 80) ||
      el.getAttribute("placeholder") ||
      el.getAttribute("name") ||
      el.getAttribute("title") ||
      (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60) ||
      el.tagName.toLowerCase()
    );
  }

  function assignRef(el: HTMLElement, prefix: string, idx: number): string {
    if (!el.getAttribute("data-berry-ref")) {
      el.setAttribute("data-berry-ref", prefix + idx);
    }
    return '[data-berry-ref="' + el.getAttribute("data-berry-ref") + '"]';
  }

  const inputs: any[] = [];
  const buttons: any[] = [];
  const links: any[] = [];

  const inputEls = queryAll(
    'input:not([type="hidden"]):not([type="submit"]), textarea, select, [role="combobox"], [role="listbox"]'
  );
  for (let i = 0; i < inputEls.length && inputs.length < 24; i++) {
    const el = inputEls[i] as any;
    if (el.offsetParent === null && el.type !== "hidden") {
      const isEmailInput =
        el.id === "mail" ||
        el.name === "mail" ||
        el.type === "email" ||
        (el.value && el.value.indexOf("@") !== -1);
      if (!isEmailInput) continue;
    }
    inputs.push({
      selector: assignRef(el, "in", i),
      type: el.type || el.tagName.toLowerCase(),
      label: label(el),
      value: (el.value || "").slice(0, 80),
    });
  }

  const btnEls = queryAll(
    'button, input[type="submit"], input[type="button"], [role="button"]'
  );
  for (let j = 0; j < btnEls.length && buttons.length < 20; j++) {
    const b = btnEls[j];
    if (b.offsetParent === null) continue;
    buttons.push({
      selector: assignRef(b, "btn", j),
      label: label(b),
    });
  }

  const checkboxes: any[] = [];
  const cbEls = queryAll('input[type="checkbox"], [role="checkbox"]');
  for (let c = 0; c < cbEls.length && checkboxes.length < 16; c++) {
    const cb = cbEls[c];
    let isVisible = cb.offsetParent !== null;
    if (!isVisible) {
      let associatedLabel: HTMLElement | null = null;
      const doc = cb.ownerDocument || document;
      if (cb.id) {
        associatedLabel = doc.querySelector('label[for="' + cb.id + '"]') as HTMLElement | null;
      }
      if (!associatedLabel) {
        associatedLabel = cb.closest("label") as HTMLElement | null;
      }
      if (associatedLabel && associatedLabel.offsetParent !== null) {
        isVisible = true;
      }
    }
    if (!isVisible) continue;
    let isChecked = false;
    if (cb.tagName === "INPUT") {
      isChecked = Boolean((cb as HTMLInputElement).checked);
    } else {
      isChecked = cb.getAttribute("aria-checked") === "true" ||
        cb.classList.contains("checked") ||
        cb.classList.contains("is-checked") ||
        cb.getAttribute("checked") === "true";
    }
    checkboxes.push({
      selector: assignRef(cb, "cb", c),
      label: label(cb),
      checked: isChecked,
    });
  }

  const linkEls = queryAll("a[href]");
  for (let k = 0; k < linkEls.length && links.length < 20; k++) {
    const a = linkEls[k] as HTMLAnchorElement;
    if (a.offsetParent === null) continue;
    const href = a.href || "";
    if (!href || href.startsWith("javascript:")) continue;
    links.push({
      selector: assignRef(a, "lnk", k),
      label: label(a),
      href: href.slice(0, 200),
    });
  }

  let bodyText = "";
  try {
    bodyText = ((document.body && document.body.innerText) || "");
    
    // Extract and append input and textarea values
    const allInputs = queryAll("input, textarea");
    let inputValuesText = "";
    for (let idx = 0; idx < allInputs.length; idx++) {
      const val = (allInputs[idx] as HTMLInputElement).value;
      if (val && val.trim()) {
        const labelOrName =
          label(allInputs[idx]) ||
          allInputs[idx].id ||
          allInputs[idx].getAttribute("name") ||
          "input";
        inputValuesText += "\n[Input value] " + labelOrName + ": " + val;
      }
    }
    if (inputValuesText) {
      bodyText += "\n\n[Form Input Values]:" + inputValuesText;
    }

    const iframes = document.querySelectorAll("iframe");
    for (let f = 0; f < iframes.length; f++) {
      try {
        const doc = iframes[f].contentDocument || iframes[f].contentWindow?.document;
        if (doc && doc.body) {
          bodyText += "\n[Iframe content]:\n" + doc.body.innerText;
          
          // Also extract inputs from iframe
          const subInputs = doc.querySelectorAll("input, textarea");
          let subInputValuesText = "";
          for (let sIdx = 0; sIdx < subInputs.length; sIdx++) {
            const sVal = (subInputs[sIdx] as HTMLInputElement).value;
            if (sVal && sVal.trim()) {
              const sLabelOrName =
                label(subInputs[sIdx] as HTMLElement) ||
                subInputs[sIdx].getAttribute("id") ||
                subInputs[sIdx].getAttribute("name") ||
                "input";
              subInputValuesText += "\n[Iframe Input value] " + sLabelOrName + ": " + sVal;
            }
          }
          if (subInputValuesText) {
            bodyText += "\n" + subInputValuesText;
          }
        }
      } catch {}
    }
    bodyText = bodyText.slice(0, 6000);
  } catch {}

  const posts: any[] = [];
  const seen: Record<string, boolean> = {};
  const tweetTexts = queryAll('[data-testid="tweetText"], article');
  for (let p = 0; p < tweetTexts.length && posts.length < 15; p++) {
    const node = tweetTexts[p];
    const snippet = (node.innerText || node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 320);
    if (!snippet || snippet.length < 8 || seen[snippet]) continue;
    seen[snippet] = true;
    posts.push({ index: posts.length, text: snippet });
  }

  return {
    pageTitle: document.title || "",
    pageUrl: location.href,
    inputs: inputs,
    buttons: buttons,
    links: links,
    checkboxes: checkboxes,
    posts: posts,
    pageTextExcerpt: bodyText.slice(0, maxLength),
  };
}

export const BROWSER_INSPECT_PAGE_SCRIPT = `(function() {
  return (${runInspectPage.toString()})(4000);
})()`;

function runClickElement(s: string) {
  function findElement(sel: string): HTMLElement | null {
    let element = document.querySelector(sel);
    if (element) return element as HTMLElement;
    try {
      const iframes = document.querySelectorAll("iframe");
      for (let f = 0; f < iframes.length; f++) {
        try {
          const doc = iframes[f].contentDocument || iframes[f].contentWindow?.document;
          if (doc) {
            element = doc.querySelector(sel);
            if (element) return element as HTMLElement;
          }
        } catch {}
      }
    } catch {}
    return null;
  }

  const el = findElement(s);
  if (!el) return { ok: false, error: "Element not found: " + s };
  try {
    let clickTarget = el;
    let rect = el.getBoundingClientRect();
    if (rect.width <= 4 || rect.height <= 4) {
      let labelEl: HTMLElement | null = null;
      const doc = el.ownerDocument || document;
      if (el.id) {
        labelEl = doc.querySelector('label[for="' + el.id + '"]') as HTMLElement | null;
      }
      if (!labelEl) {
        labelEl = el.closest("label") as HTMLElement | null;
      }
      if (labelEl) {
        const labelRect = labelEl.getBoundingClientRect();
        if (labelRect.width > 0 && labelRect.height > 0) {
          clickTarget = labelEl;
          rect = labelRect;
        }
      }
    }
    clickTarget.scrollIntoView({ block: "center", inline: "center", behavior: "instant" as any });
    if (clickTarget.focus) clickTarget.focus({ preventScroll: true });
    const rectAfterScroll = clickTarget.getBoundingClientRect();
    const x = rectAfterScroll.left + Math.max(1, rectAfterScroll.width / 2);
    const y = rectAfterScroll.top + Math.max(1, rectAfterScroll.height / 2);
    const base = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0, buttons: 1 };
    if (typeof PointerEvent === "function") {
      clickTarget.dispatchEvent(new PointerEvent("pointerdown", Object.assign({}, base, { pointerId: 1, pointerType: "mouse", isPrimary: true })));
      clickTarget.dispatchEvent(new PointerEvent("pointerup", Object.assign({}, base, { pointerId: 1, pointerType: "mouse", isPrimary: true })));
    }
    clickTarget.dispatchEvent(new MouseEvent("mousedown", base));
    clickTarget.dispatchEvent(new MouseEvent("mouseup", base));
    if (typeof clickTarget.click === "function") {
      clickTarget.click();
    } else {
      clickTarget.dispatchEvent(new MouseEvent("click", base));
    }
    return { ok: true, clicked: s };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export function buildBrowserClickScript(selector: string): string {
  return `(${runClickElement.toString()})(${JSON.stringify(selector)})`;
}

function runTypeElement(s: string, val: string, clear: boolean, pressEnter: boolean) {
  function findElement(sel: string): HTMLElement | null {
    let element = document.querySelector(sel);
    if (element) return element as HTMLElement;
    try {
      const iframes = document.querySelectorAll("iframe");
      for (let f = 0; f < iframes.length; f++) {
        try {
          const doc = iframes[f].contentDocument || iframes[f].contentWindow?.document;
          if (doc) {
            element = doc.querySelector(sel);
            if (element) return element as HTMLElement;
          }
        } catch {}
      }
    } catch {}
    return null;
  }

  const el = findElement(s) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el) return { ok: false, error: "Element not found: " + s };
  try {
    el.scrollIntoView({ block: "center", inline: "center" });
    el.focus();
    const proto = el.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) {
      desc.set.call(el, val);
    } else {
      if (clear) el.value = "";
      el.value = val;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    if (pressEnter) {
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    }
    return { ok: true, typed: val.slice(0, 40), selector: s };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export function buildBrowserTypeScript(
  selector: string,
  text: string,
  options?: { clear?: boolean; pressEnter?: boolean },
): string {
  const clear = options?.clear !== false;
  const pressEnter = options?.pressEnter === true;
  return `(${runTypeElement.toString()})(${JSON.stringify(selector)}, ${JSON.stringify(text)}, ${clear}, ${pressEnter})`;
}

function runScroll(direction: "up" | "down", amount: number) {
  const px = direction === "down" ? Math.abs(amount) : -Math.abs(amount);
  let scrolled = false;
  const candidates = [
    document.querySelector("ytd-shorts"),
    document.querySelector("#shorts-player"),
    document.querySelector("[is='ytd-shorts']"),
    document.querySelector('[data-testid="primaryColumn"]'),
    document.querySelector("main"),
    document.scrollingElement,
    document.documentElement,
    document.body
  ];
  for (let i = 0; i < candidates.length; i++) {
    const el = candidates[i];
    if (!el) continue;
    try {
      if (typeof el.scrollBy === "function") {
        el.scrollBy({ top: px, behavior: "smooth" });
        scrolled = true;
        break;
      }
    } catch {}
  }
  if (!scrolled) window.scrollBy({ top: px, behavior: "smooth" });
  return { ok: true, direction: direction, amount: px };
}

export function buildBrowserScrollScript(
  direction: "up" | "down",
  amount = 720,
): string {
  return `(${runScroll.toString()})(${JSON.stringify(direction)}, ${amount})`;
}

function runKeyPress(key: string) {
  const target = document.activeElement || document.body;
  const opts = { key: key, code: key, bubbles: true, cancelable: true };
  target.dispatchEvent(new KeyboardEvent("keydown", opts));
  target.dispatchEvent(new KeyboardEvent("keyup", opts));
  if (key === "ArrowDown" || key === "PageDown" || key === "Space") {
    window.dispatchEvent(new KeyboardEvent("keydown", opts));
    window.dispatchEvent(new KeyboardEvent("keyup", opts));
  }
  return { ok: true, key: key };
}

export function buildBrowserKeyScript(key: string): string {
  return `(${runKeyPress.toString()})(${JSON.stringify(key)})`;
}

function runSearchExtract() {
  function label(el: HTMLElement): string {
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function assignRef(el: HTMLElement, prefix: string, idx: number): string {
    if (!el.getAttribute("data-berry-ref")) {
      el.setAttribute("data-berry-ref", prefix + idx);
    }
    return '[data-berry-ref="' + el.getAttribute("data-berry-ref") + '"]';
  }

  function unwrapGoogleHref(href: string): string {
    try {
      const u = new URL(href);
      if (/google\./i.test(u.hostname) && u.pathname === "/url") {
        const q = u.searchParams.get("q") || u.searchParams.get("url");
        if (q) return q;
      }
    } catch {}
    return href;
  }

  function isExternal(href: string): boolean {
    if (!href || href.startsWith("javascript:")) return false;
    try {
      const u = new URL(href, location.href);
      if (/^(data:|mailto:|tel:)/i.test(u.protocol)) return false;
      const host = u.hostname.replace(/^www\./, "");
      const pageHost = location.hostname.replace(/^www\./, "");
      if (host === pageHost) return false;
      if (/google\./i.test(host) && u.pathname !== "/url") return false;
      return true;
    } catch {
      return false;
    }
  }

  function pushResult(
    results: any[],
    seen: Record<string, boolean>,
    title: string,
    href: string,
    el: HTMLElement | null,
    prefix: string,
    idx: number
  ) {
    if (!title || title.length < 2 || !href) return;
    const clean = unwrapGoogleHref(href);
    if (!isExternal(clean) && !isExternal(href)) return;
    const key = clean || href;
    if (seen[key]) return;
    seen[key] = true;
    results.push({
      title: title.slice(0, 140),
      href: (clean || href).slice(0, 500),
      selector: el ? assignRef(el, prefix, idx) : null,
    });
  }

  const host = location.hostname.replace(/^www\./, "");
  const results: any[] = [];
  const seen: Record<string, boolean> = {};

  if (/google\./i.test(host)) {
    const blocks = document.querySelectorAll("#search .g, div.Gx5Zad, div[data-sokoban-container]");
    for (let i = 0; i < blocks.length && results.length < 10; i++) {
      const block = blocks[i];
      const anchors = block.querySelectorAll("a[href]");
      for (let j = 0; j < anchors.length; j++) {
        const a = anchors[j] as HTMLAnchorElement;
        const h3 = a.querySelector("h3") as HTMLElement | null;
        if (!h3) continue;
        pushResult(results, seen, label(h3), a.href, a, "sr", results.length);
        if (results.length >= 10) break;
      }
    }
  } else if (/duckduckgo\./i.test(host)) {
    const ddg = document.querySelectorAll('article[data-testid="result"], .result');
    for (let d = 0; d < ddg.length && results.length < 10; d++) {
      const row = ddg[d];
      const link = row.querySelector("a[href]") as HTMLAnchorElement | null;
      const titleEl = row.querySelector("h2, h3, [data-testid='result-title-a']") as HTMLElement | null;
      if (link && titleEl) {
        pushResult(results, seen, label(titleEl), link.href, link, "sr", results.length);
      }
    }
  } else if (/bing\./i.test(host)) {
    const bing = document.querySelectorAll("#b_results .b_algo");
    for (let b = 0; b < bing.length && results.length < 10; b++) {
      const item = bing[b];
      const ba = item.querySelector("h2 a[href]") as HTMLAnchorElement | null;
      if (ba) pushResult(results, seen, label(ba), ba.href, ba, "sr", results.length);
    }
  }

  if (results.length === 0) {
    const fallback = document.querySelectorAll("a[href]");
    for (let f = 0; f < fallback.length && results.length < 8; f++) {
      const fa = fallback[f] as HTMLAnchorElement;
      if (fa.offsetParent === null) continue;
      const ft = label(fa);
      if (ft.length < 4) continue;
      pushResult(results, seen, ft, fa.href, fa, "sr", results.length);
    }
  }

  return {
    engine: host,
    pageTitle: document.title || "",
    pageUrl: location.href,
    results: results,
  };
}

export const BROWSER_SEARCH_RESULTS_SCRIPT = `(function() {
  return (${runSearchExtract.toString()})();
})()`;
