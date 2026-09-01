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
- [ ] packed-artifact 冒烟（发布前置条件；当前 private）
- [ ] 评估：正文内联 `.md` 文件提及（chatFileMentions 仍归 ui-deliverables 所有）是否值得提供包装层
- [ ] 用户环境已知问题：web profile 中第三方插件 `@benz-ai-x/dsh-client-ui-session-graph`（link 自 ~/Dev-Space/dsh-session-graph）自身依赖缺失，会在插件树加载时 fail-loud；与本插件无关，需在源项目修复或禁用该行

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
