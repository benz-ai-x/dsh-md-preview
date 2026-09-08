# v0.10.0 发布验证

日期：2026-09-08。用户明确要求 release；版本从 0.9.0 提升为 0.10.0，保留已有
v0.9.0 Git 标签。发布前 npm latest 为 0.7.2。

## 已完成

- 修改前 strict 基线检查通过。版本更新后 `pnpm verify` 退出 0：123 项基线检查、
  26 个测试文件共 290 项测试、类型检查、构建及 6 项产物检查全部通过，见
  [verify.log](verify.log)。
- `pnpm pack:publishable` 退出 0；最终 tarball 含 38 项文件，无 devDependencies、
  link:/workspace: 或 source map，所有公开 exports 目标存在，客户端为 lazy-CJS factory。
- 同一归档离线安装到全新 DSH_HOME 的 shipped web profile，安装文件与归档逐字节
  相同；dump-config 含插件。实际启动后，通过普通包名导入 Host 与 Remote；Host
  具名导出完整且无 default，Remote 导出既定的 TYPERT_REMOTE 描述符及其 default 别名。
  平台 peer 由正常 boot 层提供，未通过测试专用别名解析插件。
- 实际启动图 47 项，插件资源 HTTP 200，含 v0.10.0、回形针、×、双语提示及停靠
  适配代码。移除后 dump-config 不含插件，启动图为 46 项，原插件资源 HTTP 404。
  两次通过 SIGTERM 停止，退出码均为 0；临时服务均已停止。
- 归档、安装包与服务资源的 SHA-256 和安装闭包锁文件摘要见
  [packed-smoke.json](packed-smoke.json)；发布归档校验值见 [SHA256SUMS](SHA256SUMS)。

## 发布交接

已将经过验证的 `benz-ai-x-dsh-md-preview-0.10.0.tgz` 直接提交 npm，并将同一归档
及 SHA256SUMS 附到 GitHub Release。归档在验证与发布之间未重新生成。

- 发布前 npm whoami 返回 401；使用临时 npm userconfig 完成浏览器登录及发布二次
  认证，发布命令退出 0，账号为 `benz.ai.coder`。
- npm 版本与 `latest` 均为 0.10.0；重新下载 Registry 广告的 tarball，与经过验证的
  归档逐字节相同，SHA-1 与 SHA-512 integrity 也与 npm 元数据一致，见
  [registry.json](registry.json)。
- 发布提交 `9016f87bc1cc8d987add42386b4897a9842d845d` 与注解标签 `v0.10.0` 原子推送，
  已核对远端 main 与标签解引用。保留此前 v0.9.0 标签。
- [GitHub Release](https://github.com/benz-ai-x/dsh-md-preview/releases/tag/v0.10.0)
  已公开为正式版，两项附件的服务端 SHA-256 均与本地相符，见
  [github-release.json](github-release.json)。
- 当前人工验收 `r3-accept` 通过正式 Registry 安装精确版本 0.10.0，安装退出 0；
  在原 3185 端口重启 tmux `dsh-r3`。启动图包含插件，服务资源 HTTP 200，含 v0.10.0
  与最终 A/B 图标，安装 client 与发布归档相同，见 [manual-server.json](manual-server.json)。
  更新前 profile 配置已备份，位置由本机 `/tmp/mdpreview-0100-r3-backup.txt` 记录。

发布说明见 [v0.10.0](../../../releases/v0.10.0.md)。顶栏对齐等建议尚未实施；剩余
真实浏览器验收继续见 #36、#37，不能由本轮安装包验证代替。
