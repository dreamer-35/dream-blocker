/* global globalThis */
(function (root) {
  const XYB = (root.XYB = root.XYB || {});

  /**
   * @param {string} text
   * @param {string[]} links
   * @param {{ keywords: string[], domains: string[], regexes: RegExp[] }} rules
   * @returns {{ matched: boolean, reasons: string[] }}
   */
  XYB.matchTweet = function matchTweet(text, links, rules) {
    const reasons = [];
    const haystack = (text || "").toLowerCase();
    const linkBlob = (links || []).join(" ").toLowerCase();
    const combined = `${haystack} ${linkBlob}`;

    for (const kw of rules.keywords || []) {
      if (kw && combined.includes(kw)) {
        reasons.push(`keyword:${kw}`);
      }
    }

    for (const domain of rules.domains || []) {
      if (domain && combined.includes(domain)) {
        reasons.push(`domain:${domain}`);
      }
    }

    for (const re of rules.regexes || []) {
      if (re.test(text || "") || re.test(linkBlob)) {
        reasons.push(`regex:${re.source}`);
      }
    }

    return { matched: reasons.length > 0, reasons };
  };

  XYB.isWhitelisted = function isWhitelisted(handle, whitelist) {
    if (!handle) return false;
    const h = handle.replace(/^@/, "").toLowerCase();
    return (whitelist || []).some(
      (w) => w.replace(/^@/, "").toLowerCase() === h
    );
  };
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : window);
