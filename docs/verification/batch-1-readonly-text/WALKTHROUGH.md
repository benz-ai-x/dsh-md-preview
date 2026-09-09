# #39 验证记录：开发暂停前快照

日期：2026-09-09。功能提交：`2491a52aaa991d57d5037e60f2dfc7598910b5f6`。
本记录区分旧基线自动化通过、候选包生成和仍未完成的实际验收。
用户已要求暂停开发，完整续接信息见 [HANDOFF](../../../HANDOFF.md)。

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| 完整 `pnpm verify` | exit 0；123 项 strict、26 文件 / 338 测试、类型检查、构建、6 项产物检查通过 | [原始日志](verify.log)、[退出码](verify.exit) |
| `pnpm pack:publishable` | exit 0；构建、产物 freshness 及净化 manifest 检查通过 | [打包日志](pack.log) |
| 交接前原工作区 strict，显式旧基线 | exit 0；123/123 | [日志](strict-handoff-main.log) |
| 交接前功能 worktree strict，显式旧基线 | exit 0；123/123 | [日志](strict-handoff-feature.log) |
| 新 Harness 检出相对旧 lock 的 strict | exit 1；版本、commit、文档摘要 3 项不匹配 | [日志](strict-updated-harness.log) |
| 收尾时再次检查旧固定路径 | exit 1；固定 Harness 源码目录已不存在 | [日志](strict-baseline-missing.log) |
| 候选包实际安装、导入、资源服务及移除 | 未执行 | 待恢复后验证 |
| 真实浏览器与独立评审 | 未完成 | 不以自动化或打包成功替代 |
| 临时 3291 服务清理 | PID 75947 收到 SIGTERM 后确认退出 | [清理记录](shutdown.json) |

完整验证在以下环境执行；这些结果仅适用于该固定基线：

```sh
DSH_HARNESS_ROOT=/Users/pc2026/Dev-Space/deepseek-harness-md-preview-baseline pnpm verify
```

旧基线为 `0.1.2-rc.1` / `a66e4702047846cdaa10c66c9d3df3951f5ea70d`。
交接时普通 Harness 目录已为 `0.1.5-alpha.1` /
`5dda764ed3aa172535a7967b06ff95d9cbfe536a`，尚未评估兼容性。
以上检查完成后，独立旧基线和普通 Harness 目录均已不存在；新位置尚未定位。
保存的成功日志是当时的实测证据，当前源码前置未满足，本次没有恢复环境。

候选包位于功能 worktree 的 `benz-ai-x-dsh-md-preview-0.10.0.tgz`，
1,110,033 字节，SHA-256：

```text
a7cda449b6674ae0e681d7055cd0d16a6b9b62f1081a9b0eba6bcd25de1a7ed0
```

包内 `lib/client.js` SHA-256：

```text
1cb60f58d88477e158fee6b50b79e53b779640e1d4d2a048de495c13d397e463
```

此候选含未发布的 #39，虽然版本字段为 0.10.0，不能与正式发布的同版本包混用证据。
仓库保留日志和 [结构化快照](snapshot.json)，不提交临时认证 URL 或整个验收 profile。
纯交接文档更新没有重跑运行时测试；之后代码、依赖或基线变化需重新验证。
