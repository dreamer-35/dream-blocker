/* global importScripts */
importScripts("src/shared/constants.js", "src/shared/rules.js");

const XYB = globalThis.XYB;

const blockQueue = [];
let processing = false;
let cachedAuth = { bearer: null, ct0: null };

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getBlockedIds() {
  const res = await chrome.storage.local.get([XYB.STORAGE_KEYS.blockedIds]);
  return new Set(res[XYB.STORAGE_KEYS.blockedIds] || []);
}

async function addBlockedId(id) {
  const set = await getBlockedIds();
  set.add(String(id));
  await chrome.storage.local.set({
    [XYB.STORAGE_KEYS.blockedIds]: [...set],
  });
}

async function blockUser(userId, bearer, cookies) {
  const blocked = await getBlockedIds();
  if (blocked.has(String(userId))) {
    return { ok: true, skipped: true };
  }

  const ct0 = cookies?.ct0;
  const authToken = cookies?.authToken;
  const auth = bearer || cachedAuth.bearer;
  if (!ct0 || !auth) {
    return { ok: false, error: "缺少登录凭证，请刷新 X 页面" };
  }

  const cookieHeader = [
    authToken && `auth_token=${authToken}`,
    ct0 && `ct0=${ct0}`,
  ]
    .filter(Boolean)
    .join("; ");

  const body = new URLSearchParams({ user_id: String(userId) });
  const res = await fetch(XYB.API.blockCreate, {
    method: "POST",
    headers: {
      authorization: auth,
      "x-csrf-token": ct0,
      "content-type": "application/x-www-form-urlencoded",
      "x-twitter-auth-type": "OAuth2Session",
      "x-twitter-active-user": "yes",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: body.toString(),
    credentials: "omit",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 120)}` };
  }

  await addBlockedId(userId);
  return { ok: true };
}

async function resolveUserId(screenName, bearer, cookies) {
  const ct0 = cookies?.ct0;
  const auth = bearer || cachedAuth.bearer;
  if (!ct0 || !auth || !screenName) return null;

  const cookieHeader = [
    cookies?.authToken && `auth_token=${cookies.authToken}`,
    ct0 && `ct0=${ct0}`,
  ]
    .filter(Boolean)
    .join("; ");

  const url = `${XYB.API.userShow}?screen_name=${encodeURIComponent(screenName)}`;
  const res = await fetch(url, {
    headers: {
      authorization: auth,
      "x-csrf-token": ct0,
      "x-twitter-auth-type": "OAuth2Session",
      "x-twitter-active-user": "yes",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    credentials: "omit",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.id_str || (data?.id != null ? String(data.id) : null);
}

async function processQueue() {
  if (processing) return;
  processing = true;
  while (blockQueue.length > 0) {
    const job = blockQueue.shift();
    try {
      const result = await blockUser(job.userId, job.bearer, job.cookies);
      job.sendResponse(result);
    } catch (e) {
      job.sendResponse({ ok: false, error: String(e.message || e) });
    }
    await delay(XYB.BLOCK_QUEUE_DELAY_MS);
  }
  processing = false;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "AUTH_CACHE") {
    cachedAuth.bearer = msg.bearer || cachedAuth.bearer;
    cachedAuth.ct0 = msg.cookies?.ct0 || cachedAuth.ct0;
    chrome.storage.session?.set?.({
      [XYB.STORAGE_KEYS.authCache]: cachedAuth,
    });
    return false;
  }

  if (msg.type === "BLOCK_USER") {
    blockQueue.push({
      userId: msg.userId,
      bearer: msg.bearer,
      cookies: msg.cookies,
      sendResponse,
    });
    processQueue();
    return true;
  }

  if (msg.type === "RESOLVE_USER") {
    resolveUserId(msg.screenName, msg.bearer, msg.cookies).then((userId) => {
      sendResponse({ userId });
    });
    return true;
  }

  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get([XYB.STORAGE_KEYS.settings], (res) => {
    if (!res[XYB.STORAGE_KEYS.settings]) {
      chrome.storage.sync.set({
        [XYB.STORAGE_KEYS.settings]: XYB.DEFAULT_SETTINGS,
      });
    }
  });
});
