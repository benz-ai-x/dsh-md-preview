# PR #61：开发复现说明修复

日期：2026-09-09。审查对象 `90f0d7738493e7ed8d35d7fdb22ed4a393a93e6e`。
本轮修复 Standards 轴的一项 P2：双语 README 开发段仍写旧基线 `737e95c` 和单份
format-patch 的应用方式，未同步当前两份补丁。运行代码未确认新增问题，Spec 轴为0项。

## 修复

[英文 README](../../../README.md#development) 与 [中文 README](../../../README.zh.md#开发与验证)
同步标明当前已审计 Harness `0.1.5-alpha.1` / `a28c5a8f4927217f345d02e22c782a32d5750f0a`，
其官方基础为 `5dda764ed3aa172535a7967b06ff95d9cbfe536a`。复现步骤明确顺序：

1. 用 `git am` 应用关闭守卫的 format-patch。
2. 用 `git apply --index` 应用标题源位置的普通 diff，再提交。
3. 核对完整 tree；另行重放生成的提交仍需构建、重新审计，再记录准确 lock。

没有放宽精确提交检查，也没有把重放得到的同一文件树称为同一提交。

## 验证

- 旧命令 [失败记录](pr61-readme-red.log)：第二份普通 diff 用 `git am` 应用时退出128，
  报 `Patch format detection failed`。
- 修改前 [strict](pr61-readme-strict.log) 退出0：138项、0警告。
- [独立重放](pr61-readme-replay.log)：从官方基础创建临时本地检出，直接提取双语 README
  的命令块，确认两者相同；只替换新 worktree 路径后执行，全部命令成功。
  得到的完整 tree 为 `651b692f063e3d11806c5a53509fb705e1deb13e`，与 lock 所指提交一致；
  临时工作区干净并已移除，原 Harness 检出未修改。
- 5份变更 Markdown 的71个相对文件链接均存在，README 中已无旧基线引用；
  `git diff --check` 通过。

本次仅修改仓库文档，未重建或重打包。alpha.5 原归档与其
[安装验证](PR61-HEADINGS.md#同归档安装验证)保留原快照；#60 的真实浏览器矩阵仍未完成。
