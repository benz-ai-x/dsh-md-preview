# 官方右栏 Markdown 迁移 — TDD 记录

日期：2026-09-09。范围：#54 → #55 → #56 → #59 → #60。
用户已授权按这些 Issue 与 `tdd` 技能实施；搜索、独立大纲/持久阅读及其他格式后置。

## 测试边界

沿用用户已确认的 Spec #38 和本轮子票中的公开边界：

- Client 装配：真实注册、locale、SlotRegistry、官方文件打开/标签关闭，Remote 为外部服务边界。
- Harness 官方标签服务：通过公开打开、关闭、替换及生命周期观察验证守卫，覆盖实际 UI 关闭入口。
- Host 文件与 Remote：显式会话、精确原文读写、版本冲突、文件变化通知、取消与 codec。
- #60：实际浏览器用户操作及同一 tarball 的干净 profile 安装、运行、资源服务与移除。

新增行为逐个执行红→绿，不一次性铺满测试；不以内部组件、类名或私有调用顺序作为新验收。
已有行为测试在所属入口迁移时同步调整，已后置能力保留代码和历史证据。

## #54 — 基线与现有装配

- 修改前 strict：显式指定用户提供的新检出，实际退出 1；版本、commit、文档摘要 3 项不同。
  源码干净、构建入口和新鲜度检查通过。
- 现有原生 frame 装配红：目标场景退出 1，`openDetails` 已删除，同时报告未处理异常。
- 最小修正：同一原生右栏交互改用公开 `setRightbar` / `openRightbar`，保留原用户动作与释放断言。
- 依赖：目标 Harness 开发依赖及 Typert peer 使用已发布 `0.1.5-alpha.1`；固定源码为
  `5dda764ed3aa172535a7967b06ff95d9cbfe536a`，摘要按当前完整 docs 内容重新计算。
- 绿与完整验证：`DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness pnpm verify`
  实际退出 0；strict 123/123，26 个测试文件共 290 个测试通过，类型检查、双端构建及
  6 项产物新鲜度检查通过。日志：`/tmp/dsh-markdown-core-dev-20260909/54-verify.log`。

## #55 — 官方标签删除守卫（上游补丁，尚未发布）

独立 worktree：`../deepseek-harness-md-guard`，分支 `feat/sidebar-tab-close-guard`。
补丁以 #54 的官方检出为起点，原始检出与用户运行实例保留。

- 关闭等待红→绿：公开 `beforeClose` 缺失，补入注册及布局提交前判断后通过。
- 干净标签红→绿：首次实现把同步允许变成异步，修正为立即提交；拒绝替换保持整份布局。
- 并发红→绿：重复关闭产生 3 次询问，修正为每个会话保留第一个待决删除；等待期间新导航和
  右栏隐藏不被迟到提交覆盖。
- 所有者释放红→绿：为请求提供取消信号，释放后拒绝迟到授权，并允许后继注册正常处理。
- 原生关闭按钮与强制卸载红→绿：卸载最初没有取消等待，补齐取消、记录 abort 和自有工作停稳。
- 异常红→绿：守卫抛错最初传播到 UI，修正为保留标签并允许后续重试；拒绝 Promise 同样保留。
- 现有执行路径回归：菜单关闭、浮窗关闭、记录自身关闭、资源替换和页面替换 5 项通过。
  当前无批量关闭或独立关闭窗格入口；删除标签导致的容器收尾与所有存储删除经过同一判断。
- `pnpm run test:gui` 退出 0：337 文件，4730 通过 / 1 跳过。
- Host/Client 构建与类型检查通过；`pnpm run test:docs` 16/16、`pnpm run doc-sync` 34/34，
  `pnpm run lint:contracts-ready` 退出 0。
- `DSH_SNAPSHOT=replay pnpm run test:web` 退出 0：97 文件通过 / 1 跳过，346 测试通过 / 15 跳过。
- 最终定向覆盖率退出 0：9 文件 / 136 测试；修改的 controller/store 达到 100% 语句、分支、函数与行覆盖。
  GUI 全量结果来自增加最后两条回归之前，未将 4730 偷换为另一个全量测试数。
- 补丁提交 `737e95c657a95fd04b12269313902f9b5ca2f6ca`；可审查补丁保存在
  [harness-sidebar-close-guard.patch](../../../patches/harness-sidebar-close-guard.patch)。未发布或推送到上游。
- 本地强制重新生成 Host/Client 类型后，`context:link` 退出 0，139 项严格检查通过。
  固定 lock 与源码开发链接指向该补丁检出；不声称官方 npm 的同版本已包含守卫。

## #56 — Markdown 原生标签与 Host 边界

截至 2026-09-09 16:35，核心客户端装配 23 项通过，相关 Host 5 文件 / 66 项通过；
最近一次客户端类型检查通过。整仓 verify 与真实浏览器/安装验收尚未完成。

实际红→绿日志位于 `/tmp/dsh-markdown-core-dev-20260909/`，前缀对应行为：

- `56-native-open`：原生资源落到 Markdown body，使用平台 MarkdownText。
- `56-tab-life` / `56-save` / `56-draft-history`：标签记录保存正文、草稿及编辑器 JSON 撤销历史；完整原文按指纹保存并重读。
- `56-leave-first` / `56-saving-close` / `56-refresh` / `56-saving-edit`：统一离开意图、保存后再关闭、隐藏草稿刷新提醒、保存时冻结输入。
- `56-conflict` / `56-save-read-failure` / `56-write-failure`：冲突覆盖、已保存但重读失败的区分、写入失败与重试。
- `56-line-endings`：CRLF 红→绿；LF、无末尾换行、空文件及未修改保存同时回归通过。
- `56-find` / `56-line-nav` / `56-preview-line`：文内查找，新 navigation 的源码行定位，预览对应章节与源码行入口。
- `56-rich-markdown`：GFM、表格、数学和代码块通过真实平台渲染；真实 Mermaid 对无效语法保留源码。有效图表视觉由 #60 验证。
- `56-readonly-limit` / `56-resource-change`：超限转原生只读查看，Host 变化仅提示而不强刷正文。
- `56-read-version` / `56-markdown-authority` / `56-read-bytes` / `56-write-bytes`：读后版本检查、Markdown 写入资格、UTF-8 字节上限。
- `56-observation` / `56-symlink` / `56-write-target`：公开观察事件、最终路径链接拒绝、写前可检测目标变化拒绝。

多会话同名文件、迟到读取、原生变化流、失败/取消无成功观察，以及越界/失效链接是已有保护的回归通过，
没有将这些绿色回归写成新的红→绿。原生 × 守卫的第一版测试点错了初始 guide 的关闭按钮；
改为通过公开 active() 取得文档标签后通过，见 `56-close-integration-green.log`。
测试环境另修复了源码链接产物的 Node 装配、重复 React，以及 CodeMirror 查找事件模拟，环境失败不算功能红灯。

## #59 — 退出旧接线

修改前严格检查退出 0：138 项、0 警告，固定补丁检出未放宽；日志 `59-before-strict.log`。
`59-native-ownership` 红→绿切换正在推进：旧全局 target、独立 overlay、重复产出行及工作区 header toggle
从 mount 退出；保留的消息动作改走官方 fileAddressFor/openResource。仍需清理失效代码/样式、迁移旧测试、
同步用户文档、完整 verify，再进入 #60 的真实环境验收。


## 当前自动化结论（2026-09-09）

- 最终完整 `pnpm verify` 退出 0：138 项 strict、16 文件 / 185 测试、类型检查、双端构建、
  6 项产物检查。见 [verify.log](verify.log)。
- 旧 overlay、frame 适配、header toggle、重复树/产出接管和全局单目标已退出运行图。
  已删除被替代的 UI 组件及对应旧控件测试；保留纯阅读、偏好、大纲、产出推导和 Host 搜索测试。
  数量从旧版290降至185是此次范围收敛，不能解读为已恢复所有旧功能。
- 新原生装配26项覆盖核心 Markdown 行为及卸载；消息级入口3项，激活/回滚2项，
  Mermaid外部渲染边界4项。旧界面功能由真实官方服务和 Slot 装配接管。
- `59-native-ownership` 红→绿：停止旧 turnTail/header 接管。
  `59-unload` 红→绿：按挂载释放样式，Remote disposer 幂等。
  `59-reload` 红→绿：重复 Reload 在同一 loading 状态合并，避免并发旧读取覆盖。
  第一版 RED 的夹具遗漏一个 pending resolver，已修正并重新确认实际两次读取的 RED。
- `59-capability` 红→绿：缺少公开 beforeClose 时，在 UI 注册前明确拒绝并回滚。
  第一次失败报告包含 Vitest 对意外成功结果的格式化错误；行为问题是本应拒绝的激活成功。
- 全量装配第一次失败源于新版 TestSessions 夹具的 cwd 应置于 summary，实际文件地址工具正确；
  修正夹具后绝对/相对入口聚合通过，不将夹具修正写成产品缺陷。
- 删除旧正文组件后版本字面量被摇树移除，产物 gate 正确失败；版本改为正文 DOM 的构建标识，
  未放宽检查。完整构建先清生成目录，归档不含已删除源码的残留声明。
- README 双语、契约、词汇表及 ADR-0007 说明当前/后置边界。旧 ADR-0004 和旧版本证据保留为历史。

## #60 — 同归档安装通过，真实页面待恢复浏览器连接

候选 `0.11.0-alpha.1`；Harness 精确提交如上。未正式发布。
完整 verify 后 `pnpm pack:publishable` 退出 0；此后未重新打包。
归档 SHA-256 见 [SHA256SUMS](SHA256SUMS)，实际结果见 [packed-smoke.json](packed-smoke.json)。

- 35 项归档文件，公开 exports 均存在，无 devDependencies/link:/workspace:/source map，
  lazy-CJS factory 正常；无旧 PreviewOverlay/panel-dock/use-preview-session 等声明。
- 同一归档离线安装到全新 `/tmp/mdpreview-0110-smoke-EAUxA9/profiles/web`，安装 client 与归档逐字节一致。
- 正常 shipped web profile boot（补丁 Harness 的正常 CLI）后，普通包名 Host/Remote 导入成功；
  未使用测试别名、源码路径导入插件或私有 Host bootstrap。
- 配置包含插件，启动图54项，客户端资源HTTP 200；移除后53项，原资源HTTP 404。
  两次SIGTERM退出0。实际脚本快照见 [packed-smoke.mjs](packed-smoke.mjs)，本机路径明确写在快照中。
- 同归档另装于独立浏览器验收 profile。对既有 md-preview 行的整份 config 覆盖组合通过 dump-config，
  maxBytes4096、仅.md可编辑、搜索3/4/2等值保留；未套用用户实例配置。
- 独立验收服务 `/tmp/dsh-markdown-core-dev-20260909/accept-home`，web profile，3196端口；
  启动日志保存在该临时目录的上级 `60-visual-server.log`。原用户实例与配置不变。

浏览器：已检测 Chrome 153.0.8010.36，扩展已安装启用，native-host配置检查通过。
Browser连接命令连续超时；已按恢复规则请求打开对应Chrome配置的空白窗口。
没有将此状态报告为真实页面通过，也没有用外部脚本绕过连接恢复限制。

尚未取得本次候选的真实浏览器证据：宽/窄、左右栏组合、浅/深、中/英、100/125/200%缩放，
实际树/聊天/工具行号/chip入口、有效Mermaid、分栏/浮动、编辑保存与原生关闭/替换矩阵。
自动化对行尾、会话隔离、失败/冲突及迟到结果的验证不替代这些实际页面证据。
#60 保持打开，#57/#58/#39及其他格式不启动；最终人工验收与发布也未执行。
