# HANDOFF — dsh-md-preview 会话交接(2026-09-06 晚)

> 分工:本文件是**会话级交接**(带日期的一次性现场快照,下个会话接手后
> 由其改写或删除——勿让快照沉积);仓库级持久交接(架构速览、发布流程、
> 本机环境、事故闭环)在 `docs/HANDOVER.md`,勿混。

接手前提:读 `AGENTS.md`(`CLAUDE.md` 即其 `@AGENTS.md` import,见
commit `64fab39`)与 `TODO.md`——本文件只记录**不在任何仓库工件里的现场状态**。

## 本会话做了什么(一句话)

0.6.0 完成度分析 → 执行完整发布链(packed 冒烟 → npm publish → 验货 →
web profile 升级 → push → GitHub release)→ deprecate 0.2.4 → E2E 走查
2.5/4 段 → agent 文档去重与补指针。全部已验证、已提交(HEAD = `64fab39`,
main 与 origin 同步)。细节见 `TODO.md`「功能四连」节与 `docs/HANDOVER.md`。

## 现场状态(仅存在于本机,未入仓库)

- **3080 实例在跑**:tmux 会话 `dsh-web`,以
  `node ~/Dev-Space/deepseek-harness/apps/cli/lib/bin.js --profile web --patch /tmp/disable-graph.yml --no-open`
  启动。`/tmp/disable-graph.yml` 是禁用 session-graph 行的一次性补丁——
  **在 session-graph 修复前,每次启动 web profile 都需要它**(否则 fail-loud)。
  访问 token 在 `/tmp/web-boot.log`(勿提交)。
- **npm token 是新的**:`~/.npmrc` 里 `registry.npmjs.org/:_authToken` 为本会话
  web 登录所换(账号 benz.ai.coder,2FA)。publish/deprecate 在其过期前可直接
  用;再遇 404/EOTP 按 `docs/HANDOVER.md`「当前状态」节的排障三连处理。
- **/tmp 遗留物**:`disable-graph.yml`(保留)、`npmrc.backup`(摘除陈旧 token
  前的备份,含旧 token,确认无用后可删)、`web-boot.log`、`publish-out.txt`。
- **E2E 证据**:`.playwright-mcp/` 12 份快照(已 gitignore,仅本地)。关键三份:
  12-02-54(面板开+v0.6.0 标)、12-03-45(已保存 toast)、12-04-33(冲突条)。
- **E2E 目标文件**:`/Users/pc2026/Tech-Research/dsh.plugins.dev/md-preview-验收测试.md`
  留有走查标记行,TODO 声明可随手删。
- **任务清单**:仅 #6 in_progress(剩余两可选项,见下)。

## 剩余工作(均为可选项,无硬性缺口)

1. **E2E 冲突路径收尾(两下点击)**:步骤与背景见 `TODO.md` 0.2.0 节更新。
   注意:用户当时正在浏览器上亲自操作面板——续做前先确认用户不在用,避免互抢。
2. **HMR 热替换走查**:需 dev-link profile + `pnpm watch:client` 专用 rig,
   见 `TODO.md` 待办区;HMR 契约细节在 dsh-plugin-dev skill 的
   packaging-testing 参考。
3. **(用户环境,非本仓库)** `~/Dev-Space/dsh-session-graph` 缺声明依赖
   `@deepseek-ai/dsh-llm`——修复 = 在该项目
   `pnpm add @deepseek-ai/dsh-llm@0.1.2-rc.1`;修好后移除启动命令里的
   `--patch /tmp/disable-graph.yml`。

## 真源索引(勿在此重复)

| 内容 | 位置 |
|---|---|
| 当前进度/发布履历/待办 | `TODO.md` |
| 发布流程、本机环境(dsh 路径/代理/2FA)、事故记录 | `docs/HANDOVER.md` |
| npm 发布三坑(mtime 门/陈旧 token/tmux 真 pty) | HANDOVER「当前状态」节;本机 Claude 记忆 `npm-publish-environment.md`(仅本机可达) |
| v0.6.0 release | https://github.com/benz-ai-x/dsh-md-preview/releases/tag/v0.6.0 |
| 本会话提交 | `ea28666` `fdc4c2c` `644a934` `64fab39` |

## Suggested skills

- **`dsh-plugin-dev`** — 本仓库一切开发/验证/发布工作必读(AGENTS.md 已指向);
  HMR 走查查其 packaging-testing 参考。
- **`superpowers:verification-before-completion`** — 声称任何步骤完成前跑验证
  (本会话的 0.2.4 坏包事故教训即"证据先于断言")。
- **`superpowers:systematic-debugging`** — 若 E2E/HMR 走查中出现意外行为,
  先诊断再改。
- 浏览器 E2E 用 Playwright MCP 或 chrome-devtools MCP(工具已就绪,无需 skill)。
