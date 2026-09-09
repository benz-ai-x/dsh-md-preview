# PR #61：重载元数据与显式源行定位修复

后续标题定位修复与插件 alpha.5 的当前证据见 [PR61-HEADINGS.md](PR61-HEADINGS.md)。
下文 alpha.4 的版本、基线、摘要与结果保留为历史。

日期：2026-09-09。审查对象 `67cc30fc9785ff31e69e5c57b708299c8810b479`；
修复代码提交 `da3d52255d42a54ef09c4ba5f794344f0d1d934b`。
插件候选为 `0.11.0-alpha.4`。此前三项修复与 alpha.3 的验收记录保留于
[PR61-FIXES.md](PR61-FIXES.md)，不改写旧结果。

## Harness 最新版本核对

用户明确要求适配最新 DeepSeek Harness。本轮通过 GitHub Release、远程 master、
npm 官方 Registry 和用户本地检出交叉核对：

- [最新官方发布](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.5-alpha.1)
  为 Harness `0.1.5-alpha.1`，发布于 2026-09-08。
- 远程 master 与 `/Users/pc2026/DSH-Space/deepseek-harness` 都是
  `5dda764ed3aa172535a7967b06ff95d9cbfe536a`，manifest 版本相同。
- npm `@deepseek-ai/dsh` 的 `alpha` 标签为 `0.1.5-alpha.1`；`latest` 标签仍为
  `0.1.2-rc.1`。没有将 `latest` 标签误作按发布时间排列的最新版本而降级。
- #55 所需公共关闭守卫仍未进入官方版；实际验证使用其上的本地补丁提交
  `737e95c657a95fd04b12269313902f9b5ca2f6ca`，lock 与链接不变。
  这不是对未打补丁的官方版完成编辑验收的声明。

`0.11.0-alpha.4` 是本插件版本，Harness 版本为 `0.1.5-alpha.1`，两者单独标注。

## TDD 与行为

沿用已确认的官方标签/Slot 装配、外部 Remote 和资源元数据边界。
两个问题分别先失败，再做最小修正，没有改动 Harness 或导航去重规则。

| 问题 | RED | 修复与 GREEN |
| --- | --- | --- |
| 外部编辑后 Reload 仍误报变化 | 正文已为 v2，共享元数据仍为 v1，变化提示没有消失 | 未保存守卫放行、正文重读结束后调用公开元数据 reload；取消或记录关闭不发送迟到请求 |
| 再次点击 Source line N 不定位 | Source line 6 → Preview → Source line 6，实际停第1行 | 显式按钮在已有编辑器内直接定位，或在编辑器挂载后消费一次请求；普通切换仍不重放原生旧 revision |

- 元数据：[RED](pr61-r2-metadata-red.log) 退出1 → [GREEN](pr61-r2-metadata-green.log) 退出0。
- 行号：[RED](pr61-r2-line-red.log) 退出1 → [GREEN](pr61-r2-line-green.log) 退出0；旧导航不重放用例同时通过。
- 随后扩展取消/丢弃刷新、后续真实变化提示、编辑中显式定位与撤销重做断言，
  并补记录关闭后不重新请求元数据的回归；[侧栏完整测试](pr61-r2-sidebar.log) 35项通过。
  这些后续绿色回归不另称为 RED→GREEN。

## 完整验证与同归档检查

Node `v26.4.0`，pnpm `11.17.0`。所有命令显式使用
`DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness-md-guard`。

- [修改前 strict](pr61-r2-strict-before.log)：退出0，138项，0警告。
- [pnpm verify](pr61-r2-verify.log)：退出0；16文件196测试，类型检查、双端构建及6项产物检查通过。
- 文档收尾 strict 再次退出0；9份 Markdown 的134个相对文件链接全部存在，`git diff --check` 通过。
- [pnpm pack:publishable](pr61-r2-pack.log)：退出0；35个归档文件，公开 exports、lazy-CJS factory、
  无开发依赖/本地链接/source map 检查通过。
- 归档 `benz-ai-x-dsh-md-preview-0.11.0-alpha.4.tgz` 的 SHA-256：
  `10783794d47bf8d51b5abdf08376eda26707d63e1edf3b81934333e5740cee86`。
- 新 profile `/tmp/mdpreview-0110a4-smoke-cwnwIh/profiles/web` 使用同一归档完成普通安装、
  默认配置组合与覆盖、正常 boot、普通包名 Host/Remote 导入、资源 HTTP200、移除后 HTTP404。
  两个测试服务均退出0，验证后重算归档摘要一致。

保留 [脚本](pr61-r2-packed-smoke.mjs)、[输出](pr61-r2-packed-smoke.log)、
[结果与环境](pr61-r2-packed-smoke.json) 和 [SHA256SUMS](pr61-r2-SHA256SUMS)。
脚本中的本机路径仅表示本日验收现场。

## 待验收

两项代码修复和自动化完成。#60 的真实浏览器矩阵仍待完成，不能据此宣称 PR 已通过人工验收。
行号往返、显式重复定位、Saved 和版本变化提示仍须在真实页面确认，并记录主题、语言、视口与缩放。
此前 Browser 扩展连接超时，恢复窗口的确认尚未答复，本次未操作浏览器或用户实例。
此前3196实例对应插件 alpha.2；未来继续验收时须先核对运行状态并安装本次 alpha.4 同一归档。
没有合并、npm 或 GitHub Release 发布，后置搜索、阅读与多格式范围不变。
