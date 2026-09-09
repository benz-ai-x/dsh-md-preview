# 迁移交付前复核

本页是最初迁移实现的复核记录。PR #61 在 `dcf546e` 上的后续两轴审查及3项独立问题的修复，
见 [PR61-FIXES.md](PR61-FIXES.md)；两轮发现和验证分别保留。

基点：ae58cd4d3cfeec7b745f692cda502f66916e58ad；初始实现：7f55e85ca8b0156ac3303736cbe4944cbc7a09ae。
两路 reviewer 按 code-review 技能独立只读检查，修复后回读限定diff。

## Standards

1. 保存时 Mod-B/I/K 未检查readOnly，仍dispatch更改，违反保存冻结约定。
2. Mermaid工作未纳入dispose等待，加载期间取消后仍可能开始外部render并创建全局节点，违反可逆生命周期。
3. 新增lstat探测抛出的权限/IO错误未转换，违反稳定md-preview失败码契约。

三项已分别RED复现、修复并定向GREEN。复核确认只读命令检查、任务等待/独立容器/取消检查、
稳定错误转换均覆盖原问题；限定范围未发现新的明确错误。无另列的判断性代码异味。

## Spec

1. #56/#59要求正文重挂载保留草稿；float/dock同次提交的新编辑器先取得旧memento，显示原文并可能覆盖草稿。
2. #55要求继续编辑恢复焦点；Modal保存了触发按钮焦点，取消后未回到CodeMirror。

两项已分别RED复现、修复并定向GREEN。初始化effect读取记录最新memento，Modal销毁后由
正文effect回焦；限定范围复核未发现新的阻断错误。未发现范围扩张。
#60真实浏览器尚缺，必须保持打开。

Standards共3项、Spec共2项，均已修复；原最严重问题分别是保存中绕过冻结和浮动/停靠丢失可见草稿。
