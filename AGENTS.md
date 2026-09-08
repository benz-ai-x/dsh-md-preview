# AGENTS.md — dsh-md-preview

DeepSeek Harness Web GUI 的工作区文档预览、编辑与浏览插件，发布包为
`@benz-ai-x/dsh-md-preview`。本文件统一维护仓库级 Agent 规则，
[CLAUDE.md](CLAUDE.md) 引用本文件。

## 接手顺序

1. 运行 `git status --short --branch`，结合用户最新要求确认范围，保留工作区已有改动。
   读取 [TODO.md](TODO.md) 的当前状态与待办，以及 [长期交接](docs/HANDOVER.md)
   的开发、发布流程和本机环境事实。
2. 阅读 [项目契约](docs/agent/PROJECT_CONTRACT.md)、
   [固定基线](dsh-reference.lock.json)、[领域词汇表](CONTEXT.md) 与相关
   [ADR](docs/adr/)。行为对齐以 lock 指定的 Harness 检出源码为准。
3. **修改前运行 `pnpm context:check:strict`**。失败时先核对检出、依赖与构建状态，
   不通过跳过检查或放宽 lock 来制造通过结果。
4. [HANDOFF.md](HANDOFF.md) 是有日期的会话快照；[PIPELINE_STATE.md](PIPELINE_STATE.md)
   保留已完成批次的历史。先核对当前状态，不直接续跑旧 PR、恢复旧分支或套用旧实例信息。

Harness 路径优先取 `DSH_HARNESS_ROOT`，默认 `../deepseek-harness`。开发依赖默认使用
已发布版本；需要源码联调或已有源码链接的检出移动时，运行 `pnpm context:link`
重建链接。它会修改开发依赖并更新锁文件，需检查这些差异。Node、pnpm 版本与可用脚本
以 [package.json](package.json) 为准，入口文档不另存一套版本号。

## 开发约束

以下沿用 dsh-plugin-dev 契约，细节见项目契约与固定基线：

- **插件形态**：Host 为命名空间函数插件，具名导出 `name`、`inject`、`Config`、
  `apply`；Client 沿用具名 `inject`、`apply` 入口。插件入口无 default export。
  `src/typert/remote-client.ts` 是 Remote 描述符，保留 `TYPERT_REMOTE` 及其既定
  default 别名，不将它误当插件入口修改。
- **配置与协议**：每个 TS `Config` 配同名 Standard Schema，默认值由 schema 提供。
  修改 RPC 时同步 Host、`src/protocol.ts` 与手工维护的 Remote 描述符和 codec，
  保持显式会话身份、取消传播及稳定失败码。
- **可逆生命周期**：所有注册与外部资源可释放；dispose 关闭准入、取消自有工作并等待
  静默，迟到结果不得写入后继预览会话。监听、observer、定时器、rAF 与布局样式一并清理。
- **Client 导入与构建**：不跨 feature 运行时导入；
  `@deepseek-ai/dsh-client-ui-chat` 等仅允许 `import type`。平台运行时 external
  以 [tsdown.config.ts](tsdown.config.ts) 的 `PLATFORM_MODULES` 冻结列表为准，
  其余客户端依赖按现有构建内联。保留仓库自有 lazy-CJS factory 协议，禁止引用
  Harness 仓库内部 preset 或为解决导入报错随意扩大平台模块表。
- **状态与文件权威**：会话及产出事实归 owning service；路径范围、扩展名、字节上限
  与写入冲突由 Host 和文件服务裁决。面板只持有 UI 局部 viewing state；持久阅读记录
  与偏好不保存正文、草稿或指纹。测试 fake 的 `FsTarget` 使用 `{ targetKey, displayPath }`。
- **交互与布局**：打开其他文档、关闭与离开编辑统一经过 `leave-intent.ts` 的未保存
  守卫；正文排版、图标和主题优先复用平台 primitives。停靠适配保持在独立模块中，
  不接管原生工具详情或其他 feature 状态；升级 Harness 时重新验证
  [ADR-0004](docs/adr/0004-dock-preview-beside-the-harness-frame.md) 的兼容边界。

## 验证与交付

| 改动 | 验证要求 |
| --- | --- |
| 纯文档 | strict 基线检查、Markdown 链接与命令/配置示例核对、`git diff --check` |
| 代码或行为 | 运行相关现有测试，交付前运行 `pnpm verify`；测试覆盖用户行为、权威与生命周期边界 |
| UI 排版与交互 | 按改动范围补真实浏览器证据，记录构建、主题、语言、视口与缩放；jsdom 不证明视觉验收通过 |
| 发布 | 完整 verify 后打包，用同一归档完成干净 profile 安装、配置组合、启动、普通包名导入、资源服务及移除验证 |

检查命令的真实退出码，不让日志过滤管道吞掉失败。复用已有测试与验证入口；纯文档
修改无需新增运行时测试或重启服务。交付说明写清改动、实际验证结果及仍待验收项。

```sh
pnpm context:check:strict             # 修改前核对固定基线
pnpm verify                          # 代码交付与发布前的全链验证
pnpm watch:client                    # 客户端开发监听
pnpm pack:publishable                # 生成发布候选，随后验证该归档
```

执行发布时，按照 [长期交接的发布流程](docs/HANDOVER.md#发布流程) 发布**已验证的同一
tarball**，核对 npm 下载包与 GitHub 附件摘要。`pnpm publish:registry` 会重新构建并
打包，不用于提交已经完成冒烟的归档。重启或升级前核对指定 profile、端口与启动方式，
保留会话和配置；本机路径、代理与 npm 2FA 细节只维护在长期交接中。

## 文档与跟踪

- **用户说明**：[README.md](README.md) 与 [README.zh.md](README.zh.md) 同步维护
  安装、入口、快捷键、配置和已知限制；默认值从 schema 核对。
- **行为与设计**：行为或权威边界变化同步项目契约；使用 [CONTEXT.md](CONTEXT.md)
  的术语，相关设计决定记录到 ADR。领域文档约定见 [domain.md](docs/agents/domain.md)。
- **进度与证据**：TODO 保存当前待办；长期交接保存维护流程和有日期的环境事实；
  HANDOFF 保存短期现场。历史走查保留当时的版本、摘要和结论，补当前状态链接，
  不把旧证据改写成新验收。区分代码完成、自动化通过、人工验收与正式发布。
- **Issue**：Issue 与 spec 使用本仓库 GitHub Issues，通过 `gh` 操作，约定见
  [issue-tracker.md](docs/agents/issue-tracker.md)。多行正文使用文件配合 `--body-file`，
  保留真实换行；仅在对应验收条件满足后关闭事项。
- **Agent 入口**：共享规则更新本文件；CLAUDE 保留引用与读取说明。版本、测试数量、
  待办和本机端口从上述文档读取，避免多处维护后漂移。
