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
| 1 | 1 | feat/batch-1-r1-reliable-use | #21,#22,#23,#24 | R1 使用可靠：统一守卫+头部入口+保存反馈+轮验收 | L | - | developing | 0 | 0 |
| 2 | 2 | feat/batch-2-r2-reading-continuity | #25,#26,#27,#28,#29 | R2 阅读连续：位置恢复+偏好记忆+空间安排+继续阅读+轮验收 | L | PR-1 | planned | 0 | 0 |
| 3 | 3 | feat/batch-3-r3-find-efficiency | #30,#31,#32,#20 | R3 查找高效：工作区搜索+快捷入口+轮验收+spec 收尾 | L | PR-2 | planned | 0 | 0 |

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
- 上次中断位置：PR-1 ② 开发实质完成（pr1-dev2），待正式回传后进 ③
- 2026-09-07 17:05 pr1-dev 因 API 429（账号 5 小时限额，19:06 重置）中断于 #21 TDD 中途；17:1x 恢复后推进至 17:50 二次 429（19:12 重置）。中断时 #21（b766bfd+9998376）、#22（fb564b6）、#23（8102d31）已提交，185/185 绿，工作区干净；#21/#23 各余 1 条、#22 余 6 条真实页面类 AC 未勾（归 #24 走查验证）
- 17:5x 改派 pr1-dev2（sonnet 模型池）接手 #24 + 遗留 AC；设 19:13 one-shot 兜底（pr1-dev2 若也 429 则限额重置后唤醒 pr1-dev）
- 18:0x pr1-dev2 完成：新增 3ee8687（焦点环）+ 079fa09（行为契约/词汇表同步），#21/#22/#23/#24 AC 未勾数全部归零，工作区干净；已催收 YAML 回传
- 下一步：收到回传 → ③（pnpm verify 复核 + 建 PR，含 Closes）→ ④ 隔离评审 → ⑤ 闸门 → ⑥ 合并 → ⑦ 记录
- 未发送通知：无
