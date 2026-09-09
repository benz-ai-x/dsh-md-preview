[English](README.md) | 中文

# @benz-ai-x/dsh-md-preview

在 **DeepSeek Harness 官方右边栏标签页**中预览和编辑 Markdown。

当前分支为 **0.11.0-alpha.2 开发候选**，依赖 Harness `0.1.5-alpha.1` 加
[dsh-reference.lock.json](dsh-reference.lock.json) 固定的公共关闭守卫补丁。
官方 npm 同版本尚无该接口，候选插件会拒绝激活。已发布的
[v0.10.0](https://github.com/benz-ai-x/dsh-md-preview/releases/tag/v0.10.0)
仍使用旧面板，不包含此次迁移；本轮不代表正式发布。

## 安装候选包

先构建带[补丁](patches/harness-sidebar-close-guard.patch)的固定 Harness 检出，
使用该检出的正常 CLI 和独立 web profile。以下 `dsh` 指该 CLI：

```sh
dsh --profile markdown-accept --from-default-profile web --dump-config
dsh plugin --profile markdown-accept add ./benz-ai-x-dsh-md-preview-0.11.0-alpha.2.tgz --save-exact
dsh --profile markdown-accept --dump-config
dsh --profile markdown-accept --no-open
```

配置结果应包含 `md-preview`。已有运行实例安装后，重启同一个 profile 并刷新页面。
移除命令：

```sh
dsh plugin --profile markdown-accept remove @benz-ai-x/dsh-md-preview
```

本地归档是未发布候选。实际验证状态见
[TDD 记录](docs/verification/official-sidebar-markdown/TDD.md)。

## Markdown 工作流

- 从官方文件树、聊天文件提及、工具路径及产出 chip 打开 `.md` 或 `.markdown`；
  消息操作区的“预览文档”也走同一原生资源通路。标签、分栏、浮动及右栏开合由 Harness 管理。
- 平台 Markdown 渲染器显示 GFM 表格、配色代码、数学和 Mermaid。图表失败保留源码与提示。
- “编辑”进入 CodeMirror，支持撤销重做与文内查找；“保存”或 Mod-S 完整写回原文并重读确认。
- 标签仍存活时，切换标签/会话、隐藏右栏或正文重新挂载保留草稿及撤销历史；真正关闭记录后释放。
- 原生关闭/替换、重新加载和返回预览共用未保存守卫。“继续编辑”保留草稿，
  “放弃修改”执行暂存的第一个动作；重复破坏性请求不替换已有决定。保存中关闭会先等待保存。
  浏览器刷新在支持时触发原生离开提醒。
- 保存冲突保留草稿，提供重新加载与显式“强制覆盖”。保存已成功但重读失败会明确区分，
  可重试读取；已观察到的外部变化只提示，不会自动覆盖草稿。

带 `line` 的原生导航在预览中滚动到所属 ATX 章节；“源码第 N 行”进入编辑器精确定位。
再次导航时使用新的行目标。

## 快捷键

`Mod` 在 macOS 为 Cmd，Windows/Linux 为 Ctrl；编辑器快捷键需要焦点位于编辑器。

| 快捷键 | 动作 |
| --- | --- |
| Mod-S | 保存 |
| Mod-F | 文内查找 |
| Mod-Z / Mod-Shift-Z | 撤销 / 重做 |
| Mod-B / Mod-I / Mod-K | 将选区包为粗体、斜体或链接 |
| Esc | 关闭编辑器查找面板，或取消未保存对话框 |

本候选没有插件级 Esc 关闭、独立右栏开关、重复文件树、最大化按钮或工作区导航快捷键。

## 配置与限制

在 profile 的 `cordis.patch.yml` 覆盖已有行：

```yaml
- id: md-preview
  config:
    maxBytes: 1048576
    allowedExtensions: ['.md', '.markdown']
    previewExtensions: ['.md', '.markdown', '.txt']
    searchMaxResults: 200
    searchMaxDirectories: 2000
    searchConcurrency: 8
```

以上为 schema 默认值。后续 patch 整体替换 config，请保留需要的自定义值。
`maxBytes` 按 UTF-8 字节限制完整读取及写入。`allowedExtensions` 可以收窄编辑资格，
不能赋予 `.md`/`.markdown` 以外的写权限。`previewExtensions` 与三项搜索上限保留为
Host RPC 配置，不会在首阶段注册额外格式的标签，也不会显示搜索界面。

Host 校验显式会话身份、工作区范围、最终路径分量的符号链接（拒绝）、文件类型、字节与版本。
只编辑已有文件；读取完成后复核版本，写入通过文件服务比较版本或用户显式覆盖，
成功后发布原生文件观察事件。这不是全局文件系统 watcher。

失败保留稳定的 `md-preview/` 代码：`bad-request`、`unknown-session`、`no-workspace`、
`unsupported-extension`、`forbidden`、`not-found`、`too-large`、`conflict`、`unavailable`。
超限文档提供官方只读文本查看器入口，其自身读取限制仍适用。上传附件和其他格式后置。

文件名搜索/当前产出聚合（#57）、独立大纲/持久阅读（#58）、通用文本（#39）及其他格式均后置。
原阅读记录与偏好保留，但暂不恢复阅读位置，也不驱动官方布局。正文、草稿、指纹与撤销历史
只在内存中保存。Mermaid 仍使用默认主题；混合缩进/围栏代码导致块数不一致时跳过图表增强。

## 开发与验证

先读 [AGENTS.md](AGENTS.md)、[项目契约](docs/agent/PROJECT_CONTRACT.md) 与
[ADR-0007](docs/adr/0007-markdown-in-official-sidebar-tabs.md)。源码联调使用 lock 中的补丁检出：

```sh
export DSH_HARNESS_ROOT=/absolute/path/to/deepseek-harness-md-guard
pnpm context:link
pnpm context:check:strict
pnpm verify
pnpm pack:publishable
```

本仓库不会修改原 Harness 检出。另建 worktree 时，从官方提交
`5dda764ed3aa172535a7967b06ff95d9cbfe536a` 开始，用 `git am` 应用提供的 format-patch，
再构建 Harness。已审计 worktree 的提交是 `737e95c657a95fd04b12269313902f9b5ca2f6ca`；
保留其身份，或重新审计另行应用的提交后再更新 lock。

Node/pnpm 要求见 [package.json](package.json)。Client 保留自有 lazy-CJS factory 协议
及冻结的平台模块表，CodeMirror 与 Mermaid 内联；完整构建清除已退役源码的残留声明。
同一候选归档用于干净 profile 安装、普通包名导入、资源服务与移除验收。
正式发布另走 [HANDOVER 流程](docs/HANDOVER.md#发布流程)。

MIT
