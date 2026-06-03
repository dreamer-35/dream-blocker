/* global globalThis, chrome */
(function (root) {
  const XYB = (root.XYB = root.XYB || {});

  const NEED_REFRESH = "NEED_REFRESH";

  function alive() {
    try {
      return Boolean(chrome.runtime && chrome.runtime.id);
    } catch (_) {
      return false;
    }
  }

  function friendlyError(err) {
    const msg = err?.message || String(err || "");
    if (
      msg.includes("Extension context invalidated") ||
      msg.includes("Receiving end does not exist") ||
      msg === NEED_REFRESH
    ) {
      return "扩展已更新，请刷新本页面（F5）后重试";
    }
    return msg || "操作失败";
  }

  function storageGet(area, keys) {
    return new Promise((resolve, reject) => {
      if (!alive()) {
        reject(new Error(NEED_REFRESH));
        return;
      }
      try {
        const api = area === "local" ? chrome.storage.local : chrome.storage.sync;
        api.get(keys, (res) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(res);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  function storageSet(area, items) {
    return new Promise((resolve, reject) => {
      if (!alive()) {
        reject(new Error(NEED_REFRESH));
        return;
      }
      try {
        const api = area === "local" ? chrome.storage.local : chrome.storage.sync;
        api.set(items, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve();
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  XYB.ext = {
    NEED_REFRESH,
    alive,
    friendlyError,
    storageGet,
    storageSet,
  };
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : window);
