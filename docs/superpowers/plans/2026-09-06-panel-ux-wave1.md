# 面板 UX 整备 Wave 1 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地 spec #9 Wave 1(0.7.0):大纲当前节高亮、树文件类型图标细分、头部(脏点/版本入 tooltip/编辑提权/快捷键标注)、查找(中文 phrases + n/m 计数 + 换肤)。

**Architecture:** 全部 UI-local:扩展 `outline.ts`(两个纯函数)、`WorkspaceBrowser.tsx`(图标细分)、`PreviewOverlay.tsx`(接线)、`editor.tsx`(phrases/计数上报)、`styles.ts` 与 `locale.ts`。`PreviewSession` 纯机器零改动;无新运行时依赖。

**Tech Stack:** React 18 + CodeMirror 6(@codemirror/search 已在依赖内)+ vitest jsdom(既有面板 harness 模式)。

**Spec:** https://github.com/benz-ai-x/dsh-md-preview/issues/9

**审计修正(写计划时核实源码,推翻讨论期两个判断):** 头部按钮本就是内联 SVG 图标(非纯文本);树的 ▸/▾ 旋转、当前文件高亮(`data-current`)、键盘遍历均已存在。因此 Wave 1 无「加图标按钮」「加手柄」「加当前高亮」任务,聚焦四个真缺口。

## Global Constraints

- 运行时依赖零新增;构建期仅可用已内联的 CodeMirror 包(`@codemirror/search` 已内联)。
- `PreviewSession` reducer(`src/client/preview-session.ts`)与 Host/Remote 协议零改动;现有 116 项测试必须保持全绿。
- 代码风格:无分号、单引号、2 空格缩进、严格 TS(`exactOptionalPropertyTypes` 开启——可选 prop 类型写 `onX?: (…) => void` 并经 ref 转发)。
- locale:zh 字典是 key 集真源,en 同 key 集;新 UI 文案两语同步。
- CSS 只用 `--dsw-alias-*` token(带 fallback),类名前缀 `dsh-md-preview-`。
- 面板组件只做渲染/几何/locale;新状态(如当前节索引、查找计数)均为 UI-local。

---

### Task 1: 大纲当前节高亮

**Files:**
- Modify: `src/client/outline.ts`(末尾追加两个纯函数)
- Modify: `src/client/editor.tsx`(新增 `onCursorLine` prop)
- Modify: `src/client/PreviewOverlay.tsx`(滚动/光标接线 + 弹层高亮)
- Modify: `src/client/styles.ts`(高亮样式)
- Test: `tests/client-outline.spec.tsx`(追加)

**Interfaces:**
- Produces(outline.ts):`activeIndexForLine(entries: readonly OutlineEntry[], line: number): number`、`activeIndexForScroll(tops: readonly number[], scrollTop: number): number`(语义:最后一条满足条件的条目下标;无则 -1)。
- Produces(editor.tsx):`MarkdownEditorProps.onCursorLine?: (line: number) => void`(光标 1 基行号;挂载时上报一次,doc 或选区变化时上报)。
- Consumes:PreviewOverlay 已有的 `outline`、`findHeadingElement`、`state.face`、`documentRef`。

- [ ] **Step 1: 写失败测试(纯函数)**

在 `tests/client-outline.spec.tsx` 的 `describe('findHeadingElement', …)` 之后追加:

```tsx
describe('activeIndexForLine / activeIndexForScroll', () => {
  const ENTRIES = extractOutline('# A\n\n## B\n\n## C')
  it('activeIndexForLine owns the position from its heading line onward', () => {
    expect(activeIndexForLine(ENTRIES, 0)).toBe(-1)
    expect(activeIndexForLine(ENTRIES, 1)).toBe(0)
    expect(activeIndexForLine(ENTRIES, 2)).toBe(0)
    expect(activeIndexForLine(ENTRIES, 3)).toBe(1)
    expect(activeIndexForLine(ENTRIES, 5)).toBe(2)
    expect(activeIndexForLine(ENTRIES, 99)).toBe(2)
    expect(activeIndexForLine([], 1)).toBe(-1)
  })
  it('activeIndexForScroll picks the last heading at or above the scroll top', () => {
    expect(activeIndexForScroll([0, 120, 240], 0)).toBe(0)
    expect(activeIndexForScroll([0, 120, 240], 119)).toBe(0)
    expect(activeIndexForScroll([0, 120, 240], 120)).toBe(1)
    expect(activeIndexForScroll([0, 120, 240], 300)).toBe(2)
    expect(activeIndexForScroll([], 0)).toBe(-1)
  })
})
```

并把顶部 import 改为:

```tsx
import { activeIndexForLine, activeIndexForScroll, extractOutline, findHeadingElement } from '../src/client/outline.ts'
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/client-outline.spec.tsx`
Expected: FAIL — `activeIndexForLine is not a function`(导入不存在)。

- [ ] **Step 3: 实现纯函数**

`src/client/outline.ts` 末尾追加:

```ts
/**
 * The outline entry a source position falls under: the last entry whose
 * 1-based line is at or above it.
 * @param entries - the outline in document order.
 * @param line - the 1-based source line of the position.
 * @returns the owning entry's index, or -1 above the first heading.
 */
export function activeIndexForLine(entries: readonly OutlineEntry[], line: number): number {
  let active = -1
  for (let index = 0; index < entries.length; index += 1) {
    if ((entries[index] as OutlineEntry).line > line) break
    active = index
  }
  return active
}

/**
 * The outline entry a scroll position falls under: the last heading whose
 * document offset is at or above the scroll position.
 * @param tops - each heading's offset from the top of the scrolled document.
 * @param scrollTop - the scroller's current offset.
 * @returns the active entry's index, or -1 above the first heading.
 */
export function activeIndexForScroll(tops: readonly number[], scrollTop: number): number {
  let active = -1
  for (let index = 0; index < tops.length; index += 1) {
    if ((tops[index] as number) > scrollTop) break
    active = index
  }
  return active
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/client-outline.spec.tsx`
Expected: PASS(新增 describe 全绿,既有不回归)。

- [ ] **Step 5: 写失败测试(两脸接线)**

同文件 `describe('outline popover', …)` 内追加两个用例:

```tsx
  it('marks the outline entry owning the cursor line in the edit face', async () => {
    const harness = await renderOutlinePanel(DOC)
    await act(async () => {
      (harness.container.querySelector('button[aria-label="panel.edit"]') as HTMLButtonElement).click()
    })
    await flush()
    const host = harness.container.querySelector('.cm-editor') as HTMLElement
    const view = EditorView.findFromDOM(host)!
    await act(async () => {
      view.dispatch({ selection: { anchor: view.state.doc.line(9).from } })
    })
    await flush()
    const toggle = harness.container.querySelector('button[aria-label="outline.open"]') as HTMLButtonElement
    await act(async () => { toggle.click() })
    const items = outlineButtons(harness)
    // Line 9 is entry 2 (Deep code heading##); entry 1 (line 7) no longer owns it.
    expect(items[2]!.getAttribute('aria-current')).toBe('true')
    expect(items[1]!.getAttribute('aria-current')).toBeNull()
  })

  it('marks the heading at the scroll position in the view face', async () => {
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    const harness = await renderOutlinePanel(DOC)
    const scroller = harness.container.querySelector('.dsh-md-preview-document') as HTMLElement
    // Document offsets of the four rendered headings (DOC has 4 outline
    // entries). The mock models viewport rects: top = offset - scrollTop.
    const docTops = [0, 120, 240, 360]
    const headings = [...scroller.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')]
    const rect = (top: number): DOMRect =>
      ({ top, right: 0, bottom: 0, left: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const index = headings.indexOf(this)
      return rect(index >= 0 ? (docTops[index] ?? 0) - scroller.scrollTop : 0)
    })
    await act(async () => {
      scroller.scrollTop = 200
      scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
    })
    await flush()
    const toggle = harness.container.querySelector('button[aria-label="outline.open"]') as HTMLButtonElement
    await act(async () => { toggle.click() })
    const items = outlineButtons(harness)
    // offset = viewportTop - scrollerTop + scrollTop = docTop; 120 <= 200 < 240
    // → entry 1 (Section *A*).
    expect(items[1]!.getAttribute('aria-current')).toBe('true')
    rectSpy.mockRestore()
  })
```

- [ ] **Step 6: 跑测试确认失败**

Run: `pnpm vitest run tests/client-outline.spec.tsx`
Expected: 两个新用例 FAIL(`aria-current` 为 null)。

- [ ] **Step 7: 实现 onCursorLine(editor.tsx)**

`MarkdownEditorProps` 追加:

```ts
  /** Reports the cursor's 1-based line at mount and on doc/selection change. */
  onCursorLine?: (line: number) => void
```

组件体内(`saveRef` 声明后)追加 ref 与挂载上报;`updateListener` 扩展:

```ts
  const cursorRef = useRef(onCursorLine)
  cursorRef.current = onCursorLine
```

`EditorView.updateListener.of(…)` 改为:

```ts
          EditorView.updateListener.of((update) => {
            if (update.docChanged) changeRef.current(update.state.doc.toString())
            if (update.docChanged || update.selectionSet) {
              cursorRef.current?.(update.state.doc.lineAt(update.state.selection.main.head).number)
            }
          }),
```

`viewRef.current?.(view)` 之后追加一次上报:

```ts
    cursorRef.current?.(view.state.doc.lineAt(view.state.selection.main.head).number)
```

- [ ] **Step 8: 实现 PreviewOverlay 接线**

import 行改为:

```ts
import { activeIndexForLine, activeIndexForScroll, extractOutline, findHeadingElement } from './outline.ts'
```

组件内(`outlineOpen` state 之后)追加状态与回调:

```tsx
  const [activeOutline, setActiveOutline] = useState(-1)
```

`jumpToOutline` 之前追加计算回调与两脸驱动(查看脸滚动用捕获监听——滚动条属 `.dsh-md-preview-document` 自身,捕获同时兜底未来内层滚动):

```tsx
  const computeViewActive = useCallback((): void => {
    const container = documentRef.current
    if (container === null || state.face !== 'view' || state.content.state !== 'ready') return
    const base = container.getBoundingClientRect().top - container.scrollTop
    const tops = outline.map((_, index) => {
      const heading = findHeadingElement(container, outline, index)
      return heading === undefined ? Number.POSITIVE_INFINITY : heading.getBoundingClientRect().top - base
    })
    setActiveOutline(activeIndexForScroll(tops, container.scrollTop))
  }, [outline, state.face, state.content])

  // The active outline entry follows the rendered document's scroll; the
  // capture listener also covers any descendant that owns the scrollbar.
  // The immediate call covers content-settle (a fresh read at the top marks
  // the first heading without waiting for a scroll).
  useEffect(() => {
    const container = documentRef.current
    if (container === null) return
    const onScroll = (): void => { computeViewActive() }
    container.addEventListener('scroll', onScroll, { capture: true, passive: true })
    computeViewActive()
    return () => { container.removeEventListener('scroll', onScroll, { capture: true }) }
  }, [computeViewActive])

  // A new target re-reads; the active entry resets until the scroll reports.
  useEffect(() => { setActiveOutline(-1) }, [target])
```

编辑脸接线:`<MarkdownEditor …>` 追加 prop:

```tsx
              onCursorLine={line => { setActiveOutline(activeIndexForLine(outline, line)) }}
```

弹层条目(`outline.map`)button 追加 `aria-current` 与类名:

```tsx
                    <button
                      key={`${entry.line}-${entry.text}`} type="button" role="menuitem"
                      className={index === activeOutline ? 'dsh-md-preview-outline-active' : undefined}
                      style={{ paddingLeft: `${8 + (entry.level - 1) * 12}px` }}
                      title={entry.text}
                      aria-current={index === activeOutline ? 'true' : undefined}
                      onClick={() => { jumpToOutline(index) }}
                    >
```

高亮条目自动滚入弹层视野(弹层容器加 ref):

```tsx
  const outlineRef = useRef<HTMLDivElement>(null)
```

```tsx
  useEffect(() => {
    if (!outlineOpen) return
    outlineRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [activeOutline, outlineOpen])
```

弹层 div 改为 `<div className="dsh-md-preview-outline" role="menu" ref={outlineRef}>`。

- [ ] **Step 9: 样式**

`src/client/styles.ts` 的 CSS 串中(与其它 outline 规则相邻处)追加:

```css
.dsh-md-preview-outline-active {
  background: var(--dsw-alias-fill-secondary);
  font-weight: 500;
}
```

- [ ] **Step 10: 跑测试确认通过 + 提交**

Run: `pnpm vitest run tests/client-outline.spec.tsx`
Expected: PASS 全绿。

```bash
git add src/client/outline.ts src/client/editor.tsx src/client/PreviewOverlay.tsx src/client/styles.ts tests/client-outline.spec.tsx
git commit -m "Add the outline's current-section highlight for both faces"
```

---

### Task 2: 树文件类型图标细分

**Files:**
- Modify: `src/client/WorkspaceBrowser.tsx`(fileKind + EntryIcon 细分 + data-kind)
- Modify: `src/client/styles.ts`(markdown 图标着色)
- Test: `tests/client-browse.spec.tsx`(追加)

**Interfaces:**
- Produces(仅渲染层):treeitem 元素新增 `data-kind` 属性,取值 `directory | markdown | image | text | file`;`EntryIcon` 内部按同枚举出图标。无跨模块接口。

- [ ] **Step 1: 写失败测试**

`tests/client-browse.spec.tsx` 追加 describe(沿用文件内已有的 `renderBrowse`/`enterBrowse` 工具):

```tsx
describe('file kind icons', () => {
  const TREE = new Map<string, ListScript>([
    ['', { entries: [
      { name: 'docs', type: 'directory', path: 'docs' },
      { name: 'a.md', type: 'file', path: 'a.md' },
      { name: 'b.png', type: 'file', path: 'b.png' },
      { name: 'c.txt', type: 'file', path: 'c.txt' },
      { name: 'd.bin', type: 'file', path: 'd.bin' },
    ] }],
  ])

  it('kinds each treeitem by extension for icon selection', async () => {
    const harness = await renderBrowse(TREE)
    await enterBrowse(harness)
    const kinds = [...harness.container.querySelectorAll<HTMLElement>('[role="treeitem"]')]
      .map(item => item.dataset.kind)
    expect(kinds).toEqual(['directory', 'markdown', 'image', 'text', 'file'])
  })
})
```

注:`ListScript` 是该测试文件已导出的脚本类型;若 `renderBrowse` 不在本文件(它在同文件),直接用。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/client-browse.spec.tsx`
Expected: FAIL — `data-kind` 全部 undefined,`toEqual` 不匹配。

- [ ] **Step 3: 实现**

`src/client/WorkspaceBrowser.tsx` 中 `OTHER_TYPE` 常量之后追加:

```ts
/** Visual kind of one file entry, decided by extension (icon + data-kind). */
function fileKind(name: string): 'markdown' | 'image' | 'text' | 'file' {
  if (/\.(?:md|markdown)$/i.test(name)) return 'markdown'
  if (/\.(?:png|jpe?g|gif|svg|webp|bmp|avif)$/i.test(name)) return 'image'
  if (/\.(?:txt|text|log|csv|json|ya?ml|toml)$/i.test(name)) return 'text'
  return 'file'
}
```

`EntryIcon` 改为按 kind 分发(目录与 other 保持现状,file 按扩展):

```tsx
function EntryIcon({ type, name }: { type: MdPreviewEntry['type']; name: string }) {
  if (type === 'directory') {
    return (
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden className="dsh-md-preview-tree-icon">
        <path d="M1.5 3h4l1.5 2h7.5v8h-13z" fill="currentColor" opacity="0.55" />
      </svg>
    )
  }
  const kind = type === OTHER_TYPE ? 'file' : fileKind(name)
  if (kind === 'image') {
    return (
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden className="dsh-md-preview-tree-icon">
        <rect x="2.5" y="3.5" width="11" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
        <circle cx="6" cy="6.5" r="1" fill="currentColor" opacity="0.55" />
        <path d="M3.5 11.5l3-3 2 2 2.5-2.5 1.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" opacity="0.55" />
      </svg>
    )
  }
  if (kind === 'text') {
    return (
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden className="dsh-md-preview-tree-icon">
        <path d="M4 1.5h5L12.5 5v9.5h-8.5z" fill="none" stroke="currentColor" strokeWidth="1.3" opacity="0.55" />
        <path d="M6 8h4M6 10.5h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
      </svg>
    )
  }
  if (kind === 'markdown') {
    return (
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden className="dsh-md-preview-tree-icon">
        <path d="M4 1.5h5L12.5 5v9.5h-8.5z" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M5.5 11V8.2l1.6 1.6 1.6-1.6V11" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden className="dsh-md-preview-tree-icon">
      <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
      <circle cx="8" cy="8" r="1.6" fill="currentColor" opacity="0.55" />
    </svg>
  )
}
```

`renderEntries` 的 `<li …>` 追加 data-kind,`<EntryIcon type={entry.type} />` 改为传 name:

```tsx
        data-current={isCurrent || undefined}
        data-kind={entry.type === 'directory' ? 'directory' : (entry.type === OTHER_TYPE ? 'file' : fileKind(entry.name))}
```

```tsx
          <EntryIcon type={entry.type} name={entry.name} />
```

- [ ] **Step 4: 样式(markdown 强化着色)**

`src/client/styles.ts` 树区规则附近追加:

```css
.dsh-md-preview-treeitem[data-kind="markdown"] .dsh-md-preview-tree-icon { color: var(--dsw-alias-label-primary); }
```

- [ ] **Step 5: 跑测试确认通过 + 提交**

Run: `pnpm vitest run tests/client-browse.spec.tsx`
Expected: PASS。

```bash
git add src/client/WorkspaceBrowser.tsx src/client/styles.ts tests/client-browse.spec.tsx
git commit -m "Kind tree entries by extension for distinct file icons"
```

---

### Task 3: 头部——脏点、版本入 tooltip、编辑提权、快捷键标注

**Files:**
- Modify: `src/client/PreviewOverlay.tsx`
- Modify: `src/client/styles.ts`
- Test: `tests/client-header.spec.tsx`(新建,复用 outline 测试的 harness 形态)

**Interfaces:**
- Consumes:`isDirty`(`src/client/preview-session.ts` 已导出的纯谓词)、`process.env.MD_PREVIEW_VERSION`(构建期 define,既有)。
- Produces:DOM 形态——移除 `.dsh-md-preview-version` 常驻元素;面包屑 `title` 变为 `<path> · v<version>`;编辑中且脏时渲染 `.dsh-md-preview-dirty`;编辑按钮类 `dsh-md-preview-editcta`;查找/保存 title 追加 `· Mod-F` / `· Mod-S`。

- [ ] **Step 1: 写失败测试(新文件)**

`tests/client-header.spec.tsx`:

```tsx
// @vitest-environment jsdom
/**
 * The panel header's information architecture: version lives in the crumbs
 * tooltip, the dirty dot tracks the edit session, the edit action carries
 * primary weight, and shortcut hints ride the titles.
 */

import { useSyncExternalStore } from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { EditorView } from '@codemirror/view'
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest'
import { PreviewOverlay } from '../src/client/PreviewOverlay.tsx'
import { createPreviewStore } from '../src/client/preview-state.ts'
import type { MdPreviewFile } from '../src/protocol.ts'

const t = (key: string) => key

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

interface HeaderHarness {
  container: HTMLElement
  rerender: () => Promise<void>
}

async function renderHeaderPanel(content: string, path = 'docs/guide.md'): Promise<HeaderHarness> {
  const store = createPreviewStore()
  const readResult: { ok: true; value: MdPreviewFile } = { ok: true, value: { path, content, fingerprint: 'v1' } }
  const harness: HeaderHarness = {
    container: document.createElement('div'),
    rerender: () => act(async () => { root.render(panelElement()) }),
  }
  const usePreviewTarget = (selector: (state: unknown) => unknown) =>
    selector(useSyncExternalStore(store.subscribe, store.getSnapshot))
  const panelElement = () => (
    <PreviewOverlay
      usePreviewTarget={usePreviewTarget as never}
      close={() => { store.set(null) }}
      read={(() => Promise.resolve(readResult)) as never}
      write={(vi.fn(() => Promise.resolve({ ok: true, value: { path, fingerprint: 'v2' } }))) as never}
      t={t as never}
    />
  )
  document.body.appendChild(harness.container)
  const root: Root = createRoot(harness.container)
  store.set({ sessionId: 'session-1', path })
  await harness.rerender()
  await act(async () => { await Promise.resolve() })
  return harness
}

const flush = async (): Promise<void> => {
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

afterEach(() => { document.body.replaceChildren() })

describe('header information architecture', () => {
  it('keeps the version in the crumbs tooltip instead of a resident badge', async () => {
    const harness = await renderHeaderPanel('# T')
    expect(harness.container.querySelector('.dsh-md-preview-version')).toBeNull()
    const crumbs = harness.container.querySelector('.dsh-md-preview-crumbs') as HTMLElement
    expect(crumbs.getAttribute('title')).toContain('docs/guide.md')
    expect(crumbs.getAttribute('title')).toMatch(/v\d+\.\d+\.\d+/)
  })

  it('shows the dirty dot only while the edit draft differs', async () => {
    const harness = await renderHeaderPanel('# T\n\nbody')
    expect(harness.container.querySelector('.dsh-md-preview-dirty')).toBeNull()
    await act(async () => {
      (harness.container.querySelector('button[aria-label="panel.edit"]') as HTMLButtonElement).click()
    })
    await flush()
    expect(harness.container.querySelector('.dsh-md-preview-dirty')).toBeNull()
    const host = harness.container.querySelector('.cm-editor') as HTMLElement
    const view = EditorView.findFromDOM(host)!
    await act(async () => { view.dispatch({ changes: { from: 0, insert: 'x' } }) })
    await flush()
    expect(harness.container.querySelector('.dsh-md-preview-dirty')).toBeTruthy()
  })

  it('weights the edit action and annotates shortcut titles', async () => {
    const harness = await renderHeaderPanel('# T')
    const edit = harness.container.querySelector('button[aria-label="panel.edit"]') as HTMLButtonElement
    expect(edit.classList.contains('dsh-md-preview-editcta')).toBe(true)
    await act(async () => { edit.click() })
    await flush()
    const find = harness.container.querySelector('button[aria-label="panel.find"]') as HTMLButtonElement
    const save = harness.container.querySelector('button[aria-label="panel.save"]') as HTMLButtonElement
    expect(find.getAttribute('title')).toContain('Mod-F')
    expect(save.getAttribute('title')).toContain('Mod-S')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/client-header.spec.tsx`
Expected: 三个用例 FAIL(version 徽章仍在/无脏点/无 cta 类与标注)。

- [ ] **Step 3: 实现 PreviewOverlay**

import 追加(与既有 preview-state 导入合并):

```ts
import { isEditable } from './preview-state.ts'
import { isDirty } from './preview-session.ts'
```

(若 `isDirty` 实际从 `./preview-session.ts` 导出——核对 `src/client/preview-session.ts` 顶部导出;是的,`use-preview-session.ts` 正是从那里导入。)

面包屑与版本区改为(删除 version span,crumbs title 合并,追加脏点):

```tsx
          <div className="dsh-md-preview-crumbs" title={`${target.path} · v${process.env.MD_PREVIEW_VERSION}`}>
            {target.path.split('/').map((segment, index, all) => (
              <span
                key={`${index}-${segment}`}
                className="dsh-md-preview-crumb"
                aria-current={index === all.length - 1 ? 'page' : undefined}
              >{segment}</span>
            ))}
          </div>
          {state.face === 'edit' && isDirty(state) && (
            <span className="dsh-md-preview-dirty" title={t('panel.unsaved.title')} aria-hidden>●</span>
          )}
```

编辑按钮追加类:

```tsx
              type="button" className="dsh-md-preview-icon dsh-md-preview-editcta" aria-label={t('panel.edit')}
```

查找按钮 title 改为:

```tsx
                title={`${t('panel.find')} · Mod-F`}
```

保存按钮 title 改为:

```tsx
                title={`${t('panel.save')} · Mod-S`}
```

- [ ] **Step 4: 样式**

`src/client/styles.ts` 头部区追加(删除原 `.dsh-md-preview-version` 规则块):

```css
.dsh-md-preview-dirty {
  flex: none;
  margin-left: 2px;
  font-size: 13px;
  line-height: 1;
  color: var(--dsw-alias-accent, var(--dsw-alias-label-primary));
  user-select: none;
}
.dsh-md-preview-editcta {
  border: 1px solid var(--dsw-alias-accent, var(--dsw-alias-border-l2));
  background: var(--dsw-alias-fill-secondary);
}
```

- [ ] **Step 5: 跑测试确认通过 + 全量回归 + 提交**

Run: `pnpm vitest run tests/client-header.spec.tsx tests/client-outline.spec.tsx tests/client-edit.spec.tsx`
Expected: PASS。

```bash
git add src/client/PreviewOverlay.tsx src/client/styles.ts tests/client-header.spec.tsx
git commit -m "Rework the header: dirty dot, version into tooltip, edit primacy, shortcut hints"
```

---

### Task 4: 查找——中文 phrases、n/m 计数、换肤

**Files:**
- Modify: `src/client/editor.tsx`(phrases + 状态上报扩展)
- Modify: `src/client/PreviewOverlay.tsx`(计数 chip)
- Modify: `src/client/locale.ts`(10 个 phrases 键 + find.status)
- Modify: `src/client/styles.ts`(chip + 面板换肤)
- Test: `tests/client-edit.spec.tsx`(追加;若该文件的 harness 与 outline 文件不同,以本文件既有 harness 为准套用同断言)

**Interfaces:**
- Produces(editor.tsx):`export interface SearchStatus { readonly count: number; readonly index: number }`;`MarkdownEditorProps.onSearchStatus?: (status: SearchStatus | null) => void`(null = 面板未开或查询为空/非法;卸载时上报 null)。
- Consumes(locale.ts):键 `find.phrases.find/replace/next/previous/all/matchCase/regexp/byWord/replaceAll/close` 与 `find.status`,经 `t()` 取串后组 `Record<string, string>` 传给 editor。
- Consumes(@codemirror/search,已在依赖内):`getSearchQuery`、`SearchCursor`、`RegExpCursor`、`SearchQuery`、`setSearchQuery`、`search`、`searchKeymap`。

- [ ] **Step 1: 写失败测试**

`tests/client-edit.spec.tsx` 追加自包含渲染工具与两个用例(该文件既有 `renderPanel` 的 readResult 固定为 `'# Hi'`,查找计数需要自定文档,故新增参数化 helper;其余工具沿用文件内已有的 `flush`/`byText` 风格):

```tsx
async function renderFindPanel(content: string): Promise<PanelHarness> {
  const store = createPreviewStore()
  const harness: PanelHarness = {
    container: document.createElement('div'),
    reads: 0,
    write: vi.fn(() => Promise.resolve({ ok: true, value: { path: 'README.md', fingerprint: 'v2' } })),
    writeImpl: () => Promise.resolve({ ok: true as const, value: { path: 'README.md', fingerprint: 'v2' } }),
    setTarget: target => { store.set(target as never) },
    rerender: () => act(async () => { root.render(panelElement()) }),
    view: null,
    readResult: { ok: true, value: { path: 'README.md', content, fingerprint: 'v1' } },
    writeResult: { ok: true, value: { path: 'README.md', fingerprint: 'v2' } },
  }
  const usePreviewTarget = (selector: (state: unknown) => unknown) =>
    selector(useSyncExternalStore(store.subscribe, store.getSnapshot))
  const panelElement = () => (
    <PreviewOverlay
      usePreviewTarget={usePreviewTarget as never}
      close={() => { store.set(null) }}
      read={() => Promise.resolve(harness.readResult) as never}
      write={harness.write as never}
      t={t as never}
    />
  )
  document.body.appendChild(harness.container)
  const root: Root = createRoot(harness.container)
  harness.setTarget({ sessionId: 'session-1', path: 'README.md' })
  await harness.rerender()
  await act(async () => { await Promise.resolve() })
  return harness
}

describe('find count', () => {
  it('reports match count and current index while the search panel is open', async () => {
    const harness = await renderFindPanel('foo bar\nfoo\nbaz')
    await click(harness, 'panel.edit')
    await click(harness, 'panel.find')
    const host = harness.container.querySelector('.cm-editor') as HTMLElement
    const view = EditorView.findFromDOM(host)!
    await act(async () => {
      view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: 'foo' })) })
    })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(harness.container.querySelector('.dsh-md-preview-findcount')?.textContent).toBe('1/2')
    await act(async () => {
      view.dispatch({ selection: { anchor: view.state.doc.line(2).from + 1 } })
    })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(harness.container.querySelector('.dsh-md-preview-findcount')?.textContent).toBe('2/2')
  })

  it('clears the count when the panel closes', async () => {
    const harness = await renderFindPanel('foo bar\nfoo')
    await click(harness, 'panel.edit')
    await click(harness, 'panel.find')
    const host = harness.container.querySelector('.cm-editor') as HTMLElement
    const view = EditorView.findFromDOM(host)!
    await act(async () => { closeSearchPanel(view) })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(harness.container.querySelector('.dsh-md-preview-findcount')).toBeNull()
  })
})
```

文件顶部 import 追加:

```tsx
import { closeSearchPanel, SearchQuery, setSearchQuery } from '@codemirror/search'
```

说明:`closeSearchPanel` 是 @codemirror/search 导出的命令(直接以 view 调用,返回 boolean),不是 Effect。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/client-edit.spec.tsx`
Expected: 新用例 FAIL(chip 不存在)。

- [ ] **Step 3: locale 键**

`src/client/locale.ts` zh 字典追加:

```ts
  'find.status': '查找进度',
  'find.phrases.find': '查找',
  'find.phrases.replace': '替换',
  'find.phrases.next': '下一个',
  'find.phrases.previous': '上一个',
  'find.phrases.all': '全部',
  'find.phrases.matchCase': '区分大小写',
  'find.phrases.regexp': '正则表达式',
  'find.phrases.byWord': '整词匹配',
  'find.phrases.replaceAll': '全部替换',
  'find.phrases.close': '关闭',
```

en 字典追加:

```ts
  'find.status': 'Find progress',
  'find.phrases.find': 'Find',
  'find.phrases.replace': 'Replace',
  'find.phrases.next': 'next',
  'find.phrases.previous': 'previous',
  'find.phrases.all': 'all',
  'find.phrases.matchCase': 'match case',
  'find.phrases.regexp': 'regexp',
  'find.phrases.byWord': 'by word',
  'find.phrases.replaceAll': 'replace all',
  'find.phrases.close': 'close',
```

- [ ] **Step 4: editor.tsx 实现**

imports 扩展:

```ts
import { getSearchQuery, RegExpCursor, SearchCursor, search, searchKeymap } from '@codemirror/search'
```

props 追加:

```ts
  /** Search panel localization: CM stock phrase key → panel word. */
  searchPhrases?: Readonly<Record<string, string>>
  /** Match count and 1-based current index; null while search is inactive. */
  onSearchStatus?: (status: SearchStatus | null) => void
```

模块级导出类型:

```ts
/** What the find chip shows: total matches and the current one (1-based). */
export interface SearchStatus {
  readonly count: number
  readonly index: number
}
```

组件内 ref 与计算(挂在既有 refs 之后):

```ts
  const statusRef = useRef(onSearchStatus)
  statusRef.current = onSearchStatus
```

```ts
  /** Count matches for the live query; null when the panel is inactive. */
  const reportSearch = (view: EditorView): void => {
    const query = getSearchQuery(view.state)
    if (view.dom.querySelector('.cm-search') === null || query.search.length === 0 || !query.search.valid) {
      statusRef.current?.(null)
      return
    }
    const head = view.state.selection.main.head
    let count = 0
    let index = 0
    // Literal and regexp queries each have their cursor; word queries filter
    // substring matches down to word boundaries.
    const iterator = query.regexp
      ? new RegExpCursor(view.state.doc, query.search, { caseSensitive: query.caseSensitive })
      : new SearchCursor(view.state.doc, query.search, undefined, query.caseSensitive ? undefined : (text: string) => text.toLowerCase())
    const onMatch = (from: number, to: number): void => {
      if (query.word) {
        const before = from > 0 ? view.state.doc.sliceString(from - 1, from) : ''
        const after = to < view.state.doc.length ? view.state.doc.sliceString(to, to + 1) : ''
        if ((before !== '' && /\w/.test(before)) || (after !== '' && /\w/.test(after))) return
      }
      count += 1
      if (from <= head) index = count
    }
    while (!(iterator.next().done ?? false)) onMatch(iterator.value.from, iterator.value.to)
    statusRef.current?.({ count, index })
  }
```

extensions 追加(phrases 进 state;report 挂在既有 updateListener 里并加独立调用):

```ts
        extensions: [
          …
          search({ top: true }),
          searchPhrases === undefined ? [] : EditorState.phrases.of(searchPhrases),
```

updateListener 改为:

```ts
          EditorView.updateListener.of((update) => {
            if (update.docChanged) changeRef.current(update.state.doc.toString())
            if (update.docChanged || update.selectionSet) {
              cursorRef.current?.(update.state.doc.lineAt(update.state.selection.main.head).number)
            }
            reportSearch(update.view)
          }),
```

挂载后与卸载清理(`viewRef.current?.(view)` 附近):

```ts
    reportSearch(view)
    return () => {
      statusRef.current?.(null)
      viewRef.current?.(null)
      view.destroy()
    }
```

`searchPhrases` 经 ref 稳定(同 changeRef 模式)不必——phrases 只在创建 state 时生效,直接闭包读取一次即可(effect 依赖只有 initialValue,注释已有说明)。

- [ ] **Step 5: PreviewOverlay chip**

import 追加类型:

```ts
import { MarkdownEditor, type SearchStatus } from './editor.tsx'
```

(原 import 行是 `import { MarkdownEditor } from './editor.tsx'`,合并。)

组件内状态:

```tsx
  const [searchStatus, setSearchStatus] = useState<SearchStatus | null>(null)
```

phrases 组装(组件体内,`labels` 之后):

```tsx
  const searchPhrases = useMemo(() => ({
    Find: t('find.phrases.find'),
    Replace: t('find.phrases.replace'),
    next: t('find.phrases.next'),
    previous: t('find.phrases.previous'),
    all: t('find.phrases.all'),
    'match case': t('find.phrases.matchCase'),
    regexp: t('find.phrases.regexp'),
    'by word': t('find.phrases.byWord'),
    'replace all': t('find.phrases.replaceAll'),
    close: t('find.phrases.close'),
  }), [t])
```

编辑脸 `<MarkdownEditor …>` 追加:

```tsx
              searchPhrases={searchPhrases}
              onSearchStatus={setSearchStatus}
```

查找按钮之后渲染 chip:

```tsx
              {searchStatus !== null && (
                <span className="dsh-md-preview-findcount" aria-label={t('find.status')}>
                  {searchStatus.index}/{searchStatus.count}
                </span>
              )}
```

- [ ] **Step 6: 样式(chip + 面板换肤)**

`src/client/styles.ts` 追加:

```css
.dsh-md-preview-findcount {
  flex: none;
  margin: 0 2px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
  user-select: none;
}
.dsh-md-preview-editor .cm-panel.cm-search {
  background: var(--dsw-alias-bg-base);
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  padding: 4px 6px;
  font-size: 12px;
}
.dsh-md-preview-editor .cm-panel.cm-search input,
.dsh-md-preview-editor .cm-panel.cm-search button {
  font-size: 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 4px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  padding: 2px 4px;
}
.dsh-md-preview-editor .cm-panel.cm-search button:hover { background: var(--dsw-alias-fill-secondary); }
```

- [ ] **Step 7: 跑测试确认通过 + 提交**

Run: `pnpm vitest run tests/client-edit.spec.tsx`
Expected: PASS。

```bash
git add src/client/editor.tsx src/client/PreviewOverlay.tsx src/client/locale.ts src/client/styles.ts tests/client-edit.spec.tsx
git commit -m "Localize the find panel, report match counts, and reskin it"
```

---

### Task 5: 契约/README/TODO 同步与全链验证

**Files:**
- Modify: `docs/agent/PROJECT_CONTRACT.md`(user-visible outcome 段)
- Modify: `README.md` 与 `README.zh.md`(效果节)
- Modify: `TODO.md`(Wave 1 勾选)

**Interfaces:** 无代码接口;文档断言与 `pnpm verify` 全链。

- [ ] **Step 1: 契约更新**

`docs/agent/PROJECT_CONTRACT.md` 的 User-visible outcome 段,在「The header's outline popover navigates…」一句之后追加一句:

```
The outline tracks the reading position — the popover marks the entry
owning the current scroll position in the view face and the cursor's
source line in the edit face, keeping that entry scrolled into view.
The header carries a dirty dot while the edit draft differs, folds the
plugin version into the crumbs tooltip, and annotates the find and save
shortcuts; the editor's find panel is localized, shows a match count,
and matches the panel's design language.
```

- [ ] **Step 2: README 双语效果节**

`README.md` 效果列表与 `README.zh.md` 对应列表各追加一行(英文/中文):

```
- Outline tracks your reading position; the find panel shows match counts
```

```
- 大纲跟随阅读位置高亮当前节;查找面板显示匹配计数并本地化
```

- [ ] **Step 3: TODO 勾选**

`TODO.md`「面板 UX 整备」节 Wave 1 条目改为 `[x]`,并注明「发布链(verify → packed 冒烟 → publish → release)按 HANDOVER 流程另行执行」。

- [ ] **Step 4: 全链验证**

Run: `pnpm verify`
Expected: strict 123 项 + typecheck + 全部测试(116 + 新增 ≈ 128)+ build + built:check 全绿,exit 0。

- [ ] **Step 5: 提交**

```bash
git add docs/agent/PROJECT_CONTRACT.md README.md README.zh.md TODO.md
git commit -m "Document the Wave 1 UX improvements across contract and READMEs"
```

---

## 计划外事项(明确不做)

- 发布链(0.7.0 的 pack/publish/release):按 `docs/HANDOVER.md` 流程在 Wave 1 验证全绿后单独执行,不在本计划内。
- Wave 2 全部内容(rail、过滤框、状态栏、键映射、替换):独立计划。
