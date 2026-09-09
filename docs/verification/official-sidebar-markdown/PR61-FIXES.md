# PR #61：三项复查问题的修复

日期：2026-09-09。审查对象 `dcf546e9de89216439780e819af3ec3927c6d936`；
修复代码提交 `dff7f62`，候选版本 `0.11.0-alpha.3`。
此前两轴审查各报告2项，导航问题同时违反规范和规格，共3个独立问题。
本记录不改写 [初次迁移复核](REVIEW.md) 或 alpha.2 的验收结果。

## TDD 与修复

沿用已确认的官方标签服务、Slot 装配及外部 Remote/文件元数据边界。
逐项先失败、再修复；没有为内部导航表单独建立测试。

| 问题 | RED 实际结果 | 修复与 GREEN |
| --- | --- | --- |
| 旧行号导航重放 | 预览→编辑→预览→编辑后，本应不再跳转，却回到第6行 | 分别记住两种面孔已处理的 revision；返回编辑不重放，新导航仍跳到第3行 |
| 成功保存没有确认 | 写入和重读成功后找不到 `role="status"` 的 Saved | 恢复已有中英文文案；开始下一次编辑、主动重新加载清除旧确认，避免放弃新草稿后误报已保存 |
| 版本变化提示遗漏 | 首次元数据返回 v2、`changed:false` 时，v1 草稿没有变化提示 | 比较元数据版本与本标签指纹；共享 restat 清除 `changed` 不清除本标签提示，只有本标签读到对应版本后才消失 |

各轮定向命令均使用 `pnpm test tests/sidebar-markdown.spec.tsx -t '<场景名称>'`，
并显式设置下方 `DSH_HARNESS_ROOT`。RED 退出1，GREEN 退出0：

- 导航：[RED](pr61-navigation-red.log)、[GREEN](pr61-navigation-green.log)。
- 保存确认：[RED](pr61-saved-red.log)、[GREEN](pr61-saved-green.log)。
- 下一次编辑清理确认：[RED](pr61-saved-clear-red.log)、[GREEN](pr61-saved-clear-green.log)。
- 主动重载清理确认：[RED](pr61-saved-reload-red.log)、[GREEN](pr61-saved-reload-green.log)。
- 元数据版本：[RED](pr61-metadata-red.log)、[GREEN](pr61-metadata-green.log)；
  现有 Host 变化用例同时加入共享 restat 及主动重载后的清除断言，并在完整验证中通过。

## 完整验证

Node `v26.4.0`，pnpm `11.17.0`；Harness 固定于
`737e95c657a95fd04b12269313902f9b5ca2f6ca`，版本 `0.1.5-alpha.1` 加本地守卫补丁。
本次没有修改 Harness、lock、平台模块表或用户已有技能/流水线改动。

```sh
export DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness-md-guard
pnpm context:check:strict
pnpm verify
pnpm pack:publishable
```

- [修改前 strict](pr61-strict-before.log)：退出0，138项，0警告。
- [完整 verify](pr61-verify.log)：退出0；16文件、193测试全部通过，类型检查、双端构建、6项产物检查通过。
- [打包](pr61-pack.log)：退出0；35个归档文件、公开 exports 完整，无开发依赖、本地链接或 source map。
- 文档收尾 strict 再次退出0；9份 Markdown 的119个相对文件链接全部存在，`git diff --check` 通过。

## 同归档安装与移除

归档为 `benz-ai-x-dsh-md-preview-0.11.0-alpha.3.tgz`，SHA-256：
`3108f5bffaa9d99c8a1c928023d2a86d4120f7367a69466fa4d19a79bda77e7b`。
执行的 [脚本快照](pr61-packed-smoke.mjs)、[输出](pr61-packed-smoke.log)、
[结果与环境](pr61-packed-smoke.json)、[摘要](pr61-SHA256SUMS) 分别保留。
脚本包含本次机器路径，是有日期的验收快照。

使用全新 `/tmp/mdpreview-0110a3-smoke-keWFBi/profiles/web`：

- 同一 tarball 普通安装，安装后的 client 与归档逐字节一致。
- 默认配置组合及整份 config 覆盖通过；覆盖 maxBytes、扩展名和3个搜索限额。
- 正常 CLI 启动，54项 boot entry，Client 资源 HTTP200；普通包名 Host/Remote 导入与4个 RPC 描述符通过。
- 移除后正常启动，53项 boot entry，原资源 HTTP404；两个测试服务均 SIGTERM 后退出0。
- 验证后重新计算归档摘要，未重新打包或替换文件；没有 npm 或 GitHub Release 发布。

## 待验收边界

上述三项代码修复与自动化已完成，#60 的真实浏览器矩阵仍未完成，不据此将 PR 标为可合并。
尚缺真实页面对行号往返、Saved 状态及版本变化提示的确认，以及原有主题、语言、视口与缩放矩阵。
此前 Browser 扩展连接超时，恢复窗口的用户确认仍待答复；本次没有再次操作浏览器。
原3196验收实例仍对应 alpha.2，继续实际页面验收前须安装本次 alpha.3 同一归档，不能沿用旧实例为新包证据。
搜索、独立大纲/持久阅读及多格式继续后置。
