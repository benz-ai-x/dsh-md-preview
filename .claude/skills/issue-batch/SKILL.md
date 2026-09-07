---
name: issue-batch
description: 批量开发 GitHub issues 的自主流水线：分组规划 PR → TDD 开发 → review → 合并 → 飞书通知。手动执行 /issue-batch [--dry-run] [--confirm] [--issues 1,2,3] [--long-run]。
disable-model-invocation: true
argument-hint: "[--dry-run] [--confirm] [--issues <ids>] [--long-run]"
metadata:
  requires:
    bins: [gh, lark-cli]
---

# issue-batch：批量完成本仓库全部 open issues

## 参数（$ARGUMENTS）
- 无参数：全量自动执行（默认）。
- `--dry-run`：只做阶段 0-1 并输出规划表；不建分支、不建 PR、不写状态文件、**不建群、
  不发任何通知（含验证消息，飞书仅检查登录态）**。
- `--confirm`：每个 PR 过闸门后、合并前飞书【需决策】并等待确认，其余流程不变。
- `--issues <ids>`：只处理指定编号（逗号分隔），启动快照范围即该子集。
- `--long-run`：读取 references/long-run.md 的多日特性（批次循环、心跳、节奏护栏、
  12h 重发、发版）并入流程。
- `--notify <群名或 chat_id>`：指定通知群；不指定则自动创建专用话题群。

## Preflight（开工前逐项执行的检查清单）
| # | 检查项 | 方法 | 不满足时 |
|---|--------|------|---------|
| 0 | 续跑检测：PIPELINE_STATE.md 是否已存在 | 仓库根目录探测 | 已存在 ⇒ **续跑模式**：转恢复协议（读文件→对账→续跑），不再走新任务流程 |
| 1 | gh 认证 · GitHub 远程 · push 权限 | `gh auth status`、`git remote -v` | 退出 |
| 2 | git 仓库 · 工作区干净 · **默认分支名** | `git status --porcelain`、`git symbolic-ref refs/remotes/origin/HEAD` | 不干净或非 GitHub ⇒ 退出；默认分支非 main ⇒ 全程改用实际默认分支 |
| 3 | gh / lark-cli 可用 | `command -v gh lark-cli` | 退出 |
| 4 | 全量测试与 lint 命令 | package.json scripts / Makefile / CI 配置 | 探不到 ⇒ 询问后继续，不得瞎猜 |
| 5 | 飞书通道端到端 | (a) `lark-cli` 登录态（auth status 类子命令，现场确认）；(b) `--notify` 解析或 `+chat-create` 建话题群，确认 `+messages-send` 参数式；(c) 发一条 🔧 验证消息（模板见 dispatch-templates.md），**续跑模式改发 🔁 续跑通知**；(d) 探测 bot 身份可用性 ⇒ 定「双向级别」L1/L2/L3 并解析用户 open_id | 未登录/发送失败 ⇒ 交互模式警告并询问；supervisor 模式仅记积压继续（通知失败不阻塞开发）；bot 不可用 ⇒ 降级 L1，不阻塞其余检查 |
| 6 | 存在 open issue | `gh issue list` | 无 ⇒ 报告退出 |
| 7 | `--long-run`：supervisor 已配置 | 提醒确认（配方见 references/long-run.md） | 警告，不阻塞 |

执行规则：
- 逐项执行、逐项输出 ✅/❌（第 0 项命中输出「续跑模式」），构成会话里第一份可见产物；
- 全部通过 ⇒ 结果（命令式、默认分支、群 chat_id）写入状态文件元信息；
  `--dry-run` 只打印清单不落盘；
- 开工通知（见「飞书通知」）附带「Preflight N/N ✅」；
- 任一项失败 ⇒ 非交互模式（supervisor 拉起）下飞书发 🔴 后退出，幂等键含失败原因摘要
  （同一原因的重复失败自动去重，不会随 30 分钟拉起反复轰炸）；交互模式仅在会话报告。

## 运行时适配（Claude Code / Codex 双兼容）
本 skill 骨架（流程、状态文件、闸门、通知、gh/git/lark-cli）与运行时无关；
按能力探测选择执行路径，不假设自己是哪个 harness：

**能力 A · 隔离派发**（②④ 的执行方式，探测顺序）：
1. 有 Task/Agent 类子 agent 工具（Claude Code）→ 用之；
2. 无 → 用 CLI 子进程：`codex exec "<派发 prompt>"` 或 `claude -p "<派发 prompt>"`
   （新进程 = 全新上下文，隔离性等价）；
3. 都不可用 → 同会话降级：顺序执行 ②④，评审前只重读 diff 与 AC 材料、
   不回看开发过程，PR 描述注明「非隔离评审」。

**能力 B · 被引用 skill 的名字映射**（探测哪个可调用用哪个）：
| 逻辑用途 | Claude Code | Codex（~/.codex/skills） |
|----------|-------------|--------------------------|
| TDD 逻辑型 | /test-driven-development（superpowers） | 无 → 回退 /tdd |
| TDD 集成行为型 | /tdd（mattpocock-skills） | /tdd（同名同源） |
| 双轴评审 | /mattpocock-skills:code-review | /code-review（裸名同源） |
| correctness 专项 | 内置 /code-review | 无 → 并入双轴评审清单执行 |

**能力 C · supervisor 拉起命令**：`claude -p "/issue-batch --long-run"` 或
`codex exec "按 .claude/skills/issue-batch/SKILL.md 执行 issue-batch --long-run"`。

frontmatter 中 Claude Code 专属字段（disable-model-invocation 等）在 Codex 侧被忽略，无害。

**引用协议**：本 skill 设有 disable-model-invocation，模型不能经 Skill 工具调度它，
slash 形式仅在两种情况有效——用户亲手键入，或 `claude -p` 顶层的命令提示。
**任何其他上下文（goal 式提示、循环注入、会话内提及）一律用文本引用形式**：
「按 .claude/skills/issue-batch/SKILL.md 执行 issue-batch <参数>」——
模型读文件执行，效果等价且不依赖调度权限。

## 运行参数（可选 YAML 覆盖：仓库根 `issue-batch.yml`）
正文中的阈值为默认值；仓库根存在 issue-batch.yml 时按其覆盖（只写要改的键），
Preflight 读入并记入状态文件元信息。schema：
```yaml
fuse:   {review_rounds: 3, ci_red_rounds: 2, total_blocked_stop: 3}
packing: {small: "5-8", medium: "3-4", large: "1-2", simple_repo: "3-5", batch_threshold: 15}
notify: {urgent_after_hours: 2, urgent_max_times: 3, heartbeat_hours: 2}
guard:  {pr_stall_hours: 6, batch_timeout_hours: 24}   # --long-run 节奏护栏
```

## 不适用边界（拒绝启动）
- issue tracker 不是 GitHub（GitLab / Jira 等），或无合并权限。
- 仓库没有任何 open issue（直接报告退出）。

---

## 心智模型
本任务可能跨多个会话、多次上下文压缩运行，期间世界会变、你的记忆不可靠：
进度只存在于 PIPELINE_STATE.md；事实只认 gh / git 的实测状态；每个 PR 在隔离的全新上下文中执行。

## 全程不变式（优先级高于任何阶段指令）
1. 真相源：issue / PR / 分支状态以 `gh issue list`、`gh pr list`、`git log` 实测为准，
   状态文件与记忆只是索引；冲突时以实测为准修正文件后继续。
2. 状态文件 PIPELINE_STATE.md（阶段 1 创建、每次状态变化立即更新）：issue 快照与规划表、
   每 PR 状态（planned / developing / in-review / merged / blocked）与 review·CI 轮数、
   跳过与熔断记录及原因、阶段 0 确定的测试命令与合并方式。
   **格式必须严格按 references/state-template.md**（创建/更新前先读它）。
3. 恢复协议：任何新会话开工前先读状态文件并与 gh/git 对账，从第一个未完成 PR 续跑，
   禁止重新规划已完成部分。**续跑前先执行「决策查收」**（见 dispatch-templates.md）：
   拉取未决 🔴 消息的话题回复，解析出的决策写入状态文件后才续跑。
4. 对外通知一律按「飞书通知」一节执行，消息格式见 references/dispatch-templates.md。

## 阶段 0：侦察（checklist）
| # | 检查项 | 方法 | 产出（写入状态文件元信息） |
|---|--------|------|---------------------------|
| 1 | 项目文档 | AGENTS.md / CLAUDE.md / HANDOFF.md / README（存在哪个读哪个） | 几句话复述技术栈/结构/约定——阶段完成判据 |
| 2 | 测试与 lint 命令落定 | 承接 Preflight 第 4 项探到的来源，落定具体命令并验证可解析（`--help` 级，不跑全量） | 命令原文 |
| 3 | 合并方式 | CONTRIBUTING + 近期已合并 PR 的历史形态，判定一次全程冻结 | merge/squash/rebase；判不出默认 squash |
| 4 | CI 检查项 | `.github/workflows` | 有 ⇒ 检查名列表（供 `gh pr checks`）；无 ⇒ 闸门降级为本地全量测试，PR 描述注明 |
| 5 | commit 风格 | `git log` 近 20 条的惯例 | 遵循仓库惯例；无惯例默认 conventional commits |

执行规则：逐项输出 ✅ 及结论；全部产出随阶段 1 一并写入状态文件元信息；
`--dry-run` 同样执行本阶段（dry-run 覆盖阶段 0-1）。

## 阶段 1：规划（快照即范围，checklist）
| # | 检查项 | 方法 | 产出 |
|---|--------|------|------|
| 1 | 快照采集 | `gh issue list`（`--issues` 时即该子集） | 启动快照 = 本轮唯一范围；新增 issue 只进「待下轮清单」，不自动纳入 |
| 2 | 逐 issue 判定 | 读正文 + AC + 评论；无 AC 的 issue ⇒ 以正文目标拟定 AC 并在 issue 评论留档 | 判定表：issue → S/M/L · 所属模块 · 依赖（依赖谁 / 被谁依赖）· TDD 路由（逻辑型 / 集成行为型） |
| 3 | 依赖环检查 | 对判定表做拓扑排序 | 无环 ⇒ 序即 PR 顺序；**有环 ⇒ 环上 issue 合并进同一 PR**，无法合并的标 skipped 待人工澄清 |
| 4 | 分组打包 | ≤15 个：每 PR 3-5 个（简单且关联紧的可更多，特别复杂的可单独成 PR）；>15 个：先按模块与依赖聚批（被依赖的基建 issue 排前），批内按 S 5-8 / M 3-4 / L 1-2 个每 PR | PR 分组 |
| 5 | 排序与上限 | PR 间按依赖拓扑排、PR 内 issue 按编号从小到大；「关联紧密」= 改动同一模块目录或共享同一接口 / schema 变更；单个 PR 的 diff 以能被一次 review 消化为上限 | 最终规划表 |
| 6 | 落盘 · 冻结 · 开工 | 规划表 + 快照写入 PIPELINE_STATE.md；发 🟢 开工通知（Preflight N/N ✅ + issue 总数 + 分组概要 + 预计节奏） | 状态文件就绪 + 飞书第一条正式通知；规划即冻结，调整须记录原因 |

`--dry-run`：执行第 1-5 项后**打印规划表即结束**——不落盘、不发通知。

## 主循环：逐 PR 推进（串行，②④ 在隔离会话执行）
① 开工对账：置为 developing → git fetch origin → 核对所含 issue（被外部关闭则移出并通知，
   AC 被更新则以最新为准）→ 从最新 main 建分支 feat/batch-N-topic。
   ✔ DoD：分支已建；issue 状态已按 gh 实测核对；状态文件 = developing。
② 隔离开发（全新上下文子 agent，输入 = 本 skill + 状态文件该 PR 条目 + issue 全文，
   派发与回传格式见 references/dispatch-templates.md）：
   - TDD 按 issue 类型路由（阶段 1 判定时顺带标注到判定表）：
     逻辑 / 算法 / 业务规则型 → /test-driven-development（superpowers，严格小步：
     先写测试、看到失败、最小实现、再重构）；
     UI / 布局 / 可访问性 / 集成行为型 → /tdd（mattpocock-skills，集成测试优先：
     通过真实渲染与交互断言验收，禁止以 DOM/CSS 类存在性断言冒充布局验收）。
     指定 skill 不可用时按红绿重构自律执行。每个 issue 至少一个独立 commit
     （遵循阶段 0 冻结的 commit 风格）；
   - AC 满足一条勾一条，未满足的继续开发直至可勾选；勾选前重新拉取 issue 最新正文，
     禁止用缓存正文整段覆盖；「无法代码验证」仅限需线上环境、第三方账号、人工视觉或
     业务拍板的 AC，性能、边界、错误处理不得豁免；
   - 存在未勾 AC 的 issue 用 Refs #n 关联（不用 Closes），保持 open 待人工确认；
   - 单个 issue 做不下去：挂起继续其余，半成品优先 revert 剥离，剥不掉则移出 PR 并注明，
     绝不合并未完成实现。
   ✔ DoD：每个 issue 处于「AC 全勾」或「挂起 / 移出且有记录」；commits ≥ issue 数；
   回传含测试与阻塞摘要。
③ 提交：跑全量测试与 lint 并把命令与结果写入 PR 描述 → origin/main 有新提交时，
   无冲突则 Update branch 后重跑测试，有冲突则解决后对冲突部分重过 review →
   PR 描述列出所含 issue 及 Closes / Refs。
   ✔ DoD：PR 已创建；描述含 issue 列表、Closes/Refs、测试命令与结果原文；main 漂移已处理。
④ 评审（隔离会话跑 /mattpocock-skills:code-review——双轴：Spec 轴对照 AC、
   Standards 轴对照仓库规范；不可用回退内置 /code-review。只给 diff 与 AC，
   派发格式见 references/dispatch-templates.md）：
   仅 blocking / high 级 finding 阻塞合并并计入轮次，低优先级记 follow-up；
   有 blocking finding → 修复后重走 ④⑤，轮次 +1。
   同轮专项叠加（按判定表路由，一轮内完成，不增加轮次）：
   - 逻辑型 PR → 加跑内置 /code-review 的 correctness 视角（并发 / 边界 / 算法缺陷）；
   - 集成行为型 PR → 必含「断言质量检查」：测试是否真实渲染 / 命中 / 交互级，
     DOM/CSS 类存在性断言冒充验收的，直接标 blocking。
   ✔ DoD：findings 已分级记录；low 已入 follow-up；轮次已更新到状态文件。
⑤ 闸门（缺一不可）：CI 全绿（无 CI 仓库以本地全量测试为准）＋ 全量测试通过 ＋
   无未解决 blocking finding。CI 红：本 PR 引起 → 修复重推；疑似 flaky → rerun 一次；
   连续 2 轮红 → 熔断。严禁删除测试、skip / 放宽断言让套件变绿，确需如此按熔断处理。
   `--confirm` 模式：过闸门后、合并前飞书【需决策】等待确认；3 次加急（约 6h）
   仍未获确认 ⇒ 该 PR 转暂缓（同熔断处理），继续无依赖 PR，终局统一重试。
   ✔ DoD：三闸全绿，或已按规则熔断；--confirm 模式已获确认。
⑥ 合并：**先过下方「合并前总检」** → 合并前再 fetch 一次 → 按冻结的合并方式合并，
   失败则刷新分支重试一次，仍失败按阻塞处理 → 成功后删远端与本地分支（blocked 分支保留）
   → 拉最新 main 跑全量测试，绿了才进入下一个 PR。
   ✔ DoD：合并成功；分支已删（blocked 除外）；合并后 main 全量回归绿。
⑦ 记录：置为 merged，按「飞书通知」发消息。
   ✔ DoD：状态文件 = merged；🟢 已发或已记积压。

### 合并前总检（进入 ⑥ 前逐项打勾；聚合各处条件的引用，任一未过不得合并）
| # | 检查项 | 来源 |
|---|--------|------|
| 1 | 快照内每个 issue：AC 全勾，或 Refs + 未勾原因已留档 | ② |
| 2 | 全量测试与 lint 通过，命令与结果已写入 PR 描述 | ③ |
| 3 | CI 全绿（无 CI 仓库以本地全量输出为准） | ⑤ |
| 4 | 无未解决 blocking finding，轮次未达熔断阈值 | ④⑤ |
| 5 | origin/main 无新提交；有则已 update / 解冲突并重测、冲突部分已重 review | ③⑥ |
| 6 | 人工合并清单未命中（命中 ⇒ 转「需人工合并」，不自动合并） | 人工合并清单节 |
| 7 | `--confirm` 模式已获飞书确认 | 参数 |
| 8 | PR 描述完整：issue 列表、Closes/Refs、测试证据 | ③ |

## 异常分级（全文唯一出处）
- issue 级：挂起该 issue、继续其余（见 ②）。
- PR 级熔断（review 连续 3 轮不通过或 CI 连续 2 轮红）：置为 blocked、分支保留、
  飞书【需决策】通知后跳过它，继续不依赖它的 PR；全部可执行 PR 结束后统一重试一轮，
  仍失败保持 blocked 进总结。
- 整体停机（仅两种情况）：被熔断 PR 阻塞全部剩余工作，或累计 3 个 PR 熔断。
- 全局阻塞：仅 gh / git 认证失败这类使一切推进不可用的情况；飞书发送失败不算。

## 人工合并清单（过了闸门也不自动合并）
数据库迁移或 schema 变更；删除文件 / 目录 / 公开接口 / 数据、大面积删码；认证、授权、
密钥、权限相关；.github/workflows、部署与环境配置；依赖大版本升级；首个涉及公共接口或
schema 的基建 PR。命中则注明「需人工合并」并飞书等确认；无依赖关系的 PR 照常推进，
**依赖它的下游 PR 暂缓**（同熔断处理），待该 PR 人工合并后续跑。

## 飞书通知（全文唯一出处）
- 通道分离：全部消息发进专用通知群（preflight 准备，群可开免打扰）；
  🔴【需决策】与整体停机**同时发私聊**，保证重要事项必达。
- 分级（首行 emoji+标签）：🔴【需决策】/ 🟡【告警】/ 🟢【仅知会】。
- 即时发送：规划定稿（🟢 开工通知：issue 总数、PR 分组概要、预计节奏）、阻塞（含
  issue 挂起知悉 🟡）、熔断、整体停机、需人工合并、节奏护栏告警（--long-run 🟡）、
  批次总结（--long-run）、全部结束。
- 例行进度（issue 完成、PR 合并）逐条进群；每个 PR 合并时另发一条本 PR 汇总
  （diff 统计 + 测试结果）。
- 🔴 升级链：发出 2 小时未响应 → `urgent_app` 加急重发，仍无响应每 2 小时一次、最多 3 次；
  SMS/电话加急（urgent_sms/urgent_phone）默认关闭，需在状态文件元信息中显式开启。
- 每条消息带幂等键（<repo>#<事件>#<对象ID>），重试与补发不重复。
- 发送失败不阻塞开发：记入状态文件，恢复后积压合并为一条「离线期间汇总」补发。
- **双向分级**（Preflight 定级）：L1 轮询查收（≤30min 生效）；L2 等待决策时事件监听
  （秒级）；L3 常驻收件箱 daemon（秒级 + 跨会话）。机制见 dispatch-templates.md 3.5。
- 消息模板、确切命令与接收人规则见 references/dispatch-templates.md。

## 终局
范围 = 启动快照。终局 = 快照内每个 issue 处于「被合并 PR 关闭」或「skipped / blocked
且附原因」，所有 PR 处于 merged 或 blocked；发送最终总结（含全部非 merged 明细与待下轮清单）。
