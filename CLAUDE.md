# AGENTS.md — dsh-md-preview

DSH Client UI 插件（Markdown 预览）。开发前必读：

1. `docs/agent/PROJECT_CONTRACT.md` — 契约（形态、权威、失败码、交付）。
2. `dsh-reference.lock.json` — 固定的 Harness 基线；行为对齐以该检出源码为准。
3. 修改前运行 `pnpm context:check:strict`；Harness 检出移动后运行
   `pnpm context:sync`。

约束（来自 dsh-plugin-dev 契约）：

- 命名空间函数插件：具名导出（`name`、`inject`、`Config`、`apply`），无
  default export。
- 每个 TS `Config` 配同名 Standard Schema；默认值放 schema。
- 所有注册与外部资源可逆；dispose 关闭准入、取消自有工作并等待静默。
- 不跨 feature 运行时导入：`@deepseek-ai/dsh-client-ui-chat` 等仅
  `import type`；运行时只允许 baseline 模块（react、cordis、
  dsh-client-store、dsh-client-ui-slots、dsh-client-ui-primitives）与本包
  内部相对导入。
- Client bundle 为 lazy-CJS factory 协议（见 `tsdown.config.ts`）；构建
  配置是本仓库自有的，禁止改成引用 Harness 仓库内部 preset。
- 会话/事实状态归 owning service；面板只持有 UI 局部 viewing state。

## Agent skills

### Issue tracker

Issue 与 spec 跟踪在本仓库的 GitHub Issues（`gh` CLI）。见
`docs/agents/issue-tracker.md`。

### Domain docs

单上下文布局：根 `CONTEXT.md` 词汇表 + `docs/adr/` 决策记录；输出命名
须用词汇表术语。见 `docs/agents/domain.md`。
