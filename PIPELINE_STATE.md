# PIPELINE STATE（issue-batch 生成，续跑入口）

## 元信息
- 启动时间：2026-09-07T16:38:44+08:00
- Preflight：7/7 通过，2026-09-07T16:38+08:00（含：默认分支 main）
- 启动快照 issue：#20, #21, #22, #23, #24, #25, #26, #27, #28, #29, #30, #31, #32
- 测试命令：pnpm test（vitest run）；全量闸门 pnpm verify（context:check:strict + typecheck + test + build + built:check）
- lint 命令：无独立 lint 脚本（pnpm typecheck 兜底，仓库无 eslint/prettier 配置）
- 合并方式：rebase（判定依据：PR历史——PR #19 逐 commit 保留无 merge commit；PR #7 为 merge，以近期为准）
- commit 风格：英文祈使句叙事式标题（无 conventional 前缀），PR 内逐 issue 独立 commit，带 (#n) 尾注
- CI：无（闸门降级为本地 pnpm verify 全绿，PR 描述注明）
- 模式：默认
- 通知群 chat_id：oc_bc83ca7c9d6a0c8611d8df52b8697b52（bot 建话题群「issue-batch·dsh-md-preview」）
- 发送命令式：lark-cli im +messages-send --as bot --chat-id oc_bc83ca7c9d6a0c8611d8df52b8697b52 --markdown "<md>" --idempotency-key "dsh-md-preview#<事件>#<对象ID>"
- 加急升级：仅 urgent_app
- 运行参数覆盖：无
- 双向级别：L1 轮询；用户 open_id：ou_e4e49d75c1cc297851cb63814663ce76（仅此发送人的回复可作决策）
- 通道备注：用户尚未入群（bot 缺 im:chat.members:write_only，已提供加群链接）；发送链路已验证（🔧 om_x100b66d331a608b8b123d0a43fc1f92）

## 规划表
| 批 | PR | 分支名 | issue 列表 | 主题 | 复杂度 | 依赖 | 状态 | review轮 | CI轮 |
|----|----|--------|-----------|------|--------|------|------|---------|------|
| 1 | 1 | feat/batch-1-r1-reliable-use | #21,#22,#23,#24 | R1 使用可靠：统一守卫+头部入口+保存反馈+轮验收 | L | - | merged | 2 | 0 |
| 2 | 2 | feat/batch-2-r2-reading-continuity | #25,#26,#27,#28,#29 | R2 阅读连续：位置恢复+偏好记忆+空间安排+继续阅读+轮验收 | L | PR-1 | merged | 1 | 0 |
| 3 | 3 | feat/batch-3-r3-find-efficiency | #30,#31,#32,#20 | R3 查找高效：工作区搜索+快捷入口+轮验收+spec 收尾 | L | PR-2 | merged | 1 | 0 |

状态枚举：planned / developing / in-review / merged / blocked（只允许这五个值）。
review轮 / CI轮：当前累计轮次，熔断判定用（review≥3 或 CI≥2）。

规划调整记录：dry-run 初版 8 PR（验收票/L 票单独拆分），经用户质疑 PR 数偏多，对照仓库先例（PR #19 装 8 issue / 11 commits）与 skill 默认 packing（3-5/PR）修正为 3 PR——对齐 spec 三轮结构，阶段门槛由 PR 串行满足。缓解：逐 issue 独立 commit + rebase 保留分块 review；issue 级挂起机制控制熔断半径。

## 判定表
| issue | S/M/L | 所属模块 | 依赖 | TDD 路由 |
|-------|-------|----------|------|----------|
| #21 | L | client 面板意图层 + Cordis/Slot 装配 | - | 集成行为型 /tdd |
| #22 | M | client 头部布局与可访问性 | - | 集成行为型 /tdd |
| #23 | M | client 编辑/保存状态 + Remote 读写 | #21 | 集成行为型 /tdd |
| #24 | M | 集成验收/打包冒烟/真实页面 | #22,#23 | 集成行为型 /tdd |
| #25 | L | client 阅读记录 + 大纲恢复 | #24 | 逻辑型 /test-driven-development |
| #26 | M | client 几何与导航偏好存储 | #24 | 逻辑型 /test-driven-development |
| #27 | M | client 布局排版与空间安排 | #26 | 集成行为型 /tdd |
| #28 | S | client 浏览脸「继续阅读」入口 | #25 | 集成行为型 /tdd |
| #29 | M | 集成验收/真实页面 | #27,#28 | 集成行为型 /tdd |
| #30 | L | 宿主遍历 + Remote 契约 + client 搜索 UI | #29 | 逻辑型 /test-driven-development |
| #31 | M | client 快捷入口 + 回合产出事实消费 | #29 | 集成行为型 /tdd |
| #32 | M | 集成验收/打包冒烟/真实页面 | #30,#31 | 集成行为型 /tdd |
| #20 | - | spec 交付跟踪票（终局随 PR-3 收尾关闭） | 全部轮次 | - |

阶段 0 侦察结论：DSH Client UI 插件（Markdown 预览面板）；TS + Cordis 命名空间函数插件 + React 客户端（src/client/）+ 宿主服务与 Remote 契约（src/index.ts、remote.ts、protocol.ts、typert/）+ vitest（tests/，157/157 绿）。硬约束：具名导出无 default、Config 配同名 Standard Schema、注册可逆、baseline-only 运行时导入、lazy-CJS 构建协议、面板只持 UI 局部 viewing state（AGENTS.md / PROJECT_CONTRACT.md）。

## 跳过与熔断记录
| 对象 | 类型 | 原因 | 时间 |
|------|------|------|------|

## follow-up 记录（low 级 finding，不阻塞）
PR-3 / review 轮 1（axes: spec pass / standards pass；specialty: correctness pass + assertion_quality pass；无 blocking/high）：
1. WorkspaceBrowser.tsx:489 快捷行 aria-label 未插值 t('quick.open')（字面含 {name}）——传 { name } 或去掉占位符
2. remote.ts:262 search 文件匹配不做 fs.contains，越根符号链接文件可与根内同名档冲突（重复 key，点击打开根内文件）——文件条目同样过 contains 或跳过
3. remote.ts:282 命中恰等于 searchMaxResults 且 frontier 已空时仍标 result-limit/complete=false（完整答案误报不完整）——仅实际截断时标记
4. WorkspaceBrowser.tsx:628 不完整提示只有原因无「下一步」（AC3 字面）——补一句或记已知取舍
5. host-search.spec 缺「子目录解析越出根」宿主边界用例（可与 #2 合并先红后绿）
6. r3-acceptance 走查缺 <640 阈值下侧记录（AC5 字面）——引用 R2 记录或补一次
7. PreviewOverlay.tsx:631 reading.recent(sessionId, 8) 无名上限与 QUICK_RECENT_MAX=3 并存——命名常量
8. turn-files.ts:38 as unknown as 双重转换、RPC 签名 4 层复述、手写 fake 形状漂移——后续迭代收敛

PR-2 / review 轮 1（axes: spec pass / standards pass；specialty: correctness pass + assertion_quality pass；无 blocking/high）：
1. PreviewOverlay.tsx:589 onPanelKeyDown 依赖数组列 width 而分支按 appliedWidth 路由，纯视口 resize 跨 640 阈值时 Mod-Shift-O/E 走陈旧分支（改依赖含 appliedWidth/widePanel）
2. reading.ts:316 load() 成功解析未写 memory 记忆化，latest() 每帧重解析整包（与 preferences.ts 缓存做法对齐）
3. preferences.ts / reading.ts 的 createMemoryStorage/browserStorage 逐字重复，可单处导出共用
4. WorkspaceBrowser.tsx:384 失效目标仍占继续入口（规格内行为，体验留观：可在记录中降权/标注）

PR-1 / review 轮 1（axes: spec pass / standards pass；specialty: assertion_quality fail——仅由 blocking 构成）：
1. PreviewOverlay.tsx:238 同目标判定用请求路径而非宿主解析路径（方向保守，可选改为 content.file.path 或修正注释措辞）
2. client-assembly.spec.tsx:229 同目标重开/树行入口仅面板级覆盖，可补装配 bench 用例
3. （证据）#24 走查评论缺长名称头部修复前对照截图，可补 v0.7.2 同报告对照（pr2 评审确认 4c5a40a 已闭环此条）
4. WorkspaceDocsAction.tsx:53 胶囊卸载未发布 strip 0 / layerTop 打开时补测一次
5. 测试 helper（flush/buttonByAria/beforeAll shims）三套件重复可提取共享 test-utils；删冗余转型；NO_STRIP 回退可删
- blocking #1（已修复 5248ec7 + 轮 2 复核通过）：tests/client-edit.spec.tsx:618 冲突 reload 分支零交互覆盖

## 待下轮清单
- （运行期间新增的 issue 记在这里）

## 未决决策与决策记录
未决 🔴（发送时记录消息 ID，决策查收后归档）：
| 消息ID | 对象 | 事件 | 发出时间 |
|--------|------|------|----------|
决策记录：
| 消息ID | 对象 | 决策 | 依据回复 | 时间 |
|--------|------|------|----------|------|

## 恢复注记
- 上次中断位置：批次终局完成（2026-09-08）。PR-3 已 merged（PR #35，rebase，main=5aaf5c4，合并后回归 276/276 绿；review 1 轮 pass：无 blocking/high、双专项 pass、8 low 入 follow-up；分支已删；agents 已释放）
- 终局：启动快照 13 issues（#20-#32）全部被合并 PR 关闭（#33→#21-24、#34→#25-29、#35→#30-32+#20）；3/3 PR merged，0 skipped、0 blocked、0 熔断；待下轮清单空（运行期间无新增 issue）
- 本文件为已完成批次的追溯记录：下轮 issue-batch 启动时 Preflight 0 会检测到本文件进续跑模式，对账确认终局后可删除本文件重新开始
- 批次后项目待办（不在 issue-batch 范围）：发布 npm 版本（构建已到 0.9.0，按 TODO.md 既有流程：核查 npm 已有版本 + 干净 profile tarball 冒烟）；follow-up 共 16 条 low 记录于上方
- 下一步：收到开发回传 → ③（verify 实测 + 建 PR，Closes #30-#32 + #20）→ ④ 隔离评审（新 agent，双专项）→ ⑤ 闸门 → ⑥ 合并 → ⑦ 记录 → 终局总结（含全部非 merged 明细与 follow-up 清单）
- PR-2 已 merged（PR #34，main=429a4c2 后推进，回归 252/252 绿）；PR-1 已 merged（PR #33）；两批 agent 均已释放
- PR-2 ②③ 完成：五票 8/8、7/7、8/8、7/7、8/8 AC 全勾（#29 走查证据 docs/verification/r2-acceptance/，16 截图；走查发现缩窗宽度不重钳缺陷已修复+回归锁定；恢复操作成本 R1 3 次 → R2 1 次）；pnpm verify exit 0（252/252，调度实测复核）；main 无漂移；PR #34 已建（Closes #25-#29）
- 下一步：④ 评审回传 → 无 blocking 则 ⑤⑥⑦ → PR-3 ①
- PR-1 流程完整记录：② 四票 8/8 AC（两次独立真机走查互为复核）→ ③ verify exit 0 + PR #33 → ④ 轮 1 发现 1 blocking（reload 分支零交互覆盖）→ 修复 5248ec7 → 轮 2 复核通过 → ⑤ 闸门三绿 → ⑥ 总检 8/8 + rebase 合并 → main 回归绿
- PR-1 ②③ 完成：四票 8/8 AC 全勾（#24 走查证据见 issue 评论 5571706599）；pnpm verify exit 0（185/185，调度会话实测复核）；main 无漂移；PR #33 已建（Closes #21-#24，四票 AC 全勾故全用 Closes）
- 开发过程记录：pr1-dev 两次 429 中断（17:05/17:50，GLM 5h 限额），改派 pr1-dev2（sonnet）接手 #24；限额重置后 pr1-dev 恢复并回传最终报告。兜底闹钟已撤
- 并行插曲：dev1 恢复与 dev2 接手形成双活；dev2 对账后转向独立复核（未重复勾选/建 PR），交付 4c5a40a（同构建第二次独立走查：主链 13.5s 定位、守卫矩阵、冲突两分支磁盘核对、宽度/主题/双语矩阵、干净 profile 冒烟；27 截图 + WALKTHROUGH.md 入 docs/verification/r1-acceptance/，PR 评论 5571998389）。教训：改派接替者时应显式停掉原执行者，避免限额重置后双活
- 环境注意：3080 web 实例跑 v0.7.3（依赖 /tmp/mdp-r1-accept.tgz 勿删）；chrome-devtools MCP 服务器曾被置坏，走查用 CLI 通道
- 下一步：④ 评审回传 → 无 blocking 则 ⑤ 闸门（本地 verify 已绿 + 无 CI）→ ⑥ 合并前总检 → rebase 合并 → 删分支 → main 回归 → ⑦ 记录通知 → PR-2
- 未发送通知：无
