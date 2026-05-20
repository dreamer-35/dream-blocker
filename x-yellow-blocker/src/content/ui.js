/* global globalThis, XYB, chrome */
(function (root) {
  const XYB = root.XYB;

  XYB.ui = XYB.ui || {};

  XYB.ui.createActionBar = function createActionBar(article, meta, onAction) {
    const bar = document.createElement("div");
    bar.className = "xyb-bar";
    bar.dataset.xybBar = "1";

    const label = document.createElement("span");
    label.className = "xyb-bar-label";
    label.textContent = `已屏蔽黄推${meta.handle ? ` · @${meta.handle}` : ""}`;
    bar.appendChild(label);

    const btnShow = document.createElement("button");
    btnShow.type = "button";
    btnShow.textContent = "显示";
    btnShow.addEventListener("click", () => onAction("show", article, meta));
    bar.appendChild(btnShow);

    if (meta.handle) {
      const btnBlock = document.createElement("button");
      btnBlock.type = "button";
      btnBlock.className = "xyb-btn-primary";
      btnBlock.textContent = "拉黑作者";
      btnBlock.addEventListener("click", () => onAction("block", article, meta));
      bar.appendChild(btnBlock);

      const btnWhitelist = document.createElement("button");
      btnWhitelist.type = "button";
      btnWhitelist.textContent = "信任此人";
      btnWhitelist.addEventListener("click", () => onAction("whitelist", article, meta));
      bar.appendChild(btnWhitelist);
    }

    return bar;
  };

  XYB.ui.incrementStat = function incrementStat(field) {
    chrome.storage.local.get([XYB.STORAGE_KEYS.stats], (res) => {
      const stats = res[XYB.STORAGE_KEYS.stats] || { hidden: 0, blocked: 0, date: "" };
      const today = new Date().toISOString().slice(0, 10);
      if (stats.date !== today) {
        stats.hidden = 0;
        stats.blocked = 0;
        stats.date = today;
      }
      stats[field] = (stats[field] || 0) + 1;
      chrome.storage.local.set({ [XYB.STORAGE_KEYS.stats]: stats });
    });
  };

  XYB.ui.log = function log(settings, ...args) {
    if (settings?.debug) console.log("[xyb]", ...args);
  };
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : window);
