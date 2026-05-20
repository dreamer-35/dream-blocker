/* global globalThis */
(function (root) {
  const XYB = (root.XYB = root.XYB || {});

  XYB.DEFAULT_RULES = {
    keywords: [
      "电报",
      "tg群",
      "福利",
      "私信",
      "约炮",
      "同城",
      "上门",
      "onlyfans",
      "of链接",
      "看片",
      "资源群",
      "扫码",
      "微信同步",
      "加v",
      "+v",
      "vx",
      "裸聊",
      "包夜",
      "外围",
      "楼凤",
      "会所",
      "援交",
      "修车",
      "开车",
      "福利姬",
      "涩图",
      "黄网",
      "成人视频",
      "免费看",
      "点击进入",
      "链接在简介",
      "bio链接",
      "subscribe",
      "premium content",
      "dm me",
      "link in bio",
    ],
    domains: [
      "t.me",
      "telegram.me",
      "telegram.dog",
      "onlyfans.com",
      "fans.ly",
      "linktr.ee",
      "linktree",
      "bit.ly",
      "cutt.ly",
      "ow.ly",
      "buff.ly",
      "tinyurl.com",
      "is.gd",
      "rb.gy",
      "solo.to",
      "beacons.ai",
      "carrd.co",
      "taplink",
      "getallmylinks",
      "stan.store",
    ],
    regexes: [
      "1[3-9]\\d{9}",
      "加[\\s]*[vVＶ]",
      "\\+\\s*[vVＶ]",
      "微[\\s]*信[\\s]*[：:]",
      "[qQ][qQ]\\s*[:：]?\\s*\\d{5,12}",
    ],
  };

  /**
   * @param {object} settings
   * @returns {{ keywords: string[], domains: string[], regexes: RegExp[] }}
   */
  XYB.buildActiveRules = function buildActiveRules(settings) {
    const s = settings || {};
    const builtin = XYB.DEFAULT_RULES;

    const keywords = [];
    const domains = [];
    const regexSources = [];

    if (s.useBuiltinKeywords !== false) {
      keywords.push(...builtin.keywords);
    }
    if (s.useBuiltinDomains !== false) {
      domains.push(...builtin.domains);
    }
    if (s.useBuiltinRegexes !== false) {
      regexSources.push(...builtin.regexes);
    }

    keywords.push(...(s.keywords || []));
    domains.push(...(s.domains || []));
    regexSources.push(...(s.regexes || []));

    const regexes = [];
    for (const src of regexSources) {
      const trimmed = String(src).trim();
      if (!trimmed) continue;
      try {
        regexes.push(new RegExp(trimmed, "i"));
      } catch (_) {
        /* skip invalid user regex */
      }
    }

    return {
      keywords: [...new Set(keywords.map((k) => k.toLowerCase()))],
      domains: [...new Set(domains.map((d) => d.toLowerCase()))],
      regexes,
    };
  };

  XYB.getDefaultSettings = function getDefaultSettings() {
    return { ...XYB.DEFAULT_SETTINGS };
  };

  XYB.mergeSettings = function mergeSettings(stored) {
    const base = XYB.getDefaultSettings();
    if (!stored || typeof stored !== "object") return base;
    return {
      ...base,
      ...stored,
      keywords: stored.keywords || base.keywords,
      domains: stored.domains || base.domains,
      regexes: stored.regexes || base.regexes,
      whitelist: stored.whitelist || base.whitelist,
    };
  };
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : window);
