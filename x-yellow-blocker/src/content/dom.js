/* global globalThis, XYB */
(function (root) {
  const XYB = root.XYB;

  const processed = new WeakSet();

  XYB.dom = XYB.dom || {};

  XYB.dom.findTweets = function findTweets(rootNode) {
    const nodes = [];
    for (const sel of XYB.TWEET_SELECTORS) {
      rootNode.querySelectorAll(sel).forEach((el) => nodes.push(el));
    }
    return [...new Set(nodes)];
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

    const userLinks = article.querySelectorAll('a[href^="/"]');
    for (const a of userLinks) {
      const href = a.getAttribute("href") || "";
      const m = href.match(/^\/([^/?#]+)$/);
      if (m && !["home", "explore", "notifications", "messages", "i", "search", "settings"].includes(m[1])) {
        handle = m[1];
        break;
      }
    }

    const idAttr = article.querySelector("[data-testid=\"User-Name\"] a[href]");
    if (idAttr) {
      const hm = (idAttr.getAttribute("href") || "").match(/^\/([^/?#]+)/);
      if (hm) handle = hm[1];
    }

    const restId = article.closest("[data-testid]")?.getAttribute("data-rest-id");
    if (restId) userId = restId;

    const anchorWithUserId = article.querySelector('a[href*="/i/user/"]');
    if (anchorWithUserId) {
      const um = anchorWithUserId.getAttribute("href").match(/\/i\/user\/(\d+)/);
      if (um) userId = um[1];
    }

    return { text, links, handle, userId };
  };

  XYB.dom.markProcessed = function markProcessed(article) {
    if (processed.has(article)) return true;
    if (article.dataset.xybProcessed === "1") return true;
    article.dataset.xybProcessed = "1";
    processed.add(article);
    return false;
  };

  XYB.dom.hideTweet = function hideTweet(article, reasons) {
    article.dataset.xybHidden = "1";
    article.dataset.xybReasons = (reasons || []).join("|");
    article.style.display = "none";
  };

  XYB.dom.showTweet = function showTweet(article) {
    delete article.dataset.xybHidden;
    article.style.display = "";
    const bar = article.previousElementSibling;
    if (bar?.classList?.contains("xyb-bar")) bar.remove();
  };

  XYB.dom.placeBarBefore = function placeBarBefore(article, barEl) {
    if (article.previousElementSibling?.classList?.contains("xyb-bar")) return;
    article.parentNode?.insertBefore(barEl, article);
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
