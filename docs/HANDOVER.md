# 交接文档 — dsh-md-preview(2026-09-01)

面向接手本仓库的开发者或 AI 会话。目标:读完这一份即可继续开发、验证、发布。

## 当前状态

**v0.4.0 已全量上线**(npm latest / GitHub tag+Release / web profile 部署,三件套齐):
只读预览 → 受守卫编辑(乐观锁+沙箱)→ 工作区浏览(目录树/文本预览/面包屑/键盘)。
测试 **101 项**全绿;`pnpm verify` 全链通过是唯一发布前置。

## 文档地图(哪个问题查哪份)

| 文档 | 管什么 |
|---|---|
| `CLAUDE.md` | 仓库约束(命名空间插件/Schema 成对/可逆注册/不跨 feature 导入/bundle 协议) |
| `docs/agent/PROJECT_CONTRACT.md` | 行为契约:权威、失败码、状态归属、验收断言 |
| `CONTEXT.md` | 领域词汇表(含 _Avoid_ 弃用词);新概念必须入册 |
| `docs/adr/0001-0003` | 三条已决:FsVersion 乐观锁、写入沙箱以会话工作区为根、peers 只放 host 运行时 external |
| `TODO.md` | 全程履历(每个版本、每次事故、每个修复) |
| `docs/agents/issue-tracker.md` | issue 走 GitHub Issues(`gh`) |
| `docs/research/workspace-browser-ux.md` | 浏览脸 UX 的证据基线(改树交互前先读) |
| GitHub | spec #1(待人工验收关闭)、票 #2-#6(已关)、PR #7(已合) |

## 架构速览

- **Host**(`src/index.ts` → `lib/index.js`):`MdPreviewService` 三方法 `read/write/list`,权威链两段:`resolveContainedTarget`(会话→cwd→resolve→限域;list 的目录目标合法)+ `resolveWorkspaceTarget`(加扩展名与常规文件判定;read 传**可预览并集**,write 只传可编辑集)。运行时 peer 仅 `@deepseek-ai/dsh-typert-protocol`(ADR-0003)。
- **Client**(`lib/client.js`,lazy-CJS 工厂协议,~426 kB minified):`PreviewSession` 纯 reducer(`src/client/preview-session.ts`,`READ_STARTED`=新目标唯一全量重置)+ 效果适配器 `use-preview-session.ts`;面板组件只剩渲染+几何;`WorkspaceBrowser.tsx` 是懒树(树状态=UI 局部 viewing state);CodeMirror 6 构建期内联(`@lezer/markdown` 直组 GFM,勿引入 `@codemirror/lang-markdown` —— 会拖入 html/css/js 链使 bundle 翻倍)。
- **测试层次**(seam 即测试面):host 表驱动(`tests/host-harness.ts` 共享 fake,注意 fake 的 FsTarget 是 `{targetKey, displayPath}`)+ 面板 jsdom(client-edit/client-browse 两个 harness)+ reducer 直测 + contribution 不变量。

## 发布流程(0.4.0 验证过的完整链)

1. `pnpm verify`(真实退出码,勿经 `| grep` 管道吞掉)
2. `npm version <patch|minor>` → **再跑一次 verify**(bump 后 lib 陈旧,pack 门会拦 —— 这是设计)
3. `node scripts/pack.mjs` 自检后,净化 manifest:`node -e "delete devDependencies..."`(脚本内建有 verify-built 自防御门)
4. tmux 真终端跑 npm publish(用户 `!` 会话不是 TTY,EOTP 网页流程会直接退):
   `tmux new-session -d -s mdpreview-publish "http_proxy=http://127.0.0.1:8888 https_proxy=... npm publish --access public --registry https://registry.npmjs.org/ ..."`
   → `tmux send-keys Enter` 开浏览器 → **用户点 Authorize**(约 5 分钟窗口)→ Monitor 盯 `__PUBLISH_EXIT`
5. 验货:下载 registry tarball,确认内嵌 `v<版本>` 与新代码字符串
6. 升级 profile:`dsh plugin --profile web add @benz-ai-x/dsh-md-preview@^x.y.z --registry=https://registry.npmjs.org`(pnpm 11 对新发布版本有 minimumReleaseAge 门槛,显式 add 会自动豁免)
7. 重启 web 实例(tmux `dsh-web` 会话),curl boot graph + `/plugins` bundle 验证内嵌版本
8. `git tag -a vx.y.z` + `gh release create`;父 issue 附发布说明

## 本机环境事实(换机器/新会话必读)

- `dsh` 不在 PATH:`node ~/Dev-Space/deepseek-harness/apps/cli/lib/bin.js`(基线 0.1.2-alpha.3,锁定见 `dsh-reference.lock.json`;Harness 检出移动后跑 `pnpm context:sync`)
- npm:`~/.npmrc` 指向 npmmirror(只读),发布/查询必须 `--registry https://registry.npmjs.org/` + 代理 `127.0.0.1:8888`;账号 `benz.ai.coder` 开 2FA 但用户拿不出 TOTP,唯一可行授权 = 浏览器 web auth(tmux 模式)
- hoisted profile 里 `pnpm peers check` 报 typert-protocol missing 属预期噪音(DSH boot 模块治愈层满足 peer)
- 通知:飞书 bot(BloomAI CLI)直发用户 `ou_e4e49d75c1cc297851cb63814663ce76`(梁鹏程);`lark-cli im +messages-send --user-id ... --as bot`
- web 实例 3080:用户自己起(`cd deepseek-harness && node --import tsx/esm apps/cli/src/bin.ts web`)或 tmux `dsh-web`;改前先释放端口

## 已闭环的事故(勿再踩)

- **0.2.4 坏包**:jsdom 未捕获异常 → vitest 退出 1 但断言全过 → 外层管道吞退出码 → 旧 lib 静默发布。修复:发布路径自带 verify-built 门 + 指针捕获 best-effort。教训:**任何 verify 输出过滤必须确认真实退出码**。
- FsTarget 契约:真实形状 `{targetKey, displayPath}`,测试 fake 与实现都不得假设 `.path`。
- web-app 的 webserver 行被 patch 覆盖时必须重述全部 config 字段(patch 替换整行,不深合并)。

## 未完成 / 留观

- [ ] v0.4.0 浏览器人工走查(树/文本/不支持/高亮/键盘/中英文)→ 满意后关 spec #1
- [ ] 独立双轴审查(自查版已做并修复 5 项;子代理版因 API 配额限流未跑,可择机补)
- [ ] `npm deprecate @benz-ai-x/dsh-md-preview@0.2.4`(需一次 2FA 授权,标注"stale bundle; use >=0.2.5")
- [ ] 架构留观候选:classifyProduced 收拢(三处重复循环)、线契约 zod 单源(见架构报告,docs/research 或 issue 历史)
- [ ] HMR 热替换走查(TODO 长期项)
- [ ] 用户环境:web profile 里第三方 `@benz-ai-x/dsh-client-ui-session-graph` 自身依赖缺失(非本插件问题)

## 命令速查

```sh
pnpm verify                          # 全链验证(发布前置)
pnpm pack:publishable                # 净化 tarball + 自防御门
pnpm publish:registry -- --otp ...   # 同净化流程发布(带 OTP 时)
pnpm context:sync                    # Harness 检出移动后重写链接
node ~/Dev-Space/deepseek-harness/apps/cli/lib/bin.js --profile web --dump-config
```
