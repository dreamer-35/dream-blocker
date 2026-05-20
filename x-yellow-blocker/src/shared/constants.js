/* global globalThis */
(function (root) {
  const XYB = (root.XYB = root.XYB || {});

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
    debug: false,
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

  XYB.TWEET_SELECTORS = [
    'article[data-testid="tweet"]',
    'article[role="article"]',
  ];

  XYB.BLOCK_QUEUE_DELAY_MS = 800;
  XYB.SCAN_DEBOUNCE_MS = 150;
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : window);
