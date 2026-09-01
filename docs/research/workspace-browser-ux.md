# Workspace Browser UX 调研：文件树 + 点击预览的设计模式

## 背景与问题

DSH Web GUI 会话视图右侧有一个可停靠预览面板（宽度 320–1280px，默认 500px，可关闭、可拖宽，无目标时闲置），当前渲染会话产出的 Markdown 文档，并提供 CodeMirror 编辑脸（`docs/agent/PROJECT_CONTRACT.md`）。本调研为该面板新增「工作区浏览器」脸收集证据：一棵懒加载的会话工作区目录树，点击 Markdown/文本文件即在面板内预览。

要回答的问题：

1. 文件树在同类工具中放在哪里、如何组织（左栏/侧栏、折叠、宽度）？
2. 树的机械结构：懒加载、展开器（expander）与标签点击分工、缩进、选中高亮、加载/空/错误态、键盘模型。
3. 「点击文件 → 预览」语义：单击 vs 双击、预览 vs 固定打开、按类型选择渲染方式（富文本 vs 纯文本 vs 不可预览）。
4. 哪些模式不适合 320–1280px（默认 500px）的右侧窄面板，对应的适配形态是什么。

方法：只采信一手来源（官方文档、官方设计系统、官方工程博客、官方更新日志），每条结论后附来源 URL；无法用一手来源证实的项明确标注「未验证」。调研日期 2026-09-01。

---

## GitHub 仓库文件浏览器

GitHub 是「树 + 点击预览」最成熟的参照：新代码视图（2023 GA）官方定位就是「将文件树、正在查看的文件内容、代码视图原生路径面包屑组合在一起」（https://github.blog/developer-skills/github/a-better-way-to-search-navigate-and-understand-code-on-github/）。

树的布局与定位：

- 文件树位于代码视图左侧，官方说明其价值是「把代码放进上下文，显示文件在仓库中的位置，并让开发者跨仓库浏览文件」（https://github.blog/developer-skills/github/a-better-way-to-search-navigate-and-understand-code-on-github/）。
- 桌面布局中树约占屏宽四分之一，其余四分之三是文件内容（GitHub 工程博截图说明："A tree view … occupies a quarter of the screen. The other three quarters are taken up by the content"（https://github.blog/engineering/user-experience/considerations-for-making-a-tree-view-component-accessible/）。
- PR「Files changed」页的树可拖宽（"The file tree is now resizable"），树上显示评论/错误/警告角标，且文件过滤器同时作用于树和 diff（https://github.blog/changelog/2025-06-26-improved-pull-request-files-changed-experience-now-in-public-preview/）。

树的机械结构（GitHub 官方无障碍工程博，树组件同时驱动仓库树与 PR 树）：

- 语义基础是 `ul`/`li` 的「列表的列表」；GitHub 明确「目前不对其文件树做虚拟化，若规模变化需要重新审视该决策」（https://github.blog/engineering/user-experience/considerations-for-making-a-tree-view-component-accessible/）。
- 整棵树是复合控件（composite widget）：只有一个 Tab 停靠点，避免 500+ 文件要按几百次 Tab；并包裹在 `nav` 地标中，因为它承担「在仓库内容间导航」的职责（同上）。
- 焦点用 roving `tabindex`（各节点 `tabindex="-1"`、当前节点 `0"`），比 `aria-activedescendant` 在 VoiceOver 上表现更好（同上）。
- ARIA 组合：`role="tree"`（ul）/`role="treeitem"`（li）/`role="group"`（子 ul）；目录上 `aria-expanded`，节点上 `aria-selected`；被选中（深链）节点加 `aria-current="true"`；SVG 图标一律 `aria-hidden="true"`；显式 `aria-level` 声明深度；用 `aria-labelledby` 指向文本以保证可访问名（同上）。
- 键盘模型刻意复刻 Windows 文件资源管理器：Enter 在目录上=显示目录内容、在文件上=显示文件内容；↑↓ 在可选节点间移动；→ 展开折叠目录或进入已展开目录的第一个子节点；← 折叠已展开目录或回到父节点；Home/End 到首/末节点；支持 typeahead 按名跳转（同上）。
- 鼠标中键 / Ctrl+Enter 用 JS 复刻链接的「新标签页打开」行为（treeitem 不是 `<a>`）（同上）。

加载/空/错误态：

- 展开目录时在目录下渲染一个带 spinner 的「Loading…」占位子节点；数量已知时 live region 播报「Loading {x} items」，未知时「Loading…」，为空时「{branch} is empty」（同上）。
- 焦点管理：占位节点加载完成后焦点移到第一个子节点；若目录为空，焦点回到目录节点并移除其 `aria-expanded`（同上）。
- 取内容失败时用直白的对话框向用户沟通错误（同上）。

点击文件后的渲染分层：

- blob 视图头部右上提供 Raw / 复制 / 下载按钮；Markdown 文件在 Code 之上提供 Preview 标签，可在「渲染视图/源码视图」间切换（"If you are viewing a Markdown file, above the file content, you can also click Preview to return to the view with Markdown formatting applied"）（https://docs.github.com/en/repositories/working-with-files/using-files/viewing-a-file）。
- 树本身不标注哪些文件「可富渲染」——可预览性由点击后的视图按类型分流表达（同上）。

## VS Code

布局与预览标签（preview tabs）：

- 资源管理器是左侧 Side Bar 的视图；「在资源管理器中单击或选中文件时，文件以预览模式显示并复用现有标签页；开始编辑或双击打开时才为其分配独立标签页。预览模式用斜体标题指示」，由 `workbench.editor.enablePreview` 全局控制；无标签模式下，预览打开的文件不进入 OPEN EDITORS 列表（https://code.visualstudio.com/docs/editor/tabs、https://code.visualstudio.com/docs/getstarted/userinterface）。
- 这是对「点击预览」语义最重要的官方定义：单击=瞬态预览（复用单容器），显式动作（双击/编辑）=固定。对一个本来就是单容器的预览面板，「一切单击皆预览」正是该模式的退化形式。

树的机械结构：

- 官方树视图 API 即懒加载协议：`getChildren(element?)` 无参调用取根，目录的子级在展开时才请求（`collapsibleState` 为 `None` 的节点不会被再次调用）（https://code.visualstudio.com/api/extension-guides/tree-view）。
- 空视图有官方 `viewsWelcome` 机制：渲染文案+命令按钮（如 "No node dependencies found [learn more] [Add Dependency]"），而非留白（https://code.visualstudio.com/api/extension-guides/tree-view）。
- 树内过滤：资源管理器聚焦后 ⌥⌘F 唤出 Find 控件，有「高亮/过滤」两种模式，高亮模式下文件夹带命中角标，支持模糊匹配（https://code.visualstudio.com/docs/getstarted/userinterface）。
- 紧凑文件夹（compact folders）：单子文件夹合并为一个树元素（如 `src/components/utils` 一行），`explorer.compactFolders` 默认开启（https://code.visualstudio.com/updates/v1_41）。
- 编辑器顶部面包屑「始终显示文件路径」，可在文件夹/文件/符号间快速导航（https://code.visualstudio.com/docs/getstarted/userinterface）。
- 搜索结果树：按文件分组并显示命中预览，展开文件看命中行，「单击命中项即在编辑器中查看」（https://code.visualstudio.com/docs/editor/codebasics）——官方在树场景使用「单击=查看」。

Markdown 预览的并排模式：

- ⇧⌘V 切换编辑器与预览；⌘K V 并排打开，编辑时实时反映（https://code.visualstudio.com/docs/languages/markdown）。
- 预览默认「动态」跟随当前活动编辑器，可用 Toggle Preview Locking 锁定到某文档（锁定后标题显示 [Preview]）；编辑器与预览双向滚动同步；双击预览中的元素跳回编辑器最近行（https://code.visualstudio.com/docs/languages/markdown）。
- 预览安全分级（Strict 默认禁脚本、仅 https 资源）说明官方把「渲染不可信内容」当作需要显式策略的问题（https://code.visualstudio.com/docs/languages/markdown）。

## 在线 IDE / AI 应用构建器

共同形态：左侧文件树（可折叠侧栏）+ 中间编辑器（多标签）+ 右侧/单独的应用预览；AI 对话占据一个并列栏或主栏。

- **StackBlitz**：最左侧 Activity Bar 选择侧栏视图（Project/Search/Ports/Settings），打开项目时侧栏默认是 Project 视图，用于「浏览项目文件」；Editor「显示当前所选文件的内容」，右上角管理文件标签；Preview 是浏览器内嵌 iframe 迷你浏览器，可 "Open in New Window" 弹出（https://developer.stackblitz.com/guides/user-guide/ide-whats-on-your-screen）。
- **Replit**：文件树由左侧文件夹图标开关；「选中文件夹以显示其内容」「选中文件或拖到窗格以在文件编辑器中打开」；树内完成复制/重命名/移动/下载/删除；工具以标签页打开，窗格（pane）可增删/移动/最大化；顶部搜索栏统一找文件/文本/工具（https://docs.replit.com/features/editor/editor-and-tools）。
- **v0**：编辑器通过 Preview 旁的 Code 标签进入；File Explorer 用 Shift+Cmd+E 开关面板；编辑器带语法高亮/行号/文件内查找/全局搜索；支持 Diff 视图与 Split 并排；在资源管理器头部图标或树内右键完成新建文件/文件夹、重命名、删除；工具栏有 Copy File、Download File、Toggle Diff View、Split Layout、Toggle Preview（https://v0.app/docs/code-editing）。
- **Lovable**：项目工具栏的 Code 标签（与 Preview 标签同位）打开代码视图，布局为「左侧文件资源管理器 + 右侧代码编辑器」，可用右上角侧栏图标开关资源管理器；「选中任意文件即查看其内容」；Diff 下拉可看全部变更或单文件 diff，Cmd+点击文件直接开它的 diff；代码默认只读，切换 Dev Mode 才可编辑（https://docs.lovable.dev/features/code-mode）。
- **Bolt.new**：从项目下拉或顶部的 `<>` 图标进入 Code View；Code View 含三个面板——Files（打开/编辑/新建/删除文件）、Editor、Preview（https://support.bolt.new/building/using-bolt/code-view）。
- **CodeSandbox**：【未验证】其文档站被反爬验证拦截，无法从一手来源核实编辑器文件树的当前行为；仅可确认其产品定位为云端开发环境（https://codesandbox.io/）。

与聊天 GUI 最相关的两个观察：一是这些产品全部把「预览(应用)/代码(树+编辑器)」做成工作区级标签或模式切换（v0、Lovable、Bolt），树是代码模式内部的左侧栏；二是 Lovable/v0 都把「浏览/查看代码」与「编辑代码」拆成两种状态（Lovable 默认只读 + Dev Mode），树+查看是低权限默认态。

## Obsidian / Typora

- **Obsidian**：文件资源管理器是核心插件，「浏览笔记及其他可接受文件格式」并做增删改/拖拽；工具栏提供排序（名称/修改时间/创建时间，升/降序）与「全部展开/全部折叠」；「Auto-reveal active file」在打开笔记时自动滚动到并在树中高亮该笔记，「帮你定位当前活动笔记在库中的位置」（https://obsidian.md/help/plugins/file-explorer）。
- **Obsidian Page preview**：悬停内链即可预览页面而无需导航（阅读视图直接悬停；编辑视图需 Ctrl/Cmd+悬停），默认开启（https://obsidian.md/help/plugins/page-preview）——「预览是导航的低承诺形式」的极好例证。
- **Typora**：侧栏两型——Outline（当前文档目录）与 Files（File Tree 树形 / File List 平铺）；关键规则：「file tree 模式下，当前只显示文件夹与 Typora 支持的文件（Markdown、文本等）」——即树直接过滤掉不可打开的类型（https://support.typora.io/File-Management/）。文件树自动监视文件夹变化并更新，异常时可手动 Refresh；排序支持「Group by Folder」（树中文件夹排前）等；Open Quickly（Cmd+Shift+O / Ctrl+P）模糊搜文件（https://support.typora.io/File-Management/）。

## 设计系统树组件指南

**Ant Design Tree**（https://ant.design/components/tree）：

- 懒加载 API：`loadData`「点击展开某 treeNode 时异步加载数据」，配合受控 `loadedKeys`；`isLeaf` 标记叶子（loadData 生效时）。FAQ 明确 `default*` 属性仅初始化生效，异步数据需受控 `expandedKeys`。
- 展开器（switcher）与选中分离：`switcherIcon` 自定义展开/折叠图标、`switcherLoadingIcon` 自定义加载图标；`onSelect` 是点击节点回调、`onExpand` 是展开回调，两者独立。
- 虚拟滚动：`virtual` 默认 `true`，配 `height` 启用；限制是「虚拟滚动只渲染可见区域，因此不支持自动宽度（如长标题横向滚动）」，并提供 `scrollTo({key})`。
- 连接线：`showLine` 显示节点间连接线（缩进参考线），可定制叶子图标。
- 搜索：`filterTreeNode` 过滤（高亮）树节点；`DirectoryTree` 的 `expandAction` 可配置 `click` / `doubleClick` / `false`（目录展开触发方式）。
- 设计 token：`indentSize`（每级缩进）默认 **24px**、`titleHeight`（行高）默认 **24px**、`nodeSelectedBg` 默认 `#e6f4ff`、目录选中 `directoryNodeSelectedBg` `#1677ff`、`nodeHoverBg`。

**Carbon TreeView**（https://carbondesignsystem.com/components/tree-view/usage/）：

- 何时用/不用：适合「浏览由文件夹和文档组成的文件系统结构」；不要用作产品主导航（那是 UI Shell 左面板+面包屑的职责）；只有一层嵌套时用 accordion/data table。
- 结构：branch node / leaf node / caret icon（展开折叠）/ 可选 node icon；两种行高——small 32px（默认）与 extra-small 24px，「页面空间受限或需要更紧凑视图以显示更多树内容时」用后者；节点 0px 堆叠；嵌套靠类型与图标的垂直对齐表达（不靠缩进线）。
- 溢出：标签过长加省略号并配浏览器原生 tooltip；可选择前/中/后截断位置以保留最有用信息。
- 选中与展开的点击区规则：展开=「点击 caret 图标包围盒以内」；选中 branch=「点击节点上 caret 包围盒以外的任意位置」，选中 leaf=整个节点容器；若所选子节点的父 branch 被折叠，父节点应继承选中态，「让用户不丢失所选上下文」。
- 焦点：单选树获得焦点时聚焦「上一次选中的节点」，否则第一个节点。
- 键盘：→ 开节点（焦点不动）/进入首子节点；← 关节点/回到父节点；↑↓ 顺序移动；Enter 激活（单选中不跟随焦点时默认动作=选中）。
- 图标指南：文件夹(branch)+文档(leaf)是「公认配对」；要求全树一致使用；「不得混用有图标与纯文本节点」；「若单个节点数据无法被图标识别，就不显示图标；拿不准时用无图标节点」。

**Primer（GitHub）React TreeView**：组件「渲染带可展开/折叠节点的交互式树」，属 interactive 组件、须运行在 ActionList parts provider 内（https://primer.style/react/tree-view）；其生产行为规范以上述 GitHub 工程博为准（单 tab stop、roving tabindex、Windows 键盘模型、加载/空/错误态）。

**Atlassian Design System**：未发布独立 Tree 组件；最接近的是 **Table tree**——「用于展示嵌套层级的可展开表格」（https://atlassian.design/components）。

## 文件类型 affordance（图标/颜色/可预览信号）

- VS Code 的文件图标体系是「按类型给图标」的最完整官方范式：图标可关联到文件名、扩展名、语言 ID、文件夹名及文件夹展开态（`folderExpanded`），匹配优先级为「文件名(带父路径) > 文件名 > 扩展名(带父路径) > 扩展名 > 语言」（https://code.visualstudio.com/api/extension-guides/file-icon-theme）。
- 图标定义支持 `fontColor`（字形+颜色组合表达类型），并为 light/highContrast 主题分别细化；未匹配文件回退到通用 `file` 图标；内置两套主题 Minimal 与 Seti（https://code.visualstudio.com/api/extension-guides/file-icon-theme）。
- 展开状态可由文件夹图标本身表达：图标主题可设 `hidesExplorerArrows: true` 让资源管理器隐藏默认旋转三角（twistie）——前提是「文件夹图标足以表达展开状态」；反之无强图标体系时 chevron 是必需 affordance（https://code.visualstudio.com/api/extension-guides/file-icon-theme）。
- Carbon 的保守规则：folder/document 公认配对；图标要么全有要么全无、不得混用；识别不了就不用图标（https://carbondesignsystem.com/components/tree-view/usage/）。
- 图标是纯视觉信息：GitHub 把树内 SVG 图标对辅助技术隐藏（`aria-hidden`），可访问名始终由文件名文本承担（https://github.blog/engineering/user-experience/considerations-for-making-a-tree-view-component-accessible/）。
- 「可预览」的两种表达流派：GitHub 在树上不做区分，点击后由 blob 视图按类型分流渲染（Markdown 提供 Code/Preview 切换）（https://docs.github.com/en/repositories/working-with-files/using-files/viewing-a-file）；Typora 则在树里直接过滤，只显示编辑器支持的类型（https://support.typora.io/File-Management/）。

---

## 对右侧停靠聊天面板的启示（综合）

面板约束：宽 320–1280px（默认 500px）、右侧停靠、与对话并列，已有「文档预览脸」与「编辑脸」。以下 11 条机制按上述证据归纳。

1. **树是面板内的一张「脸」，不是永久左栏。** 所有参照工具的树都是全屏 IDE 的左侧固定栏（StackBlitz/Replit/Lovable/Bolt/VS Code，各见上文来源），GitHub 桌面树也占屏宽 1/4——500px 面板同时容纳树+正文不可行。适配形态：浏览器脸与预览脸在同一面板内切换（类比 v0/Lovable 的 Preview↔Code 工作区级标签，https://v0.app/docs/code-editing、https://docs.lovable.dev/features/code-mode），面板头部放「工作区」入口；点击文件切到预览脸，预览脸头部留返回/路径入口。
2. **单击即预览，无双击语义。** VS Code 官方定义单击=瞬态预览（复用单一容器）、双击/编辑才固定（https://code.visualstudio.com/docs/editor/tabs）；GitHub 树上 Enter/点击直接显示文件内容（https://github.blog/engineering/user-experience/considerations-for-making-a-tree-view-component-accessible/）。面板本身就是单容器，全部单击都是预览，不需要 pin/tab。
3. **展开器与「打开」严格分离。** chevron/caret 是独立点击区（Carbon：展开=caret 包围盒内，选中=包围盒外，https://carbondesignsystem.com/components/tree-view/usage/；Ant：switcher 独立图标，https://ant.design/components/tree）；点击文件夹标签只选中/聚焦该目录（Replit：选中文件夹显示其内容，https://docs.replit.com/features/editor/editor-and-tools），不递归展开。
4. **子级按展开懒加载。** VS Code `getChildren` 在展开时才请求（https://code.visualstudio.com/api/extension-guides/tree-view）；Ant Design `loadData` 的契约就是「点击展开时异步加载」（https://ant.design/components/tree）；GitHub 树同样在展开时拉取目录内容（https://github.blog/engineering/user-experience/considerations-for-making-a-tree-view-component-accessible/）。
5. **加载/空/错误三态做在树内。** 展开目录时在目录下渲染「Loading…」占位子节点（spinner），空目录显示「{名称} 为空」并移除 `aria-expanded`，加载后焦点从占位节点移到首个子节点；取数失败用明确对话而非静默（GitHub 工程博，https://github.blog/engineering/user-experience/considerations-for-making-a-tree-view-component-accessible/）。空工作区渲染带操作的欢迎文案（VS Code `viewsWelcome`，https://code.visualstudio.com/api/extension-guides/tree-view）。
6. **当前预览文件在树中高亮并可自动定位。** 选中节点加 `aria-current`/`aria-selected`（https://github.blog/engineering/user-experience/considerations-for-making-a-tree-view-component-accessible/）；Obsidian 的 Auto-reveal 在打开笔记时自动滚动到并高亮树中节点（https://obsidian.md/help/plugins/file-explorer）；折叠的父目录继承选中态以防丢失上下文（https://carbondesignsystem.com/components/tree-view/usage/）。面板从 chip/动作栏打开文档时，树（若可见）应同步高亮该路径。
7. **键盘采用 Windows 资源管理器模型 + 单 Tab 停靠。** 整树一个 Tab stop、roving tabindex、↑↓/→/←/Home/End/Enter、typeahead（GitHub 与 Carbon 一致，两文同上）；树包 `nav` 地标、语义 ul/li + `aria-level`，不用 div 堆砌。
8. **窄宽度优先级：小行高、适度缩进、紧凑文件夹、省略号+tooltip。** Carbon 为空间受限场景提供 24px 紧凑行高（默认 32px）且节点 0px 堆叠（https://carbondesignsystem.com/components/tree-view/usage/）；Ant 默认 24px 行高/24px 每级缩进（https://ant.design/components/tree）；VS Code 的 compact folders 把单子文件夹合并显示（默认开启，https://code.visualstudio.com/updates/v1_41）对深路径尤有价值；长文件名省略号+原生 tooltip，可选前/中/后截断（https://carbondesignsystem.com/components/tree-view/usage/）。
9. **规模策略：先语义不虚拟化，预留虚拟滚动开关。** GitHub 生产树明确不虚拟化以保语义结构（https://github.blog/engineering/user-experience/considerations-for-making-a-tree-view-component-accessible/）；会话工作区通常远小于 GitHub 仓库，跟随该路线，超大目录再启用 Ant 式 `virtual`+`height`（注意其不支持横向自适应宽度，https://ant.design/components/tree）。
10. **文件类型用「图标+通用回退」表达，可预览性由点击后的渲染分流表达。** 按扩展名/文件名给图标、未匹配回退通用文件图标（https://code.visualstudio.com/api/extension-guides/file-icon-theme）；folder/document 公认配对且不得混用有/无图标节点（https://carbondesignsystem.com/components/tree-view/usage/）；树不标「可预览」徽章——点击白名单外扩展名时预览脸显示「不支持预览」状态（对应契约的 `md-preview/unsupported-extension`），而不是禁用树节点。此为 GitHub 流派；Typora 的树内过滤流派（https://support.typora.io/File-Management/）会隐藏文件，对「了解工作区全貌」不利。
11. **预览脸头部：路径面包屑 + 复制/原始内容动作；只读默认、显式编辑。** GitHub blob 头部即此模式（面包屑路径、Raw/复制/下载，https://docs.github.com/en/repositories/working-with-files/using-files/viewing-a-file；新代码视图原生路径面包屑，https://github.blog/developer-skills/github/a-better-way-to-search-navigate-and-understand-code-on-github/）；VS Code 面包屑「始终显示文件路径」（https://code.visualstudio.com/docs/getstarted/userinterface）。Lovable 代码默认只读、Dev Mode 才可编辑（https://docs.lovable.dev/features/code-mode）——与现有「预览→显式『编辑』」的脸切换一致。

**明确不适合 320–500px 面板及对应替代：**

- 永久左侧树栏（VS Code/StackBlitz/Replit/Lovable/Bolt）→ 面板内的浏览脸/树抽屉，树与内容二选一或拖宽后并排（GitHub PR 树可拖宽是并排合法性的参照，https://github.blog/changelog/2025-06-26-improved-pull-request-files-changed-experience-now-in-public-preview/）。
- 多标签编辑器（VS Code tabs、Replit/v0 的 tab/split）→ 单一预览容器 + 面包屑回溯；VS Code preview tab 证明「单容器瞬态复用」是官方认可的轻量浏览形态（https://code.visualstudio.com/docs/editor/tabs）。
- 编辑器+预览并排、树+diff 双栏（VS Code ⌘K V、GitHub Files changed）→ 仅在面板拖至较宽（如 >800px）时提供树|内容分栏；默认脸切换（GitHub 新体验自身也注明小屏支持仍在开发，https://github.blog/changelog/2025-06-26-improved-pull-request-files-changed-experience-now-in-public-preview/）。
- 树内文件管理操作（新建/删除/重命名，各 IDE 均有）→ 超出「预览面板」职责；契约已知限制即「仅编辑既有文件、不创建」。

## 未验证项

- CodeSandbox：文档站被反爬拦截，未能从一手来源核实（https://codesandbox.io/ 仅确认产品定位）。
- Atlassian 无独立树组件的判断基于其官方组件目录页（https://atlassian.design/components）当前只列出 Table tree。
