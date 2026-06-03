/* global importScripts */
importScripts("src/shared/constants.js", "src/shared/rules.js");

const XYB = globalThis.XYB;

function migrateSettings() {
  chrome.storage.sync.get([XYB.STORAGE_KEYS.settings], (res) => {
    const stored = res[XYB.STORAGE_KEYS.settings];
    const merged = XYB.mergeSettings(stored);
    if (!stored || (stored.rulesVersion || 0) < XYB.RULES_VERSION) {
      chrome.storage.sync.set({ [XYB.STORAGE_KEYS.settings]: merged });
    }
  });
}

chrome.runtime.onInstalled.addListener(migrateSettings);
chrome.runtime.onStartup.addListener(migrateSettings);
