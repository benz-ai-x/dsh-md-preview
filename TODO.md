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
- [ ] 用户环境已知问题：web profile 中第三方插件 `@benz-ai-x/dsh-client-ui-session-graph`（link 自 ~/Dev-Space/dsh-session-graph）自身依赖缺失，会在插件树加载时 fail-loud；与本插件无关，需在源项目修复或禁用该行

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
- [ ] 浏览器端到端走查：编辑 → 保存 → 冲突 → 强制覆盖四路径（下次真实使用时顺带）

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
