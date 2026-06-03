/* global globalThis */
(function (root) {
  const XYB = (root.XYB = root.XYB || {});

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * 单字中文、短 ASCII 用词边界；多字中文词（黄推、电报）允许子串匹配
   */
  XYB.includesKeyword = function includesKeyword(haystack, kw) {
    if (!kw) return false;
    const k = kw.toLowerCase().trim();
    const h = (haystack || "").toLowerCase();
    if (!k || !h) return false;

    const isSingleHan = k.length === 1 && /[\u4e00-\u9fa5]/.test(k);
    const isShortAscii = k.length <= 3 && /^[a-z0-9.+_\-]+$/i.test(k);

    if (!isSingleHan && !isShortAscii) {
      return h.includes(k);
    }

    const re = new RegExp(
      `(?:^|[^\\u4e00-\\u9fa5a-z0-9])${escapeRegExp(k)}(?:[^\\u4e00-\\u9fa5a-z0-9]|$)`,
      "i"
    );
    if (re.test(h)) return true;
    if (h === k) return true;
    if (h.startsWith(k) && !/[\u4e00-\u9fa5a-z0-9]/i.test(h.charAt(k.length))) return true;
    if (h.endsWith(k) && !/[\u4e00-\u9fa5a-z0-9]/i.test(h.charAt(h.length - k.length - 1))) {
      return true;
    }
    return false;
  };

  XYB.matchDomainInUrl = function matchDomainInUrl(href, domain) {
    if (!href || !domain) return false;
    const lower = href.toLowerCase();
    const d = domain.toLowerCase();

    try {
      const url = lower.startsWith("http")
        ? new URL(lower)
        : new URL(`https://${lower.replace(/^\/\//, "")}`);
      const host = url.hostname;
      return host === d || host.endsWith(`.${d}`);
    } catch (_) {
      return (
        lower.includes(`://${d}/`) ||
        lower.includes(`://${d}?`) ||
        lower.includes(`.${d}/`) ||
        lower.endsWith(`.${d}`)
      );
    }
  };

  XYB.matchTweet = function matchTweet(text, links, rules) {
    const reasons = [];
    const haystack = text || "";
    const linkList = links || [];

    for (const kw of rules.strongKeywords || []) {
      if (XYB.includesKeyword(haystack, kw)) reasons.push(`strong:${kw}`);
    }

    for (const kw of rules.customKeywords || []) {
      if (XYB.includesKeyword(haystack, kw)) reasons.push(`custom:${kw}`);
    }

    let weakHits = 0;
    for (const kw of rules.weakKeywords || []) {
      if (XYB.includesKeyword(haystack, kw)) {
        weakHits += 1;
        reasons.push(`weak:${kw}`);
      }
    }

    const allDomains = [
      ...(rules.strongDomains || []),
      ...(rules.customDomains || []),
    ];
    for (const domain of allDomains) {
      if (linkList.some((href) => XYB.matchDomainInUrl(href, domain))) {
        reasons.push(`domain:${domain}`);
      }
    }

    for (const re of rules.regexes || []) {
      re.lastIndex = 0;
      if (re.test(haystack)) reasons.push(`regex:${re.source}`);
    }

    const hasStrong =
      reasons.some((r) => r.startsWith("strong:") || r.startsWith("custom:") || r.startsWith("domain:")) ||
      reasons.some((r) => r.startsWith("regex:"));
    const hasWeak = weakHits >= (rules.minWeakHits || 2);
    const matched = hasStrong || hasWeak;

    return {
      matched,
      reasons: matched ? reasons : [],
      weakHits,
      hasStrong,
      hasWeak,
    };
  };

  XYB.isWhitelisted = function isWhitelisted(handle, whitelist) {
    if (!handle) return false;
    const h = handle.replace(/^@/, "").toLowerCase();
    return (whitelist || []).some(
      (w) => w.replace(/^@/, "").toLowerCase() === h
    );
  };
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : window);
