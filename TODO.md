# TODO — dsh-md-preview

更新：2026-09-08。仅保留当前状态与未完成事项。
发布流程及事故结论见 [长期交接](docs/HANDOVER.md)；历史履历见 Git 记录与
[Releases](https://github.com/benz-ai-x/dsh-md-preview/releases)。

## 当前状态

- GitHub 最新发布：[0.7.2](https://github.com/benz-ai-x/dsh-md-preview/releases/tag/v0.7.2)
  （2026-09-08 查询）；当前源码 package 版本为 `0.9.0`。
- [spec #20](https://github.com/benz-ai-x/dsh-md-preview/issues/20) 及
  #21–#32 已关闭，三轮 PR 已合并；交付证据见
  [R3 走查](docs/verification/r3-acceptance/WALKTHROUGH.md)，批次记录见
  [PIPELINE_STATE.md](PIPELINE_STATE.md)。
- 本轮 UI/UX 实施跟踪：[Issue #36](https://github.com/benz-ai-x/dsh-md-preview/issues/36)。
  `pnpm verify` 通过：123 项基线检查、286 项测试、类型检查及构建产物检查。
  干净 profile 的 tarball 安装、启动、资源服务及移除检查通过。
- 已保留并完成原有顶部停靠改动，同步契约；本轮源码以 `v0.9.0` Git 标签归档，
  npm 发布与 UX-12 浏览器验收另行跟踪。
  证据与剩余验收见 [本轮记录](docs/verification/uiux-alignment/WALKTHROUGH.md)。

## UI/UX 对齐 Harness

详细问题、基线数值、修改位置、依赖与验收标准见
[UI/UX 对齐分析](docs/research/harness-uiux-alignment.md)。本次用户原图未能读取，
清单依据固定 Harness 源码、当前产品源码及明确标注的历史截图。
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

- [ ] 恢复浏览器连接后完成 UX-12 的浅/深主题、中/英文、边界宽度、缩放与
      完整阅读链路验收；当前 Chrome 通信失败，已请求打开空白窗口恢复连接。
- [ ] 发布下一版：源码已到 `0.9.0`，发布前核查 npm 已有版本并确定版本号，
      通过 `pnpm verify` 与干净 profile 的 tarball 安装、启动、移除冒烟。

## 验证与评估

- [ ] HMR 走查：使用 dev-link profile 与 `pnpm watch:client` 验证浏览器
      bundle 热替换及旧贡献释放。
- [ ] 评估 Mermaid 暗色主题适配（目前使用默认主题）。
- [ ] 评估正文内联 `.md` 文件提及的预览包装层；`chatFileMentions` 仍归
      ui-deliverables 所有。
