/* global globalThis, XYB */
(function (root) {
  const XYB = root.XYB;
  let toastTimer = null;
  let statsPending = { hidden: 0, blocked: 0 };

  XYB.ui = XYB.ui || {};

  XYB.ui.toast = function toast(message, isError) {
    document.querySelectorAll(".xyb-toast").forEach((el) => el.remove());
    const el = document.createElement("div");
    el.className = "xyb-toast" + (isError ? " xyb-toast-err" : "");
    el.textContent = message;
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 2800);
  };

  XYB.ui.setButtonLoading = function setButtonLoading(btn, loading, label) {
    if (!btn) return;
    btn.disabled = loading;
    if (label != null) btn.textContent = label;
  };

  XYB.ui.createActionBar = function createActionBar(article, meta, onAction) {
    const bar = document.createElement("div");
    bar.className = "xyb-bar";
    bar.dataset.xybBar = "1";

    const label = document.createElement("span");
    label.className = "xyb-bar-label";
    const hint = meta.matchReasons?.length
      ? ` · ${meta.matchReasons.slice(0, 2).join(",")}`
      : "";
    label.textContent = `已屏蔽黄推${meta.handle ? ` · @${meta.handle}` : ""}${hint}`;
    bar.appendChild(label);

    const btnShow = document.createElement("button");
    btnShow.type = "button";
    btnShow.textContent = "显示";
    btnShow.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onAction("show", article, meta, { btnBlock: null });
    });
    bar.appendChild(btnShow);

    let btnBlock = null;
    if (meta.handle) {
      btnBlock = document.createElement("button");
      btnBlock.type = "button";
      btnBlock.className = "xyb-btn-primary";
      btnBlock.textContent = "拉黑作者";
      btnBlock.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onAction("block", article, meta, { btnBlock });
      });
      bar.appendChild(btnBlock);

      const btnWhitelist = document.createElement("button");
      btnWhitelist.type = "button";
      btnWhitelist.textContent = "信任此人";
      btnWhitelist.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onAction("whitelist", article, meta, { btnBlock: null });
      });
      bar.appendChild(btnWhitelist);
    }

    return bar;
  };

  XYB.ui.flushStats = async function flushStats() {
    if (!XYB.ext.alive()) {
      statsPending = { hidden: 0, blocked: 0 };
      return;
    }
    if (!statsPending.hidden && !statsPending.blocked) return;

    const addH = statsPending.hidden;
    const addB = statsPending.blocked;
    statsPending = { hidden: 0, blocked: 0 };

    try {
      const res = await XYB.ext.storageGet("local", [XYB.STORAGE_KEYS.stats]);
      const stats = res[XYB.STORAGE_KEYS.stats] || { hidden: 0, blocked: 0, date: "" };
      const today = new Date().toISOString().slice(0, 10);
      if (stats.date !== today) {
        stats.hidden = 0;
        stats.blocked = 0;
        stats.date = today;
      }
      stats.hidden = (stats.hidden || 0) + addH;
      stats.blocked = (stats.blocked || 0) + addB;
      await XYB.ext.storageSet("local", { [XYB.STORAGE_KEYS.stats]: stats });
    } catch (_) {
      /* 扩展已重载，忽略统计 */
    }
  };

  XYB.ui.incrementStat = function incrementStat(field) {
    if (!XYB.ext.alive()) return;
    if (field === "hidden") statsPending.hidden += 1;
    else if (field === "blocked") statsPending.blocked += 1;
    clearTimeout(XYB.ui._statsTimer);
    XYB.ui._statsTimer = setTimeout(() => XYB.ui.flushStats(), 500);
  };

  XYB.ui.log = function log(settings, ...args) {
    if (settings?.debug !== false) console.log("[xyb]", ...args);
  };
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : window);
