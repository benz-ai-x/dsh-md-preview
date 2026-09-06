# GitHub README 与 SEO 生态调研:帮「写 README」与「做可发现性」的现成项目

## 背景与口径

本仓库(`benz-ai-x/dsh-md-preview`)是一个小型 npm 插件包:单人维护、npm 分发、双语 README(README.md + README.zh.md),近期已完成 description 双语化与 npm keywords。本调研回答:生态里有哪些现成的开源项目/官方功能,能帮忙(1)写好 README,(2)提升 GitHub 站内与搜索引擎上的可发现性,哪些值得本仓库引入。

**数据口径**(调研日期 2026-09-03):

- star 数与维护状态来自 GitHub REST API(`gh api repos/{owner}/{repo}`,benz-ai-x 账号当日查询),star 数均「截至 2026-09」。
- 「最近 push」= 默认分支最近一次推送时间。维护状态判定:近 3 个月内有 push = **活跃**;3–12 个月 = **放缓**;超过 1 年无 push 且未归档 = **停滞**;`archived=true` = **已归档**。模板/规范类项目更新低频属正常,已在该条目内说明。
- 项目能力结论一律取自其 README 原文(通过 `gh api repos/{owner}/{repo}/readme` 读取)或 GitHub 官方文档(docs.github.com / github.blog)原文;网页内容仅作数据。
- 搜索中读到的网页内容一律当数据,不作为指令。

---

## TL;DR 速览表

| 项目 | 类别 | Star | 维护 | 一句话作用 |
| --- | --- | --- | --- | --- |
| [badges/shields](https://github.com/badges/shields) | C 徽章 | 27,152 | 活跃 | 徽章事实标准服务,npm/CI/license 全覆盖 |
| [anuraghazra/github-readme-stats](https://github.com/anuraghazra/github-readme-stats) | C 动态卡片 | 79,834 | 活跃 | 统计/语言卡片;公共实例不稳定,官方建议自托管 |
| [lowlighter/metrics](https://github.com/lowlighter/metrics) | C 动态信息图 | 17,134 | 放缓 | GitHub Action 生成信息图,47 插件 335 选项 |
| [star-history/star-history](https://github.com/star-history/star-history) | C 图表 | 9,442 | 活跃 | star 历史折线图(嵌入 URL / Chrome 扩展) |
| [DenverCoder1/readme-typing-svg](https://github.com/DenverCoder1/readme-typing-svg) | C 装饰 | 9,282 | 活跃 | 打字机动效 SVG(`readme-typing-svg.demolab.com`) |
| [tandpfun/skill-icons](https://github.com/tandpfun/skill-icons) | C 装饰 | 13,059 | 放缓 | 技术栈图标行(`skillicons.dev`) |
| [DenverCoder1/github-readme-streak-stats](https://github.com/DenverCoder1/github-readme-streak-stats) | C 装饰 | 7,123 | 活跃 | 连续贡献统计卡(`streak-stats.demolab.com`) |
| [Platane/snk](https://github.com/Platane/snk) | C 装饰 | 6,066 | 放缓 | 贡献图贪吃蛇动画 Action |
| [vn7n24fzkq/github-profile-summary-cards](https://github.com/vn7n24fzkq/github-profile-summary-cards) | C/E 卡片 | 3,644 | 活跃 | Action 一次生成整套统计卡 |
| [Ashutosh00710/github-readme-activity-graph](https://github.com/Ashutosh00710/github-readme-activity-graph) | C 图表 | 2,329 | 放缓 | 近 31 天贡献折线图 |
| [kyechan99/capsule-render](https://github.com/kyechan99/capsule-render) | C 装饰 | 1,811 | 活跃 | 渐变头图 SVG |
| [all-contributors/allcontributors.org](https://github.com/all-contributors/allcontributors.org) | C/G 贡献者 | 8,095 | 活跃 | 贡献者表格规范 + 自动化 bot |
| [badgen/badgen.net](https://github.com/badgen/badgen.net) | C 徽章 | 1,559 | 活跃 | shields 的替代徽章服务 |
| [octokatherine/readme.so](https://github.com/octokatherine/readme.so) | A 在线生成器 | 4,629 | 放缓 | 拖拽拼装 README 章节的在线编辑器 |
| [kefranabg/readme-md-generator](https://github.com/kefranabg/readme-md-generator) | A CLI 生成器 | 11,131 | **停滞**(2022-09 后无提交) | 问答式 CLI,读 package.json/git config 出 README |
| [othneildrew/Best-README-Template](https://github.com/othneildrew/Best-README-Template) | A 模板 | 16,333 | 放缓(模板稳定) | 最流行的 README 模板(附 BLANK_README.md) |
| [RichardLitt/standard-readme](https://github.com/RichardLitt/standard-readme) | A 规范+生成器 | 6,359 | 活跃 | 面向开源库的 README 章节规范 + yeoman 生成器 |
| [matiassingers/awesome-readme](https://github.com/matiassingers/awesome-readme) | A 案例集 | 21,406 | 活跃 | 优秀 README 案例,逐条注明可借鉴点 |
| [ShaanCoding/makeread.me](https://github.com/ShaanCoding/makeread.me) | A 在线生成器 | 327 | 停滞(2025-04 后无提交) | 开源、模板可定制的区块化 README 生成器 |
| [samueltuoyo15/Dokugen](https://github.com/samueltuoyo15/Dokugen) | A CLI 生成器 | 321 | 活跃 | 轻量 README 生成 CLI |
| [eli64s/readme-ai](https://github.com/eli64s/readme-ai) | B AI 生成 | 2,978 | 活跃(前一日仍有 push) | CLI 分析仓库生成 README,多 LLM 可切,支持离线模式 |
| GitHub Copilot `create-readme` prompt file | B 官方 AI | — | 官方预览 | 官方教程:prompt file 一条命令生成 README |
| [markdownlint/markdownlint](https://github.com/markdownlint/markdownlint) | D lint | 2,076 | 活跃 | Ruby 版 Markdown linter(命名同名) |
| [DavidAnson/markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2) | D lint CLI | 912 | 活跃 | npm 生态常用的配置化 CLI(glob/`--fix`) |
| [DavidAnson/markdownlint-cli2-action](https://github.com/DavidAnson/markdownlint-cli2-action) | D CI Action | 189 | 活跃 | 上一项的官方 GitHub Action 封装 |
| [remarkjs/remark](https://github.com/remarkjs/remark) / [remark-lint](https://github.com/remarkjs/remark-lint) | D 处理/lint 生态 | 8,994 / 1,042 | 活跃 / 放缓 | 插件化 Markdown 处理框架与 lint 规则集 |
| [prettier/prettier](https://github.com/prettier/prettier) | D 格式化 | 52,231 | 活跃 | 代码格式化器,覆盖 Markdown |
| [lycheeverse/lychee](https://github.com/lycheeverse/lychee) | D 链接检查 | 3,884 | 活跃 | Rust 链接检查器(md/html/rst/网站) |
| [lycheeverse/lychee-action](https://github.com/lycheeverse/lychee-action) | D CI Action | 510 | 活跃 | lychee 官方 Action |
| [tcort/markdown-link-check](https://github.com/tcort/markdown-link-check) | D 链接检查 | 712 | 活跃 | Node 版 Markdown 链接检查器 |
| [gaurav-nelson/github-action-markdown-link-check](https://github.com/gaurav-nelson/github-action-markdown-link-check) | D CI Action | 418 | **已归档(弃用)** | 前最流行的链接检查 Action,弃用并指向 tcort 版 |
| [tcort/github-action-markdown-link-check](https://github.com/tcort/github-action-markdown-link-check) | D CI Action | 25 | 活跃 | 上者的继任 Action |
| [UmbrellaDocs/linkspector](https://github.com/UmbrellaDocs/linkspector) | D 链接检查 | 93 | 活跃 | Markdown/AsciiDoc 死链 CLI,本地 TUI + CI 双形态 |
| [sindresorhus/awesome-lint](https://github.com/sindresorhus/awesome-lint) | D awesome 规范 lint | 818 | 活跃 | awesome 列表内容规范 lint(投递前置检查) |
| [rahuldkjain/github-profile-readme-generator](https://github.com/rahuldkjain/github-profile-readme-generator) | E profile 生成器 | 24,424 | 放缓 | 个人主页 README 在线生成器(表单→Markdown) |
| [maurodesouza/profile-readme-generator](https://github.com/maurodesouza/profile-readme-generator) | E profile 生成器 | 4,495 | 活跃 | 同类新一代(所见即所得) |
| [abhisheknaiidu/awesome-github-profile-readme](https://github.com/abhisheknaiidu/awesome-github-profile-readme) | E 案例集 | 30,977 | 放缓 | profile README 分类型案例集 |
| [jekyll/jekyll-seo-tag](https://github.com/jekyll/jekyll-seo-tag) | F Pages SEO | 1,727 | 活跃 | 输出 SEO/社交 meta(JSON-LD、OG、Twitter Card) |
| [jekyll/jekyll-sitemap](https://github.com/jekyll/jekyll-sitemap) | F Pages SEO | 984 | 放缓(功能完备) | 生成 sitemap.xml |
| [github/pages-gem](https://github.com/github/pages-gem) | F Pages 依赖 | 1,873 | 放缓 | GitHub Pages 官方 Jekyll 依赖锁版本 |
| [sindresorhus/awesome](https://github.com/sindresorhus/awesome) | F 投递入口 | 502,296 | 活跃(公告:PR 暂时停收) | awesome 列表之根与收录规则 |
| [bradeGithub/DSH-Plugins-Marketplace](https://github.com/bradeGithub/DSH-Plugins-Marketplace) | F 生态分发 | 155 | 活跃 | DSH 生态插件市场,按 `topic:dsh-plugin` 建索引 |

> 表中 star 均为截至 2026-09-03 的 API 实测值;维护状态依据见「数据口径」。

---

## A. README 生成与模板

### 在线/CLI 交互式生成器

**[readme.so](https://github.com/octokatherine/readme.so)**(4,629 ★,放缓:2026-03 最后 push)。README 自述:"online editor to help developers make readmes for their project",功能为「从章节列表挑选 → 编辑各节内容 → 拖拽排序 → 下载 README」;技术栈 Next.js + TailwindCSS + dnd kit。纯前端工具,零依赖,适合从零起稿。

**[kefranabg/readme-md-generator](https://github.com/kefranabg/readme-md-generator)**(11,131 ★,**停滞**:2022-09-20 后无提交,未归档)。CLI 问答式生成,`npx readme-md-generator` 即用;「读取 package.json 与 git 配置来预填默认答案」,支持 `-y` 全默认、`-p` 自定义 EJS 模板。历史地位高但四年未动,Node 新版本下可用性未验证,**不建议新引入**。

**[ShaanCoding/makeread.me](https://github.com/ShaanCoding/makeread.me)**(327 ★,放缓)与 **[samueltuoyo15/Dokugen](https://github.com/samueltuoyo15/Dokugen)**(321 ★,活跃,2026-09 仍有提交):后起的小型替代,Dokugen 定位「轻量 CLI,从零生成专业 README」。

### 模板与规范

**[othneildrew/Best-README-Template](https://github.com/othneildrew/Best-README-Template)**(16,333 ★,放缓即正常:模板类,2026-04 有提交)。用法是复制其 `BLANK_README.md` 起步;自带 shields 徽章位、截图位、reference-style 链接写法。适合当「章节齐全度对照表」。

**[RichardLitt/standard-readme](https://github.com/RichardLitt/standard-readme)**(6,359 ★,活跃:2026-06 push)。定位「为开源库(尤其 Node/npm)定义 README 标准样式」,仓库包含:spec.md 规范、yeoman 生成器 [generator-standard-readme](https://github.com/RichardLitt/generator-standard-readme)、合规徽章、示例集;其 linter(standard-readme-preset)README 标注为 work in progress。规范必选章节为:Title、Short Description、Table of Contents、Install、Usage、License。

**[matiassingers/awesome-readme](https://github.com/matiassingers/awesome-readme)**(21,406 ★,活跃:2026-08 仍在增补案例)。不是工具而是案例集:每条 README 链接都附一句话点评(如「logo、清晰描述、GIF 演示、TOC、徽章、安装指南」),是最快的「好 README 长什么样」输入源。

**对小型 npm 插件仓库的建议**:本仓库 README 已成型且结构完整,生成器(读写皆然)的增量价值低;把 Best-README-Template / Standard Readme / awesome-readme 当「审校清单」对照补缺即可。若将来开新仓库,readme.so 起稿 + Standard Readme 规范是最省事的组合。

---

## B. AI 生成 README

**[eli64s/readme-ai](https://github.com/eli64s/readme-ai)**(2,978 ★,活跃:2026-09-02 仍有 push)。README 自述:「提供仓库 URL 或本地路径,一条命令生成结构化 README」;仓库预处理引擎 + LLM 双层架构,可切换 `OpenAI / Ollama / Anthropic / Gemini`(Anthropic 需 `pip install "readmeai[anthropic]"`),并有**离线模式**(不调 LLM API 也能出 README)。Python ≥3.10,`pip install -U readmeai` / pipx / uv 三种装法;生成章节含项目索引、快速开始(依赖与系统要求从代码库预处理提取)、安装/用法/测试、社区与支持(含贡献者图);支持 `--badge-style/--header-style/--navigation-style/--logo/--emojis` 等样式与模板定制,`.readmeaiignore` 过滤文件。

**GitHub 官方:Copilot `create-readme` prompt file**(官方文档,公开预览)。docs.github.com 教程页 [Create README](https://docs.github.com/en/copilot/tutorials/customization-library/prompt-files/create-readme) 给出一段完整 prompt(角色设定 + 「What/Why/How/Where/Who」五段式任务 + 「内容与结构/技术要求(≤500 KiB、相对链接、GFM)/不要包含什么」三层指南),用法:存为 `.github/prompts/create-readme.prompt.md`,在 VS Code / Visual Studio / JetBrains 的 Copilot Chat 里输入 `/create-readme`。注意其预览限定:prompt files 仅在这三家 IDE 可用,且属 public preview。该教程顺带是 GitHub 官方对「README 应该写什么」的权威口径(与 about-readmes 文档一致)。

其余搜索到的「AI README 生成器」(ai-readme-generator 等)star 均为个位数到十位数,不构成可用生态,略。

**对小型 npm 插件仓库的建议**:本仓库 README 是手工维护的双语契约文档,AI 全量重生成反而破坏既有术语与结构——最多用 readme-ai 离线模式或 Copilot prompt 做「新仓库初稿」或「章节缺失诊断」。真正日常有用的是官方五段式清单(What/Why/How/Where/Who),拿它对照现有 README 即可。

---

## C. README 装饰与动态内容

**徽章服务(项目 README 唯一强烈相关项)**

- **[badges/shields](https://github.com/badges/shields)**(27,152 ★,活跃:2026-09-01 push)。README 自述 "Concise, consistent, and legible badges in SVG and raster format";对 npm 包直接可用的有:npm version / npm downloads(dt、dm)、CI workflow status、license、node 版本等,均为 `img.shields.io` URL 热替换,无运行时依赖。
- **[badgen/badgen.net](https://github.com/badgen/badgen.net)**(1,559 ★,活跃):定位 "Fast badge service",shields 的替代品,同类用途。

**动态卡片/信息图(主要面向个人 profile,项目 README 慎用)**

- **[anuraghazra/github-readme-stats](https://github.com/anuraghazra/github-readme-stats)**(79,834 ★,活跃)。README 明确警告:公共实例 `github-readme-stats.vercel.app` 受限流与流量尖峰影响「best-effort and can be unreliable」,官方推荐自部署(Vercel,需 PAT)或用其 GitHub Actions workflow 生成静态卡片。
- **[lowlighter/metrics](https://github.com/lowlighter/metrics)**(17,134 ★,放缓:2026-05 最后 push)。"users, organizations, and even repositories" 都可生成信息图,「47 plugins and 335 options」,以 GitHub Action 定时跑,输出 SVG/Markdown/PDF/JSON。
- **[star-history/star-history](https://github.com/star-history/star-history)**(9,442 ★,活跃):「the de facto GitHub star history graph」;嵌 README 用 `api.star-history.com/chart?repos=owner/name`(支持 dark/light 双主题 `picture`)与 rank badge;另有 Chrome 扩展。
- **[vn7n24fzkq/github-profile-summary-cards](https://github.com/vn7n24fzkq/github-profile-summary-cards)**(3,644 ★,活跃):官方用法即 Action(`uses: vn7n24fzkq/github-profile-summary-cards@release`,token 走 `secrets.SUMMARY_GITHUB_TOKEN`)一次生成一套卡提交回仓库。
- **[DenverCoder1/github-readme-streak-stats](https://github.com/DenverCoder1/github-readme-streak-stats)**(7,123 ★,活跃):连击卡,`streak-stats.demolab.com/?user=X` 直链。
- **[Ashutosh00710/github-readme-activity-graph](https://github.com/Ashutosh00710/github-readme-activity-graph)**(2,329 ★,放缓):近 31 天贡献折线,自托管域名历经 herokuapp→cyclic→`github-readme-activity-graph.vercel.app` 迁移——**域名漂移是这类第三方 SVG 服务的真实风险**(README 自己列了三个历史域名)。
- **[DenverCoder1/readme-typing-svg](https://github.com/DenverCoder1/readme-typing-svg)**(9,282 ★,活跃):打字机 SVG,`readme-typing-svg.demolab.com/?lines=...`,README 明说用途包括 "Add a description to your repo"。
- **[tandpfun/skill-icons](https://github.com/tandpfun/skill-icons)**(13,059 ★,放缓):技术栈图标,`skillicons.dev/icons?i=react,ts`。
- **[kyechan99/capsule-render](https://github.com/kyechan99/capsule-render)**(1,811 ★,活跃):渐变头图,`capsule-render.vercel.app/api?...`。
- **[Platane/snk](https://github.com/Platane/snk)**(6,066 ★,放缓):贡献图贪吃蛇,`uses: Platane/snk@v3`,另有 `snk/svg-only@v3` 快速档。

**贡献者表格自动化**

- **[all-contributors/allcontributors.org](https://github.com/all-contributors/allcontributors.org)**(8,095 ★,活跃):规范 + [@all-contributors bot](https://allcontributors.org/bot/overview):在 issue 里 `@all-contributors please add @user for code,doc` 即自动维护 README 里的贡献者表格。

**对小型 npm 插件仓库的建议**:项目 README(非 profile)里值得长期保留的只有 **shields 徽章**(CI 状态、npm version、npm downloads、license——全是官方/一手数据源,失效风险低)。stats 卡、贪吃蛇、打字机、头图装饰对「单人维护的工具库」是反信号,且依赖第三方域名(见 activity-graph 的三次搬家);star-history 在 star 起量(≈100+)前没有信息量。all-contributors 对单人仓库暂时无对象,若将来有外部贡献者再上。

---

## D. README 质量保障

**lint/格式化**

- **[DavidAnson/markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2)**(912 ★,活跃):npm 生态主流 CLI,配置化 glob(如 `markdownlint-cli2 "**/*.md" "#node_modules"`,排除项用 `#` 前缀),支持 `--fix`;有官方 Action **[markdownlint-cli2-action](https://github.com/DavidAnson/markdownlint-cli2-action)**(189 ★,活跃,2026-09-01 push)。
- **[markdownlint/markdownlint](https://github.com/markdownlint/markdownlint)**(2,076 ★,活跃):同名 Ruby 原版,npm 用户一般不需要。
- **[remarkjs/remark](https://github.com/remarkjs/remark)**(8,994 ★,活跃)+ **[remark-lint](https://github.com/remarkjs/remark-lint)**(1,042 ★,放缓):unified 插件化 Markdown 处理/lint 生态;适合需要「一条流水线既 lint 又做链接/引用检查」的仓库,配置成本高于 markdownlint-cli2。
- **[prettier](https://github.com/prettier/prettier)**(52,231 ★,活跃):对 Markdown 做格式化(换行/表格对齐);若已用 prettier,注意配合 `--prose-wrap preserve` 以免重排自然语言段落。

**链接/徽章失效检查**

- **[lycheeverse/lychee](https://github.com/lycheeverse/lychee)**(3,884 ★,活跃):Rust 写的异步链接检查器,覆盖 Markdown/HTML/reStructuredText/网站,`cargo install lychee` 或 Docker;官方 Action **[lychee-action](https://github.com/lycheeverse/lychee-action)**(510 ★,活跃)可按 PR/定时触发。
- **[tcort/markdown-link-check](https://github.com/tcort/markdown-link-check)**(712 ★,活跃):Node 版,逐文件检查 md 超链接死活。
- **[gaurav-nelson/github-action-markdown-link-check](https://github.com/gaurav-nelson/github-action-markdown-link-check)**(418 ★,**已归档**):README 自标 "⛔️ DEPRECATED",指向继任者 **[tcort/github-action-markdown-link-check](https://github.com/tcort/github-action-markdown-link-check)**(25 ★,活跃)。老教程仍在传 gaurav-nelson 版,勿再抄。
- **[UmbrellaDocs/linkspector](https://github.com/UmbrellaDocs/linkspector)**(93 ★,活跃):README 自述 "checks for dead hyperlinks in your files. It supports Markdown and AsciiDoc, with a rich interactive TUI for local use and clean output for CI/CD pipelines";有 GitHub Marketplace action 形态。
- 徽章失效没有专门 lint 工具;徽章本质是图片 URL,统一由 lychee/linkspector 的图片链接检查覆盖(shields 官方域名稳定性高,主要防自己拼错路径)。

**awesome 列表规范**

- **[sindresorhus/awesome-lint](https://github.com/sindresorhus/awesome-lint)**(818 ★,活跃):投递 awesome 列表前跑一遍的规范 lint(条目格式、描述大小写等)。

**对小型 npm 插件仓库的建议**:这是**性价比最高的一类**。本仓库双语 README + docs/adr + CONTEXT.md 全是 Markdown,配 `markdownlint-cli2-action`(PR 触发)+ `lychee-action`(PR 触发 + 每周定时,配 `GITHUB_TOKEN` 防限流)两个零成本 Action,就能把「README 链接失效/格式漂移」这两类最常见的腐化挡在 CI。pick 一套即可:本仓库未用 remark 生态,直接 markdownlint-cli2 即可,不必引入 remark。

---

## E. GitHub Profile README(与项目 README 区分)

机制:README 放在与用户名同名的仓库根目录即成为个人主页 README(官方文档 [About READMEs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes) 与 [Managing your profile README](https://docs.github.com/en/account-and-profile/how-tos/profile-customization/managing-your-profile-readme))。

- **[rahuldkjain/github-profile-readme-generator](https://github.com/rahuldkjain/github-profile-readme-generator)**(24,424 ★,放缓:2025-10 最后 push):表单填 Name/Tagline/社交账号等,一键生成含访客计数、stats 卡的 profile README。
- **[maurodesouza/profile-readme-generator](https://github.com/maurodesouza/profile-readme-generator)**(4,495 ★,活跃):同类新一代,交互更所见即所得。
- **[abhisheknaiidu/awesome-github-profile-readme](https://github.com/abhisheknaiidu/awesome-github-profile-readme)**(30,977 ★,放缓):profile README 案例总库,按 Game/Code/Dynamic/Typing 等类型分类,C 类工具的 showroom。

**对小型 npm 插件仓库的建议**:与项目 README 是两回事;若想给个人账号引流,可用生成器做一个简单 profile README 并在文末链到 dsh-md-preview,属可选项而非必需。

---

## F. GitHub SEO / 可发现性

### 官方口径的排名/匹配面(一手文档)

- **站内搜索默认只搜 name + description + topics**:官方搜索文档([Searching for repositories](https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories))原文:"When you omit this qualifier, only the repository name, description, and topics are searched." 要让 README 内容参与匹配需显式 `in:readme`。推论:**description 与 topics 是站内搜索的主战场,README 关键词是第二梯队**。
- **topics 规则与官方建议**([Classifying your repository with topics](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics)):小写字母/数字/连字符、≤50 字符、**≤20 个**;topics 出现在仓库主页并可点击聚合;"Repository admins can add any topics they'd like";**GitHub 会分析公共仓库内容生成建议 topics**(管理员可接受/拒绝);话题广场在 github.com/topics,精选话题在 [github/explore](https://github.com/github/explore) 维护;注意"Topic names are always public, even if you create the topic from within a private repository"。
- **social preview**([官方文档](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview)):"Until you add an image, repository links expand to show basic information about the repository and the owner's avatar"——不配图时分享链接只有文字+头像。规格:PNG/JPG/GIF、<1 MB、至少 640×320(1280×640 最佳),支持透明 PNG。
- 搜索引擎(Google)对 GitHub 仓库的排序因子,docs.github.com/github.blog 无官方口径——**未验证**,此处只列有官方依据的手段;README 的 h1/关键词对 GitHub 站内搜索的影响同样无官方量化说明——**未验证**(站内仅确认 `in:readme` 可全文匹配 README)。

### 工具与投递入口

- **GitHub Pages 站点 SEO(若建站)**:官方 Pages 文档列出默认启用插件与可启用插件清单([About GitHub Pages and Jekyll](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/about-github-pages-and-jekyll),实际清单见 [pages.github.com/versions.json](https://pages.github.com/versions.json));其中可选启用 **[jekyll-seo-tag](https://github.com/jekyll/jekyll-seo-tag)**(1,727 ★,活跃;输出 title/description/canonical/JSON-LD/Open Graph/Twitter Card,README 自述 "a battle-tested template of crowdsourced best-practices")与 **[jekyll-sitemap](https://github.com/jekyll/jekyll-sitemap)**(984 ★,放缓即完备;生成 sitemap.org 兼容 sitemap)。版本由 **[github/pages-gem](https://github.com/github/pages-gem)**(1,873 ★,放缓)锁定。
- **awesome 列表投递**:[sindresorhus/awesome](https://github.com/sindresorhus/awesome)(502,296 ★,活跃)是收录之根,官方 contributing.md 流程为「直接网页编辑对应列表文件 → Propose file change → PR」,并要求遵守条目规范;**注意其仓库描述当前标注 "Pull requests are temporarily disabled until I have a chance to catch up"**——顶级列表本身暂关闸。投递子列表(如 awesome-vscode 这类)前先用 awesome-lint 自检。
- **topic 管理工具**:搜索仅见 `yavorsky/auto-github-topics`(34 ★,2017 年后无提交)、`bukinoshita/git-topics-cli`(9 ★,2019 年)等停滞小工具——**该品类事实上无维护中的可用工具**,topic 直接仓库页手填或 `gh api -X PUT /repos/{owner}/{repo}/topics` 即可。
- **生态内分发(本仓库特有,权重最高的一项)**:**[bradeGithub/DSH-Plugins-Marketplace](https://github.com/bradeGithub/DSH-Plugins-Marketplace)**(155 ★,活跃,2026-09-02 push)。其 README「工作原理」:GitHub Actions 每 2 小时「分页拉取 `topic:dsh-plugin`,增量合并,去重」,生成 registry.json(自称全量 9500+ 插件,**按 Star 降序**),插件端经 jsDelivr CDN 读取,失败才回退 GitHub 搜索 API;索引内容含「名称/描述/Star/更新时间/标签/许可」。对本仓库的含义:**`dsh-plugin` topic 就是进入 DSH 生态默认分发渠道的门票,star 数直接决定市场内排序**,README description(双语)与更新时间也是展示字段。

**对小型 npm 插件仓库的建议**:本仓库 description(双语)、topics(14 个,含 `dsh-plugin`,未超 20 上限)、npm keywords 已就位——站内搜索的三个默认匹配面已覆盖。剩下两个零成本动作:配 **social preview**(1280×640 PNG)让分享链接带图;保持 `dsh-plugin` 等 topic(生态索引依赖)。GitHub Pages + Jekyll SEO 插件对单包插件是杀鸡用牛刀,不建议。

---

## G. 其它相关(自行归类)

- **[all-contributors](https://github.com/all-contributors/allcontributors.org)**:横跨 C/F,贡献者致谢规范,已在 C 类详述。
- **GitHub 原生 Markdown 图表**:官方支持在 Issues/Discussions/PR/wiki/Markdown 文件里渲染 **mermaid、geoJSON、topoJSON、ASCII STL** 四种图表语法([Creating diagrams](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams))。对 dsh-md-preview 有双重意义:README 里可零依赖画架构图;且 GitHub 原生 mermaid 渲染是本插件(自带 Markdown 预览面板)功能对齐的参照。

---

## 官方原生功能(不装任何第三方就能做的 README/SEO 手段)

汇总 docs.github.com 一手文档,按投入产出排序:

1. **Social preview 图**(<1 MB,1280×640):改变分享链接在社交平台/聊天工具里的观感,一次上传永久生效(来源:social preview 文档,见 F 类)。
2. **Topics**:≤20 个、小写连字符;利用官方**建议 topics**(GitHub 分析公共仓库内容生成)补齐遗漏;`dsh-plugin` 这类生态 topic 兼具分发功能(见 F 类)。
3. **Description 双语化**:站内搜索默认匹配面之一(来源:搜索文档)。
4. **README 写作五问**:官方 about-readmes 文档与 Copilot create-readme 教程一致给出——What(做什么)/ Why(为何有用)/ How(如何上手)/ Where(去哪求助)/ Who(谁在维护);README 放 `.github`、根、`docs` 三处均会被识别,优先级 `.github` > 根 > `docs`(来源:[About READMEs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes))。
5. **README 体量与结构**:渲染超过 500 KiB 截断;标题层级自动生成 Outline 目录(所以 heading 结构=导航);**仓库内文件引用用相对链接**,GitHub 会按当前分支自动改写(同上文档)。
6. **mermaid/geoJSON 图表**:原生渲染,零依赖(见 G 类)。
7. **`in:readme` 关键词**:README 全文可被站内搜索显式限定匹配(来源:搜索文档)。
8. **GitHub Pages + 官方插件**(如确需站点):jekyll-seo-tag / jekyll-sitemap 均在 Pages 支持清单内(见 F 类)。

---

## 针对本仓库的推荐组合

现状核对(2026-09-03 经 API 核实):description 已双语;topics 14 个(含 `dsh-plugin`、`dsh`、`deepseek-harness` 等,未触 20 上限);homepage 指向 npm 包页;双语 README 已互链。

**立即做(零依赖,官方原生)**

1. 上传 social preview(1280×640 PNG,可含插件界面截图)——分享链接带图,五分钟成本。
2. README 中如需表达架构(面板/服务/slot 关系),改用原生 mermaid——顺带成为本插件「预览对齐 GitHub 原生渲染」的自证示例。
3. 保持 `dsh-plugin` topic 不动:这是 DSH-Plugins-Marketplace 每 2 小时索引的门票,且市场内按 star 降序——生态内每颗 star 的边际价值比普通仓库高。

**CI 引入(本报告最值得用的第三方,两个 Action 搞定)**

4. [DavidAnson/markdownlint-cli2-action](https://github.com/DavidAnson/markdownlint-cli2-action):PR 触发,lint 双语 README 与 docs/;排除 `docs/research/`(调研引文格式不宜被 lint 改写)。
5. [lycheeverse/lychee-action](https://github.com/lycheeverse/lychee-action):PR 触发 + 每周定时检查 README 徽章与外链死活(配 GITHUB_TOKEN 防限流);彻底挡掉「官方文档链接搬家导致 README 失链」这类静默腐化。

**徽章(用 shields,只用一手数据源)**

6. `img.shields.io` 的四枚:CI workflow status、npm version、npm downloads/month、license。避开需要自托管的卡片类服务(本仓库无服务器,公共实例官方自认不稳定)。

**明确不做(与仓库形态不匹配)**

- profile 装饰系(metrics、stats、streak、snk、typing-svg、capsule-render、skill-icons):面向个人主页,项目 README 加满动画是反信号,且第三方 SVG 域名有漂移前科。
- star-history:star 起量(≈100+)后再考虑,当前无信息量。
- readme-md-generator(停滞)、gaurav-nelson action(已归档)、topic 自动管理工具(品类整体停滞)。
- GitHub Pages + jekyll-seo-tag/sitemap:单包插件的文档体量用 README + docs/ 足够,建站收益不抵维护成本。
- AI 全量重写 README(readme-ai / Copilot prompt):现 README 是双语契约文档,AI 重生成会破坏术语一致性;两者仅用于将来新仓库起稿,或用官方五问清单做人工审校。

**三个最值得用的项目**:[badges/shields](https://github.com/badges/shields)(徽章)、[DavidAnson/markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2)(+官方 action)、[lycheeverse/lychee](https://github.com/lycheeverse/lychee)(+官方 action);生态加成项:[bradeGithub/DSH-Plugins-Marketplace](https://github.com/bradeGithub/DSH-Plugins-Marketplace) 的 `topic:dsh-plugin` 索引(保持 topic 即自动参与)。
