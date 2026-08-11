// Block by Class Name - popup script
// 负责规则的增删改查与存储

const STORAGE_KEY = "blockRules";

// DOM 引用
const emptyState = document.getElementById("empty-state");
const ruleList = document.getElementById("rule-list");
const addRuleBtn = document.getElementById("add-rule-btn");
const editor = document.getElementById("editor");
const ruleUrl = document.getElementById("rule-url");
const ruleSelectors = document.getElementById("rule-selectors");
const ruleEnabled = document.getElementById("rule-enabled");
const saveBtn = document.getElementById("save-btn");
const cancelBtn = document.getElementById("cancel-btn");
const saveMsg = document.getElementById("save-msg");

/** 当前正在编辑的规则 id（null 表示新增） */
let editingId = null;

/** 当前全部规则 */
let rules = [];

/** 生成唯一 id */
function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 读取规则 */
async function loadRules() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  rules = result[STORAGE_KEY] || [];
  return rules;
}

/** 保存规则到存储 */
async function saveRules() {
  await chrome.storage.local.set({ [STORAGE_KEY]: rules });
}

/** 渲染规则列表 */
function renderRules() {
  ruleList.innerHTML = "";

  if (rules.length === 0) {
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");
  }

  rules.forEach((rule, index) => {
    const item = document.createElement("div");
    item.className = "rule-item" + (rule.enabled ? "" : " rule-disabled");

    const info = document.createElement("div");
    info.className = "rule-info";

    const urlEl = document.createElement("div");
    urlEl.className = "rule-url";
    urlEl.textContent = rule.urlPattern || "(未填写网址)";

    const selEl = document.createElement("div");
    selEl.className = "rule-selectors";
    selEl.textContent = rule.selectors || "(未填写选择器)";

    info.appendChild(urlEl);
    info.appendChild(selEl);

    const actions = document.createElement("div");
    actions.className = "rule-actions";

    // 启用开关
    const switchLabel = document.createElement("label");
    switchLabel.className = "switch";
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = !!rule.enabled;
    toggle.addEventListener("change", async () => {
      rule.enabled = toggle.checked;
      await saveRules();
      renderRules();
    });
    const slider = document.createElement("span");
    slider.className = "slider";
    switchLabel.appendChild(toggle);
    switchLabel.appendChild(slider);

    // 编辑按钮
    const editBtn = document.createElement("button");
    editBtn.className = "btn-icon";
    editBtn.textContent = "✏️";
    editBtn.title = "编辑";
    editBtn.addEventListener("click", () => openEditor(rule.id));

    // 删除按钮
    const delBtn = document.createElement("button");
    delBtn.className = "btn-icon danger";
    delBtn.textContent = "🗑️";
    delBtn.title = "删除";
    delBtn.addEventListener("click", async () => {
      if (!confirm(`确定删除规则「${rule.urlPattern}」？`)) return;
      rules.splice(index, 1);
      await saveRules();
      renderRules();
    });

    actions.appendChild(switchLabel);
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    item.appendChild(info);
    item.appendChild(actions);
    ruleList.appendChild(item);
  });
}

/** 打开编辑器（新增或编辑） */
function openEditor(id = null) {
  editingId = id;
  saveMsg.textContent = "";

  if (id === null) {
    // 新增
    ruleUrl.value = "";
    ruleSelectors.value = "";
    ruleEnabled.checked = true;
    editor.classList.remove("hidden");
    ruleUrl.focus();
    return;
  }

  const rule = rules.find((r) => r.id === id);
  if (!rule) return;

  ruleUrl.value = rule.urlPattern || "";
  ruleSelectors.value = rule.selectors || "";
  ruleEnabled.checked = !!rule.enabled;
  editor.classList.remove("hidden");
  ruleUrl.focus();
}

/** 关闭编辑器 */
function closeEditor() {
  editor.classList.add("hidden");
  editingId = null;
  saveMsg.textContent = "";
}

/** 保存当前编辑的内容 */
async function handleSave() {
  const urlPattern = ruleUrl.value.trim();
  const selectors = ruleSelectors.value.trim();

  // 校验
  if (!urlPattern) {
    showSaveMessage("请填写网址规则", "error");
    return;
  }
  if (!selectors) {
    showSaveMessage("请填写要屏蔽的元素", "error");
    return;
  }

  if (editingId === null) {
    // 新增
    rules.push({
      id: makeId(),
      urlPattern,
      selectors,
      enabled: ruleEnabled.checked,
    });
  } else {
    // 更新
    const rule = rules.find((r) => r.id === editingId);
    if (rule) {
      rule.urlPattern = urlPattern;
      rule.selectors = selectors;
      rule.enabled = ruleEnabled.checked;
    }
  }

  await saveRules();
  renderRules();
  closeEditor();
  showSaveMessage("已保存 ✅", "success");
}

/** 显示保存提示消息 */
let msgTimer = null;
function showSaveMessage(text, type = "success") {
  saveMsg.textContent = text;
  saveMsg.className = "save-msg " + (type === "error" ? "save-msg-error" : "");
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => {
    saveMsg.textContent = "";
  }, 2000);
}

// ----- 事件绑定 -----
addRuleBtn.addEventListener("click", () => openEditor(null));
cancelBtn.addEventListener("click", closeEditor);
saveBtn.addEventListener("click", handleSave);

// 回车键保存
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !editor.classList.contains("hidden")) {
    const tag = e.target.tagName.toLowerCase();
    if (tag === "input") {
      e.preventDefault();
      handleSave();
    }
  }
});

// 初始化
(async function init() {
  await loadRules();
  renderRules();
})();
