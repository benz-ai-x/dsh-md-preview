# --long-run 多日特性

仅当启动参数带 `--long-run` 时读取本文件并入流程；日常单会话跑不需要这些规则。

## 1. 批次循环：批末维护（多批时，每批全部 PR 到达终态后执行）
1. 对账世界：重新 `gh issue list` 对照快照——外部关闭的移出并说明；AC 更新的重新核对；
   新 issue 记入「待下轮清单」并在通知中列出，不自动纳入。
2. 轻量重规划：按实际剩余 issue 与跳过的连带影响修订后续批次分组，原因记入状态文件。
3. 卫生检查：无未推送 commit、无悬空分支。
4. 飞书发批次总结（本批 issue/PR 结果、熔断与跳过明细、下批计划），然后自动进入下一批。
   （如需人工把关，把上句改为「等我确认后再继续」。）

## 2. 心跳与节奏护栏（长跑遥测）
- 心跳：每完成一个 PR 或每 2 小时发一次进度心跳（N/M、当前 PR、距上次合并时长），标 🟢。
- 单 PR 超 6 小时无 commit 进展、或单批超 24 小时未完成 → 发 🟡 告警并自查是否陷入循环。
- 熔断等待期间每 12 小时重发一次待决策摘要（配合 🔴 升级链，防淹没后遗忘）。

## 3. 收尾发版
- 仓库有 CHANGELOG / release 惯例 → 按惯例补条目并发版（tag + GitHub Release）；
- 无惯例 → 跳过并在最终总结注明「未发版」。

## 4. 外部 supervisor 配方（安装在 skill 之外，skill 无法自救进程死亡）

长跑（3 天以上）建议二选一配置拉起机制，配合状态文件的恢复协议实现断点续跑：

**cron 方案**（每 30 分钟拉起一次，按运行时二选一）：
```cron
# Claude Code
*/30 * * * * cd <仓库路径> && claude -p "/issue-batch --long-run" >> .issue-batch-supervisor.log 2>&1
# Codex
*/30 * * * * cd <仓库路径> && codex exec "按 .claude/skills/issue-batch/SKILL.md 执行 issue-batch --long-run" >> .issue-batch-supervisor.log 2>&1
```
- PIPELINE_STATE.md 存在时 skill 自动走恢复协议续跑；全部完成时会因「无 open issue /
  终局已达成」立即退出，不会重复开发。

**ralph-loop 方案**：循环提示词用文本引用形式（slash 在循环注入的文本里不会被
展开，且本 skill 禁止模型自动调度）：
「按 .claude/skills/issue-batch/SKILL.md 执行 issue-batch --long-run：
先读 PIPELINE_STATE.md 决策查收与对账续跑，终局已达成则直接退出」，30 分钟间隔。

**死亡判定约定**：超过 4 小时未收到任何飞书消息（含心跳）→ 视为流水线死亡，
人工检查 `.issue-batch-supervisor.log` 与 PIPELINE_STATE.md 的「恢复注记」。

**飞书回复的生效时延**：你在飞书里对 🔴 的话题回复，最迟在下一次拉起（≤30min）被
「决策查收」解析并生效——不需要人工把决策再搬到会话里说一遍。
