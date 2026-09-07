# TODO — dsh-md-preview

更新：2026-09-07。仅保留当前状态与未完成事项。
发布流程及事故结论见 [长期交接](docs/HANDOVER.md)；历史履历见 Git 记录与
[Releases](https://github.com/benz-ai-x/dsh-md-preview/releases)。

## 当前状态

- 已发布：[0.7.2](https://github.com/benz-ai-x/dsh-md-preview/releases/tag/v0.7.2)。
- 待合并：`details-workbench-abc` 的 `0a58e31`（九项打磨版）；第二轮改动
  已回退，保存在 `ux-round2-backup`。现场详情见 [HANDOFF.md](HANDOFF.md)。
- 最近验证：2026-09-07 仓库清理后 `pnpm verify` 全链通过，157/157 项测试通过。

## 下一步

- [ ] 按 [spec #20](https://github.com/benz-ai-x/dsh-md-preview/issues/20)
      的 12 张任务票分轮推进：R1（#21–#24）→ R2（#25–#29）→ R3（#30–#32），
      各轮整体验收后进入下一轮。当前可开始
      [#21 统一未保存守卫](https://github.com/benz-ai-x/dsh-md-preview/issues/21)、
      [#22 头部与入口可达](https://github.com/benz-ai-x/dsh-md-preview/issues/22)。
- [ ] 合并当前开发分支并发布下一版（暂定 0.7.3）：发布前核查 npm 已有版本，
      通过 `pnpm verify` 与干净 profile 的 tarball 安装、启动、移除冒烟。

## 验证与评估

- [ ] HMR 走查：使用 dev-link profile 与 `pnpm watch:client` 验证浏览器
      bundle 热替换及旧贡献释放。
- [ ] 补验冲突处理：真实浏览器中点击「重新加载」与「强制覆盖」，确认最终
      文件内容；两分支已有 jsdom 覆盖，此前浏览器走查未完成。
- [ ] 评估 Mermaid 暗色主题适配（目前使用默认主题）。
- [ ] 评估正文内联 `.md` 文件提及的预览包装层；`chatFileMentions` 仍归
      ui-deliverables 所有。
