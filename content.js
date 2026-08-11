// Block by Class Name - content script
// 读取存储的规则，匹配当前页面 URL，并隐藏匹配的元素

/** 扩展的状态标记属性（防止重复处理已隐藏元素） */
const BLOCKED_MARK = "data-blocked-by-extension";

/** 存储 key */
const STORAGE_KEY = "blockRules";

/**
 * 匹配当前页面 URL 是否命中规则。
 * 支持的匹配方式：
 *  - 通配符：*.example.com、example.com/*
 *  - 纯包含：example.com（即 URL 中包含该字符串即命中）
 */
function isUrlMatched(pattern, url) {
  if (!pattern) return false;

  const p = pattern.trim().toLowerCase();
  if (!p) return false;

  const u = url.toLowerCase();

  // 通配符匹配
  if (p.includes("*")) {
    const regex = p
      .split("*")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    return new RegExp(`^${regex}$`).test(u);
  }

  // 纯字符串：包含匹配
  return u.includes(p);
}

/**
 * 将用户输入的“类名 / id 文本”转换为标准 CSS 选择器列表。
 * 例如输入:
 *   .ad-banner   -> ['.ad-banner']
 *   #popup       -> ['#popup']
 *   ad-banner    -> ['.ad-banner', '#ad-banner']
 * 逗号分隔可一次输入多个。
 */
function buildSelectors(raw) {
  if (!raw) return [];

  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const selectors = [];
  for (const part of parts) {
    if (part.startsWith(".") || part.startsWith("#")) {
      selectors.push(part);
    } else {
      // 纯文本：同时当作 class 和 id 处理
      selectors.push(`.${part}`);
      selectors.push(`#${part}`);
    }
  }
  return selectors;
}

/**
 * 解析用户输入的自定义 CSS 选择器（原样使用，不做转换）。
 * 例如:
 *   a[target="_blank"][href="#"]  -> ['a[target="_blank"][href="#"]']
 * 支持逗号或换行分隔多个选择器。
 */
function parseCssSelectors(raw) {
  if (!raw) return [];
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 获取一条规则对应的所有 CSS 选择器
 * （className / id 转换结果 + 自定义 CSS 选择器）。
 */
function getRuleSelectors(rule) {
  const selectors = buildSelectors(rule.selectors);
  for (const s of parseCssSelectors(rule.cssSelectors)) {
    if (!selectors.includes(s)) selectors.push(s);
  }
  return selectors;
}

/**
 * 隐藏匹配的元素。
 * 使用 CSS 优先级最高的内联样式并添加标记，防止后续被页面样式覆盖。
 */
function hideElements(selectors) {
  let hiddenCount = 0;
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (el.hasAttribute(BLOCKED_MARK)) continue;
        el.setAttribute(BLOCKED_MARK, "true");
        el.style.setProperty("display", "none", "important");
        hiddenCount++;
      }
    } catch (e) {
      // 无效选择器，跳过
      console.warn("[Block by Class Name] 无效选择器:", selector, e);
    }
  }
  return hiddenCount;
}

/** 获取当前页面匹配的规则（已启用） */
function getMatchingRules(rules) {
  const url = window.location.href;
  return (rules || []).filter(
    (r) => r.enabled && isUrlMatched(r.urlPattern, url),
  );
}

/** 在当前页面执行所有命中规则的隐藏操作 */
function applyRules(rules) {
  const matching = getMatchingRules(rules);
  let total = 0;
  for (const rule of matching) {
    total += hideElements(getRuleSelectors(rule));
  }
  return total;
}

/** 启动 MutationObserver，持续处理动态加载的元素 */
function startObserver(selectorsList) {
  // 展开所有规则的选择器（扁平化）
  const allSelectors = [];
  for (const rule of selectorsList) {
    if (!rule.enabled) continue;
    const selectors = getRuleSelectors(rule);
    for (const s of selectors) {
      if (!allSelectors.includes(s)) allSelectors.push(s);
    }
  }
  if (allSelectors.length === 0) return null;

  const observer = new MutationObserver(() => {
    hideElements(allSelectors);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  return observer;
}

async function init() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const rules = result[STORAGE_KEY] || [];
  const matching = getMatchingRules(rules);

  // 初始隐藏
  applyRules(rules);

  // 监听动态变化
  if (matching.length > 0) {
    const observer = startObserver(matching);
    // 页面 URL 变化时（SPA 路由），重新应用规则
    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        applyRules(rules);
      }
    }, 1000);
    // 清理 observer 一旦页面销毁
    window.addEventListener("beforeunload", () => observer?.disconnect());
  }

  // 监听存储变化：规则被修改时立即在当前页面生效
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) {
      const newRules = changes[STORAGE_KEY].newValue || [];
      applyRules(newRules);
    }
  });
}

init();
