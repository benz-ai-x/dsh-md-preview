# PIPELINE_STATE.md 固定模板

创建：阶段 1 规划定稿后立即创建于仓库根目录，随仓库提交（便于跨机器/跨会话续跑）。
每次状态变化立即更新；任何字段与 gh / git 实测冲突时，以实测为准并回写修正。

## 固定结构（字段顺序与枚举值不可变，恢复协议依赖它们）

```markdown
# PIPELINE STATE（issue-batch 生成，续跑入口）

## 元信息
- 启动时间：<ISO8601>
- Preflight：<N/N 通过，时间>（含：默认分支 <main|…>）
- 启动快照 issue：<#1, #2, … 完整列表>
- 测试命令：<全量测试命令原样>
- lint 命令：<lint 命令原样>
- 合并方式：<merge | squash | rebase>（判定依据：<CONTRIBUTING | PR历史 | 默认squash>）
- commit 风格：<仓库惯例描述 | conventional 默认>
- CI：<有（检查名列表） | 无>
- 模式：<默认 | --confirm | --long-run>
- 通知群 chat_id：<oc_xxx（preflight 解析/创建）>
- 发送命令式：<preflight 确认的 +messages-send 完整参数式>
- 加急升级：<仅 urgent_app | 开启 SMS/电话>
- 运行参数覆盖：<无 | issue-batch.yml 的差异键值>
- 双向级别：<L1 轮询 | L2 会话级实时 | L3 常驻收件箱>；用户 open_id：<ou_xxx（仅此发送人的回复可作决策）>

## 规划表
| 批 | PR | 分支名 | issue 列表 | 主题 | 复杂度 | 依赖 | 状态 | review轮 | CI轮 |
|----|----|--------|-----------|------|--------|------|------|---------|------|
| 1  | 1  | feat/batch-1-auth | #3,#7,#9 | 认证模块 | M | - | merged | 1 | 1 |

状态枚举：planned / developing / in-review / merged / blocked（只允许这五个值）。
review轮 / CI轮：当前累计轮次，熔断判定用（review≥3 或 CI≥2）。

规划表之后附判定表（每个 issue 一行：S/M/L · 所属模块 · 依赖 · TDD 路由
「逻辑型 /test-driven-development｜集成行为型 /tdd」）——② 派发时按此传给开发子 agent。

## 跳过与熔断记录
| 对象 | 类型 | 原因 | 时间 |
|------|------|------|------|
| #7 | skipped | <AC 描述自相矛盾，已在 #7 评论询问> | <ISO8601> |
| PR-4 | blocked | <review 3 轮未过：摘要> | <ISO8601> |

## 待下轮清单
- #<n> <标题>（运行期间新增，<日期>）

## 未决决策与决策记录
未决 🔴（发送时记录消息 ID，决策查收后归档）：
| 消息ID | 对象 | 事件 | 发出时间 |
决策记录：
| 消息ID | 对象 | 决策 | 依据回复 | 时间 |

## 恢复注记
- 上次中断位置：<PR-x 步骤③>
- 下一步：<一句具体动作，恢复协议从这里继续>
- 未发送通知：<积压的飞书消息摘要（通道故障时记在这里，恢复后补发）>
```

## 更新时机（每次变化立即写，先写文件再发通知）
- 每个 PR 状态迁移（planned→developing→in-review→merged/blocked）
- 每轮 review / CI 结束（轮次 +1）
- 每次 issue 挂起、PR 熔断、规划调整（连原因一起记）
- 每次中断前（会话即将结束 / 检测到上下文接近极限时，把「恢复注记」写满）
