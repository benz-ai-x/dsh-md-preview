# HANDOFF — dsh-md-preview

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
