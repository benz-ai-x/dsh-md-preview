# TODO — dsh-md-preview

更新：2026-09-08。仅保留当前状态与未完成事项。
发布流程及事故结论见 [长期交接](docs/HANDOVER.md)；历史履历见 Git 记录与
[Releases](https://github.com/benz-ai-x/dsh-md-preview/releases)。

## 当前状态

- 最新发布：[v0.10.0](https://github.com/benz-ai-x/dsh-md-preview/releases/tag/v0.10.0)
  （2026-09-08）；npm `latest` 与当前源码 package 均为 `0.10.0`。
  归档、GitHub 附件与 npm 下载包摘要一致，见
  [发布验证](docs/verification/releases/v0.10.0/WALKTHROUGH.md)。
- 本轮文档同步已完成：中英文 README、契约、词汇表、交接与历史记录均对齐
  v0.10.0；[AGENTS.md](AGENTS.md) 统一维护接手、开发、验证和交付规则，
  [CLAUDE.md](CLAUDE.md) 保留引用与读取说明。本轮 **14 份 Markdown** 统一纳入
  文档同步提交；具体交接见 [HANDOFF.md](HANDOFF.md)。
- 文档验证：123 项 strict 基线检查通过，Markdown 解析、仓库内链接、命令与配置
  示例及 `git diff --check` 通过。本轮仅修改文档，未重跑运行时测试、重启服务或新增发布；
  下述 290 项测试属于 v0.10.0 发布证据，UX-12 与 F-03–F-08 继续保持待办。
- [spec #20](https://github.com/benz-ai-x/dsh-md-preview/issues/20) 及
  #21–#32 已关闭，三轮 PR 已合并；交付证据见
  [R3 走查](docs/verification/r3-acceptance/WALKTHROUGH.md)，批次记录见
  [PIPELINE_STATE.md](PIPELINE_STATE.md)。
- v0.10.0 发布验证：`pnpm verify` 通过，含 123 项基线检查、26 个测试文件共
  290 项测试、类型检查及构建产物检查；同一 tarball 的干净 profile 安装、启动、
  普通包名导入、资源服务及移除检查通过。UI/UX 实施继续由
  [Issue #36](https://github.com/benz-ai-x/dsh-md-preview/issues/36) 跟踪剩余视觉验收。
- 已保留并完成原有顶部停靠改动，同步契约；此前以 `v0.9.0` Git 标签归档的
  排版改动已随 v0.10.0 发布到 npm，UX-12 浏览器验收继续跟踪。
  证据与剩余验收见 [本轮记录](docs/verification/uiux-alignment/WALKTHROUGH.md)。

## UI/UX 对齐 Harness

详细问题、基线数值、修改位置、依赖与验收标准见
[UI/UX 对齐分析](docs/research/harness-uiux-alignment.md)。初次排版分析未取得用户
原图，依据固定 Harness 源码、当时产品源码及历史截图；后续侧边栏与 A/B 修正
依据用户提供的真实截图，见 [截图反馈](docs/research/sidebar-screenshot-feedback.md)。
以下勾选表示**代码已实施并通过自动化回归**；真实页面的布局、颜色及缩放验收
集中在 UX-12，仍未闭环，不能据此宣称视觉验收全部通过。

- [x] **P0 · UX-01** 修复未定义颜色变量、搜索文字变量前缀和深色分段选中态，
      显式定义 hover、当前预览目标、焦点与禁用态。
- [x] **P1 · UX-02** 统一导航主文字为 14px / 20px，辅助路径为 12px / 18px，
      分组标签为 12–13px；统一字体家族与字重层级。
- [x] **P1 · UX-03** 单行条目对齐约 32px 行盒，路径双行条目至少 48px 起步；
      统一内容边距、图文对齐和分组留白。
- [x] **P1 · UX-04** 使用同源图标；常用图标按钮按 28×28px、常驻搜索按 32px
      高设计，扩大展开器命中区并保留键盘操作。
- [x] **P1 · UX-05** 文档名优先；快捷入口、搜索结果与头部整理展示路径，
      将文档名与父目录独立成行，并提供完整路径焦点提示。
- [x] **P1 · UX-06** 整理头部操作分组与折叠断点；解决已有顶部停靠改动与
      契约描述的差异，按实际宽度折叠并优先保留保存/关闭入口。
- [x] **P1 · UX-07** 联合优化快捷区信息量与窄导航空间；文字放大后搜索仍可达，
      手动偏好和各入口语义保持正确。
- [x] **P1 · UX-08** 对齐编辑脸字体与浅/深主题，显式定义行号沟槽、光标、选区、
      查找框及保存状态样式。
- [x] **P2 · UX-09** 移除放大档额外段距与标题上距覆盖；保留 760/940px 阅读宽度，
      正文节奏由平台 Markdown 排版变量统一管理。
- [x] **P2 · UX-10** 收敛阴影、边框、圆角与版本信息占位，保留必要状态反馈。
- [x] **P2 · UX-11** 加入缩放后的窄屏降级、稳定滚动条占位、焦点与状态提示布局。
- [ ] **验收 · UX-12** 保存同条件优化前后截图与 computed style 记录，走完
      搜索→打开→定位→编辑保存→关闭→继续阅读全链，并执行相应验证。

## 下一步

- [x] **文档侧边栏 · 代码与回归** 按用户截图增加会话头部入口与面板关闭按钮；
      宽屏为对话预留空间，窄屏覆盖展开，保留未保存守卫与宽度记忆。
      [Issue #37](https://github.com/benz-ai-x/dsh-md-preview/issues/37)；接入决策见
      [ADR-0004](docs/adr/0004-dock-preview-beside-the-harness-frame.md)。290 项测试与
      干净 profile 安装/移除冒烟通过，见 [验证记录](docs/verification/sidebar-docking/WALKTHROUGH.md)。
- [x] **截图反馈 · F-01/F-02** A 换原生回形针、B 换 ×；提示改为打开工作区文档/关闭
      文档面板，保留未保存守卫。后续建议与验收见
      [人工截图反馈 TODO](docs/research/sidebar-screenshot-feedback.md)。`pnpm verify` 通过
      290 项测试；已重新安装并重启 3185，服务资源与安装包校验通过。
- [ ] **截图反馈 · F-03/F-04** 对齐两侧顶栏操作行，强化导航、面孔切换、面板操作分组。
- [ ] **截图反馈 · F-05/F-06** 同条件校准正文宽度与排版，独立核查文档开头测试残留。
- [ ] **截图反馈 · F-07/F-08** 评估分隔拖柄反馈、默认宽度恢复、大纲与长表格体验。
- [ ] **文档侧边栏 · 页面验收（并入 UX-12）** 复验修正后的 A/B，记录真实布局、
      左右栏开合、工具详情共存、拖宽、浅/深主题、中/英文、边界宽度、缩放与完整阅读链路。
      2026-09-08 最近一次自动化浏览器连接超时，视觉证据仍待补齐。
      人工验收沿用 `r3-accept`（3185，tmux `dsh-r3`，npm 精确版本 0.10.0）。
- [x] **发布 v0.10.0**：`pnpm verify` 与干净 profile 安装/启动/移除冒烟通过；
      npm `latest` 已更新，提交 `9016f87` 与新标签已推送，GitHub Release 已公开。
      已下载核验同一 tarball，并将 `r3-accept`（3185）更新为 npm 正式版后重启。

## 验证与评估

- [ ] HMR 走查：使用 dev-link profile 与 `pnpm watch:client` 验证浏览器
      bundle 热替换及旧贡献释放。
- [ ] 评估 Mermaid 暗色主题适配（目前使用默认主题）。
- [ ] 评估正文内联 `.md` 文件提及的预览包装层；`chatFileMentions` 仍归
      ui-deliverables 所有。
