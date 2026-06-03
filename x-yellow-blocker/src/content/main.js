/* global globalThis, XYB, chrome */
(function (root) {
  if (root.__xybContentLoaded) return;
  root.__xybContentLoaded = true;

  const XYB = root.XYB;

  let settings = XYB.getDefaultSettings();
  let activeRules = XYB.buildActiveRules(settings);
  let scanTimer = null;
  let rescanTimer = null;
  let bearerToken = null;
  let observerPaused = false;
  let rescanInProgress = false;
  let lastAuthSavedAt = 0;
  let hiddenCountThisPass = 0;
  let scrollTimer = null;
  let lastGlobalScanAt = 0;
  let intersectionObserver = null;
  const userDismissed = new WeakSet();

  function ensureAlive() {
    if (XYB.ext.alive()) return true;
    XYB.ui.toast(XYB.ext.friendlyError(new Error(XYB.ext.NEED_REFRESH)), true);
    return false;
  }

  function applySettingsFromStorage(stored) {
    settings = XYB.mergeSettings(stored);
    activeRules = XYB.buildActiveRules(settings);
    scheduleSettingsRescan();
  }

  function loadSettings(cb) {
    if (!XYB.ext.alive()) {
      cb?.();
      return;
    }
    XYB.ext
      .storageGet("sync", [XYB.STORAGE_KEYS.settings])
      .then((res) => {
        settings = XYB.mergeSettings(res[XYB.STORAGE_KEYS.settings]);
        activeRules = XYB.buildActiveRules(settings);
        cb?.();
      })
      .catch(() => cb?.());
  }

  function persistAuth(bearer) {
    if (!bearer || !XYB.ext.alive()) return;
    bearerToken = bearer;
    const now = Date.now();
    if (now - lastAuthSavedAt < XYB.AUTH_THROTTLE_MS) return;
    lastAuthSavedAt = now;
    XYB.ext
      .storageSet("local", {
        [XYB.STORAGE_KEYS.authCache]: {
          bearer,
          ct0: XYB.dom.getCookies().ct0,
          at: now,
        },
      })
      .catch(() => {});
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window || e.data?.source !== "xyb") return;
    if (e.data.type === "AUTH") persistAuth(e.data.bearer);
  });

  async function persistWhitelist(handle) {
    const h = handle.replace(/^@/, "");
    const list = [...(settings.whitelist || [])];
    if (!list.some((w) => w.toLowerCase() === h.toLowerCase())) {
      list.push(h);
      settings.whitelist = list;
    }
    if (XYB.ext.alive()) {
      await XYB.ext.storageSet("sync", {
        [XYB.STORAGE_KEYS.settings]: settings,
      });
    }
  }

  async function handleBarAction(action, article, meta, ctx) {
    if (action === "show") {
      userDismissed.add(article);
      article.dataset.xybDismissed = "1";
      XYB.dom.showTweet(article);
      finishTweetScan(article, XYB.dom.getContentSignature(article));
      XYB.ui.toast("已恢复显示（本条本会话不再自动隐藏）");
      return;
    }

    if (action === "whitelist" && meta.handle) {
      if (!ensureAlive()) return;
      try {
        const h = meta.handle.replace(/^@/, "");
        await persistWhitelist(h);
        const bar = article.previousElementSibling;
        if (bar?.classList?.contains("xyb-bar")) bar.remove();
        article.classList.remove("xyb-tweet-hidden");
        delete article.dataset.xybHidden;
        XYB.dom.unmarkProcessed(article);
        XYB.ui.toast(`已信任 @${h}`);
      } catch (err) {
        XYB.ui.toast(XYB.ext.friendlyError(err), true);
      }
      return;
    }

    if (action === "block") {
      const btn = ctx?.btnBlock;
      XYB.ui.setButtonLoading(btn, true, "拉黑中…");
      try {
        const resp = await XYB.api.blockUser(meta, bearerToken);
        if (resp?.ok) {
          try {
            XYB.ui.incrementStat("blocked");
          } catch (_) {
            /* 统计失败不影响拉黑 */
          }
          const bar = article.previousElementSibling;
          if (bar?.classList?.contains("xyb-bar")) bar.remove();
          article.remove();
          XYB.ui.toast(resp.skipped ? "该用户已在屏蔽列表" : `已拉黑 @${meta.handle}`);
        } else {
          XYB.ui.toast(resp?.error || "拉黑失败", true);
        }
      } catch (err) {
        XYB.ui.toast(XYB.ext.friendlyError(err), true);
      } finally {
        XYB.ui.setButtonLoading(btn, false, "拉黑作者");
      }
    }
  }

  function finishTweetScan(article, sig) {
    article.dataset.xybContentSig = sig;
    XYB.dom.markProcessed(article);
  }

  function reprocessTweet(article) {
    if (observerPaused || rescanInProgress) return;
    XYB.dom.unmarkProcessed(article);
    delete article.dataset.xybContentSig;
    processTweet(article);
  }

  function processTweet(article) {
    if (!settings.enabled || rescanInProgress) return;
    if (userDismissed.has(article) || article.dataset.xybDismissed === "1") {
      return;
    }
    if (article.dataset.xybHidden === "1" || article.classList.contains("xyb-tweet-hidden")) {
      return;
    }

    const sig = XYB.dom.getContentSignature(article);
    if (article.dataset.xybContentSig === sig && article.dataset.xybProcessed === "1") {
      return;
    }

    if (!XYB.dom.isContentReady(article)) {
      XYB.dom.watchTweetContent(article, reprocessTweet);
      return;
    }

    const meta = XYB.dom.extractTweetData(article);

    if (XYB.isWhitelisted(meta.handle, settings.whitelist)) {
      finishTweetScan(article, sig);
      return;
    }

    const match = XYB.matchTweet(meta.text, meta.links, activeRules);
    if (!match.matched) {
      finishTweetScan(article, sig);
      return;
    }

    meta.matchReasons = match.reasons;
    XYB.ui.log(settings, "matched", meta.handle, match.reasons, {
      strong: match.hasStrong,
      weakHits: match.weakHits,
      sig: sig.slice(0, 40),
    });
    if (!settings.autoHide) return;

    observerPaused = true;
    try {
      XYB.dom.hideTweet(article, match.reasons);
      const bar = XYB.ui.createActionBar(article, meta, handleBarAction);
      XYB.dom.placeBarBefore(article, bar);
      finishTweetScan(article, sig);
      hiddenCountThisPass += 1;
    } finally {
      requestAnimationFrame(() => {
        observerPaused = false;
      });
    }
  }

  function isInViewport(article) {
    const r = article.getBoundingClientRect();
    const h = window.innerHeight || document.documentElement.clientHeight;
    return r.bottom > -120 && r.top < h + 120;
  }

  function rescanVisibleTweets() {
    if (!settings.enabled || rescanInProgress || observerPaused) return;
    const now = Date.now();
    if (now - lastGlobalScanAt < XYB.GLOBAL_SCAN_MIN_MS) return;
    lastGlobalScanAt = now;

    let checked = 0;
    const maxCheck = 30;
    for (const article of XYB.dom.findTweets(document)) {
      if (checked >= maxCheck) break;
      if (!isInViewport(article)) continue;
      if (article.classList.contains("xyb-tweet-hidden")) continue;
      checked += 1;

      const sig = XYB.dom.getContentSignature(article);
      if (article.dataset.xybContentSig === sig && article.dataset.xybProcessed === "1") {
        continue;
      }
      if (article.dataset.xybProcessed !== "1") {
        processTweet(article);
      } else if (article.dataset.xybContentSig !== sig) {
        reprocessTweet(article);
      }
    }
  }

  function observeTweet(article) {
    if (!intersectionObserver || article.dataset.xybIo === "1") return;
    article.dataset.xybIo = "1";
    intersectionObserver.observe(article);
  }

  function observeNewTweets(root) {
    XYB.dom.findTweets(root || document).forEach(observeTweet);
  }

  function startViewportObserver() {
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (observerPaused || rescanInProgress) return;
        for (const entry of entries) {
          if (entry.isIntersecting) processTweet(entry.target);
        }
      },
      { root: null, rootMargin: "100px 0px", threshold: 0 }
    );
    observeNewTweets(document);
  }

  function startScrollRescan() {
    const target = document.scrollingElement || document.documentElement;
    target.addEventListener(
      "scroll",
      () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(rescanVisibleTweets, XYB.SCROLL_RESCAN_MS);
      },
      { passive: true }
    );
  }

  function scanRoot(rootNode) {
    if (!settings.enabled || rescanInProgress) return;
    const tweets = XYB.dom.findTweets(rootNode);
    tweets.forEach(processTweet);
    if (hiddenCountThisPass > 0) {
      for (let i = 0; i < hiddenCountThisPass; i++) XYB.ui.incrementStat("hidden");
      hiddenCountThisPass = 0;
    }
  }

  function scheduleScanSubtree(rootNode) {
    if (!rootNode || observerPaused || rescanInProgress) return;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => scanRoot(rootNode), XYB.SCAN_DEBOUNCE_MS);
  }

  function applySettingsRescan() {
    if (rescanInProgress) return;
    rescanInProgress = true;
    observerPaused = true;
    clearTimeout(scanTimer);

    try {
      if (!settings.enabled) {
        XYB.dom.clearExtensionUI();
        return;
      }

      document.querySelectorAll(XYB.TWEET_SELECTOR).forEach((article) => {
        if (XYB.dom.isNestedTweet(article)) return;

        const meta = XYB.dom.extractTweetData(article);
        const whitelisted = XYB.isWhitelisted(meta.handle, settings.whitelist);
        const { matched } = XYB.matchTweet(meta.text, meta.links, activeRules);
        const hidden =
          article.dataset.xybHidden === "1" ||
          article.classList.contains("xyb-tweet-hidden");

        if (
          whitelisted ||
          !matched ||
          userDismissed.has(article) ||
          article.dataset.xybDismissed === "1"
        ) {
          if (hidden) XYB.dom.showTweet(article);
          return;
        }

        if (!hidden) {
          delete article.dataset.xybContentSig;
          XYB.dom.unmarkProcessed(article);
          processTweet(article);
        }
      });
      XYB.ui.log(settings, "settings applied");
    } finally {
      rescanInProgress = false;
      requestAnimationFrame(() => {
        observerPaused = false;
      });
    }
  }

  function scheduleSettingsRescan() {
    clearTimeout(rescanTimer);
    rescanTimer = setTimeout(applySettingsRescan, XYB.RESCAN_DEBOUNCE_MS);
  }

  function startObserver() {
    const observer = new MutationObserver((mutations) => {
      if (observerPaused || rescanInProgress || !settings.enabled) return;

      let subtree = null;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (XYB.dom.isOurNode(node)) continue;
          if (node.matches?.(XYB.TWEET_SELECTOR) || node.querySelector?.(XYB.TWEET_SELECTOR)) {
            subtree = node;
            break;
          }
        }
        if (subtree) break;
      }
      if (subtree) {
        scheduleScanSubtree(subtree);
        observeNewTweets(subtree);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (!XYB.ext.alive()) return;
      if (area !== "sync" || !changes[XYB.STORAGE_KEYS.settings]) return;
      applySettingsFromStorage(changes[XYB.STORAGE_KEYS.settings].newValue);
    });
  } catch (_) {
    /* invalidated */
  }

  if (!root.__xybMessageHooked) {
    root.__xybMessageHooked = true;
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      try {
        if (msg.type === "APPLY_SETTINGS" && msg.settings) {
          applySettingsFromStorage(msg.settings);
          sendResponse({ ok: true });
          return;
        }
        if (msg.type === "PING") {
          sendResponse({ ok: true, alive: XYB.ext.alive() });
          return;
        }
      } catch (e) {
        sendResponse({ ok: false, error: String(e.message || e) });
      }
    });
  }

  root.__xybApplySettings = applySettingsFromStorage;

  loadSettings(() => {
    scanRoot(document);
    startObserver();
    startViewportObserver();
    startScrollRescan();
    if (XYB.ext.alive()) {
      XYB.ext
        .storageGet("local", [XYB.STORAGE_KEYS.authCache])
        .then((res) => {
          const c = res[XYB.STORAGE_KEYS.authCache];
          if (c?.bearer) bearerToken = c.bearer;
        })
        .catch(() => {});
    }
    XYB.ui.log(settings, "content script ready");
  });
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : window);
