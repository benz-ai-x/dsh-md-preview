# Harness 0.1.5-alpha.1 兼容性核对清单

日期：2026-09-09。状态：初审完成，待与用户人工审查结果核对；未确定处理方案。

后续状态（同日）：用户已明确采用官方右边栏，并要求整理 Issue 准备开发。
审查项已纳入更新后的 [Spec #38](https://github.com/benz-ai-x/dsh-md-preview/issues/38)
及 #54–#60；原多格式票 #39–#53 保留并对齐官方标签语义。
当前队列见 [TODO](../../TODO.md#官方右边栏迁移与清理)。以下保留初审当时的证据与边界，
不将规划状态改写为实施或浏览器验收通过。

## 审查范围与结论

- Harness：用户指定的同级检出，`0.1.5-alpha.1`，提交
  `5dda764ed3aa172535a7967b06ff95d9cbfe536a`；审查时工作区干净。
- 插件：当前 main，`0.10.0`，提交
  `ae58cd4d3cfeec7b745f692cda502f66916e58ad`；已有未提交改动保留。
- 对照基线：[lock](../../dsh-reference.lock.json) 中的 `0.1.2-rc.1`，提交
  `a66e4702047846cdaa10c66c9d3df3951f5ea70d`。
- 未合入的 #39 以功能提交 `2491a52` 为参考；功能分支当前 `8ab313d`
  是其后的暂停交接文档提交。本轮没有恢复功能开发或执行旧流水线。

新版已经内置右侧栏、标签页、文件树、纯文本分段阅读和文件资源元数据。
插件仍按旧版布局提供独立文档面板，并接管部分文件入口。主要冲突集中在
界面职责、打开入口、会话状态及文件变化规则；当前生产源码的直接接口使用
尚未发现类型层面的破坏。

下面 C01–C07 是当前实现与新版的差异或验证问题；C08–C10 是后续设计与新版
机制之间必须核对的边界。它们不表示已经决定采用新版组件，也不表示尚未实施
的功能已经发生运行故障。

## 核对总表

| 编号 | 问题 | 证据状态 | 主要影响 |
| --- | --- | --- | --- |
| C01 | 两套右侧栏同时参与布局 | 源码确认；视觉待核对 | 重复占宽、原生窄屏判断受插件挤压影响 |
| C02 | 同一文件因入口不同进入不同预览链路 | 源码确认 | Markdown 渲染、编辑与纯文本阅读分裂；其他文件不再沿用桌面打开 |
| C03 | 工作区树及面板开合入口重复 | 源码确认；视觉待核对 | 两棵树、两套展开与刷新状态，两组侧栏按钮 |
| C04 | 全局单目标与按会话保存的多标签状态不一致 | 源码确认 | 切换会话、关闭面板、再次打开的含义不同 |
| C05 | 插件保存未进入原生文件变化通知链路 | 临时文件实测 | 原生已打开页面可能继续显示旧内容，且没有变化提示 |
| C06 | 符号链接文件的准入规则不同 | 临时文件实测 | 同一链接在插件可读，在原生预览被拒绝 |
| C07 | 固定依赖及旧布局验收不能证明新版兼容 | 检查和现有测试实测 | strict 失败；旧装配测试调用已删除 API |
| C08 | 原生标签关闭机制没有现成的未保存守卫入口 | 源码确认；设计边界 | 编辑器接入原生标签前，脏草稿生命周期尚未对齐 |
| C09 | 原生分段文本不是可直接用于编辑回写的原始全文 | 临时文件实测；设计边界 | 分页与末尾换行语义不同，不能视为现有编辑快照 |
| C10 | 续读发现文件变化后的处理与已确认需求相反 | 源码确认；规划冲突 | 原生自动清空并重读；本项目要求保留已读内容并等待刷新 |

## C01：两套右侧栏同时参与布局

插件仍从 `shell.overlay` 挂载，在 containing block 内另做 portal，并修改整个
Harness frame 的 `max-width`。新版原生 `rightbar` 已负责右栏占宽、拖动、
全屏、分栏与浮动；`details` 及原来的工具详情面板已经移除。

旧 [ADR-0004](../adr/0004-dock-preview-beside-the-harness-frame.md) 的理由是当时
没有公共侧边栏扩展接口。新版已经提供 `sidebarRightTabs` 和
`sidebar.right.pane.tab`，但插件的 DOM 适配仍然运行。

具体几何冲突：在容器宽 1440px、插件面板宽 720px 时，插件会把 frame 限制到
720px；新版 frame 的 ResizeObserver 把这个值交给原生右栏，原生按 `<768px`
进入自动全屏。物理窗口宽度与原生收到的可用宽度因此不同。原生全屏层为
z-index 40，插件 portal 为 20；覆盖和开合效果还需真实页面核对。

证据：[插件几何与 frame 写入](../../src/client/panel-dock.ts)（22、75–81 行）、
[插件 portal](../../src/client/PreviewOverlay.tsx)（755–758、1093 行）、
[新版 AppFrame](../../../deepseek-harness/packages/client/ui-layout/src/client/AppFrame.tsx)
（132–151、234 行）、
[新版全屏判定](../../../deepseek-harness/packages/client/ui-sidebar-right/src/client/shell/SidebarRight.tsx)
（348–373 行）、
[新版层级](../../../deepseek-harness/packages/client/ui-sidebar-right/src/client/shell/SidebarRight.module.css)
（19–51 行）。原来的 `data-shell-overlay` 锚点仍存在，不能把问题描述为锚点删除。

## C02：同一文件的打开链路分裂

插件的产出 Markdown chip 和“预览文档”动作仍调用自己的 `openPreview`，进入
带渲染、编辑和阅读记录的独立面板。新版聊天文件提及、工具文件路径、工具行号
引用和原生文件树则调用 `sidebarRight.openResource`，当前由原生 `text` fallback
承接文件地址。插件未在该类型注册表中声明 Markdown 预览。

因此同一份 `note.md`：点插件 chip 得到渲染和编辑；点正文中的产出文件提及或
原生文件树得到原生纯文本标签。新版工具传递的 `line` 导航参数也不会进入插件。

另一个实际行为变化是插件 `matched.other` 仍调用 owner 的 `openFile(path)`，
但这个函数已经从 `remote.session.openWorkspacePath` 改为原生资源导航。
“非 Markdown 文件保持桌面打开”的现行契约不再成立。默认原生 fallback 只读
文本，图片、PDF 等二进制文件可能以 `not-text` 失败，不会自动转为桌面打开。
这条路由变化由新版 Host UI 引入，插件仍依赖其旧语义。

证据：[插件入口注册](../../src/client/mount.ts)（127–142 行）、
[插件 chip 点击](../../src/client/MdChips.tsx)（34–55 行）、
[新版聊天 opener](../../../deepseek-harness/packages/client/ui-chat/src/client/apply.ts)
（119–137 行）、
[原生文件类型](../../../deepseek-harness/packages/client/ui-sidebar-textpreview/src/client/definition.ts)
（45–54 行）、
[原生文件树点击](../../../deepseek-harness/packages/client/ui-sidebar-files/src/client/FilesBody.tsx)
（158–162 行）。

## C03：工作区树和开合入口重复

新版 shipped web 组合已经包含 `ui-sidebar-files`。它在原生右栏提供工作区文件树，
通过 `workspaceFiles.list` 获取目录，以资源地址打开文件。插件另有浏览脸、
宽面板文件导航、目录刷新和会话头部回形针开合入口。

原生右栏的开合按钮位于 session header 的 `corner`，插件按钮仍位于
`utilities`。两套按钮操作不同面板；树的展开、刷新、当前文件和打开结果也不共享。

能力并非完全相同：原生树目前没有搜索、产出筛选和当前文件高亮；插件还有名称
搜索、当前回合产出、最近阅读和继续阅读。这里记录职责重叠，不认定这些已有
插件功能可以直接取消。

证据：[插件 header 注册](../../src/client/mount.ts)（144–156 行）、
[原生右栏及 header 注册](../../../deepseek-harness/packages/client/ui-sidebar-right/src/client/index.ts)
（159–189 行）、
[原生文件树说明](../../../deepseek-harness/packages/client/ui-sidebar-files/README.md)、
[shipped web 组合](../../../deepseek-harness/packages/bundle/web-app/cordis.patch.yml)
（217–235 行）。

## C04：会话和标签状态模型不同

插件持有一个 root 范围的 `previewTarget`，打开状态只判断 `target !== null`。
面板读取目标携带的 sessionId，没有随 Harness 当前会话切换而切换目标的处理。
例如在 A 会话打开文档后切到 B，插件仍持有 A 的目标；B 的回形针先请求关闭
这个已打开的面板。原生右栏则为每个会话保留独立的多标签布局。

原生隐藏右栏和切换会话不会终止标签记录，只有移除标签记录或卸载才 abort。
插件关闭则结束当前预览会话；重复选择当前目标是 no-op，原生重复打开会聚焦
已有标签并推进导航 revision。这是两套既有状态语义的差异，不是已发现跨会话
写入错误。

证据：[插件目标](../../src/client/preview-state.ts)（9–28 行）、
[插件开合判断](../../src/client/WorkspaceDocsAction.tsx)（42–58 行）、
[插件目标读取](../../src/client/PreviewOverlay.tsx)（171–178 行）、
[原生标签生命周期](../../../deepseek-harness/packages/client/ui-sidebar-right/src/client/contract/slots.ts)
（129–143 行）、
[原生导航 revision](../../../deepseek-harness/packages/client/ui-sidebar-right/src/client/tab-domain.ts)
（124–130 行）。

## C05：插件保存没有原生文件变化通知

新版资源元数据依赖 `workspaceFiles.changes`，其 Host 订阅 `fs/observed`。
该事件由文件工具在操作后发出，文件系统 provider 本身不自动发出。插件保存
直接调用 `ctx.fs.writeText`，成功后返回并只重读自己的预览，没有发出这个事件。

临时文件实测：插件保存后真实文件版本变化，捕获到的 `fs/observed` 次数为 0。
因此已经打开同一文件的原生标签不能靠这条通知显示“文件已被修改”；在没有
后续 Agent 文件观察、手动刷新或重新获取资源的情况下，会继续持有旧页面。
原生本身也不监听任意 OS 文件变化，不能把它描述成通用文件 watcher。

证据：[插件 write](../../src/remote.ts)（145–167 行）、
[原生变化源](../../../deepseek-harness/packages/api/workspace-files/src/changes.ts)
（1–27 行）、
[原生元数据消费者](../../../deepseek-harness/packages/api/workspace-files/src/client/provider.ts)
（92–122 行）、
[文件工具通知](../../../deepseek-harness/packages/fs/tool-fs/src/write.ts)（120 行）。

## C06：符号链接准入不同

插件先 resolve，再检查解析后的 target 是否在工作区内及是否为普通文件。
新版 `workspaceFiles` 先 `lstat` 请求路径，再拒绝不是普通文件的入口；符号
链接即使指向工作区内的普通文件，也被拒绝。

临时工作区里创建 `alias.md -> note.md`：插件读取成功；原生读取返回
`workspace-file/not-regular-file`，消息为 `"alias.md" is a symlink`。
同一入口文件因此会出现两种准入结果。这是产品规则差异，本轮没有认定其中
一方的规则应当优先。

证据：[插件 resolve 与 stat](../../src/remote.ts)（317–368 行）、
[原生 lstat 与文件准入](../../../deepseek-harness/packages/api/workspace-files/src/index.ts)
（324–367 行）。

## C07：版本约束与旧布局验收失效

插件的 lock、Harness 开发依赖及 `dsh-typert-protocol` 精确 peer 仍为旧版。
相对新检出运行 strict 退出 1，失败项为版本、提交和文档摘要，共 3 项；不是
源码不存在或缺少构建入口。本轮没有改 lock、依赖，也没有执行 `context:link`。

现有 5 个定向测试文件实际运行 55 项：54 通过，1 失败，并报告 1 个未捕获
异常；退出 1。失败在 `client-assembly.spec.tsx` 的旧原生布局场景，测试仍调用
`nativeLayout.actions.openDetails()`，新版已删除该方法。该异常来自测试装配，
不能把它误报为插件生产路径调用了删除的 API。

当前 `pnpm typecheck` 退出 0。另用不写文件的 TypeScript 程序将 Harness 类型
入口临时映射到新版声明，并统一 Cordis 类型身份，474 个入口映射、295 个新版
声明文件，生产 src 诊断为 0。该结果只覆盖类型兼容，不代表普通包安装或浏览器
运行已通过。

证据：[版本约束](../../package.json)（95–122 行）、
[旧测试调用](../../tests/client-assembly.spec.tsx)（208、507–509 行）、
[新版布局服务](../../../deepseek-harness/packages/client/ui-layout/src/client/service.ts)。

## C08：原生标签关闭尚无未保存守卫接入点

这是编辑能力后续接入原生标签时的边界。现有编辑会话要求所有离开请求经过
`leave-intent`，由用户决定保留或放弃脏草稿。

新版公开标签接口提供 `close()` 和生命周期 signal；控制器关闭直接调用
`actions.closeTab`，记录删除后立即 abort。公开类型声明及关闭路径中没有
等待编辑器确认的 before-close/veto 接口。直接把现有编辑器作为标签 body
挂入，不能据此认为原生标签 ×、替换标签等操作已经受现有守卫保护。

证据：[插件离开守卫](../../src/client/leave-intent.ts)、
[原生 close](../../../deepseek-harness/packages/client/ui-sidebar-right/src/client/service.ts)
（345–352 行）、
[记录删除后的 abort](../../../deepseek-harness/packages/client/ui-sidebar-right/src/client/tab-domain.ts)
（85–90 行）、
[公开标签动作](../../../deepseek-harness/packages/client/ui-sidebar-right/src/client/contract/slots.ts)
（111–143 行）。本轮未把当前独立面板的关闭守卫判为失效。

## C09：原生文本页不能直接视为编辑全文

新版 `workspaceFiles.read` 返回 `{ offset, text, lines, eof, version }`，以行窗口
为边界，默认最多 5000 行、2 MiB 一页；插件现行编辑快照使用完整正文及指纹，
默认对整个文件限制 1 MiB。

更具体的字节差异：临时文件正文为 `# Before\n`，插件 read 保留该正文；原生
read 返回 `text: "# Before"`、`lines: 1`、`eof: true`。原生契约明确页内行以
`\n` 连接，不携带最后一行的终止换行。其页面是阅读表示，不能直接替代现有
Markdown 编辑器的原始内容快照，否则保存时可能改掉未编辑的末尾换行。

证据：[原生文本页协议](../../../deepseek-harness/packages/api/workspace-files/src/types.ts)
（41–68 行）、
[原生默认限额](../../../deepseek-harness/packages/api/workspace-files/src/index.ts)
（172–176 行）、[插件 read](../../src/remote.ts)（90–107 行）。

## C10：续读版本变化策略与已确认要求不同

[ADR-0006](../adr/0006-text-preview-independent-of-language-recognition.md) 已确认：
包括日志追加在内，续读检测到文件指纹变化后保留已加载内容、暂停续读并提示
刷新，待用户刷新才从头读取。

新版 `ui-sidebar-textpreview` 在后续页发现 version 不同时，立即 `restart`，
`actions.reset(tabId)` 后读取第一页。它避免混合版本，但会自动替换已读内容。
这个行为与已确认的等待用户刷新要求不同，不能把原生分段预览直接算作本项目
该验收条件完成。此处只指“续读读到新版本”分支；通常收到 changed 元数据时，
原生会保留旧内容并显示提示。

证据：[新版续读分支](../../../deepseek-harness/packages/client/ui-sidebar-textpreview/src/client/face.ts)
（91–107 行）、[已确认需求](../../TODO.md)。

## 尚未发现破坏的接口与能力边界

- 插件依赖的 `FsTarget`、`resolve/contains/stat/readText/writeText/listDir`，
  以及 #39 使用的 `streamText`，仍存在；新 FS 增加了 `readByteRange`。
- 插件的 direct Remote 描述符、显式 sessionId、取消参数未发现被新版删除。
  Typert 删除的 Host context identity API 不是本插件使用的调用路径。
- 使用中的四个 Slot 及 `deliverables.produced`、turn-tail 关闭序号结构仍存在。
  当前问题不应写成“产出事实接口已经全部失效”。
- lazy-CJS factory 加载协议仍在；原有 external 模块仍在平台表中，新版增加
  `ui-dockkit`，没有证据需要为当前 bundle 扩大 external。MarkdownText 的新增
  `pathImages` 参数是可选参数，插件当前调用仍有效。
- 新版内置纯文本、分段读取、目录树和资源元数据，与 #39 及后续计划部分重叠；
  原生 text fallback 尚不提供 Markdown 渲染、编辑、语法高亮、JSON/XML 格式化、
  HTML 内嵌浏览器或图片/音视频/PDF 预览。字节读取接口也不等于这些体验已经交付。
  插件现有搜索、大纲、编辑守卫和阅读连续能力仍须分别评估。

## 实际验证与人工核对入口

已运行：

```sh
DSH_HARNESS_ROOT=../deepseek-harness pnpm context:check:strict
pnpm typecheck
DSH_HARNESS_ROOT=../deepseek-harness pnpm exec vitest run \
  tests/client-registration.spec.ts tests/client-assembly.spec.tsx \
  tests/host-authority.spec.ts tests/contribution.spec.ts tests/panel-dock.spec.ts
```

另执行了上述新版声明诊断，以及临时目录中使用新版 LocalFileSystem、
WorkspaceFiles 和当前插件 Remote 的直接服务调用。临时样例已清理。这些是源码、
类型和服务层证据，未启动或重启用户 profile，未完成新版普通包安装、完整 verify
或真实浏览器验收。测试中的 Host fake 也不能替代真实文件服务验收。

供双方人工核对的场景：

1. 同一 Markdown 分别从插件 chip、正文文件提及、工具行号和原生树打开（C02）。
2. 同时展开两套右栏，在约 1440px 容器内把插件拖到约 720px，再检查原生开合、
   自动全屏和两层覆盖（C01、C03）；记录主题、语言、视口和缩放。
3. A 会话打开插件文档后切到 B，再分别操作两组面板按钮（C04）。
4. 原生标签已显示某 Markdown 时，由插件编辑保存，核对原生变化提示（C05）。
5. 用工作区内的 `.md` 符号链接对比两套入口（C06）。

本轮只新增这份审查记录，未修改生产代码、依赖、固定基线、现有待办或交接文件，
未创建或修改 Issue、PR、Release；问题是否合并、保留或进入后续设计，待双方核对。
