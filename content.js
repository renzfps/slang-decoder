// Slang Decoder content script: finds slang abbreviations in page text,
// underlines them, and shows their meaning in a tooltip on hover.
(() => {
  const MARK_CLASS = "slang-decoder-term";
  const SKIP_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION",
    "CODE", "PRE", "SVG", "CANVAS", "IFRAME", "HEAD", "TITLE"
  ]);

  // Build one regex for all terms, longest first so "lmfao" beats "lmao".
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
  const terms = Object.keys(SLANG_DICTIONARY).sort((a, b) => b.length - a.length);
  // Custom boundaries so terms containing "/" or ";" (w/o, tl;dr) still match,
  // while "lol" inside "lollipop" does not.
  const PATTERN = new RegExp(
    "(?<![\\p{L}\\p{N}_])(" + terms.map(escape).join("|") + ")(?![\\p{L}\\p{N}_])",
    "giu"
  );

  let enabled = true;
  let observer = null;
  let tooltip = null;

  function shouldSkip(node) {
    for (let el = node.parentElement; el; el = el.parentElement) {
      if (SKIP_TAGS.has(el.tagName)) return true;
      if (el.classList && el.classList.contains(MARK_CLASS)) return true;
      if (el.isContentEditable) return true; // don't touch text the user is typing
    }
    return false;
  }

  function matchIsValid(word) {
    const key = word.toLowerCase();
    if (!(key in SLANG_DICTIONARY)) return false;
    if (CAPS_ONLY.has(key) && word !== word.toUpperCase()) return false;
    return true;
  }

  function processTextNode(textNode) {
    const text = textNode.nodeValue;
    if (!text || text.length < 2) return;
    PATTERN.lastIndex = 0;
    let match;
    let last = 0;
    let frag = null;

    while ((match = PATTERN.exec(text)) !== null) {
      const word = match[1];
      if (!matchIsValid(word)) continue;
      if (!frag) frag = document.createDocumentFragment();
      if (match.index > last) {
        frag.appendChild(document.createTextNode(text.slice(last, match.index)));
      }
      const span = document.createElement("span");
      span.className = MARK_CLASS;
      span.textContent = word;
      span.dataset.slangKey = word.toLowerCase();
      frag.appendChild(span);
      last = match.index + word.length;
    }

    if (frag) {
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      textNode.parentNode.replaceChild(frag, textNode);
    }
  }

  function scan(root) {
    if (!enabled || !root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      if (!shouldSkip(root)) processTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE && (SKIP_TAGS.has(root.tagName) || root.isContentEditable)) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (shouldSkip(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(processTextNode);
  }

  function unwrapAll() {
    document.querySelectorAll("." + MARK_CLASS).forEach((span) => {
      const parent = span.parentNode;
      parent.replaceChild(document.createTextNode(span.textContent), span);
      parent.normalize();
    });
    hideTooltip();
  }

  // ---------- Tooltip ----------
  function ensureTooltip() {
    if (tooltip) return tooltip;
    tooltip = document.createElement("div");
    tooltip.id = "slang-decoder-tooltip";
    tooltip.setAttribute("role", "tooltip");
    document.documentElement.appendChild(tooltip);
    return tooltip;
  }

  function showTooltip(span) {
    const tip = ensureTooltip();
    const key = span.dataset.slangKey;
    tip.innerHTML = "";
    const term = document.createElement("div");
    term.className = "sd-term";
    term.textContent = span.textContent.toUpperCase();
    const def = document.createElement("div");
    def.className = "sd-def";
    def.textContent = SLANG_DICTIONARY[key];
    tip.append(term, def);
    tip.classList.add("sd-visible");

    const r = span.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    let top = r.top - t.height - 8;
    if (top < 4) top = r.bottom + 8; // flip below if no room above
    let left = r.left + r.width / 2 - t.width / 2;
    left = Math.max(4, Math.min(left, window.innerWidth - t.width - 4));
    tip.style.top = top + "px";
    tip.style.left = left + "px";
  }

  function hideTooltip() {
    if (tooltip) tooltip.classList.remove("sd-visible");
  }

  document.addEventListener("mouseover", (e) => {
    const span = e.target.closest && e.target.closest("." + MARK_CLASS);
    if (span) showTooltip(span);
  });
  document.addEventListener("mouseout", (e) => {
    const span = e.target.closest && e.target.closest("." + MARK_CLASS);
    if (span && !span.contains(e.relatedTarget)) hideTooltip();
  });
  window.addEventListener("scroll", hideTooltip, { passive: true, capture: true });

  // ---------- Watch for new content (chat messages, infinite scroll) ----------
  let pending = new Set();
  let scheduled = false;

  function flush() {
    scheduled = false;
    const batch = pending;
    pending = new Set();
    batch.forEach((n) => { if (n.isConnected) scan(n); });
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "characterData") {
          pending.add(m.target);
        } else {
          m.addedNodes.forEach((n) => {
            if (n.nodeType === Node.ELEMENT_NODE && n.classList.contains(MARK_CLASS)) return;
            if (n.id === "slang-decoder-tooltip") return;
            pending.add(n);
          });
        }
      }
      if (pending.size && !scheduled) {
        scheduled = true;
        setTimeout(flush, 200);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function stopObserver() {
    if (observer) observer.disconnect();
    observer = null;
  }

  function enable() {
    enabled = true;
    scan(document.body);
    startObserver();
  }

  function disable() {
    enabled = false;
    stopObserver();
    unwrapAll();
  }

  // ---------- On/off setting from the popup ----------
  chrome.storage.sync.get({ enabled: true }, (res) => {
    if (res.enabled) enable(); else enabled = false;
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (!changes.enabled) return;
    if (changes.enabled.newValue) enable(); else disable();
  });
})();
