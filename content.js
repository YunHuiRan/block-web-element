// Block Web Element - content script
const BLOCKED_MARK = "data-blocked-by-extension";
const ORIGINAL_DISPLAY_MARK = "data-blocked-original-display";
const ORIGINAL_PRIORITY_MARK = "data-blocked-original-priority";
const STORAGE_KEY = "blockRules";

const t = (key) => globalThis.chrome?.i18n?.getMessage(key) || key;

/** 通配符（*.example.com）或包含匹配 */
function isUrlMatched(pattern, url) {
  const p = (pattern || "").trim().toLowerCase();
  if (!p) return false;

  const u = url.toLowerCase();
  if (!p.includes("*")) return u.includes(p);

  const regex = p
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${regex}$`).test(u);
}

/** 按逗号或换行拆分（与 popup 一致） */
const splitList = (raw) =>
  (raw || "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

/** . / # 开头按 CSS 选择器使用；旧数据里的纯名称同时当作 class 和 id */
function buildSelectorForPart(part) {
  return part.startsWith(".") || part.startsWith("#")
    ? [part]
    : [`.${part}`, `#${part}`];
}

/** 规则中所有被屏蔽元素：kind 's' = .class/#id，'c' = CSS 选择器 */
const getRuleTargets = (rule) => [
  ...splitList(rule.selectors).map((value) => ({ kind: "s", value })),
  ...splitList(rule.cssSelectors).map((value) => ({ kind: "c", value })),
];

const targetKey = ({ kind, value }) => `${kind}:${value}`;

/** 该规则当前生效的 CSS 选择器（跳过被单独关闭的元素） */
function getRuleSelectors(rule) {
  const disabled = new Set(rule.disabledTargets || []);
  const selectors = [];

  for (const target of getRuleTargets(rule)) {
    if (disabled.has(targetKey(target))) continue;
    const parts =
      target.kind === "c" ? [target.value] : buildSelectorForPart(target.value);
    for (const part of parts) {
      if (!selectors.includes(part)) selectors.push(part);
    }
  }
  return selectors;
}
/** 隐藏匹配元素（记录原始 display，便于恢复） */
function hideElements(selectors) {
  let count = 0;

  for (const selector of selectors) {
    let elements;
    try {
      elements = document.querySelectorAll(selector);
    } catch (e) {
      console.warn(t("warnInvalidSelector"), selector, e);
      continue;
    }

    for (const el of elements) {
      if (el.hasAttribute(BLOCKED_MARK)) continue;
      el.setAttribute(
        ORIGINAL_DISPLAY_MARK,
        el.style.getPropertyValue("display"),
      );
      el.setAttribute(
        ORIGINAL_PRIORITY_MARK,
        el.style.getPropertyPriority("display"),
      );
      el.setAttribute(BLOCKED_MARK, "true");
      el.style.setProperty("display", "none", "important");
      count += 1;
    }
  }
  return count;
}

const matchesAny = (el, selectors) =>
  selectors.some((selector) => {
    try {
      return el.matches(selector);
    } catch {
      return false;
    }
  });

/** 恢复不再需要屏蔽的元素（规则停用 / 删除，或元素开关被关闭） */
function restoreElements(selectors) {
  let count = 0;

  for (const el of document.querySelectorAll(`[${BLOCKED_MARK}]`)) {
    if (selectors.length > 0 && matchesAny(el, selectors)) continue;

    const display = el.getAttribute(ORIGINAL_DISPLAY_MARK) || "";
    const priority = el.getAttribute(ORIGINAL_PRIORITY_MARK) || "";
    if (display) el.style.setProperty("display", display, priority);
    else el.style.removeProperty("display");

    el.removeAttribute(ORIGINAL_DISPLAY_MARK);
    el.removeAttribute(ORIGINAL_PRIORITY_MARK);
    el.removeAttribute(BLOCKED_MARK);
    count += 1;
  }
  return count;
}

/** 当前页面命中的、已启用的规则 */
const getMatchingRules = (rules) =>
  (rules || []).filter(
    (rule) =>
      rule.enabled && isUrlMatched(rule.urlPattern, window.location.href),
  );

/** 当前页面全部生效的 CSS 选择器 */
function getActiveSelectors(rules) {
  const selectors = [];

  for (const rule of getMatchingRules(rules)) {
    for (const selector of getRuleSelectors(rule)) {
      if (!selectors.includes(selector)) selectors.push(selector);
    }
  }
  return selectors;
}

/** 执行屏蔽，并恢复已失效的元素 */
function applyRules(rules) {
  const selectors = getActiveSelectors(rules);
  return {
    hidden: hideElements(selectors),
    restored: restoreElements(selectors),
  };
}

let currentRules = [];

/** 持续处理动态加载的元素 */
function startObserver() {
  const observer = new MutationObserver(() => {
    const selectors = getActiveSelectors(currentRules);
    if (selectors.length > 0) hideElements(selectors);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  return observer;
}

async function init() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  currentRules = stored[STORAGE_KEY] || [];
  applyRules(currentRules);

  const observer = startObserver();
  window.addEventListener("beforeunload", () => observer.disconnect());

  // SPA 路由变化时重新应用
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      applyRules(currentRules);
    }
  }, 1000);

  // 规则被修改时立即生效
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    currentRules = changes[STORAGE_KEY].newValue || [];
    applyRules(currentRules);
  });
}

init();
