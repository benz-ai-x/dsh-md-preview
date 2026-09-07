# HANDOFF — dsh-md-preview 会话交接(2026-09-07)

> 分工:本文件是**会话级交接**(带日期的一次性现场快照,下个会话接手后
> 由其改写或删除——勿让快照沉积);仓库级持久交接(架构速览、发布流程、
> 本机环境、事故闭环)在 `docs/HANDOVER.md`,勿混。

接手前提:读 `AGENTS.md`、`TODO.md`、本文——本文件只记录**不在任何仓库
工件里的现场状态**。

## 本会话做了什么(一句话)

文档入口大迭代(根级按钮→header utilities 胶囊→宿主详情栏→**自持
overlay 叠层**),九项 UIUX 打磨后用户实证通过;追加的 round-2 十三项
(限宽/深搜/56px 顶部偏移等)被用户否决**已整体回退**——`details-workbench-abc`
HEAD = `0a58e31`(九项打磨版),round-2 全部提交保存在 `ux-round2-backup`
分支待选择性打捞。

## 现场状态(仅存在于本机,未入仓库)

- **分支拓扑**:`details-workbench-abc` 领先 `main` 10+ commits(从
  `8824365` 详情栏接管起,到 `0a58e31` 止);**未合并未发布**。
  `ux-round2-backup` = `0a58e31` + 2(`552486e` round-2 十三项、
  `34ac385` 叠层下移避开胶囊)。
- **用户裁决(最高优先上下文)**:round-2「比上一版还差」整体回退;
  **具体差在哪用户尚未回答**(已被追问)。任何新 UIUX 迭代前必须先
  拿到这个答案——本会话已犯一次「批量打包改动」的错,勿再犯。
- **3080 实例在跑**:nohup(非 tmux)启动
  `node ~/Dev-Space/deepseek-harness/apps/cli/lib/bin.js --profile web --no-open`,
  装的是 `/tmp/mdp-dev18.tgz`(= `0a58e31` 回退版)。token 在
  `/tmp/web-boot.log`。web profile 的 `package.json` 指向 `file:/tmp/mdp-dev18.tgz`
  (dev tarball 链 12→18,只需保最新)。
- **回退版已知问题**(walkthrough 实证):面板开着时 overlay 盖住右上角
  「工作区文档」胶囊(按下态可见、点不到);关面板走 × 或 Esc。
  修复思路在 `ux-round2-backup` 的 `34ac385`(但那条 commit 连带 56px
  顶部偏移+圆角,可能正是用户不满的一部分——打捞时只取「胶囊可点」
  最小修,勿整 cherry-pick)。
- **round-2 里值得单独打捞的纯赢件**(与视觉形态无关,用户否决的是
  整体):CM 透明 token 主题(`editor.tsx`,暗色编辑脸实证干净)、
  `Number(null)=0` 把首开宽度钳到 360 的雷(persistence 引入,
  回退后不存在)、深搜/重开恢复(功能件,是否要听用户)。
- **暗色走查已做**(设置→深色→还原浅色):面板/树/代码块/编辑脸全部
  token 跟随,唯 mermaid 默认浅色(README known limit)。宿主主题体系
  在 `packages/client/ui-theme`,body 挂 `data-ds-dark-theme`。
- **localStorage**:dev17 曾写入 `dsh-md-preview:width`/`rail-width`,
  回退版不读、无害;介意可在浏览器清。
- **E2E 证据**:`.playwright-mcp/`(gitignored):`final-open/final-max.png`
  (九项打磨版,用户看过)、`dark-view/dark-edit.png`(暗色)、
  `reverted.png`(当前线上态)。

## 剩余工作(按优先序)

1. **拿到用户对 round-2 的具体不满**(本会话末已追问,等答复)——
   决定打捞/重做/放弃哪些件。
2. 胶囊被盖的最小修复(独立小改,与 round-2 解耦)。
3. 合 `details-workbench-abc` → `main`、发布 **0.7.3**(发前
   `npm view @benz-ai-x/dsh-md-preview versions` 查证——0.7.2 在册;
   npm 2FA 走 tmux 真 pty + 浏览器授权,流程在 `docs/HANDOVER.md`)。
4. 长期留观:HMR 走查、mermaid 暗色、内联 .md 提及包装层(见 `TODO.md`)。

## 真源索引(勿在此重复)

| 内容 | 位置 |
|---|---|
| 当前进度/发布履历/待办 | `TODO.md` |
| 发布流程、本机环境(dsh 路径/代理/2FA)、事故记录 | `docs/HANDOVER.md` |
| 九项打磨的具体清单与实测 | commit `0a58e31` message + README「panel is a self-owned overlay」节 |
| round-2 十三项明细(已回退,备查) | `ux-round2-backup` 的 `552486e` message |
| 0.7.2 release | https://github.com/benz-ai-x/dsh-md-preview/releases/tag/v0.7.2 |

## Suggested skills

- **`dsh-plugin-dev`** — 本仓库一切开发/验证/发布工作必读(AGENTS.md 已指向)。
- **`superpowers:brainstorming`** — 下轮 UIUX 改动**先出方案等批准再动码**
  (本会话「全干」批量落地被整体否决,教训:批量打包 ≠ 用户逐项同意)。
- **`superpowers:systematic-debugging`** — E2E 走查异常先诊断再改。
- 浏览器走查用 Playwright MCP(本会话全程在用,`.playwright-mcp/` 留证)。
