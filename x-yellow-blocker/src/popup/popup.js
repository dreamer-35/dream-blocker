/* global XYB, chrome */

const $ = (id) => document.getElementById(id);

function linesToArray(text) {
  return (text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function arrayToLines(arr) {
  return (arr || []).join("\n");
}

function readForm() {
  return {
    enabled: $("enabled").checked,
    autoHide: $("autoHide").checked,
    debug: $("debug").checked,
    useBuiltinKeywords: $("useBuiltinKeywords").checked,
    useBuiltinDomains: $("useBuiltinDomains").checked,
    useBuiltinRegexes: $("useBuiltinRegexes").checked,
    keywords: linesToArray($("keywords").value),
    domains: linesToArray($("domains").value),
    regexes: linesToArray($("regexes").value),
    whitelist: linesToArray($("whitelist").value).map((h) =>
      h.replace(/^@/, "")
    ),
  };
}

function fillForm(settings) {
  $("enabled").checked = settings.enabled !== false;
  $("autoHide").checked = settings.autoHide !== false;
  $("debug").checked = !!settings.debug;
  $("useBuiltinKeywords").checked = settings.useBuiltinKeywords !== false;
  $("useBuiltinDomains").checked = settings.useBuiltinDomains !== false;
  $("useBuiltinRegexes").checked = settings.useBuiltinRegexes !== false;
  $("keywords").value = arrayToLines(settings.keywords);
  $("domains").value = arrayToLines(settings.domains);
  $("regexes").value = arrayToLines(settings.regexes);
  $("whitelist").value = arrayToLines(settings.whitelist);
}

function loadStats() {
  chrome.storage.local.get([XYB.STORAGE_KEYS.stats], (res) => {
    const stats = res[XYB.STORAGE_KEYS.stats] || {};
    const today = new Date().toISOString().slice(0, 10);
    if (stats.date === today) {
      $("statHidden").textContent = stats.hidden || 0;
      $("statBlocked").textContent = stats.blocked || 0;
    } else {
      $("statHidden").textContent = "0";
      $("statBlocked").textContent = "0";
    }
  });
}

function saveSettings() {
  const data = readForm();
  const merged = XYB.mergeSettings(data);
  chrome.storage.sync.set({ [XYB.STORAGE_KEYS.settings]: merged }, () => {
    chrome.tabs.query({ url: ["https://x.com/*", "https://twitter.com/*"] }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { type: "RESCAN" }).catch(() => {});
      });
    });
    loadStats();
  });
}

function exportRules() {
  const data = readForm();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "xyb-rules.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importRules() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        fillForm(XYB.mergeSettings(parsed));
        saveSettings();
      } catch {
        alert("JSON 格式无效");
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function resetDefaults() {
  fillForm(XYB.getDefaultSettings());
  saveSettings();
}

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get([XYB.STORAGE_KEYS.settings], (res) => {
    fillForm(XYB.mergeSettings(res[XYB.STORAGE_KEYS.settings]));
  });
  loadStats();

  $("save").addEventListener("click", saveSettings);
  $("export").addEventListener("click", exportRules);
  $("import").addEventListener("click", importRules);
  $("reset").addEventListener("click", resetDefaults);
  $("enabled").addEventListener("change", saveSettings);
});
