/* global globalThis, XYB, chrome */
(function (root) {
  const XYB = root.XYB;

  let settings = XYB.getDefaultSettings();
  let activeRules = XYB.buildActiveRules(settings);
  let scanTimer = null;
  let bearerToken = null;

  function loadSettings(cb) {
    chrome.storage.sync.get([XYB.STORAGE_KEYS.settings], (res) => {
      settings = XYB.mergeSettings(res[XYB.STORAGE_KEYS.settings]);
      activeRules = XYB.buildActiveRules(settings);
      cb?.();
    });
  }

  function captureBearer() {
    const origFetch = window.fetch;
    if (origFetch.__xybPatched) return;
    window.fetch = function patchedFetch(input, init) {
      const headers = init?.headers;
      const auth =
        (headers instanceof Headers && headers.get("authorization")) ||
        (typeof headers === "object" && headers?.authorization);
      if (auth && auth.startsWith("Bearer ")) {
        bearerToken = auth;
        chrome.runtime.sendMessage({
          type: "AUTH_CACHE",
          bearer: auth,
          cookies: XYB.dom.getCookies(),
        });
      }
      return origFetch.apply(this, arguments);
    };
    window.fetch.__xybPatched = true;
  }

  function resolveUserId(meta) {
    return new Promise((resolve) => {
      if (meta.userId) {
        resolve(meta.userId);
        return;
      }
      if (!meta.handle) {
        resolve(null);
        return;
      }
      chrome.runtime.sendMessage(
        {
          type: "RESOLVE_USER",
          screenName: meta.handle,
          bearer: bearerToken,
          cookies: XYB.dom.getCookies(),
        },
        (resp) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(resp?.userId || null);
        }
      );
    });
  }

  async function handleBarAction(action, article, meta) {
    if (action === "show") {
      XYB.dom.showTweet(article);
      return;
    }
    if (action === "whitelist" && meta.handle) {
      const list = [...(settings.whitelist || [])];
      const h = meta.handle.replace(/^@/, "");
      if (!list.some((w) => w.toLowerCase() === h.toLowerCase())) {
        list.push(h);
        settings.whitelist = list;
        chrome.storage.sync.set({
          [XYB.STORAGE_KEYS.settings]: settings,
        });
      }
      XYB.dom.showTweet(article);
      return;
    }
    if (action === "block") {
      const userId = await resolveUserId(meta);
      if (!userId) {
        alert("无法解析用户 ID，请刷新页面后重试");
        return;
      }
      chrome.runtime.sendMessage(
        {
          type: "BLOCK_USER",
          userId,
          bearer: bearerToken,
          cookies: XYB.dom.getCookies(),
        },
        (resp) => {
          if (resp?.ok) {
            XYB.ui.incrementStat("blocked");
            article.remove();
            const bar = document.querySelector(`[data-xyb-bar][data-for="${userId}"]`);
            bar?.remove();
          } else {
            alert(resp?.error || "拉黑失败");
          }
        }
      );
    }
  }

  function processTweet(article) {
    if (!settings.enabled) return;
    if (XYB.dom.markProcessed(article)) return;
    if (article.dataset.xybHidden === "1") return;

    const meta = XYB.dom.extractTweetData(article);
    if (XYB.isWhitelisted(meta.handle, settings.whitelist)) return;

    const { matched, reasons } = XYB.matchTweet(meta.text, meta.links, activeRules);
    if (!matched) return;

    XYB.ui.log(settings, "matched", meta.handle, reasons);

    if (!settings.autoHide) return;

    XYB.dom.hideTweet(article, reasons);
    const bar = XYB.ui.createActionBar(article, meta, handleBarAction);
    XYB.dom.placeBarBefore(article, bar);
    XYB.ui.incrementStat("hidden");
  }

  function scanRoot(rootNode) {
    if (!settings.enabled) return;
    const tweets = XYB.dom.findTweets(rootNode || document);
    tweets.forEach(processTweet);
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => scanRoot(document), XYB.SCAN_DEBOUNCE_MS);
  }

  function startObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          scanRoot(node);
        }
      }
      scheduleScan();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes[XYB.STORAGE_KEYS.settings]) {
      settings = XYB.mergeSettings(changes[XYB.STORAGE_KEYS.settings].newValue);
      activeRules = XYB.buildActiveRules(settings);
      document.querySelectorAll("[data-xyb-processed]").forEach((el) => {
        delete el.dataset.xybProcessed;
      });
      scheduleScan();
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "RESCAN") scheduleScan();
  });

  captureBearer();
  loadSettings(() => {
    scanRoot(document);
    startObserver();
    XYB.ui.log(settings, "content script ready");
  });
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : window);
