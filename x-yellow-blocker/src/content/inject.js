/* global chrome */
(function () {
  if (document.getElementById("xyb-page-hook")) return;
  const s = document.createElement("script");
  s.id = "xyb-page-hook";
  s.src = chrome.runtime.getURL("src/content/page-hook.js");
  (document.documentElement || document.head).appendChild(s);
})();
