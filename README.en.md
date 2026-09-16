# Block Web Element

English | [简体中文](README.md)

A small, practical Chrome extension: **set the URL rules that should apply** and **the elements you want to block** — matching elements are hidden automatically whenever those pages load.

## Features

- 🎯 **URL rule matching**: wildcards supported, e.g. `*.example.com`, `example.com/*`; without a wildcard it does a “URL contains” match
- 🧩 **Element to block**: a single input that accepts class / id (`.ad-banner`, `#popup` — the prefix is required) and full CSS selectors (e.g. `div[data-ad] > a`); **one element per save**
- ⚡ **Applies instantly**: editing a rule updates the pages that are already open
- 🔄 **Dynamic elements**: a MutationObserver keeps hiding matching elements that appear later
- 🏷️ **Multiple rules**: the level-1 menu lists URLs only; click a URL to open the level-2 menu and add elements; every rule can be enabled / disabled / deleted on its own
- 🎚️ **Drawer + per-element switches**: the drawer button on a URL card expands the blocked elements of that URL (stacked vertically) and every element has its own switch; turning one off makes that element **visible again immediately** (no need to delete the rule or re-type anything)
- 💾 **JSON config export / import**: export all rules to a JSON file in one click and import them back (merged by `id`: existing rules are updated, new ones appended, nothing gets deleted)
- 📱 **SPA friendly**: rules are re-applied after route changes (Vue / React single-page apps)

## Installation

### 1. Load the extension (developer mode)

1. Open Chrome and go to `chrome://extensions/`
2. Turn on **Developer mode** (top-right corner)
3. Click **Load unpacked** (top-left corner)
4. Select this project folder (`block-web-element`)

### 2. How to use

1. Click the extension icon in the toolbar
2. Click **“+ Add rule”**
3. Fill in:
   - **URL rule**: e.g. `zhihu.com` (contains match — applies to every page whose URL contains it) or `*.example.com/*` (wildcard match)
   - **Element to block**: e.g. `.Advert` (class), `#popup` (id) or a full CSS selector such as `div[data-ad] > a`; class / id must start with `.` / `#`, one element per save
4. Click **“Save”**
5. Reload the target page (or simply edit a rule — it applies immediately) to see the result
6. The **level-1 menu lists URLs only**. Click the drawer button (`▸ / ▾ + count`) to expand the blocked elements of that URL: each element can be toggled on its own (turning it off restores it on the page) or removed with `✕`
7. Click a URL to open the **level-2 menu (editor)**: the URL is pre-filled and editable, the element input is empty (blocked elements are never listed there) — “Save” **appends** the new element to that URL (existing elements stay). A URL change alone can be saved too. “Back” returns to the URL list
8. Click **“Export”** at the bottom of the level-1 menu to download all rules as a JSON file (the file name contains the export time)
9. Click **“Import”** and pick a JSON file: rules with the same `id` are updated, the rest are appended, and the result is reported as “Imported: X added, Y updated”

## Input reference

### URL rule

| Example                     | Matching | Notes                                                                                       |
| --------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `example.com`               | contains | matches when the URL contains `example.com` (recommended: covers http/https and subdomains) |
| `*.example.com`             | wildcard | matches any subdomain such as `a.example.com`, `b.example.com`                              |
| `https://www.example.com/*` | wildcard | matches the whole URL prefix exactly                                                        |

### Element to block

The “Element to block” input accepts both class / id and full CSS selectors:

| Example                           | Allowed | Notes                                                                              |
| --------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| `.ad-banner`                      | ✅      | class selector — matches every element with that class                             |
| `#popup`                          | ✅      | id selector — matches the element with that id                                     |
| `div[data-ad] > a[href*="click"]` | ✅      | CSS selector (attribute / descendant) for elements without class / id              |
| `a[target="_blank"][href="#"]`    | ✅      | CSS selector (attribute) that precisely targets those links                        |
| `ad-container`                    | ❌      | a bare name cannot tell class from id: add `.` / `#`, or use a CSS selector         |
| `div`                             | ❌      | same for a bare tag name (write a more specific selector such as `body > div`)      |
| `.foo, #bar` / `div, span`        | ❌      | multiple at once — only one element can be blocked at a time                        |

> Each “Save” adds exactly **one** element: repeat the level-2 menu for more (blocked elements are managed in the drawer of the URL).
> `.` / `#` entries are stored in `selectors`, other CSS selectors in `cssSelectors`; both are parsed as CSS selectors on the page.
> For backward compatibility the content script still accepts legacy entries without a prefix (treated as both class and id), but the popup no longer allows them.

### Level-1 / level-2 menu

**Level-1 menu (URL list)** — one row per rule, from left to right:

| Control         | Action                                                                |
| --------------- | --------------------------------------------------------------------- |
| URL (clickable) | opens the level-2 menu of that URL (change URL / add elements)        |
| Drawer `▸ 3`    | expands / collapses the blocked elements of that URL (number = count) |
| Rule switch     | enables / disables the whole rule (all of its elements with it)       |
| 🗑️              | deletes the rule                                                      |

**Drawer (blocked elements)** — every blocked element of that URL is **stacked vertically**, one row per element:

- **Small switch**: blocks or unblocks that single element; turning it off restores the element on the page immediately
- **`✕`**: removes the element from the block list

**Level-2 menu (editor)** — opened by clicking a URL or “+ Add rule”. The element input is always empty and blocked elements are never shown (they live in the drawer). Clicking “Save”:

- while adding a rule: creates a new rule (enabled by default) and needs a URL rule plus one element
- while editing an existing URL: **the URL is pre-filled and editable** (clearing it shows “Please fill in the URL rule”); a filled element is **appended** to that URL (existing elements stay, already-blocked ones are skipped); a URL change alone can be saved as well; with no changes at all you get “Nothing to save”

Validation rules for the single element input:

| Case                                 | Rule                                                              |
| ------------------------------------ | ----------------------------------------------------------------- |
| `.ad-banner` / `#popup`              | ✅ allowed, blocked as class / id                                 |
| `div[data-ad] > a`, `a[href="#"]`    | ✅ allowed, blocked as a full CSS selector                        |
| `ad-container`, `div` (bare names)   | ❌ rejected: add a `.` / `#` prefix, or write a full CSS selector |
| `.foo, #bar`, `div, span` (multiple) | ❌ rejected: only one element can be blocked at a time            |
| invalid input such as `div[`         | ❌ rejected: not a valid CSS selector                             |

> In other words, **each save adds exactly one element**; repeat the level-2 menu to block more.

### JSON config export / import

The **“Export”** / **“Import”** buttons at the bottom of the level-1 menu are for backup and migration:

- **Export**: writes all rules to a JSON file named like `block-web-element-20260916-1630.json`
- **Import**: pick a JSON file; when it finishes you get “Imported: X added, Y updated”

Exported file format:

```json
{
  "app": "Block Web Element",
  "version": 1,
  "exportedAt": "2026-09-16T08:00:00.000Z",
  "rules": [
    {
      "id": "m1a2b3c4",
      "urlPattern": "example.com",
      "selectors": ".ad-banner, #popup",
      "cssSelectors": "div[data-ad] > a",
      "disabledTargets": ["s:.ad-banner"],
      "enabled": true
    }
  ]
}
```

Import behaviour:

| Case                                          | Behaviour                                             |
| --------------------------------------------- | ----------------------------------------------------- |
| rule `id` already exists locally              | **updates** that rule (no duplicate is created)       |
| rule `id` is new                              | **appended** as a new rule                            |
| the file is a bare array `[{...}, {...}]`     | supported as well (same as `{ "rules": [...] }`)      |
| `enabled` / `disabledTargets` / `id` missing  | defaults: `true` / `[]` / a generated id              |
| `url` is used instead of `urlPattern`         | still recognised as the URL rule                      |
| an entry has neither URL nor element          | that entry is ignored                                 |
| the file is not valid JSON, or has no usable rule | error message, existing rules are **left untouched** |

> Import **never deletes** existing rules (they are merged by `id`), so importing the same file twice does not create duplicates.

## Project structure

```
block-web-element/
├── README.md               # Simplified Chinese readme
├── README.en.md            # English readme (this file)
├── manifest.json           # extension manifest (Manifest V3, strings via __MSG__)
├── content.js              # content script: read rules, match URL, hide / restore elements
├── popup/
│   ├── popup.html          # popup markup (static strings marked with data-i18n)
│   ├── popup.css           # popup styles
│   └── popup.js            # rule management, element switches, config import / export
├── _locales/
│   ├── zh_CN/messages.json # Simplified Chinese strings (default locale)
│   └── en/messages.json    # English strings
├── icons/                  # extension icons (16 / 48 / 128)
└── scripts/
    └── generate-icons.js   # optional icon generator
```

## Localization

- All strings live in `_locales/<locale>/messages.json`. The extension name / description / action title are referenced from `manifest.json` with `__MSG_xxx__`, and UI strings are marked in `popup.html` with `data-i18n` / `data-i18n-placeholder` and injected by `applyI18n()` in `popup.js`
- The language follows Chrome’s UI language (`default_locale` is `zh_CN`): a Chinese Chrome shows Chinese, an English Chrome shows English, and anything else falls back to the default locale
- Adding a language: copy `_locales/en` to `_locales/<locale>` (e.g. `ja`) and translate the `message` values — keep the keys unchanged

## Development & debugging

```bash
# Regenerate the icons (optional)
node scripts/generate-icons.js
```

To debug `content.js`, run this in the console of the target page:

```js
// Check whether the current rules are being read
chrome.storage.local.get("blockRules", (r) => console.log(r));
```

## Technical notes

- Built on **Manifest V3**
- Rules live in `chrome.storage.local`; changes are pushed to every open page through `storage.onChanged`
- Elements are hidden with an inline `display: none !important` plus a marker attribute, so page styles cannot override it and elements are never processed twice
- A `MutationObserver` keeps hiding dynamically added elements
- The element input supports both class / id and CSS selectors: class / id must start with `.` or `#`, anything else must be a valid CSS selector, and only one element is added per save (the popup validates the prefix, the count and the selector). For legacy data the content script still accepts entries without a prefix
- Entries are routed by syntax: `.` / `#` go to `rule.selectors`, other CSS selectors to `rule.cssSelectors`; both are parsed as CSS selectors in the page
- Every element has its own switch state; disabled elements are stored in `rule.disabledTargets` (e.g. `s:.ad-banner`, `c:a[href]`) and skipped by the content script. When an element is unblocked its original inline `display` is restored, so switches can be flipped back and forth freely
- The level-2 menu only appends: new entries are de-duplicated and merged into `rule.selectors` / `rule.cssSelectors`, existing elements are never overwritten, and new elements are blocked by default
- The URL is pre-filled and editable in the level-2 menu; saving updates `rule.urlPattern` (changing the URL does not touch the blocked elements or their switch states)
- Whether a rule applies depends only on `rule.enabled` (the level-2 menu no longer has an “enable this rule” checkbox); new rules are enabled by default
- Export uses `Blob` + `<a download>`; import reads the file with `<input type="file">` + `File.text()`, normalises the entries, merges them by `id` and then goes through the same `chrome.storage.local` save / render path
- Localization is based on `chrome.i18n`: `__MSG__` in the manifest, `data-i18n` / `data-i18n-placeholder` + `applyI18n()` in the HTML, and `msg(key, subs)` everywhere in JS; the zh_CN and en key sets are identical (enforced by tests)

## FAQ

**Q: I changed a rule but the open page did not update — why?**
A: It normally updates instantly. If nothing happens, reload the page.

**Q: Some elements reappear after being hidden?**
A: If the page re-creates the element with its own JS (instead of only changing styles), the new element must carry the same class / id — the extension’s MutationObserver handles that automatically.

**Q: How do I block an element that has neither class nor id?**
A: Type a full CSS selector into the “Element to block” input, e.g. `a[target="_blank"][href="#"]` or `div[data-ad] > a`, to match it by tag / attribute.

**Q: Why are bare names such as `ad-container` or `div` rejected?**
A: A bare name cannot tell class, id and tag apart, which easily blocks the wrong thing. Write `.ad-container` (class), `#ad-container` (id) or a more specific selector (e.g. `body > div`). Entries without a prefix that older versions saved still work.

**Q: I want to block several elements at once?**
A: Each “Save” adds exactly one element: open the level-2 menu (click the URL) again and save the next one. Blocked elements can be toggled or removed from the drawer.

**Q: I only want to unblock one of the elements?**
A: Open the drawer of that URL — every blocked element is listed with its own switch. Turning it off unblocks just that element (it becomes visible on the page immediately) and the state is saved with the rule.

**Q: How do I add another element to an existing URL?**
A: Click the URL to open the level-2 menu (the inputs are empty and existing elements are not listed), fill in the element and click “Save” — it is appended. Elements that are already blocked are skipped automatically.

**Q: How do I remove a blocked element for good?**
A: Open the drawer of the URL and click `✕` next to the element. If you only want to stop blocking it temporarily, use its switch instead (the page restores it automatically).

**Q: How do I change the URL of a rule?**
A: Click the URL in the level-1 menu — the URL input is pre-filled, edit it and click “Save” (saving a URL change alone is fine; blocked elements and their switch states are untouched).

**Q: How do I disable a rule temporarily?**
A: Click the switch on the URL card to disable the whole rule; to disable a single element, open the drawer and turn off that element’s switch. Neither requires deleting anything.

**Q: How do I move my configuration to another machine, or after reinstalling?**
A: Click “Export” on the old machine, then “Import” the JSON file on the new one; rules with the same `id` are updated instead of duplicated.

**Q: Will importing overwrite my existing rules?**
A: No rule is ever deleted: imported rules whose `id` already exists update that rule, the rest are appended. Afterwards you get a report such as “Imported: X added, Y updated”.

**Q: How do I switch the interface language?**
A: It follows Chrome’s UI language (Simplified Chinese `zh_CN` and English `en` are bundled). To add another language, copy `_locales/en/messages.json` to the matching locale folder (e.g. `_locales/ja/messages.json`) and translate the values, keeping the keys unchanged.

**Q: Can I write the config file by hand and import it?**
A: Yes. Use either the full export format or a bare array such as `[{ "urlPattern": "example.com", "selectors": ".ad-banner" }]`; `enabled`, `disabledTargets` and `id` are optional (defaults: `true`, `[]`, a generated id) and `url` is an alias of `urlPattern`.
