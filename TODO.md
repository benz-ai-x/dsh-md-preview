# TODO — dsh-md-preview

## 已完成

- [x] 契约确立（PROJECT_CONTRACT.md）：overlay 面板 + 双入口，Host Remote 读权威
- [x] 项目骨架：package.json（dsh.client manifest、exports、bundle patch）、tsconfig、tsdown 双 face（host ESM + client lazy-CJS factory，装饰器降级插件见 scripts/build-plugins.ts）
- [x] Host 半：`MdPreviewService.read`（工作区限域、扩展名白名单、字节上限、取消传播、稳定失败码）
- [x] Remote contribution：手工描述符 + zod codecs（goals 直连调用约定）
- [x] Client 半：mount 生命周期（$mount → ctx.inject，失败回滚）、shell.overlay 面板、turnTail chain 接管、assistant-actions 按钮、zh/en 词条
- [x] 测试（32 项全绿）：host 读取权威、contribution 不变量、注册生命周期（真实 SlotRegistry/LocaleRuntime，含回滚与 owner 塌缩）
- [x] `pnpm verify` 全链路通过（context:strict + typecheck + test + build + built:check）
- [x] 真实 Loader/profile：`dsh plugin --profile web add` 落行（`--dump-config` 可见）；Web profile 带插件启动成功；boot graph 含 `dsh-md-preview/client.js` 行（inject 边正确）；`/plugins` 路由 200 提供工厂 bundle

## 待办

- [ ] HMR 验证：`pnpm watch:client` + 浏览器 bundle 热替换
- [x] packed-artifact 冒烟（发布前置条件）→ 已通过，见下节
- [ ] 评估：正文内联 `.md` 文件提及（chatFileMentions 仍归 ui-deliverables 所有）是否值得提供包装层
- [ ] 用户环境已知问题：web profile 中第三方插件 `@benz-ai-x/dsh-client-ui-session-graph`（link 自 ~/Dev-Space/dsh-session-graph）自身依赖缺失，会在插件树加载时 fail-loud；与本插件无关，需在源项目修复或禁用该行。根因（2026-09-06 实查）：其 lib import `@deepseek-ai/dsh-llm` 但 package.json 未声明；临时绕过 = 启动时带一次性 `--patch` 禁用该行（见 0.6.0 发布节）

## 发布 0.1.0（2026-09-01）

- [x] 改名 `dsh-md-preview` → `@benz-ai-x/dsh-md-preview`：无 scope 名在 npm 已被他人
      （eaglewong/manibookmark，2026-08-17）占用。联动更新：boot graph 以包名为主键
      （`ClientBundleRegistration.id` 必须 = npm 包名）→ tsdown banner id、typert
      contribution `package`/descriptor id/typeSymbol、cordis.patch.yml 行、两个 verify
      脚本、README、测试断言同步
- [x] peerDependencies 5 个 `@deepseek-ai/dsh-*`：`0.1.2-alpha.1` → `0.1.2-alpha.3`
      （与锁定基线一致，npm 均已存在）；`dsh.client.inject` 统一为 scoped 包名
- [x] 发布元数据：去 `private`，加 publishConfig(public)/repository/license/keywords；
      context gate 翻转断言（`private === undefined` + `publishConfig.access === 'public'`）
- [x] `scripts/pack.mjs`：打包/发布用净化 manifest（删 `link:` devDependencies，工作区
      manifest 事后逐字节还原）+ tarball 内 manifest 复检（无 devDeps、无 link:/workspace:）；
      `pnpm pack:publishable` / `pnpm publish:registry`
- [x] packed-artifact 冒烟（全新 profile，基线全部走 npm registry）：
      `web-app@0.1.2-alpha.3` + 本 tarball 安装 → reconcile 识别 `dsh.bundle` →
      `--dump-config` 含 md-preview 行 → 启动零告警 → boot graph entry 以新包名为主键、
      inject 边 scoped → `/plugins` combo 路由 200 提供工厂 bundle（180.6kB，banner id
      正确）→ SIGINT 干净退出 → remove 往返干净（依赖/层/行全消失）
- [x] 发布：`@benz-ai-x/dsh-md-preview@0.1.0` 已上线
      https://www.npmjs.com/package/@benz-ai-x/dsh-md-preview
      （2FA 走 tmux 真终端 + 浏览器授权完成；tarball 49.6kB / 22 files）
- [x] web profile 切换到发布包：旧 `dsh-md-preview` link 行移除，改为
      `@benz-ai-x/dsh-md-preview@^0.1.0`（npm 源），`--dump-config` 复核通过
- 备注：pnpm 11 supply-chain 策略会给刚发布的包记 `minimumReleaseAgeExclude`
      （新鲜度门槛），其它 profile 安装新发布的版本时可能遇到同类提示，属预期行为

## 发布 0.1.1（2026-09-01）

- [x] 内容 = 0.1.0 + 重写后的 README（npm 包页 README 取自最新 tarball，故补发）；
      代码零变化。发布流程同 0.1.0（净化 manifest + tmux 真终端浏览器授权）

## 编辑功能（2026-09-01，目标 0.2.0）

- [x] 设计（bounded，用户批准）：CodeMirror 6 编辑器 + 乐观锁保存；冲突提示
      （重新加载/强制覆盖）；未保存关闭守卫；仅编辑已存在文件
- [x] 关键发现：harness fs 服务自带并发写入机制 —— `stat().version` 即新鲜度
      令牌（FsVersion），`writeText(target, content, {kind:'replaceIfVersion',
      version})` 原子守卫，过期抛 FS_STALE_VERSION → 映射 `md-preview/conflict`；
      force = 省略 intent（无条件覆盖）。无需自造指纹
- [x] Host（TDD）：read 结果带 fingerprint；write 全套权威测试（12 项：限域/
      白名单/上限/冲突/force/取消/IO 映射）
- [x] Contribution（TDD）：write 描述符 + codecs（fingerprint/force 可选参数）
- [x] Client（TDD，jsdom 真渲染 CodeMirror）：编辑进入/保存指纹传递/冲突往返/
      未保存守卫/取消丢弃（5 项）；vitest include 扩展 .tsx；react 单副本别名
      （harness 18.3.1 vs 项目 18.2 双 React 导致 invalid hook call）
- [x] 体积攻坚：basicSetup+markdown() 默认配置 = 1354 kB（language-data 全目录
      内联）→ 精选扩展 + `@lezer/markdown` 直组 GFM 语法（绕开 lang-markdown
      静态拖入 lang-html→css/js/autocomplete，888 kB）→ 对齐 harness `minify:
      true`（最终 **402 kB** minified，gzip ~100 kB）；verify-built 兼容反引号 id
- [x] `pnpm verify` 全绿：context 123 + typecheck + **52/52 测试** + build +
      built:check
- [x] 文档同步：PROJECT_CONTRACT（写权威、conflict 码、验收断言、已知限制）、
      README（编辑效果、失败码表、结构表）、本 TODO
- [x] 0.2.0 发布（2026-09-01）：packed 冒烟通过（干净 profile 装tarball → dump 行 →
      启动零告警 → boot graph entry → /plugins 411 kB 工厂 bundle → 会话清理）；
      npm 发布（web 授权前两次因未及时点授权超时 404，第三次完成）；web profile
      升级 `^0.2.0`
- [x] 浏览器端到端走查（0.6.0 发布日自动化完成 2.5/4 路径，2026-09-06）：
      编辑 → 修改草稿 → 保存 ✓（落盘 + 「✓ 已保存」toast + 渲染脸回显新列表项）；
      外部并发修改后再保存 → 冲突条 ✓（「文件已在别处被修改」+ 重新加载/强制覆盖
      两按钮，Playwright 快照留档本地 .playwright-mcp/（gitignore：快照含用户
      会话侧栏与文档正文等非仓库内容，不入公开仓库)）；强制覆盖与重新加载两下点击
      因用户同时手动操作面板导航走目标而未点成（目标切换按设计全量重置冲突态），
      这两分支已有 jsdom 面板测试覆盖，留待下次真实使用顺手补点

## 保存反馈（2026-09-01，0.2.1）

- [x] 用户反馈「点了保存没反应」→ 两个根因：成功无提示；非冲突失败被静默吞掉
      （save handler 只有 ok / conflict 两分支）
- [x] 修复（TDD，54/54）：成功 → 面板内「✓ 已保存」toast（2 秒淡出，role=status，
      卸载清定时器）；非冲突失败 → 持久错误条（`保存失败 · md-preview/<code>` + 重试）
- [x] 词条 zh/en 同步；README 效果节更新
- [x] 发布 0.2.1：冒烟通过（boot graph + bundle 含 panel.saved 词条）→ npm
      `latest` → web profile 升级 `^0.2.1` 并重启（3080，零告警）
- [x] 用户实报错误条 `md-preview/unavailable — file access denied under
      workspace-write mode` → 根因：沙箱后端对未传策略的 writeText 按全局
      standing root 拦截（非会话工作区）。修复：write 显式传 per-call
      `SandboxExecutionPolicy = { mode: 'workspace-write', workspaceRoot:
      会话 cwd, sessionId }`（tool-fs 同惯例）；`FS_SANDBOX_DENIED` 映射
      `md-preview/forbidden`；`@deepseek-ai/dsh-sandbox` 仅 type-only 依赖
      （host bundle 无运行时引用）。0.2.2 发布（55/55 测试）

## 面板版本号（2026-09-01，0.2.3）

- [x] 面板标题旁显示 `v<version>` 弱化小字；版本取自 package.json，
      tsdown 客户端 face `define` 注入完整 v 前缀标签（vitest define 镜像供测试）；
      verify-built 新增门：bundle 必须内嵌当前版本字面量。56/56 测试

## 架构深化两连（2026-09-01，0.2.7 / 0.3.0）

- [x] 架构走查（子代理新鲜视角 + HTML 报告四候选）+ grilling 定案：
      两个 Strong 落地，候选 3（classifyProduced 收拢）/候选 4（线契约 zod 单源）留观
- [x] **0.2.7 · resolveWorkspaceTarget**：read/write 逐字平行的九步权威前置
      （各占方法体 ~50%）归一为私有深模块；pass-through 的旧 helper 删除；
      测试归一（tests/host-harness.ts 共享工厂 + host-authority.spec 表驱动
      read×write ×九失败）；59/59。纯重构，发布链完整
- [x] **0.3.0 · PreviewSession 机器**：走查实证的散落重置 bug（保存中切换目标 →
      `saving` 永久卡死；换目标 2 秒内闪上一份的已保存 toast）先以红测试证死，
      再抽 `src/client/preview-session.ts` 纯 reducer（READ_STARTED=新目标唯一
      全量重置；RETRY_READ=同目标刷新、toast 存活）+ `use-preview-session.ts`
      效果适配器（RPC/abort/toast 计时/一次性 close）；PreviewOverlay 只剩
      渲染+几何+词条，死 wasOpen 删除；红测试转绿
- 0.2.7 发布时自防御门当场拦下一次 bump 后未重建的陈旧 lib（0.2.4 教训闭环）

## 0.2.4 坏包事故与修复（2026-09-01，0.2.5）

- [x] 现象：页面显示 v0.2.3，用户质疑是否发布。实查：registry 上 0.2.4 的
      manifest=0.2.4 但 client.js 是 0.2.3 旧构建（宽度改动也缺失）
- [x] 根因链：拖拽测试的 pointerup 处理器在 jsdom 抛
      `hasPointerCapture is not a function`（未捕获异常）→ 测试断言全过但
      vitest 退出 1 → `pnpm verify` 在 build 之前失败 → lib 停留旧版 →
      而我外层 `pnpm verify | grep | head` 管道吞掉了非零退出码 →
      pack/publish 带着旧 lib 静默发布
- [x] 修复：pointerup 的指针捕获释放改为 best-effort try/catch（与
      pointerDown 的容错一致）；pack.mjs 打包前强制运行 verify-built
      （版本内嵌 + 新鲜度自防御门，不再依赖外层 shell 链）
- [x] 0.2.4 在 npm 上 deprecate 标注；教训：verify 输出经管道过滤时必须
      `set -o pipefail`，发布路径必须自带门
- 宽度（500/1280）随 0.2.5 真正生效——0.2.4 里是旧的 440/960

## 浏览器端到端走查（2026-08-30，真实 LLM 回合）

- [x] profile 级 remove → re-add 往返：dump 中行消失/恢复
- [x] 新会话真实回合写入 `md-preview-验收测试.md` → turnTail chip 出现（📄 + 文件名 + "预览 <path>" title）
- [x] chip 点击 → 面板打开：h1「预览验收」/ h2「功能清单」/ 3 列表项 / 1 代码块全部渲染
- [x] 面板几何：右缘贴视口右边（2056/2056），宽 441px，停靠对话右侧
- [x] assistant-actions「预览文档」按钮：关闭后经按钮重开面板 ✓
- [x] 关闭行为：面板移除 ✓
- [x] 负向路径：仅含 `ocr.swift` 的回合让位给原生产物行 ✓
- [x] 走查中发现并修复真实 bug：Host 服务用 `#` 真私有字段，cordis Proxy 包装下 brand check 失败
      （`Cannot read private member #config`）→ 改为 TS `private`（与 Harness 惯例一致），32 项测试
      复跑全绿后重新验证通过
- 测试文件遗留：`/Users/pc2026/Tech-Research/dsh.plugins.dev/md-preview-验收测试.md`（保留供手动复现，可随手删除）

## 基线升级 alpha.1 → alpha.3（2026-09-01）

- [x] 起因：Harness 检出被移动到 `~/Dev-Space/deepseek-harness` 并更新到
      `0.1.2-alpha.3`（dd6322d6），node_modules 链接悬空、strict 32 项失败、
      typecheck/test 全挂（环境问题，非代码问题）
- [x] 漂移审查（cd5ef814..dd6322d6，351 commits）：store/ui-slots/ui-layout/fs/
      cordis-src 零变化；slots 契约纯增量（loadThrough/openView/selectView）；
      唯一破坏性变更 = `TypertRemoteFailure` 移除 → 共享 `RemoteError` +
      声明合并 `RemoteErrorDetailsMap`（惯例 `<domain>/<reason>` 码）
- [x] 代码迁移：失败码加 `md-preview/` 前缀并声明到 `RemoteErrorDetailsMap`
      （src/protocol.ts、src/remote.ts）；client face 的 read 返回类型对齐生成器
      形态 `Promise<RemoteResult<T>>`（src/typert/remote-client.ts）。测试断言
      的是消息正则，不受码值改名影响
- [x] 环境修复：重算 docsDigest 并更新 lock（alpha.3/dd6322d6）；`pnpm build:lib`
      + `tsc -b --force` 重建 harness（增量构建曾因仅 package.json mtime 变化
      跳过 .d.ts 重发导致"不新鲜"误报）；`pnpm context:sync` 重写链接；
      手动修复 expectedLinks 清单之外的两个悬空 link（dsh-client-ui-renderer、
      dsh-client-test-runtime）；补 jsdom@29.1.1 devDep（jsdom 环境测试此前靠
      坏拓扑侥幸解析，pnpm 严格隔离下必须自声明）
- [x] `pnpm verify` 全链路通过：strict 122 项 + typecheck + 32/32 测试 + build
      + built:check
- [x] profile 复核：web profile 中 md-preview 行曾丢失（依赖仍在、patch 行被
      之前某次 reconcile 丢弃），`dsh plugin --profile web add` 重新落行，
      `--dump-config` 确认恢复
- 待办不变：HMR 热替换走查、packed-artifact 冒烟仍待做；浏览器端到端走查
  建议在下次真实使用时顺带复核（RemoteError 迁移后错误分支 UI 展示
  `md-preview/<reason>` 码）

## 拖拽调宽修复（2026-08-30）

- [x] 用户反馈"面板希望可自由拖动大小"→ 根因：`.dsh-md-preview-panel` 缺 `position: relative`，
      绝对定位的手柄落在**视口左缘**（盖在侧边栏拖拽区上），面板边缘反而无手柄
- [x] 修复定位上下文；手柄加 hover/拖拽可见指示线（8px 命中区，越缘 4px）
- [x] 指针捕获改为 best-effort（合成事件/节点分离时降级为条带内拖拽，不中断手势）
- [x] 宽度改为跨开合持久（应用会话内记住用户宽度，不再每次打开重置）
- [x] 浏览器自动化验证：手柄几何贴面板左缘 ✓；左拖 +100 → +100 ✓；右拖 600 → 夹到 321（min 320+边框）✓；
      左拖至 721（max 720+边框）夹取 ✓；关闭重开宽度保持 ✓；32 项测试复跑全绿
- [x] 用户反馈"再宽一点"：MAX_WIDTH 720 → 960；新上限夹取 961 ✓，收缩方向 961→811 ✓

## 基线升级 alpha.3 → rc.1（2026-09-06，目标 0.5.0）

- [x] 漂移审查（dd6322d6..a66e470204，305 commits）：fs/typert/cordis API 零变化
      （fs 仅版本号；typert 只删本插件不引用的 `./invariant` 导出）；slots/locale/
      renderer 全部纯增量（keyedHooks 机制 + 各包 invariant 伴生删除，`hooks` 注入
      面行为保留）；bundle 工厂协议/冻结模块表/web boot/CLI 装载/manifest 解析/
      发布规范零 diff；deliverables `produced` 形状不变（buildLocationData 仅加
      结构共享）
- [x] 唯一类型漂移：`TurnLocation.data` 从 `Map` 收紧为
      `ConversationLocationDataStore`（新增 `source(key)`，`get(key)` 保留）——
      生产代码只用 `.get()`，rc.1 类型面对 src/ 零报错；测试 fake 补 `source()`
      桩防将来 typecheck 纳入 tests
- [x] 运行时实证：rc.1 构建产物跑全套 **101/101 全绿**（含真实 SlotRegistry/
      LocaleRuntime 注册回滚）；npm registry 上 rc.1 各包均已存在
- [x] 版本对齐（方案 A：精确 pin）：peer + 16 devDeps → `0.1.2-rc.1`；lock 三
      字段更新（commit a66e470204…/docsDigest 重算/verifiedOn 2026-09-06）；
      README ×2、PROJECT_CONTRACT、HANDOVER 基线文案同步
- [x] 顺手修复：vitest.config 回退路径 `../../deepseek-harness` →
      `../deepseek-harness`（与 lock 的 fallbackRelativePath 一致；此前未设
      DSH_HARNESS_ROOT 时 4 个测试文件直接 resolve 失败）
- [x] 发布前置全过（2026-09-06）：verify 全链路（strict 123 + typecheck +
      **101/101** + build + built:check）；packed 冒烟（干净 profile 装 0.5.0
      tarball + 本地 web-app → dump 行 → web 启动零告警 → 首页 combo 预载含
      本插件行 → `/plugins/??…client.js` 200 服务 426 kB 工厂 bundle、内嵌
      v0.5.0 → remove 往返干净）；`npm version minor` → v0.5.0 commit+tag
- [x] 发布链新 bug 修复：npm pack/publish 会触发 `prepare` 生命周期脚本，
      其 stdout 污染 `--json` 解析（0.4.0 发布时 prepare 尚不存在，0.5.0 首
      次暴露）→ pack.mjs 两条路径加 `--ignore-scripts`（新鲜度已由
      verify-built 门保证）
- [x] npm publish 0.5.0 → **决定跳过**：0.5.0 从未单独发布，rc.1 对齐内容随
      0.6.0 一并上线（registry 0.4.0 → 0.6.0 直跳）。修正记录：上节曾勾
      「v0.5.0 commit+tag 已落」，但本地 tag 实际只有 v0.4.0/v0.6.0，v0.5.0
      tag 从未存在
- 备注：用户 web profile 的第三方 `@benz-ai-x/dsh-client-ui-session-graph`
      依赖缺失（预存问题）当前会阻塞整个 profile 启动；本次冒烟改用独立
      干净 profile 完成，用户侧需修复该项目或禁用该行后 3080 才能起来。
      2026-09-06 实查根因：该项目 lib import 了 `@deepseek-ai/dsh-llm` 但
      package.json 未声明该依赖（源项目 bug，非安装缺失）

## 功能四连（2026-09-06，目标 0.6.0）

- [x] **大纲导航**：`src/client/outline.ts` 纯函数（ATX 扫描跳过围栏；闭合
      `#` 序列要求前置空格，对齐 commonmark）+ 头部弹层；查看脸按「同文本
      出现序数」定位渲染标题并滚动，编辑脸经 `onView` 句柄跳光标到源行。
      修复过程实录：惰性正则误配空串、`undefined`/`null` 守卫穿透、两个
      「face」变量遮蔽（浏览脸 face vs 会话脸 state.face）——均由红测试逼出
- [x] **树刷新**：`refreshPath` 静默重验（新结果到达前保留现列表、失败不变
      任何内容）；重进浏览脸自动重验（激活效应钉在 `active`、refreshAll 走
      ref——否则 sessionId 变化会用旧展开集对新会话补刷，冲掉会话边界重置，
      红测试实证）+ 树工具栏手动刷新按钮
- [x] **编辑器查找**：`@codemirror/search` + searchKeymap（Mod-F）+ 编辑脸
      头部按钮 `openSearchPanel`
- [x] **Mermaid 图表增强**：`src/client/diagrams.ts` 渲染后增强——源码围栏
      序 ↔ `.md-code-block` 渲染序**对齐校验**（平台 banner 类名被 css-module
      哈希，只有 `md-code-block` 是稳定类；数量不符整体放弃），横幅保留、
      代码隐藏、SVG 就位，失败回退源码 + 一行说明；mermaid `securityLevel:
      strict`。**构建关键**：动态 import 默认被 rolldown 拆成 180 个旁路
      chunk（单文件工厂协议下运行时必然找不到）→ client face 开
      `inlineDynamicImports`：单文件内联但保留惰性求值。**体积 426 kB →
      3.89 MB minified（gzip 131 kB → 1.06 MB）**；本地服务 + rev 戳缓存 +
      首图才求值的部署上下文下可接受，已写入契约与 README 已知限制
- [x] 测试 116/116（+15：outline 6、refresh 3、find 2、diagrams 4）；
      mermaid 经 vi.mock 在 import seam 打桩（其自身渲染归上游测试）
- [x] 发布 0.6.0（2026-09-06）：verify 全链 + packed 冒烟（干净 profile：
      装 tarball → dump 行 → 启动零告警 → /plugins 200 服务 3.89 MB 工厂
      bundle 内嵌 v0.6.0 → remove 往返干净）→ npm publish 完成（排障三连：
      自防御门拦 mtime 陈旧 d.ts，`tsc -b --force` 重建；~/.npmrc 陈旧
      npmjs token 致 404，摘除后 `npm login --auth-type=web` 重授权；tmux
      会话 stdout 重定向到文件会让 npm 判非交互直抛 EOTP —— 必须
      **不重定向、让 npm 拥有真 pty**，再 send-keys Enter 开浏览器授权）；
      验货 registry tarball（1,080,680 B、29 files、无 devDeps、内嵌
      v0.6.0 + mermaid）→ web profile 升 `^0.6.0`（minimumReleaseAgeExclude
      自动加条目）→ 带禁用 session-graph 的一次性 `--patch` 启动验证
      bundle → git push + gh release v0.6.0
