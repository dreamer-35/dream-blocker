/* global globalThis, XYB */
(function (root) {
  const XYB = root.XYB;
  const processed = new WeakSet();
  const tweetWatchers = new WeakMap();

  XYB.dom = XYB.dom || {};

  XYB.dom.isOurNode = function isOurNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    return (
      node.classList?.contains("xyb-bar") ||
      node.dataset?.xybBar === "1" ||
      !!node.closest?.(".xyb-bar, [data-xyb-bar]")
    );
  };

  XYB.dom.isNestedTweet = function isNestedTweet(article) {
    let parent = article.parentElement;
    while (parent) {
      const outer = parent.closest?.(XYB.TWEET_SELECTOR);
      if (outer && outer !== article) return true;
      parent = parent.parentElement;
    }
    return false;
  };

  XYB.dom.findTweets = function findTweets(rootNode) {
    const root = rootNode || document;
    return [...root.querySelectorAll(XYB.TWEET_SELECTOR)].filter(
      (el) => !XYB.dom.isNestedTweet(el)
    );
  };

  XYB.dom.extractTweetData = function extractTweetData(article) {
    const textEl = article.querySelector('[data-testid="tweetText"]');
    const text = textEl ? textEl.innerText : "";

    const links = [];
    article.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") || "";
      links.push(href);
      if (a.innerText) links.push(a.innerText);
    });

    let handle = null;
    let userId = null;

    const userNameRoot = article.querySelector('[data-testid="User-Name"]');
    if (userNameRoot) {
      userNameRoot.querySelectorAll('a[href^="/"]').forEach((a) => {
        const href = a.getAttribute("href") || "";
        const m = href.match(/^\/([^/?#]+)/);
        if (m && !XYB.RESERVED_HANDLES.has(m[1].toLowerCase())) {
          handle = m[1];
        }
        const um = href.match(/\/i\/user\/(\d+)/);
        if (um) userId = um[1];
      });
    }

    if (!handle) {
      article.querySelectorAll('a[href^="/"]').forEach((a) => {
        if (handle) return;
        const href = a.getAttribute("href") || "";
        const m = href.match(/^\/([^/?#]+)$/);
        if (m && !XYB.RESERVED_HANDLES.has(m[1].toLowerCase())) {
          handle = m[1];
        }
      });
    }

    article.querySelectorAll('a[href*="/i/user/"]').forEach((a) => {
      const um = (a.getAttribute("href") || "").match(/\/i\/user\/(\d+)/);
      if (um) userId = um[1];
    });

    return { text, links, handle, userId };
  };

  XYB.dom.getContentSignature = function getContentSignature(article) {
    const meta = XYB.dom.extractTweetData(article);
    const snippet = meta.text.slice(0, 160);
    return `${meta.text.length}|${snippet}|${meta.links.join(",").slice(0, 80)}`;
  };

  XYB.dom.isContentReady = function isContentReady(article) {
    const meta = XYB.dom.extractTweetData(article);
    return meta.text.trim().length > 0 || meta.links.length > 0;
  };

  XYB.dom.markProcessed = function markProcessed(article) {
    if (processed.has(article)) return true;
    if (article.dataset.xybProcessed === "1") return true;
    article.dataset.xybProcessed = "1";
    processed.add(article);
    return false;
  };

  XYB.dom.unmarkProcessed = function unmarkProcessed(article) {
    delete article.dataset.xybProcessed;
    processed.delete(article);
  };

  XYB.dom.watchTweetContent = function watchTweetContent(article, onUpdate) {
    if (tweetWatchers.has(article)) return;
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const sig = XYB.dom.getContentSignature(article);
        if (sig !== article.dataset.xybContentSig) {
          onUpdate(article);
        }
      }, XYB.TWEET_REPROCESS_DEBOUNCE_MS);
    });
    observer.observe(article, { childList: true, subtree: true });
    tweetWatchers.set(article, observer);
  };

  XYB.dom.removeBarFor = function removeBarFor(article) {
    const prev = article.previousElementSibling;
    if (prev?.classList?.contains("xyb-bar")) prev.remove();
  };

  XYB.dom.hideTweet = function hideTweet(article, reasons) {
    XYB.dom.removeBarFor(article);
    article.dataset.xybHidden = "1";
    article.dataset.xybReasons = (reasons || []).join("|");
    article.classList.add("xyb-tweet-hidden");
    article.style.removeProperty("display");
  };

  XYB.dom.showTweet = function showTweet(article) {
    XYB.dom.removeBarFor(article);
    delete article.dataset.xybHidden;
    delete article.dataset.xybReasons;
    article.classList.remove("xyb-tweet-hidden");
    article.style.removeProperty("display");
    XYB.dom.unmarkProcessed(article);
    delete article.dataset.xybContentSig;
  };

  XYB.dom.placeBarBefore = function placeBarBefore(article, barEl) {
    const prev = article.previousElementSibling;
    if (prev?.classList?.contains("xyb-bar")) return prev;
    article.parentNode?.insertBefore(barEl, article);
    return barEl;
  };

  XYB.dom.clearExtensionUI = function clearExtensionUI() {
    document.querySelectorAll(".xyb-bar").forEach((bar) => bar.remove());
    document.querySelectorAll(XYB.TWEET_SELECTOR).forEach((article) => {
      delete article.dataset.xybHidden;
      delete article.dataset.xybReasons;
      article.classList.remove("xyb-tweet-hidden");
      XYB.dom.unmarkProcessed(article);
      delete article.dataset.xybContentSig;
    });
  };

  XYB.dom.getCookies = function getCookies() {
    const map = {};
    document.cookie.split(";").forEach((part) => {
      const [k, ...rest] = part.trim().split("=");
      if (k) map[k] = decodeURIComponent(rest.join("="));
    });
    return { ct0: map.ct0 || "", authToken: map.auth_token || "" };
  };
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : window);
