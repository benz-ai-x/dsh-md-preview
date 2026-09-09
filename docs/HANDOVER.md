# 交接文档 — dsh-md-preview

更新：2026-09-09。面向接手开发、验证和发布的维护者。当前待办以
[TODO](../TODO.md) 为准；本文件记录持久流程与有日期的环境事实。

## 当前开发候选（2026-09-09）

`feat/official-sidebar-markdown` 的 `0.11.0-alpha.1` 迁移候选使用官方右栏；
固定 Harness 补丁提交 `737e95c657a95fd04b12269313902f9b5ca2f6ca`。
`DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness-md-guard`，原检出和用户实例未修改。
官方 npm 的 0.1.5-alpha.1 尚无关闭守卫，不可直接宣称兼容。当前自动化185项通过，
真实浏览器和同归档验收状态见 [本轮 TDD](verification/official-sidebar-markdown/TDD.md)。

## 当前发布与验收

**[v0.10.0](https://github.com/benz-ai-x/dsh-md-preview/releases/tag/v0.10.0)
已于 2026-09-08 发布，npm `latest` 为 0.10.0。** 发布提交 `9016f87`，包含文档
侧边栏、回形针入口、× 关闭、UI/UX 对齐、统一未保存守卫、阅读连续和工作区搜索。
此前 `v0.9.0` 仅作 Git 源码归档；这些改动已包含在本次 npm 发布中。

发布时 `pnpm verify` 退出 0：123 项基线检查、26 个测试文件共 **290 项测试**、
类型检查、构建及 6 项产物检查通过。同一 tarball 完成干净 profile 安装、配置组合、
启动、普通包名导入、资源服务与移除验证；npm 下载包与 GitHub 附件摘要一致。
证据见 [发布验证](verification/releases/v0.10.0/WALKTHROUGH.md)。

人工验收实例 `r3-accept` 已安装 npm 精确版本 0.10.0，入口为
`http://127.0.0.1:3185/`，tmux 会话 `dsh-r3`。主题、缩放和完整页面流程仍待补验；
A/B 图标已实现，顶栏对齐等 F-03–F-08 仍是候选建议。自动化和安装包验证不替代视觉验收。

## 文档地图

| 问题 | 入口 |
| --- | --- |
| 安装、功能、配置与快捷键 | [README](../README.md)、[中文 README](../README.zh.md) |
| 仓库约束与开发前置 | [AGENTS.md](../AGENTS.md)；`CLAUDE.md` 引用它 |
| 行为、权威、失败码、状态归属与交付 | [PROJECT_CONTRACT.md](agent/PROJECT_CONTRACT.md) |
| 领域术语 | [CONTEXT.md](../CONTEXT.md) |
| 已决设计 | [ADR 目录](adr/)，0001–0004：既有实现边界；[0005](adr/0005-networked-html-preview-isolated-from-harness.md)、[0006](adr/0006-text-preview-independent-of-language-recognition.md)：HTML 联网隔离与文本准入的待实现设计 |
| 当前状态与待办 | [TODO.md](../TODO.md) |
| Issue 约定 | [issue-tracker.md](agents/issue-tracker.md) |
| 浏览交互的证据基线 | [工作区浏览 UX](research/workspace-browser-ux.md) |
| 当前 UI/UX 分析与截图反馈 | [排版对齐](research/harness-uiux-alignment.md)、[侧边栏反馈](research/sidebar-screenshot-feedback.md) |
| 已完成批次的历史记录 | [PIPELINE_STATE.md](../PIPELINE_STATE.md)；spec #20 与 #21–#32 已关闭 |

## 架构速览

- Host `MdPreviewService` 保留显式会话的 `read/write/list/search`；精确读取、版本比较、
  Markdown 写入限制、取消与公开文件观察见项目契约。Remote 手工描述符与 codec 保持同步。
- Client `mount.ts` 先挂 Remote，再注册官方 Markdown tab type/body、root 未保存 Modal
  和消息级预览动作。CodeMirror/Mermaid 内联，自有 lazy-CJS factory 及平台模块表保持不变。
- `markdown-documents.ts` 按存活标签记录持有正文、草稿与编辑器 memento；`preview-session.ts`
  是纯状态机，`leave-intent.ts` 统一破坏性请求。独立 overlay/frame 适配已删除，见 ADR-0007。
- 未接入的搜索/阅读与偏好 helper 保留供后置任务复用，不删除旧持久记录。
- 自动化测试通过真实官方服务和 Slot 装配验证行为；不把 jsdom 当成视觉验收。
  完整构建先清除生成目录，防止已删除源码的声明被归档。

## 开发前置

1. 阅读 AGENTS、契约、词汇表及相关 ADR，确认当前 TODO 和 Issue 范围。
2. 修改前运行 `pnpm context:check:strict`；固定 Harness 基线与源码解析方式见
   `dsh-reference.lock.json`。默认使用已发布依赖；需要源码链接时才运行
   `pnpm context:link`。该命令会重写开发依赖并更新锁文件，Harness 检出移动后也用它
   重建链接；可通过 `DSH_HARNESS_ROOT` 指定检出位置。
3. 按改动选择验证，交付代码与发布前运行 `pnpm verify`。文档修改检查命令、配置、
   相对链接和历史状态，不为纯文档变更重启用户服务。

## 发布流程

版本发布沿用以下流程，先验证具体归档，再发布同一个文件。

1. 检查分支和工作区、固定基线、待发布改动及 npm 已有版本，选择未发布版本。
   Registry 查询显式指定 `--registry=https://registry.npmjs.org/`。保留已有标签；
   更新版本可用 `npm version <新版本> --no-git-tag-version --ignore-scripts`，
   然后运行完整 `pnpm verify` 并检查真实退出码。
2. 更新发布说明、TODO 和验证记录，运行 `pnpm pack:publishable`。脚本先构建并执行
   freshness 检查，再临时净化 manifest、打包并检查归档；原 manifest 按字节恢复。
   检查公开 exports、版本、lazy-CJS 协议、无 devDependencies/link:/workspace:/source map，
   记录归档及 client 摘要。
3. 将该归档安装到独立的临时 `DSH_HOME` 与干净 shipped web profile，核对安装文件，
   执行 `--dump-config`、实际启动、普通包名 Host/Remote 导入及客户端资源 HTTP 200。
   普通导入在正常 boot 提供平台 peer 后检查；不能用测试别名绕过解析。
   移除后再次检查配置、启动图和原资源 HTTP 404，停止两个测试进程。
   移除命令不支持 `--offline`；不要把安装参数原样传给 `remove`。
4. 提交发布源码与说明，创建指向该提交的注解标签并推送；GitHub Release 可先建草稿，
   附上已验证归档与 `SHA256SUMS`。版本提升、代码变化或重新打包都会产生新候选，
   需要重新核验对应归档，不能沿用旧摘要和冒烟记录。
5. 确认 npm 身份后，在真实 TTY 中发布**已验证的文件**：
   `npm publish <已验证的.tgz> --ignore-scripts --access public --registry=https://registry.npmjs.org/`。
   本机浏览器认证注意事项见下一节。`pnpm publish:registry` 会重新构建并从工作区打包，
   因此不用于提交已经完成归档验证的候选。
6. 下载 Registry 元数据指向的 tarball，与本地归档逐字节及摘要比对；核对版本、
   `dist-tags`、SHA-1 / integrity。核对 GitHub 标签、两项附件摘要后公开 Release。
7. 更新指定验收 profile 到 npm 精确版本，保留其会话与配置；确认该实例的端口与
   启动方式后重启，核对实际服务资源。不要从旧快照推断要重启哪个实例。
8. 将发布结果、运行验证和归档校验值写入验证记录，更新 TODO 与相关 Issue；
   清理本次创建的临时认证配置、测试服务和终端会话。未完成的视觉验收继续保持待办。

`pack.mjs` 恢复 manifest 内容时会改变 mtime，因此打包后单独运行 `built:check`
可能提示本地构建陈旧。需要重新检查本地输出时运行 `pnpm build`；这不会改变已生成的
归档。发布重试直接使用原已验证归档，不必为 mtime 重新打包。

## 本机环境事实（2026-09-09）

### 官方右栏审查与拆票后的复核

- 当前插件仓库为 `/Users/pc2026/DSH-Space/dsh-md-preview`，main `ae58cd4`。
  用户指定的同级 Harness 为 `/Users/pc2026/DSH-Space/deepseek-harness`，
  `0.1.5-alpha.1` / `5dda764ed3aa172535a7967b06ff95d9cbfe536a`，审查时工作树干净。
- 当前进程继承的 `DSH_HARNESS_ROOT` 仍指向失效的
  `/Users/pc2026/Dev-Space/deepseek-harness`，不带覆盖的 strict 退出 1（源码缺失）。
  显式使用下方命令，源码构建入口和新鲜度检查通过，实际退出 1，仅版本、commit、
  文档摘要 3 项与旧 lock 不同。当前问题不能再描述为新检出不存在或 35 项失败。

  ```sh
  DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness pnpm context:check:strict
  ```

- [兼容初审](research/harness-0.1.5-alpha.1-compatibility-audit.md) 已完成；
  用户要求采用官方右栏，整理 Issue 准备开发。当前规格与执行入口分别为
  [#38](https://github.com/benz-ai-x/dsh-md-preview/issues/38) 和
  [#54](https://github.com/benz-ai-x/dsh-md-preview/issues/54)，
  旧 #39 提交和历史证据保留。具体队列见 [TODO](../TODO.md#官方右边栏迁移与清理)。
- 同日用户进一步收窄优先级：先让已有 Markdown 预览/编辑在新 DSH 可用。
  首阶段为 #54 → #55 → #56 → #59 → #60；#57/#58 在 #60 实际验收后推进，
  #39 及多格式随后按依赖处理。后置需求和数据保留，首阶段不等待搜索或阅读记录迁移。
- 本轮没有改变 lock、依赖、环境变量或源码链接，没有恢复旧流水线、重启/升级实例或发布。
  浏览器和同归档验收由新票跟踪，不将旧路径下的通过记录当作新版证据。

### 当日较早的暂停快照

以下保留目录再次移动前后的实测现场；最新位置与开发方向以上方复核为准。

- **收尾路径变化**：下述独立旧基线和普通 Harness 目录在检查之后均已不存在；新位置未确认。最新旧基线路径 strict 退出 1，报固定源码缺失。以下版本及通过结果保留为路径失效前的实测快照，恢复前重新定位检出；本次未重建环境。
- 用户已要求暂停开发并先保存交接，当前入口为 [HANDOFF](../HANDOFF.md)。
  #39 位于独立 `dsh-md-preview-batch-1-readonly-text` worktree，提交 `2491a52`
  已推送，未合入 main；原工作区的既有改动保留。
- 固定对照检出为 `/Users/pc2026/Dev-Space/deepseek-harness-md-preview-baseline`，
  `0.1.2-rc.1` / `a66e4702047846cdaa10c66c9d3df3951f5ea70d`，已完成 lib/web 构建。
  显式设置 `DSH_HARNESS_ROOT` 到该处，原工作区和功能 worktree 的 strict 均 123/123 通过；
  #39 完整 verify 的 338 项测试通过，见 [本轮证据](verification/batch-1-readonly-text/WALKTHROUGH.md)。
- 默认 `DSH_HARNESS_ROOT` 指向 `/Users/pc2026/Dev-Space/deepseek-harness`，交接时已为
  `0.1.5-alpha.1` / `5dda764ed3aa172535a7967b06ff95d9cbfe536a`。该检出相对旧 lock 的
  strict 退出 1，版本、commit、文档摘要 3 项不匹配；兼容性尚未评估。
  下方 alpha.2 与路径移动记录仅保留其当时事实。
- 本次未修改 lock、依赖或执行 `context:link`。独立临时 3291 服务已停止；
  用户原有 3185 实例本次未重启、未升级。恢复前重新核对实际实例与目标基线。

## 本机环境事实（2026-09-08）

- **目录恢复后的复核**：插件仓库现回到
  `/Users/pc2026/Dev-Space/dsh-md-preview`，`DSH-Space` 下的插件路径已不可用，
  在当前工作目录启动命令正常。默认 Harness 检出仍为 `0.1.3-alpha.2`，
  `pnpm context:check:strict` 退出 1，共 35 项失败（版本、commit、文档摘要及
  32 项构建入口）。同级 `deepseek-harness-baseline-0.1.2-rc.1` 的 Git worktree
  元数据入口仍无法解析，`git rev-parse HEAD` 退出 128。插件依赖仍为 Registry
  版本，本次未修改 lock、依赖或 worktree 元数据。以下移动记录保留当时状态。
- **目录移动后的复核**：插件仓库现位于
  `/Users/pc2026/DSH-Space/dsh-md-preview`，原 `Dev-Space` 路径已不存在，已有改动保留。
  `DSH_HARNESS_ROOT` 仍指向旧路径，因此本次 `pnpm context:check:strict` 退出 1，
  报告 1 项失败：找不到固定基线源码。同级 `deepseek-harness` 仍为下述
  `0.1.3-alpha.2` 检出且缺少 32 项构建入口；同级
  `deepseek-harness-baseline-0.1.2-rc.1` 的 32 项入口存在，但其 `.git` 仍引用
  旧目录，`git rev-parse HEAD` 失败，尚未恢复固定基线检查。插件仍使用 Registry
  依赖，本次未修改依赖、lock 或 Git worktree 元数据。下文旧 CLI 路径仅为历史记录。
- **目录移动前的访谈复核**：`DSH_HARNESS_ROOT` 指向
  `/Users/pc2026/Dev-Space/deepseek-harness`，其检出已为 `0.1.3-alpha.2`、commit
  `c389f96bf3a9b6807cb71ed6bdad5849be0df6d8`，与插件 lock 的 `0.1.2-rc.1` 不一致。
  该检出的受检包缺少 main/types 构建入口；`pnpm context:check:strict` 实际退出 1，
  共 35 项失败（版本、commit、文档摘要及 32 项构建入口）。插件开发依赖仍为
  Registry 固定版本。本次保留失败结果，未修改 lock 或依赖；恢复固定源码与构建
  状态后需重验，先前发布验证不能替代当前基线检查。
- 以下 CLI 与实例信息是 **v0.10.0 发布时记录**，后续操作前重新核对。
  `dsh` 不在本机 PATH；CLI 入口为
  `node /Users/pc2026/Dev-Space/deepseek-harness/apps/cli/lib/bin.js`。
  基线为 `0.1.2-rc.1`，commit 以仓库 lock 为准。
- 当前人工验收使用 `DSH_HOME=/Users/pc2026/.dsh`、profile `r3-accept`、端口 3185、
  tmux `dsh-r3`。启动参数为 `--profile r3-accept --port 3185 --no-open`。
  其他端口与旧 `web` 实例需要独立确认；它们不是本次重启目标。
- npm 默认 registry 指向 npmmirror；发布与验货显式使用 npm 官方 Registry。
  本机发布链路使用代理 `http://127.0.0.1:8888`，账号 `benz.ai.coder` 开启 2FA。
  这些是本机记录，换环境时重新确认。
- v0.10.0 发布前 `npm whoami` 返回 401。实际解决方式：使用权限 0600 的临时
  `NPM_CONFIG_USERCONFIG`，执行 `npm login --auth-type=web`，登录与发布使用同一配置。
  登录和发布分别出现浏览器授权；完成后移除临时配置。不要把 token 或认证 URL 写入仓库。
- npm 浏览器 2FA 使用 tmux 中的真实 TTY；发布 stdout 保持终端输出。
  重定向可能使 npm 判为非交互并返回 EOTP。认证未完成时不能把等待或超时当作授权。
- `--dump-config` 只检查组合结果，不运行插件服务；干净 profile 的平台 peer 由正常
  boot 层满足。曾见 hoisted profile 的独立 peer 检查与实际 boot 结果不同，需以后者
  加普通包名导入验证闭环，不能仅据 peer 告警判定可用或不可用。
- v0.10.0 更新前的 profile 备份路径由本机
  `/tmp/mdpreview-0100-r3-backup.txt` 记录；这些临时路径可能随清理失效。

## 已闭环事故

- **0.2.4 陈旧包**：测试有未捕获异常，vitest 退出 1；外层过滤管道吞掉退出码，旧
  client 被发布。现有发布路径增加产物检查；任何输出过滤都必须保留真实退出码。
  该版本已于 2026-09-06 deprecate，提示使用 >=0.2.5。
- **FsTarget 形状**：真实值是 `{ targetKey, displayPath }`，实现与 fake 都不能假设 `.path`。
- **配置覆盖**：profile patch 按 id 覆盖已有行时，`config` 整体替换而非深合并。
  包括 webserver 配置在内，需要保留的自定义字段必须重述，其他字段回到 schema 默认值。
- **pnpm 11 构建白名单**：验收 profile 已有的可信 koffi/esbuild 授权迁移到
  `pnpm-workspace.yaml` 的 `allowBuilds` 后安装成功。Git 源码安装本插件需要执行
  `prepare`；Registry 归档已含构建输出，安装形态不能混为一谈。
- **源码链接依赖解析**：2026-09-06 session-graph 的依赖缺失由源项目补 peer 声明
  并将 web profile 改为 Registry 引用解决。`link:` 依赖按真实路径解析，源码 rig
  必须有自身可解析的依赖，不能假设能借用 profile 的 boot 修复层。

## 命令速查

```sh
pnpm context:check:strict             # 修改前检查固定基线
pnpm context:link                     # 显式切换/重建源码链接，会修改依赖与锁文件
pnpm verify                          # 类型、测试、构建与产物全链
pnpm watch:client                    # 客户端开发监听
pnpm pack:publishable                # 构建并生成净化归档，随后验证同一归档
node /Users/pc2026/Dev-Space/deepseek-harness/apps/cli/lib/bin.js --profile r3-accept --dump-config
```

HMR、Mermaid 暗色与内联文档提及等长期项统一见 [TODO](../TODO.md)；
历史评审 follow-up 保留在 [批次记录](../PIPELINE_STATE.md)，实施前需对照当前源码复核。
