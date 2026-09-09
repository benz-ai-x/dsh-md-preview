# HANDOFF — dsh-md-preview

## 当前交接：2026-09-09，PR #61 开发复现说明修复

对 `90f0d77` 的复审未确认新的运行代码问题，发现双语 README 开发段仍指向旧补丁提交。
现已更新为 `a28c5a8`，区分关闭守卫的 `git am` 与标题源位置的 `git apply --index`、提交步骤。
修改前 strict 138项通过；从官方 `5dda764` 独立执行 README 命令，得到与 lock 一致的完整 tree。
本轮只改文档，未重建、重打包或操作实例；#60 真实浏览器验收继续待办。
详见 [修复与验证](docs/verification/official-sidebar-markdown/PR61-README.md)。

## 2026-09-09 较早快照：PR #61 标题定位修复

用户要求修复剩余的链接/缩进标题定位 P2。修复代码提交 `18b43c0`，插件候选 `0.11.0-alpha.5`。
预览定位使用平台渲染标题的源坐标，覆盖重复标题、setext、围栏、数学与脚注重排。
新增 Harness 公共 `MarkdownText.headingSource` 选项；固定本地补丁提交为 `a28c5a8`，
仍以最新已核对的官方 `0.1.5-alpha.1` / `5dda764` 为基础。两份补丁在 `patches/`，均未上游发布。

完整 verify 退出0：138项strict、16文件201测试、类型检查、构建与6项产物检查。
同一 alpha.5 归档完成干净 profile 安装、配置组合/覆盖、正常启动、普通导入、资源HTTP200、
移除后HTTP404，并确认实际 Web 资源包含源坐标能力；两个测试服务均退出0。
Harness GUI、相关组件与关闭服务测试、完整回放、文档及 lint 通过；详情和计数边界见
[本轮验证](docs/verification/official-sidebar-markdown/PR61-HEADINGS.md)。

仍在 `feat/official-sidebar-markdown` / [草稿 PR #61](https://github.com/benz-ai-x/dsh-md-preview/pull/61)。
#60 真实浏览器矩阵未完成，未合并或发布，相关 Issue 保持打开。
继续页面验收前重新核对3196现场并安装本次 alpha.5；此前 alpha.2 不是当前候选。
显式设置 `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness-md-guard`。
原 Harness 检出、用户实例以及已有技能/流水线改动保留。

## 2026-09-09 较早快照：PR #61 后续两项修复与最新 Harness 核对

用户要求继续修复重载后的元数据误报和显式源行重复定位，并明确要求使用最新 Harness。
GitHub 最新 Release、master 与用户原检出均已核实为 `0.1.5-alpha.1` / `5dda764`；
插件版本单独为 `0.11.0-alpha.4`。关闭守卫仍依赖 #55 的本地补丁 `737e95c`。

修复代码提交 `da3d522`。两个失败用例分别 RED→GREEN，完整 verify 退出0：
138项strict、16文件196测试、类型检查、构建和6项产物检查通过。
插件 alpha.4 同一归档完成干净 profile 安装、配置组合/覆盖、正常启动、普通导入、
资源HTTP200、移除后HTTP404；两个测试服务已退出0。
详见 [本轮修复与验收记录](docs/verification/official-sidebar-markdown/PR61-FOLLOWUP.md)。

仍在 `feat/official-sidebar-markdown` / [草稿 PR #61](https://github.com/benz-ai-x/dsh-md-preview/pull/61)。
#60 真实浏览器矩阵未完成，未合并或发布，相关 Issue 保持打开。
此前3196实例为插件 alpha.2；未来验收前先核对现场并安装 alpha.4 同一归档。
命令显式设置 `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness-md-guard`；
本轮未修改 Harness、lock、用户实例或已有技能/流水线改动。

## 2026-09-09 较早快照：修复 PR #61 的3项复查问题

用户要求修复旧导航重放、保存确认缺失和变化提示遗漏。修复代码提交 `dff7f62`，
开发候选升级为 `0.11.0-alpha.3`；公开 Slot 装配逐项 RED→GREEN，完整 verify 退出0：
138项strict、16文件193测试、类型检查、双端构建、6项产物检查全部通过。
同一 alpha.3 tarball 的干净 profile 安装、配置组合/覆盖、普通导入、启动、资源服务和移除通过，
两个测试服务退出0；详见 [修复与验收记录](docs/verification/official-sidebar-markdown/PR61-FIXES.md)。

修改仍在 `feat/official-sidebar-markdown` / [草稿 PR #61](https://github.com/benz-ai-x/dsh-md-preview/pull/61)。
#60 真实浏览器验收仍待连接恢复，未合并或发布，相关 Issue 保持打开。
原3196验收实例仍是 alpha.2；继续页面验收前安装本次 alpha.3 归档。
命令仍需显式设置 `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness-md-guard`。
用户既有技能、Agent 和流水线文件改动保留。

## 2026-09-09 较早快照：按 TDD 开发 Markdown 核心迁移

用户已明确授权开发 #54、#55、#56、#59、#60。插件开发分支为
`feat/official-sidebar-markdown`，保留了开始前已有的文档、技能和流水线文件改动。

- #54：lock 与依赖已对齐 `0.1.5-alpha.1` / `5dda764ed3aa172535a7967b06ff95d9cbfe536a`。
  `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness pnpm verify` 退出 0：
  strict 123/123、26 文件 / 290 测试、类型检查与双端构建通过。旧 `openDetails` 只出现在
  测试装配，已改用新版公开布局操作；本结果不代表原生编辑迁移验收完成。
- #55：上游补丁在 `/Users/pc2026/DSH-Space/deepseek-harness-md-guard` 的
  `feat/sidebar-tab-close-guard` 分支开发；原用户 Harness 检出和运行实例保留。
  补丁已提交为 `737e95c657a95fd04b12269313902f9b5ca2f6ca`，并导出到 `patches/`。
  GUI 测试 4730 通过 / 1 跳过；浏览器回放 346 通过 / 15 跳过；文档与 lint 通过，
  受影响 controller/store 定向覆盖率 100%。lock 和开发链接已指向该补丁，尚未上游发布。
- #56/#59：核心迁移和旧接线清理已实施，双语 README、契约、ADR-0007同步。
  最终完整verify退出0：138项strict、16文件190测试、类型检查、构建及6项产物检查。
- #60：`0.11.0-alpha.2` 同归档安装、配置、正常boot/public imports、资源HTTP200、移除后404、
  两次服务退出0已验证。摘要与完整日志见
  [本轮TDD](docs/verification/official-sidebar-markdown/TDD.md)。
  真实浏览器尚未验收：Chrome扩展连接连续超时，已请求打开对应配置的窗口后重试。
  独立web验收profile在 `/tmp/dsh-markdown-core-dev-20260909/accept-home`，服务端口3196，
  日志 `/tmp/dsh-markdown-core-dev-20260909/60-alpha2-visual-server.log`；原用户实例未操作。
- 后置搜索、阅读、#39和多格式保持原计划；不自动发布或将#60视为完成。

当前shell继承旧 `DSH_HARNESS_ROOT`；检查需显式使用新的补丁检出。
代码提交3c4c042；[草稿PR #61](https://github.com/benz-ai-x/dsh-md-preview/pull/61)已创建。
安装候选alpha.2已验证，真实页面待Browser恢复。尚未合并或发布。下方为历史快照，不恢复旧流水线。

## 2026-09-09 较早快照：官方右栏迁移 Issue 已就绪

用户最新要求：**先迁移已有 Markdown 预览和编辑，让插件在新 DSH 的官方右栏中可用，其他功能优先级放最后。**
本轮完成兼容初审与票集重排，尚未开始迁移代码、创建 PR 或操作运行实例。

- 母规格为 [#38](https://github.com/benz-ai-x/dsh-md-preview/issues/38)，已修订为
  官方右栏、会话标签和文件树承载文档；原多格式 #39–#53 的需求全部保留。
- 新增 [#54](https://github.com/benz-ai-x/dsh-md-preview/issues/54)–
  [#60](https://github.com/benz-ai-x/dsh-md-preview/issues/60)：基线、关闭守卫、
  Markdown 读写、搜索入口、阅读连续、清理与核心验收。
  母票共 22 张原生子票、34 条原生阻塞关系；当前唯一无阻塞功能入口为 #54。
- 首阶段顺序改为 **#54 → #55 → #56 → #59 → #60**。#59 只做 Markdown 默认切换和必要
  冲突接线清理，直接依赖 #56；#60 只验收已有 Markdown 的预览、编辑、保存/冲突、未保存
  保护及新版同归档安装/移除。搜索、独立大纲/阅读记录和 #39 均不阻塞首阶段。
- #57/#58 改为依赖 #60，#39 继续依赖 #57/#58；其他格式与对应验收沿原功能依赖后置。
  需求和已有代码保留，旧阅读数据不删除。当前布局仅做官方集成所需清理，不把全面重构当作可用门槛。
- #39 的 `2491a52` 与旧 7/7 勾选保留为历史代码/自动化证据，新增 4 项官方标签验收；
  移除暂停任务的 `in-progress`，仍为 OPEN、未合入 main。功能分支后的 `8ab313d`
  是暂停交接提交。不要把旧 YAML、worktree 路径或历史通过结果当作当前执行入口。
- 初审见 [兼容清单](docs/research/harness-0.1.5-alpha.1-compatibility-audit.md)。
  关键前置是官方关闭缺少可等待守卫；原生文本页不等于编辑原始全文；插件保存要进入
  原生文件变化链路。隐藏/切换仍存活的标签不等于关闭，不应丢草稿、已读内容或 HTML 状态。

当前插件路径为 `/Users/pc2026/DSH-Space/dsh-md-preview`，main 仍在 `ae58cd4`；
用户指定 Harness 为 `/Users/pc2026/DSH-Space/deepseek-harness`，
`0.1.5-alpha.1` / `5dda764ed3aa172535a7967b06ff95d9cbfe536a`。
当前进程继承的 `DSH_HARNESS_ROOT` 仍指向已失效的 Dev-Space 路径，因此不带覆盖的
strict 退出 1（源码不存在）；显式指定上述新目录后退出 1（版本、commit、文档摘要
3 项不匹配），构建入口和新鲜度检查通过。lock、依赖和全局环境均未修改。
完整环境事实见 [长期交接](docs/HANDOVER.md#本机环境事实2026-09-09)。

本轮只更新 Issue 与文档；没有新功能验证或发布。Issue 正文、标签、打开状态、原生父子
与阻塞关系已回读核对，Markdown 和 `git diff --check` 通过；strict 的真实失败如上。
开始代码开发时先核对 Git/GitHub，再从 #54 处理基线，不继续旧独立面板方案。

## 2026-09-09 较早快照：开发暂停时

以下保留暂停时的现场、路径和通过记录；当前方向及检查结果以上方最新交接为准。

用户最新指示：先写交接文档，Harness 版本更新对插件影响较大，开发暂停。
暂停功能开发、PR 创建、评审、合并和安装验收；恢复前先明确新 Harness 的兼容性与基线迁移。
本次只保存现场和证据，没有升级插件依赖或修改固定基线。

**收尾环境变化**：下文两个 Harness 目录在读取版本和完成检查之后均已不存在。
显式旧基线 strict 再次执行时退出 1，原因是固定源码路径缺失。新位置尚未确认；
本次没有恢复目录或重新安装。以下版本、提交和通过结果均为路径失效前的实测快照。

### 代码与工作区

- 原工作区：`/Users/pc2026/Dev-Space/dsh-md-preview`，`main` 位于
  `ae58cd4d3cfeec7b745f692cda502f66916e58ad`。既有文档、ADR 和技能安装改动保留，
  不要执行整体 reset、clean 或把这些改动全部提交。
- 功能 worktree：`/Users/pc2026/Dev-Space/dsh-md-preview-batch-1-readonly-text`，
  分支 `feat/batch-1-readonly-text`。功能提交
  [`2491a52`](https://github.com/benz-ai-x/dsh-md-preview/commit/2491a52aaa991d57d5037e60f2dfc7598910b5f6)
  已推送，尚未合入 main。
- [#39](https://github.com/benz-ai-x/dsh-md-preview/issues/39) 的 7/7 代码验收项已勾选，
  Issue 仍为 OPEN、保留 `in-progress`。**尚未创建 PR，尚未进行独立评审。**
  PR-1 是规划编号，不是 GitHub PR 编号。
- 批次状态 `PIPELINE_STATE.yaml`（当前为失效链接） 的实际文件位于功能 worktree；原工作区的 YAML
  与 JSONL 是指向该处的软链接。保留 worktree；不要删除它而留下失效入口。
  PR-1 保留 `developing` 枚举，用户暂停记录在恢复注记中；它不表示仍在后台开发。
- [#36](https://github.com/benz-ai-x/dsh-md-preview/issues/36)、
  [#37](https://github.com/benz-ai-x/dsh-md-preview/issues/37) 实测均为 CLOSED。
  历史走查中的未覆盖场景仍按原记录保留，不改写为新验收证据。

### 已完成的 #39

既有浏览、搜索、产出 chip、预览动作和当前回合产出入口可打开 UTF-8 文本，含
`Dockerfile`、`Makefile` 和未知扩展名。Host 使用有界 `streamText`，负责会话、
路径范围、常规文件、文本判定和 UTF-8 字节限额，返回独立的 `kind` / `editable`。
新增文本只读；Markdown 按配置保留编辑、冲突处理和保存后重读。

查看脸提供内容刷新及 Alt-R；外部变化或重复选择当前目标不自动重读。成功打开即记入
最近阅读，无需先滚动；沿用共享未保存守卫、取消传播和迟到结果隔离。
`previewExtensions` 保留为已弃用的配置兼容字段，不再限制或扩大文本准入；
`allowedExtensions` 与 `.md` / `.markdown` 取交集，不能为新增文本开放写入。

JSON、XML、JSONL 当前仍显示原文；高亮、格式化、分段、图片、音视频、PDF、HTML
均未因 #39 完成而交付。代码与文档已同步，真实浏览器验收未完成。

### 新旧 Harness 基线

| 对象 | 本次核对事实 | 验证结论 |
| --- | --- | --- |
| 插件 lock 与已验证基线 | `0.1.2-rc.1`，`a66e4702047846cdaa10c66c9d3df3951f5ea70d` | strict 123/123，通过 |
| 独立旧基线目录 | `/Users/pc2026/Dev-Space/deepseek-harness-md-preview-baseline` | 此前完成 lib/web 构建；收尾时目录已不存在 |
| 默认 Harness 目录 | `/Users/pc2026/Dev-Space/deepseek-harness` | 此前读取到新版本；收尾时目录已不存在 |
| 本机新检出快照 | `0.1.5-alpha.1`，`5dda764ed3aa172535a7967b06ff95d9cbfe536a` | 读取时工作树干净；兼容性尚未评估 |

`DSH_HARNESS_ROOT` 默认仍指向普通 `deepseek-harness` 目录。新检出下实际运行 strict
退出 1，**3 项不匹配：版本、commit、文档摘要**；不是此前 alpha.2 的 35 项失败。
这是相对旧 lock 的检查结果，不能单凭这三项判断运行兼容或不兼容。
本次没有改 lock、依赖、摘要或执行 `context:link`。

以下是已完成验证使用的命令，当前目录缺失，不能直接续跑；恢复时先定位或准备正确检出：

```sh
cd /Users/pc2026/Dev-Space/dsh-md-preview-batch-1-readonly-text
DSH_HARNESS_ROOT=/Users/pc2026/Dev-Space/deepseek-harness-md-preview-baseline pnpm verify
```

新版本评估优先核对：文件服务的 `FsTarget`、流读取、取消和写入权威；会话与产出事实；
Typert/Remote 描述符与 codec；Client 插件入口、模块加载及构建 external；
SlotRegistry/AppFrame、主题 primitives 与 [ADR-0004](docs/adr/0004-dock-preview-beside-the-harness-frame.md)
的停靠边界。以上是待核对接缝，尚未断言新版本具体变更。
先形成兼容差异与迁移方案，再更新依赖、基线契约及测试，不能仅改 lock 使 strict 通过。

### 验证与未完成验收

- 提交 `2491a52` 的完整 `pnpm verify` 退出 0：strict **123/123**、
  **26 个文件 / 338 项测试**、类型检查、构建和 **6 项产物检查**全部通过。
  原始日志和退出码已保存在[本轮证据](docs/verification/batch-1-readonly-text/WALKTHROUGH.md)。
- `pnpm pack:publishable` 退出 0，生成本地候选包，manifest 净化检查通过。
  候选仍标记 `0.10.0`，含未发布改动，与已发布的同版本包不是同一归档。
  **未完成该候选的安装、普通包名导入、实际资源服务或移除验证。**
- Chrome 控制连接两次超时；诊断通过后曾请求允许打开 Profile 5 空白窗口，未收到批准。
  该恢复动作随开发暂停；没有打开窗口，没有取得新的截图或浏览器验收证据。
- 本次临时实例端口 3291、PID 75947 已发送 SIGTERM 并确认退出。样例与未执行的
  安装包烟测脚本保留在 `/tmp/dsh-md-preview-pr1-CbxfUG`，临时目录不保证长期存在。
  启动 URL 含临时认证信息，不写入仓库；恢复测试时重新启动并取得新 URL。
- 用户原有 `r3-accept` / 3185 / tmux `dsh-r3` 本次未重启、未升级。
  恢复操作前重新核对实例；不要把旧记录当作当前运行事实。

### 恢复顺序与已确认范围

1. 先确认用户恢复开发及目标 Harness 版本，对比新旧检出与插件接缝，重新评估批次计划。
2. 核对 Git / GitHub 实际状态并保留 #39 提交；必要的基线迁移独立记录，不自动重跑旧流水线。
3. 在确认的基线上补完整验证、同归档安装验收、真实浏览器证据和独立双轴评审，再处理 PR。
4. 原规划为 6 PR / 4 层：#39 → #40/#41 → #45 → 并行的 #42/#43/#44、#46/#47、#48/#49。
   #40–#49 均未开工；额外的调度顺序不是新增 GitHub 依赖。详细规划以 YAML 为准。
5. 母 [Spec #38](https://github.com/benz-ai-x/dsh-md-preview/issues/38) 和验收 #50–#53 均保持 OPEN。
   未进行 npm 发布、GitHub Release 或新标签操作。

需求继续以 #38 为准：总体目标是预览各种文档，“简单优先”不是原则。
JSON/XML 必须真正格式化美化；JSONL 按记录展示；大文本按需继续读取，检测到变化
（包括追加）后暂停并提示从头刷新。HTML 是隔离的内嵌浏览器，支持页面脚本、正常联网
和工作区内关联资源；外部网站新标签打开。新增类型只读，保留 Markdown 编辑，Office 排除。

## 2026-09-08 历史快照

以下保留原会话记录；当前分支、实例和续跑位置以上方 2026-09-09 交接为准。

会话快照：2026-09-08。持久开发、发布流程与本机环境见
[docs/HANDOVER.md](docs/HANDOVER.md)，当前任务状态见 [TODO.md](TODO.md)。

## 接手状态

- 当前开发分支为 `main`；**v0.10.0 已发布到 npm 与 GitHub**，发布提交 `9016f87`。
  [发布验证](docs/verification/releases/v0.10.0/WALKTHROUGH.md) 记录了 290 项测试、
  同一归档的干净 profile 冒烟，以及 npm/GitHub 摘要核对。
- 文档侧边栏与 A/B 图标反馈已落地：会话头部回形针开合工作区文档，面板右上 × 关闭，
  保留未保存守卫。此前旧分支合并、0.7.3 待发布及 round-2 等待反馈的现场记录已过期；
  历史过程查 Git，不能再作为当前任务的阻塞条件。
- 人工验收沿用 `r3-accept`，入口 `http://127.0.0.1:3185/`，tmux `dsh-r3`，
  已安装 npm 精确版本 0.10.0。启动图、client 文件与资源已核验；不要从旧快照推断
  其他端口的版本或重启目标。

## 本轮文档同步

- 已完成中英文 README、长期交接、项目契约、词汇表及历史记录入口的更新，说明
  当前侧边栏、编辑守卫、搜索配置和发布流程，并区分历史构建证据与当前待办。
- [AGENTS.md](AGENTS.md) 已补齐接手顺序、开发约束、验证交付及文档维护规则；
  [CLAUDE.md](CLAUDE.md) 保留 `@AGENTS.md` 引用和未展开引用时的读取说明。
  本次进一步同步 TODO 与本快照，共享规则继续只维护在 AGENTS。
- 本轮 **14 份 Markdown** 以 `Refresh v0.10.0 documentation and agent guidance`
  文档提交归档。接手时先检查 `git status --short --branch`，按实际 Git 状态继续工作。
  版本仍为 0.10.0，本轮没有新标签、npm 发布或服务重启。
- 文档检查已通过：123 项 strict 基线检查、Markdown 解析与仓库内链接、命令和配置
  示例核对、`git diff --check`。本轮未重跑运行时测试；上文 290 项测试和安装包冒烟
  属于 v0.10.0 发布记录，不能用来关闭尚未完成的视觉验收。

## 仍待处理

1. UX-12：补真实浏览器的浅/深主题、中/英文、宽度边界、缩放和完整阅读链路证据。
   最近一次自动化浏览器连接超时，资源 HTTP 检查不能代替视觉验收。
2. [截图反馈 F-03–F-08](docs/research/sidebar-screenshot-feedback.md)：顶栏对齐、
   操作分组、排版核验、文档测试残留核查、拖动提示和长文档体验，均未实施。
3. HMR、Mermaid 暗色等长期项，以及需复核的历史评审 follow-up，见 TODO 与
   [PIPELINE_STATE.md](PIPELINE_STATE.md)。批次 #20–#32 已完成，不需要续跑旧 PR 流程。

继续开发前按 [AGENTS.md](AGENTS.md) 阅读契约与基线并运行
`pnpm context:check:strict`。后续用户指示更新本快照；不要把一次会话的现场条件当成永久约束。
