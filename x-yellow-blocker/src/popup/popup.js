/* global XYB, chrome */

const $ = (id) => document.getElementById(id);
let saveTimer = null;

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
  $("debug").checked = settings.debug !== false;
  $("useBuiltinKeywords").checked = settings.useBuiltinKeywords !== false;
  $("useBuiltinDomains").checked = settings.useBuiltinDomains !== false;
  $("useBuiltinRegexes").checked = settings.useBuiltinRegexes !== false;
  $("keywords").value = arrayToLines(settings.keywords);
  $("domains").value = arrayToLines(settings.domains);
  $("regexes").value = arrayToLines(settings.regexes);
  $("whitelist").value = arrayToLines(settings.whitelist);
}

function setStatus(text, ok) {
  const el = $("status");
  if (!el) return;
  el.textContent = text;
  el.className = ok ? "status-ok" : "status-err";
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

function sendTabMessage(tabId, payload) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function pushSettingsToTabs(merged) {
  return new Promise((resolve) => {
    chrome.tabs.query(
      { url: ["https://x.com/*", "https://twitter.com/*"] },
      async (tabs) => {
        let applied = 0;
        let needRefresh = 0;

        for (const tab of tabs) {
          if (!tab.id) continue;
          try {
            const resp = await sendTabMessage(tab.id, {
              type: "APPLY_SETTINGS",
              settings: merged,
            });
            if (resp?.ok) {
              applied += 1;
              continue;
            }
          } catch (_) {
            /* 页面脚本未就绪 */
          }

          if (chrome.scripting?.executeScript) {
            try {
              const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (s) => {
                  if (typeof window.__xybApplySettings === "function") {
                    window.__xybApplySettings(s);
                    return 1;
                  }
                  return 0;
                },
                args: [merged],
              });
              if (results?.[0]?.result) {
                applied += 1;
                continue;
              }
            } catch (_) {
              /* fallthrough */
            }
          }
          needRefresh += 1;
        }

        resolve({ applied, needRefresh, total: tabs.length });
      }
    );
  });
}

function saveSettings() {
  const data = readForm();
  const merged = XYB.mergeSettings(data);
  merged.rulesVersion = XYB.RULES_VERSION;
  $("save").disabled = true;
  setStatus("保存中…", true);

  chrome.storage.sync.set({ [XYB.STORAGE_KEYS.settings]: merged }, async () => {
    $("save").disabled = false;
    if (chrome.runtime.lastError) {
      setStatus("保存失败", false);
      return;
    }

    try {
      const { applied, needRefresh, total } = await pushSettingsToTabs(merged);
      loadStats();

      if (applied > 0 && needRefresh === 0) {
        setStatus(`已保存，已应用到 ${applied} 个标签页`, true);
      } else if (applied > 0) {
        setStatus(`已保存；${needRefresh} 个标签请 F5 刷新`, true);
      } else if (total > 0) {
        setStatus("已保存。请刷新 X 页面（F5）", false);
      } else {
        setStatus("已保存。打开 x.com 后生效", true);
      }
    } catch (e) {
      setStatus("已保存到云端，请 F5 刷新 X 页面", false);
    }
    setTimeout(() => setStatus("", true), 3500);
  });
}

function debouncedSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveSettings, 400);
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
  setStatus("规则已导出", true);
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
        setStatus("JSON 无效", false);
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
  $("enabled").addEventListener("change", debouncedSave);
});
