/**
 * 页面主世界：捕获 Bearer + 代发拉黑请求（与 X 页面同上下文，cookie 可靠）
 */
(function () {
  if (window.__xybPageHook) return;
  window.__xybPageHook = true;

  let lastBearer = "";

  function emitAuth(bearer) {
    if (!bearer || bearer === lastBearer) return;
    lastBearer = bearer;
    window.postMessage({ source: "xyb", type: "AUTH", bearer }, "*");
  }

  function readAuth(headers) {
    if (!headers) return;
    if (headers instanceof Headers) {
      const v = headers.get("authorization");
      if (v?.startsWith("Bearer ")) emitAuth(v);
      return;
    }
    if (typeof headers === "object") {
      const v =
        headers.authorization ||
        headers.Authorization ||
        headers["authorization"];
      if (typeof v === "string" && v.startsWith("Bearer ")) emitAuth(v);
    }
  }

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    readAuth(init?.headers);
    if (input instanceof Request) readAuth(input.headers);
    return origFetch.apply(this, arguments);
  };

  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (name.toLowerCase() === "authorization" && String(value).startsWith("Bearer ")) {
      emitAuth(String(value));
    }
    return origSetHeader.apply(this, arguments);
  };

  function readCt0() {
    const m = document.cookie.match(/(?:^|;\s*)ct0=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.data?.source !== "xyb-ext") return;
    if (event.data.type !== "XYB_BLOCK") return;

    const { id, userId, screenName, bearer } = event.data;
    const ct0 = readCt0();

    const reply = (payload) => {
      window.postMessage({ source: "xyb", type: "BLOCK_DONE", id, ...payload }, "*");
    };

    if (!ct0 || !bearer) {
      reply({ ok: false, error: "缺少登录凭证，请刷新并滚动时间线" });
      return;
    }

    const body = new URLSearchParams();
    if (userId) body.set("user_id", String(userId));
    else if (screenName) body.set("screen_name", String(screenName).replace(/^@/, ""));
    else {
      reply({ ok: false, error: "缺少用户标识" });
      return;
    }

    try {
      const res = await origFetch("https://x.com/i/api/1.1/blocks/create.json", {
        method: "POST",
        headers: {
          authorization: bearer,
          "x-csrf-token": ct0,
          "content-type": "application/x-www-form-urlencoded",
          "x-twitter-auth-type": "OAuth2Session",
          "x-twitter-active-user": "yes",
        },
        body: body.toString(),
        credentials: "include",
      });

      if (res.ok) {
        reply({ ok: true });
        return;
      }
      const text = await res.text().catch(() => "");
      reply({
        ok: false,
        status: res.status,
        error: `拉黑失败 (${res.status})` + (text ? `: ${text.slice(0, 60)}` : ""),
      });
    } catch (err) {
      reply({ ok: false, error: err?.message || "网络错误" });
    }
  });
})();
