# PR #61：预览标题源位置导航修复

日期：2026-09-09。审查对象 `7d5847f5b3127277e3bc3e84c2c1d0620070439f`。
插件候选 `0.11.0-alpha.5`；本轮修复链接、缩进标题无法定位或跳错章节的 P2。
修复代码提交 `18b43c0810237c94bedb9200d05b496991e687dc`。
前轮 alpha.4 结果保留于 [PR61-FOLLOWUP.md](PR61-FOLLOWUP.md)。

## 行为与实现

`MarkdownTab` 开启平台 `MarkdownText.headingSource`，使用实际渲染标题携带的源行号和
UTF-16 偏移。`preview-navigation.ts` 按源位置选择目标行所属的 ATX 章节，不用标题文字
或第二套 Markdown 解析器推测对应 DOM。重复标题、setext、围栏、数学和脚注重排均不改变匹配。
普通导航 revision 去重、显式 Source line、草稿、保存和关闭守卫沿用原行为。

Harness 的 `headingSource` 为可选公共 prop，默认 false；完整渲染的真实标题提供坐标，
流式渲染和自动生成的脚注标题不提供。源码由原渲染器解释，插件没有新增解析依赖或平台 external。
旧大纲/阅读 helper 继续保留供后置功能使用。

## 基线与补丁

官方基础仍为 Harness `0.1.5-alpha.1` / `5dda764ed3aa172535a7967b06ff95d9cbfe536a`。
固定本地提交升级为 `a28c5a8f4927217f345d02e22c782a32d5750f0a`，包含以下两个未上游发布的补丁：

1. [关闭守卫](../../../patches/harness-sidebar-close-guard.patch)：此前 #55 的提交 `737e95c`。
2. [标题源位置](../../../patches/harness-markdown-heading-source.patch)：在其上补充渲染坐标、公开组件回归、
   双语说明与设计记录；另修正原关闭服务测试的一处无行为变化的 lint 写法。

通过独立临时 Git index 从官方基础依次应用两份补丁，结果与当前 Harness 完整 tree 一致：
`651b692f063e3d11806c5a53509fb705e1deb13e`。
原 `deepseek-harness` 检出和用户运行实例未修改。插件 alpha.5 的版本号不表示 Harness 升级到该版本。

## TDD 与自动化

沿用官方标签/Slot 装配、真实平台渲染器和外部 Remote 边界。五个新增用例逐步暴露定位问题：

| 场景 | 失败证据 | 最终结果 |
| --- | --- | --- |
| 链接标题与先前同名标题 | [RED](pr61-heading-link-red.log)：未发出滚动 | 定位链接标题 |
| 三空格缩进标题 | [RED](pr61-heading-indent-red.log)：跳到 Top | 定位所属章节 |
| 缩进围栏中的同名标题 | [RED](pr61-heading-fence-red.log)：伪标题干扰匹配 | 忽略代码内容 |
| 先前同名 setext 标题 | [RED](pr61-heading-setext-red.log)：跳错同名标题 | 定位实际 ATX 标题 |
| 数学块与脚注重排 | [RED](pr61-heading-rendered-red.log)：第二套语法树把目标映射到 Footnotes | 使用实际渲染坐标 |

插件接入公共坐标后、Harness 尚未实现该选项时的[失败记录](pr61-heading-source-red.log)退出1；
补上平台坐标后的[相关回归](pr61-heading-source-green.log)退出0：3文件66项。
此前文字匹配和第二套语法解析的中间实现未进入最终代码。

- [修改前 strict](pr61-heading-strict-before.log)：138项，0警告，退出0。
- [新基线首次检查](pr61-heading-strict-new-baseline.log)发现3个陈旧构建入口；强制重新生成 Client 类型并
  正常构建后通过，没有放宽 lock。重建前后 ui-primitives 与 Web index/vendor 三个运行产物摘要相同。
- [插件完整 verify](pr61-heading-verify.log)：退出0，138项strict、16文件201测试、类型检查、
  双端构建与6项产物检查通过。
- [Harness GUI](pr61-heading-harness-gui.log)：337文件、4732通过/1跳过；
  该次执行早于最后新增的公开坐标组件用例，后续[相关测试](pr61-heading-harness-targeted.log)72项通过，
  包含 CRLF、UTF-16、setext、默认与流式输出不带坐标的回归。
- [Harness 回放](pr61-heading-harness-web.log)：97文件通过/1跳过，346通过/15跳过，退出0。
- [Harness 文档](pr61-heading-harness-docs.log)：34项通过；[最终 lint](pr61-heading-harness-lint-final.log)退出0。
- [收尾 strict](pr61-heading-strict-final.log)：138项、0警告，退出0；11份改动 Markdown 的相对文件链接全部存在，
  `git diff --check` 通过。新增原始补丁沿用仓库对 unified diff 上下文空行的 whitespace 属性。

## 同归档安装验证

Node `v26.4.0`，pnpm `11.17.0`。[打包](pr61-heading-pack.log)退出0：36项归档文件，
公开 exports、lazy-CJS factory、无开发依赖/本地链接/source map 检查通过。
归档 `benz-ai-x-dsh-md-preview-0.11.0-alpha.5.tgz` 的 SHA-256：
`da9d91dae684c4836d8a9a10c78c15f11623b2c5b99bd995d5d0b33a8782567d`。

同一归档安装到全新 `/tmp/mdpreview-0110a5-smoke-TNstzz/profiles/web`，安装文件与归档一致。
默认配置组合、整行覆盖、正常 CLI boot、普通包名 Host/Remote 导入通过。
启动图54项，插件资源HTTP200；同时确认实际服务的 Web 资源包含标题源坐标能力。
移除后53项，原插件资源HTTP404。两个测试服务均退出0，复算归档摘要未变化。

保留[脚本](pr61-heading-packed-smoke.mjs)、[输出](pr61-heading-packed-smoke.log)、
[结果与环境](pr61-heading-packed-smoke.json)和[SHA256SUMS](pr61-heading-SHA256SUMS)。
本机路径只表示本日独立验收现场。

## 待验收

#60 的真实浏览器矩阵仍未完成；上述回放和 jsdom 不能证明本插件实际页面的滚动、布局和编辑流程通过。
此前 Browser 连接恢复的窗口确认仍未答复，本轮未操作该浏览器或用户实例。
后续页面验收须使用本次 alpha.5 和两份 Harness 补丁；此前3196实例的 alpha.2 不能替代当前候选。
没有合并、上游补丁发布、npm 发布或 GitHub Release 发布。
