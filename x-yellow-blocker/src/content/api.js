/* global globalThis, XYB */
(function (root) {
  const XYB = root.XYB;

  XYB.api = XYB.api || {};

  const recentBlocks = new Map();

  XYB.api.blockUser = function blockUser(meta, bearer) {
    const handle = (meta.handle || "").replace(/^@/, "");
    const key = meta.userId || handle;
    if (!key) {
      return Promise.resolve({ ok: false, error: "无法识别作者" });
    }

    const last = recentBlocks.get(key) || 0;
    if (Date.now() - last < 2000) {
      return Promise.resolve({ ok: false, error: "请勿重复点击" });
    }
    recentBlocks.set(key, Date.now());

    if (!bearer) {
      return Promise.resolve({
        ok: false,
        error: "请先滚动时间线（等待 X 加载完成）",
      });
    }

    const ct0 = XYB.dom.getCookies().ct0;
    if (!ct0) {
      return Promise.resolve({ ok: false, error: "未检测到登录状态，请重新登录 X" });
    }

    return new Promise((resolve) => {
      const id = `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      let settled = false;

      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve(result);
      };

      const timer = setTimeout(() => {
        finish({ ok: false, error: "请求超时，请重试" });
      }, XYB.BLOCK_TIMEOUT_MS);

      function onMessage(event) {
        if (event.source !== window || event.data?.source !== "xyb") return;
        if (event.data.type !== "BLOCK_DONE" || event.data.id !== id) return;
        if (event.data.ok) {
          finish({ ok: true, skipped: false });
        } else {
          finish({ ok: false, error: event.data.error || "拉黑失败" });
        }
      }

      window.addEventListener("message", onMessage);

      window.postMessage(
        {
          source: "xyb-ext",
          type: "XYB_BLOCK",
          id,
          userId: meta.userId || null,
          screenName: handle || null,
          bearer,
        },
        "*"
      );
    });
  };
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : window);
