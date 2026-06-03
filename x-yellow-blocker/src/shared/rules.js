/* global globalThis */
(function (root) {
  const XYB = (root.XYB = root.XYB || {});

  /** 命中一条即屏蔽 */
  XYB.STRONG_KEYWORDS = [
    "电报",
    "纸飞机",
    "tg群",
    "telegram群",
    "onlyfans",
    "only fans",
    "fansly",
    "福利姬",
    "裸聊",
    "约炮",
    "包夜",
    "外围",
    "楼凤",
    "会所上门",
    "援交",
    "一夜情",
    "色情",
    "黄片",
    "成人片",
    "看黄片",
    "涩图包",
    "of链接",
    "linktree福利",
    "同城约",
    "上门服务",
    "兼职妹子",
    "小姐上门",
  ];

  /** 需同时命中 ≥2 条才屏蔽，降低误伤 */
  XYB.WEAK_KEYWORDS = [
    "私信领取",
    "扫码加群",
    "资源群",
    "进群领取",
    "链接在简介",
    "主页有链接",
    "看简介",
  ];

  /** 仅检查推文内链接的域名 */
  XYB.STRONG_DOMAINS = [
    "t.me",
    "telegram.me",
    "telegram.dog",
    "onlyfans.com",
    "fans.ly",
  ];

  /** 组合语境正则，避免单独匹配手机号等 */
  XYB.COMBO_REGEXES = [
    "(电报|telegram|tg群|纸飞机).{0,12}(群|频道|链接)",
    "加.{0,4}[vVＶ].{0,8}(微信|wx|telegram|电报)",
    "(微信|vx|telegram).{0,8}1[3-9]\\d{9}",
    "1[3-9]\\d{9}.{0,8}(微信|vx|电报|联系我)",
    "(onlyfans|fansly).{0,6}(订阅|subscribe|link)",
  ];

  XYB.DEFAULT_RULES = {
    strongKeywords: XYB.STRONG_KEYWORDS,
    weakKeywords: XYB.WEAK_KEYWORDS,
    strongDomains: XYB.STRONG_DOMAINS,
    regexes: XYB.COMBO_REGEXES,
  };

  XYB.buildActiveRules = function buildActiveRules(settings) {
    const s = settings || {};
    const builtin = XYB.DEFAULT_RULES;

    const strongKeywords = [];
    const weakKeywords = [];
    const strongDomains = [];
    const regexSources = [];

    if (s.useBuiltinKeywords !== false) {
      strongKeywords.push(...builtin.strongKeywords);
      weakKeywords.push(...builtin.weakKeywords);
    }
    if (s.useBuiltinDomains !== false) {
      strongDomains.push(...builtin.strongDomains);
    }
    if (s.useBuiltinRegexes !== false) {
      regexSources.push(...builtin.regexes);
    }

    const customKeywords = [...(s.keywords || [])];
    const customDomains = [...(s.domains || [])];
    regexSources.push(...(s.regexes || []));

    const regexes = [];
    for (const src of regexSources) {
      const trimmed = String(src).trim();
      if (!trimmed) continue;
      try {
        regexes.push(new RegExp(trimmed, "i"));
      } catch (_) {
        /* skip invalid */
      }
    }

    return {
      strongKeywords: [...new Set(strongKeywords.map((k) => k.toLowerCase()))],
      weakKeywords: [...new Set(weakKeywords.map((k) => k.toLowerCase()))],
      customKeywords: [...new Set(customKeywords.map((k) => k.toLowerCase()))],
      strongDomains: [...new Set(strongDomains.map((d) => d.toLowerCase()))],
      customDomains: [...new Set(customDomains.map((d) => d.toLowerCase()))],
      regexes,
      minWeakHits: XYB.MIN_WEAK_KEYWORD_HITS,
    };
  };

  XYB.getDefaultSettings = function getDefaultSettings() {
    return { ...XYB.DEFAULT_SETTINGS };
  };

  XYB.mergeSettings = function mergeSettings(stored) {
    const base = XYB.getDefaultSettings();
    if (!stored || typeof stored !== "object") return base;

    const merged = {
      ...base,
      ...stored,
      keywords: stored.keywords || base.keywords,
      domains: stored.domains || base.domains,
      regexes: stored.regexes || base.regexes,
      whitelist: stored.whitelist || base.whitelist,
      rulesVersion: XYB.RULES_VERSION,
    };

    if ((stored.rulesVersion || 0) < XYB.RULES_VERSION) {
      merged.debug = true;
    }

    return merged;
  };
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : window);
