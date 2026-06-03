/* global globalThis */
(function (root) {
  const XYB = (root.XYB = root.XYB || {});

  XYB.RULES_VERSION = 3;

  XYB.STORAGE_KEYS = {
    settings: "xyb_settings",
    stats: "xyb_stats",
    blockedIds: "xyb_blocked_ids",
    authCache: "xyb_auth_cache",
  };

  XYB.DEFAULT_SETTINGS = {
    enabled: true,
    autoHide: true,
    scanReplies: true,
    debug: true,
    rulesVersion: XYB.RULES_VERSION,
    useBuiltinKeywords: true,
    useBuiltinDomains: true,
    useBuiltinRegexes: true,
    keywords: [],
    domains: [],
    regexes: [],
    whitelist: [],
  };

  XYB.API = {
    blockCreate: "https://x.com/i/api/1.1/blocks/create.json",
    userShow: "https://x.com/i/api/1.1/users/show.json",
  };

  XYB.TWEET_SELECTOR = 'article[data-testid="tweet"]';

  XYB.RESERVED_HANDLES = new Set([
    "home",
    "explore",
    "notifications",
    "messages",
    "i",
    "search",
    "settings",
    "compose",
    "login",
    "signup",
  ]);

  XYB.BLOCK_TIMEOUT_MS = 12000;
  XYB.SCAN_DEBOUNCE_MS = 400;
  XYB.RESCAN_DEBOUNCE_MS = 600;
  XYB.SCROLL_RESCAN_MS = 1200;
  XYB.GLOBAL_SCAN_MIN_MS = 2000;
  XYB.TWEET_REPROCESS_DEBOUNCE_MS = 600;
  XYB.AUTH_THROTTLE_MS = 3000;
  XYB.MIN_WEAK_KEYWORD_HITS = 2;
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : window);
