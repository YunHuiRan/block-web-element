# Block by Class Name

一个简单实用的 Chrome 扩展：**手动设置生效的网址规则** 和 **想要屏蔽的元素 className / id**，打开匹配的网页时自动隐藏这些元素。

## 功能特性

- 🎯 **网址规则匹配**：支持通配符，例如 `*.example.com`、`example.com/*`；不写通配符则按「URL 包含匹配」
- 🧩 **屏蔽元素**：直接填写 `className` 或 `id`（如 `.ad-banner`、`#popup`），也可不带前缀同时匹配 class 和 id
- ⚡ **即时生效**：修改规则后，已打开的页面自动更新
- 🔄 **动态元素处理**：通过 MutationObserver 持续隐藏后加载的匹配元素
- 🏷️ **多规则管理**：可以添加多条规则，每条规则独立启用 / 停用 / 编辑 / 删除
- 📱 **SPA 兼容**：页面路由变化（如 Vue / React 单页应用）后自动重新应用规则

## 安装方法

### 1. 加载扩展（开发者模式）

1. 打开 Chrome，在地址栏输入 `chrome://extensions/` 并回车
2. 打开右上角的 **「开发者模式」** 开关
3. 点击左上角的 **「加载已解压的扩展程序」**
4. 选择本项目目录（`block-by-class-name`）

### 2. 使用方式

1. 点击浏览器工具栏中的扩展图标（蓝色底白色字母 B 的图标）
2. 点击 **「+ 添加规则」**
3. 填写：
   - **网址规则**：如 `zhihu.com`（包含匹配，所有包含 zhihu.com 的页面都生效）或 `*.example.com/*`（通配符匹配）
   - **屏蔽元素**：如 `.Advert`、`#popup`、`AdContainer`（逗号分隔可写多个）
4. 点击 **「保存」**
5. 刷新（或直接修改后自动生效）目标页面查看效果

## 输入说明

### 网址规则

| 输入示例                    | 匹配方式   | 说明                                                                    |
| --------------------------- | ---------- | ----------------------------------------------------------------------- |
| `example.com`               | 包含匹配   | URL 中包含 `example.com` 即命中（推荐，可同时覆盖 http/https 和子域名） |
| `*.example.com`             | 通配符匹配 | 匹配 `a.example.com`、`b.example.com` 等任意子域名                      |
| `https://www.example.com/*` | 通配符匹配 | 精确匹配整个 URL 前缀                                                   |

### 屏蔽元素

| 输入示例          | 匹配方式     | 说明                                                            |
| ----------------- | ------------ | --------------------------------------------------------------- |
| `.ad-banner`      | class 选择器 | 匹配所有带 `ad-banner` class 的元素                             |
| `#popup`          | id 选择器    | 匹配 id 为 `popup` 的元素                                       |
| `ad-container`    | class + id   | 同时匹配 class 为 `ad-container` 和 id 为 `ad-container` 的元素 |
| `.foo, #bar, baz` | 多个         | 逗号分隔，一次性屏蔽多个目标                                    |

## 项目结构

```
block-by-class-name/
├── manifest.json          # 扩展清单（Manifest V3）
├── content.js             # 内容脚本：读取规则、匹配 URL、隐藏元素
├── popup/
│   ├── popup.html         # 扩展弹窗界面
│   ├── popup.css          # 弹窗样式
│   └── popup.js           # 规则管理逻辑（增删改查）
├── icons/                 # 扩展图标（16 / 48 / 128）
└── scripts/
    └── generate-icons.js  # 图标生成脚本（可选，重新生成图标用）
```

## 开发与调试

```bash
# 重新生成图标（可选）
node scripts/generate-icons.js
```

调试 content.js 时，在目标页面的控制台中输入：

```js
// 查看当前生效的规则是否被读取
chrome.storage.local.get("blockRules", (r) => console.log(r));
```

## 技术说明

- 使用 **Manifest V3** 规范
- 使用 `chrome.storage.local` 存储规则，规则修改通过 `storage.onChanged` 实时同步到所有已打开的页面
- 元素隐藏使用内联 `display: none !important` 并打上标记，避免被页面样式覆盖或重复处理
- 通过 `MutationObserver` 监听 DOM 变化，持续隐藏动态加载的目标元素

## 常见问题

**Q: 修改规则后已打开的页面没有生效？**
A: 正常情况下会自动生效。如果没反应，刷新一下页面即可。

**Q: 某些元素隐藏后又出现了？**
A: 如果页面 JS 动态重绘该元素（而非仅仅修改样式），需要保证新元素带有相同的 class/id —— 扩展的 MutationObserver 会自动处理这种情况。

**Q: 怎么临时停用某条规则？**
A: 在扩展弹窗中点击该条规则的开关即可停用，无需删除。
