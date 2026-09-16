// Block Web Element - popup
const STORAGE_KEY = "blockRules";
const EXPORT_VERSION = 1;

const $ = (id) => document.getElementById(id);
const listView = $("list-view");
const ruleList = $("rule-list");
const editor = $("editor");
const editorTitle = $("editor-title");
const urlField = $("url-field");
const ruleUrl = $("rule-url");
const ruleSelectors = $("rule-selectors");
const saveMsg = $("save-msg");
const ioMsg = $("io-msg");
const importFile = $("import-file");
const ruleNote = $("rule-note");

/** 注释最大长度（与 popup.html 输入框的 maxlength 保持一致） */
const NOTE_MAX_LENGTH = 100;

let rules = [];
let editingId = null;
const expandedRuleIds = new Set();
/** 正在编辑注释的元素行（`ruleId|targetKey`，同一时间只编辑一个） */
let editingNoteKey = null;

/** 多语言文案 */
const msg = (key, subs) => chrome.i18n.getMessage(key, subs) || key;

/** 应用 HTML 上的静态文案（data-i18n / data-i18n-placeholder） */
function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const text = chrome.i18n.getMessage(el.dataset.i18n);
    if (text) el.textContent = text;
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const text = chrome.i18n.getMessage(el.dataset.i18nPlaceholder);
    if (text) el.placeholder = text;
  });
}

const makeId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

async function loadRules() {
  rules = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] || [];
}

const saveRules = () => chrome.storage.local.set({ [STORAGE_KEY]: rules });

// ----- 规则 / 元素 -----

/** 按逗号或换行拆分（与 content.js 一致） */
const splitList = (raw) =>
  (raw || "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

/** 规则中所有被屏蔽元素：kind 's' = .class/#id，'c' = CSS 选择器 */
const getRuleTargets = (rule) => [
  ...splitList(rule.selectors).map((value) => ({ kind: "s", value })),
  ...splitList(rule.cssSelectors).map((value) => ({ kind: "c", value })),
];

const targetKey = ({ kind, value }) => `${kind}:${value}`;
const targetField = ({ kind }) => (kind === "c" ? "cssSelectors" : "selectors");

/** . / # 开头记入 selectors，其它 CSS 选择器记入 cssSelectors */
const fieldOfValue = (value) =>
  value.startsWith(".") || value.startsWith("#")
    ? "selectors"
    : "cssSelectors";

const isTargetOff = (rule, target) =>
  (rule.disabledTargets || []).includes(targetKey(target));

/** 单独开启 / 关闭某个元素的屏蔽 */
function setTargetDisabled(rule, target, disabled) {
  const keys = new Set(rule.disabledTargets || []);
  if (disabled) keys.add(targetKey(target));
  else keys.delete(targetKey(target));
  rule.disabledTargets = [...keys];
}

/** 元素的注释存在 rule.targetNotes 里：{ 's:.ad-banner': '顶部广告' } */
const getTargetNote = (rule, target) =>
  (rule.targetNotes || {})[targetKey(target)] || "";

/** 写入 / 清空某个元素的注释（传空字符串即删除该元素的注释） */
function setTargetNote(rule, target, note) {
  const notes = { ...(rule.targetNotes || {}) };
  const key = targetKey(target);
  if (note) notes[key] = note;
  else delete notes[key];
  rule.targetNotes = notes;
}

/** 注释编辑区的标识：同一条规则下的同一个元素 */
const noteEditKey = (rule, target) => `${rule.id}|${targetKey(target)}`;

/** 开关组件 */
function createSwitch({ checked, small = false, title = "", onChange }) {
  const wrap = document.createElement("label");
  wrap.className = "switch" + (small ? " switch-sm" : "");
  wrap.title = title;

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!checked;
  input.addEventListener("change", () => onChange(input.checked));

  const slider = document.createElement("span");
  slider.className = "slider";

  wrap.append(input, slider);
  return wrap;
}

/** 抽屉中的一行：元素文本（含注释）+ 注释按钮 + 独立开关 + 移除按钮 */
function createTargetItem(rule, target) {
  const off = isTargetOff(rule, target);
  const note = getTargetNote(rule, target);
  const editKey = noteEditKey(rule, target);
  const editingNote = editingNoteKey === editKey;

  const row = document.createElement("div");
  row.className = "target-item" + (off ? " target-disabled" : "");

  const main = document.createElement("div");
  main.className = "target-main";

  const text = document.createElement("div");
  text.className = "target-text";

  const label = document.createElement("span");
  label.className = "target-label";
  label.textContent = target.value;
  label.title =
    `${msg(target.kind === "c" ? "sourceCss" : "sourceClassId")}：` +
    target.value;
  text.append(label);

  if (note) {
    const noteEl = document.createElement("span");
    noteEl.className = "target-note";
    noteEl.textContent = note;
    noteEl.title = note;
    text.append(noteEl);
  }

  const noteBtn = document.createElement("button");
  noteBtn.className = "btn-icon btn-note" + (note ? " has-note" : "");
  noteBtn.textContent = "📝";
  noteBtn.title = msg(note ? "editNote" : "addNote");
  noteBtn.addEventListener("click", () => {
    editingNoteKey = editingNote ? null : editKey;
    renderRules();
  });

  const removeBtn = document.createElement("button");
  removeBtn.className = "btn-icon btn-remove";
  removeBtn.textContent = "✕";
  removeBtn.title = msg("removeTarget");
  removeBtn.addEventListener("click", () => removeTarget(rule, target));

  main.append(
    text,
    noteBtn,
    createSwitch({
      checked: !off,
      small: true,
      title: msg("targetSwitchTitle"),
      onChange: async (checked) => {
        setTargetDisabled(rule, target, !checked);
        await saveRules();
        renderRules();
      },
    }),
    removeBtn,
  );

  row.append(main);
  if (editingNote) row.append(createNoteEditor(rule, target, note));
  return row;
}

/** 行内注释编辑区：输入框 + 保存 / 取消（已有注释时还能直接删除） */
function createNoteEditor(rule, target, note) {
  const box = document.createElement("div");
  box.className = "target-note-editor";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "note-input";
  input.value = note;
  input.maxLength = NOTE_MAX_LENGTH;
  input.placeholder = msg("notePlaceholder");
  input.addEventListener("keydown", (e) => {
    e.stopPropagation(); // 不要触发弹窗级的「回车 = 保存规则」
    if (e.key === "Enter") {
      e.preventDefault();
      saveTargetNote(rule, target, input.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeNoteEditor();
    }
  });

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn-icon";
  saveBtn.textContent = "✓";
  saveBtn.title = msg("noteSave");
  saveBtn.addEventListener("click", () =>
    saveTargetNote(rule, target, input.value),
  );

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn-icon";
  cancelBtn.textContent = "✕";
  cancelBtn.title = msg("noteCancel");
  cancelBtn.addEventListener("click", closeNoteEditor);

  box.append(input, saveBtn, cancelBtn);

  if (note) {
    const clearBtn = document.createElement("button");
    clearBtn.className = "btn-icon danger";
    clearBtn.textContent = "🗑️";
    clearBtn.title = msg("removeNote");
    clearBtn.addEventListener("click", () => saveTargetNote(rule, target, ""));
    box.append(clearBtn);
  }
  return box;
}

/** 关闭注释编辑区（不保存改动） */
function closeNoteEditor() {
  editingNoteKey = null;
  renderRules();
}

/** 保存某个元素的注释（传空字符串即删除注释） */
async function saveTargetNote(rule, target, value) {
  setTargetNote(rule, target, value.trim().slice(0, NOTE_MAX_LENGTH));
  editingNoteKey = null;
  await saveRules();
  renderRules();
}

/** 一条规则卡片：网址 + 操作 + 抽屉内容 */
function createRuleItem(rule, index) {
  const item = document.createElement("div");
  item.className = "rule-item" + (rule.enabled ? "" : " rule-disabled");

  const head = document.createElement("div");
  head.className = "rule-head";

  const url = document.createElement("div");
  url.className = "rule-url";
  url.textContent = rule.urlPattern || msg("noUrl");
  url.title = msg("editUrlTitle");
  url.addEventListener("click", () => openEditor(rule.id));

  const targets = getRuleTargets(rule);
  const expanded = expandedRuleIds.has(rule.id);

  const drawerBtn = document.createElement("button");
  drawerBtn.className = "btn-icon drawer-toggle";
  drawerBtn.textContent = (expanded ? "▾ " : "▸ ") + targets.length;
  drawerBtn.title = msg("drawerTitle");
  drawerBtn.addEventListener("click", () => {
    if (expanded) expandedRuleIds.delete(rule.id);
    else expandedRuleIds.add(rule.id);
    renderRules();
  });

  const delBtn = document.createElement("button");
  delBtn.className = "btn-icon danger";
  delBtn.textContent = "🗑️";
  delBtn.title = msg("deleteRule");
  delBtn.addEventListener("click", async () => {
    if (!confirm(msg("deleteRuleConfirm", [rule.urlPattern]))) return;
    expandedRuleIds.delete(rule.id);
    if (editingNoteKey?.startsWith(`${rule.id}|`)) editingNoteKey = null;
    rules.splice(index, 1);
    await saveRules();
    renderRules();
  });

  const actions = document.createElement("div");
  actions.className = "rule-actions";
  actions.append(
    drawerBtn,
    createSwitch({
      checked: rule.enabled,
      title: msg("ruleSwitchTitle"),
      onChange: async (checked) => {
        rule.enabled = checked;
        await saveRules();
        renderRules();
      },
    }),
    delBtn,
  );

  head.append(url, actions);
  item.append(head);

  if (expanded) {
    const box = document.createElement("div");
    box.className = "rule-targets";
    if (targets.length === 0) {
      const empty = document.createElement("div");
      empty.className = "target-empty";
      empty.textContent = msg("noTargets");
      box.append(empty);
    } else {
      box.append(...targets.map((target) => createTargetItem(rule, target)));
    }
    item.append(box);
  }
  return item;
}

/** 渲染一级菜单（每条规则一行网址） */
function renderRules() {
  ruleList.replaceChildren(...rules.map(createRuleItem));
  // 注释编辑区打开时保持焦点（重渲染后输入框是新节点）
  if (editingNoteKey) ruleList.querySelector(".note-input")?.focus();
}
// ----- 二级菜单（新增 / 编辑） -----

/** 打开二级菜单：id = null 表示新增规则 */
function openEditor(id = null) {
  editingId = id;
  saveMsg.textContent = "";
  ruleSelectors.value = "";
  ruleNote.value = "";
  urlField.classList.remove("hidden");

  if (id === null) {
    ruleUrl.value = "";
    editorTitle.textContent = msg("editorTitleNew");
  } else {
    const rule = rules.find((r) => r.id === id);
    if (!rule) return;
    ruleUrl.value = rule.urlPattern || "";
    editorTitle.textContent = msg("editorTitleEdit", [rule.urlPattern]);
  }

  listView.classList.add("hidden");
  editor.classList.remove("hidden");
  (id === null ? ruleUrl : ruleSelectors).focus();
}

function closeEditor() {
  editor.classList.add("hidden");
  listView.classList.remove("hidden");
  editingId = null;
  saveMsg.textContent = "";
}

/** 从屏蔽列表移除一个元素（连同它的开关记录与注释） */
async function removeTarget(rule, target) {
  if (editingNoteKey === noteEditKey(rule, target)) editingNoteKey = null;

  const field = targetField(target);
  rule[field] = splitList(rule[field])
    .filter((value) => value !== target.value)
    .join(field === "selectors" ? ", " : "\n");

  const keys = new Set(getRuleTargets(rule).map(targetKey));
  rule.disabledTargets = (rule.disabledTargets || []).filter((key) =>
    keys.has(key),
  );
  setTargetNote(rule, target, "");

  await saveRules();
  renderRules();
}

/** CSS 选择器是否合法（交给浏览器判断） */
function isValidSelector(selector) {
  try {
    document.querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

/** 校验元素输入：只能一个；class / id 需带前缀；其余需是合法 CSS 选择器 */
function validateElement(value) {
  if (!value) return null;
  if (/[,;\n]/.test(value)) return msg("errMultiple");
  if (!/^[.#]/.test(value) && /^[A-Za-z0-9_-]+$/.test(value))
    return msg("errNeedPrefix");
  return isValidSelector(value) ? null : msg("errInvalidSelector");
}

/** 保存：新增规则，或修改网址 + 追加一个元素（可同时给新元素填注释） */
async function handleSave() {
  const value = ruleSelectors.value.trim();
  const inputError = validateElement(value);
  if (inputError) return flash(saveMsg, inputError, true);

  const urlPattern = ruleUrl.value.trim();
  if (!urlPattern) return flash(saveMsg, msg("errUrlRequired"), true);

  // 注释是可选项：只作用于本次追加的那个元素
  const note = ruleNote.value.trim().slice(0, NOTE_MAX_LENGTH);

  if (editingId === null) {
    if (!value) return flash(saveMsg, msg("errElementRequired"), true);

    const rule = {
      id: makeId(),
      urlPattern,
      selectors: "",
      cssSelectors: "",
      disabledTargets: [],
      targetNotes: {},
      enabled: true,
    };
    const field = fieldOfValue(value);
    rule[field] = value;
    if (note) {
      setTargetNote(
        rule,
        { kind: field === "selectors" ? "s" : "c", value },
        note,
      );
    }
    rules.push(rule);
    expandedRuleIds.add(rule.id);
  } else {
    const rule = rules.find((r) => r.id === editingId);
    if (!rule) return;

    const urlChanged = urlPattern !== (rule.urlPattern || "");
    if (!value && !urlChanged) return flash(saveMsg, msg("errNoChange"), true);
    if (value && getRuleTargets(rule).some((t) => t.value === value))
      return flash(saveMsg, msg("errDuplicated"), true);

    if (urlChanged) rule.urlPattern = urlPattern;
    if (value) {
      const field = fieldOfValue(value);
      const target = { kind: field === "selectors" ? "s" : "c", value };
      rule[field] = splitList(rule[field])
        .concat(value)
        .join(field === "selectors" ? ", " : "\n");
      setTargetDisabled(rule, target, false);
      if (note) setTargetNote(rule, target, note);
    }
    expandedRuleIds.add(rule.id);
  }

  await saveRules();
  renderRules();
  closeEditor();
  flash(saveMsg, msg("saved"));
}
// ----- 提示 / 配置导出导入 -----

/** 显示提示，3 秒后自动消失 */
const msgTimers = new WeakMap();
function flash(el, text, error = false) {
  el.textContent = text;
  el.classList.toggle("save-msg-error", error);
  clearTimeout(msgTimers.get(el));
  msgTimers.set(
    el,
    setTimeout(() => (el.textContent = ""), 3000),
  );
}

/** 文件名用的时间戳：20260916-1630 */
function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}`
  );
}

/** 导出全部规则为 JSON 文件 */
function exportConfig() {
  const payload = {
    app: "Block Web Element",
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    rules,
  };

  const url = URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `block-web-element-${timestamp()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  flash(ioMsg, msg("exported", [String(rules.length)]));
}

/** 规范化 targetNotes：只保留仍存在的元素、非空且长度合法的注释 */
function normalizeTargetNotes(raw, rule) {
  const notes = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return notes;

  const keys = new Set(getRuleTargets(rule).map(targetKey));
  for (const [key, value] of Object.entries(raw)) {
    if (!keys.has(key) || typeof value !== "string") continue;
    const note = value.trim().slice(0, NOTE_MAX_LENGTH);
    if (note) notes[key] = note;
  }
  return notes;
}

/** 规范化导入的一条规则，无效条目返回 null */
function normalizeImportedRule(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const urlPattern = String(raw.urlPattern || raw.url || "").trim();
  const selectors = typeof raw.selectors === "string" ? raw.selectors : "";
  const cssSelectors =
    typeof raw.cssSelectors === "string" ? raw.cssSelectors : "";
  if (!urlPattern && !selectors.trim() && !cssSelectors.trim()) return null;

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : makeId(),
    urlPattern,
    selectors,
    cssSelectors,
    disabledTargets: Array.isArray(raw.disabledTargets)
      ? raw.disabledTargets.filter((key) => typeof key === "string")
      : [],
    targetNotes: normalizeTargetNotes(raw.targetNotes, { selectors, cssSelectors }),
    enabled: raw.enabled === undefined ? true : !!raw.enabled,
  };
}

/** 导入配置：按 id 合并（存在则更新，不存在则追加） */
async function importConfig(text) {
  let list;
  try {
    const data = JSON.parse(text);
    list = Array.isArray(data) ? data : data && data.rules;
  } catch {
    return flash(ioMsg, msg("importInvalidJson"), true);
  }

  const incoming = (Array.isArray(list) ? list : [])
    .map(normalizeImportedRule)
    .filter(Boolean);
  if (incoming.length === 0) return flash(ioMsg, msg("importNoRules"), true);

  let added = 0;
  let updated = 0;
  for (const item of incoming) {
    const exists = rules.find((rule) => rule.id === item.id);
    if (exists) {
      Object.assign(exists, item);
      updated += 1;
    } else {
      rules.push(item);
      added += 1;
    }
  }

  await saveRules();
  renderRules();
  flash(ioMsg, msg("imported", [String(added), String(updated)]));
}

/** 读取所选 JSON 文件并导入 */
async function handleImportFile() {
  const file = importFile.files?.[0];
  if (!file) return;
  await importConfig(await file.text());
  importFile.value = "";
}

// ----- 事件绑定 -----

$("add-rule-btn").addEventListener("click", () => openEditor(null));
$("save-btn").addEventListener("click", handleSave);
$("cancel-btn").addEventListener("click", closeEditor);
$("export-btn").addEventListener("click", exportConfig);
$("import-btn").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", handleImportFile);

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.tagName === "INPUT" && !editor.classList.contains("hidden")) {
    e.preventDefault();
    handleSave();
  }
});

(async () => {
  applyI18n();
  await loadRules();
  renderRules();
})();
