# TODO — dsh-md-preview

更新：2026-09-09。仅保留当前状态与未完成事项。
发布流程及事故结论见 [长期交接](docs/HANDOVER.md)；历史履历见 Git 记录与
[Releases](https://github.com/benz-ai-x/dsh-md-preview/releases)。

## 当前状态

- 当前进行：多格式预览已整理为
  [Spec #38](https://github.com/benz-ai-x/dsh-md-preview/issues/38)，已拆为 11 张功能票与
  4 张验收票；母 Spec 保持打开并移除执行标签，子票见下方实施待办。
  总体目标是持续覆盖各种文档，并按格式提供合适的预览体验。本轮扩展文本、HTML、
  图片、音视频和 PDF 的只读预览，明确包含 JSON、XML 格式化美化；保留 Markdown
  既有编辑能力，Office 已排除。已确认需求与待定技术选择在规格中分别说明，
  后续工作见[实施待办](#多格式预览设计与实施)。已按用户批准的 6 PR / 4 层规划启动
  PR-1（#39），进度见 [批次状态](PIPELINE_STATE.yaml)。只读文本、统一入口、Host
  文档类别与编辑资格、手动刷新及成功阅读记录已实施；完整 `pnpm test` 通过
  26 个文件 / 338 项测试。独立固定基线 strict 123/123 通过，
  见[环境复核](docs/HANDOVER.md#本机环境事实2026-09-09)。真实浏览器验收仍由
  [#50](https://github.com/benz-ai-x/dsh-md-preview/issues/50) 跟踪，未据自动化勾选。
- 最新发布：[v0.10.0](https://github.com/benz-ai-x/dsh-md-preview/releases/tag/v0.10.0)
  （2026-09-08）；npm `latest` 与当前源码 package 均为 `0.10.0`。
  归档、GitHub 附件与 npm 下载包摘要一致，见
  [发布验证](docs/verification/releases/v0.10.0/WALKTHROUGH.md)。
- v0.10.0 文档同步已完成：中英文 README、契约、词汇表、交接与历史记录均对齐
  v0.10.0；[AGENTS.md](AGENTS.md) 统一维护接手、开发、验证和交付规则，
  [CLAUDE.md](CLAUDE.md) 保留引用与读取说明。本轮 **14 份 Markdown** 统一纳入
  文档同步提交；具体交接见 [HANDOFF.md](HANDOFF.md)。
- v0.10.0 后的文档验证：123 项 strict 基线检查通过，Markdown 解析、仓库内链接、命令与配置
  示例及 `git diff --check` 通过。该次仅修改文档，未重跑运行时测试、重启服务或新增发布；
  下述 290 项测试属于 v0.10.0 发布证据，UX-12 与 F-03–F-08 继续保持待办。
- [spec #20](https://github.com/benz-ai-x/dsh-md-preview/issues/20) 及
  #21–#32 已关闭，三轮 PR 已合并；交付证据见
  [R3 走查](docs/verification/r3-acceptance/WALKTHROUGH.md)，批次记录见
  [PIPELINE_STATE.md](PIPELINE_STATE.md)。
- v0.10.0 发布验证：`pnpm verify` 通过，含 123 项基线检查、26 个测试文件共
  290 项测试、类型检查及构建产物检查；同一 tarball 的干净 profile 安装、启动、
  普通包名导入、资源服务及移除检查通过。UI/UX 实施继续由
  [Issue #36](https://github.com/benz-ai-x/dsh-md-preview/issues/36) 跟踪剩余视觉验收。
- 已保留并完成原有顶部停靠改动，同步契约；此前以 `v0.9.0` Git 标签归档的
  排版改动已随 v0.10.0 发布到 npm，UX-12 浏览器验收继续跟踪。
  证据与剩余验收见 [本轮记录](docs/verification/uiux-alignment/WALKTHROUGH.md)。

## 多格式预览设计与实施

2026-09-08，`grill-with-docs` 的共识已通过 `to-spec` 整理为
[Spec #38](https://github.com/benz-ai-x/dsh-md-preview/issues/38)。已勾选项表示已确认的
设计或已完成的规格工作，未勾选项为实施细化与验收，不表示功能已实现。

- [x] **总体原则**：持续扩展各种文档的预览能力，并按文档类型提供合适的渲染和
      可读性呈现；具体方案围绕预览体验、格式兼容性、性能和项目契约确定。
- [x] **规格发布**：Spec #38 已发布并作为母规格引用，包含用户故事、已确认
      决策、待定项、测试边界和范围排除。测试优先沿用现有 Client 装配的 Remote 边界及
      Host harness，真实浏览器验证实际渲染、媒体解码和 HTML 隔离。
- [x] **拆票发布**：已按用户批准的票集发布功能票
      [#39](https://github.com/benz-ai-x/dsh-md-preview/issues/39)–[#49](https://github.com/benz-ai-x/dsh-md-preview/issues/49)
      （`ready-for-agent`）及验收票
      [#50](https://github.com/benz-ai-x/dsh-md-preview/issues/50)–[#53](https://github.com/benz-ai-x/dsh-md-preview/issues/53)
      （`ready-for-human`）。15 张票的正文、标签及 22 条原生阻塞关系已核对，
      `verify-tickets.sh` 退出 0，指纹自检 15/15 通过；验收票不作为功能票的阻塞项。
      仅按授权移除母票的 `ready-for-agent`，保留其正文与打开状态。
- [x] **新增文本的写入边界**：首轮采用只读预览美化，涵盖语法高亮、行号、折叠
      和适合文件格式的展示排版；美化只影响显示，不保存回原文件。Markdown
      保留现有编辑能力，新增文本的编辑与格式化保存另行明确范围。
      术语见[领域词汇表](CONTEXT.md#文档与读取)。
- [x] **JSON、XML 格式化预览**：本轮明确支持两种格式的只读美化，包含按结构
      缩进、换行、语法高亮和折叠，压缩内容也应可清晰阅读；格式化仅影响展示，
      不改写源文件。有效文件须以格式化效果验收，纯文本回退不能代替该能力。
- [x] **无扩展名与未知语言文本**：允许预览 `Dockerfile`、`Makefile` 等无扩展名
      文件，以及语言暂时无法识别的文本；Host 确认可作为文本读取后准入，识别到
      语言就高亮，否则提供纯文本回退。语言识别与读取、编辑资格分别判定，见
      [ADR-0006](docs/adr/0006-text-preview-independent-of-language-recognition.md)。
- [x] **JSONL 阅读方式**：默认按记录展示，支持逐条展开或折叠，展开后缩进高亮，
      并提供原始文本切换；某行格式错误时单独提示，其余记录继续展示。
      术语见[领域词汇表](CONTEXT.md#文档与读取)；这一呈现仍属于只读预览美化。
- [x] **HTML 体验目标**：用户要求“内嵌浏览器”，预览 HTML 与在浏览器中打开
      页面的体验一致，包含页面自身的样式、JavaScript 和页面交互。
      术语见[领域词汇表](CONTEXT.md#文档与读取)；具体嵌入方案仍待明确。
- [x] **HTML 联网与隔离边界**：默认允许加载外部脚本、在线字体等资源及请求
      外部 API，遵守浏览器同源与跨域规则；预览页面与 Harness 的界面和会话数据
      隔离，工作区文件访问仍由 Host 与文件服务裁决。
      见[ADR-0005](docs/adr/0005-networked-html-preview-isolated-from-harness.md)。
- [x] **HTML 入口与编辑范围**：本次迭代只打开本地 HTML 文件，保持只读，不提供
      HTML 编辑或保存；沿用会话工作区的文件范围。开发网站和任意网址的直接打开
      入口留待后续阶段，HTML 页面自身的脚本、外部资源及 API 请求按已确认边界保留。
- [x] **HTML 本地关联文件范围**：允许读取同一会话工作区内其他目录的 CSS、
      JavaScript、图片和数据文件；例如 `reports/index.html` 引用
      `../assets/app.js` 或 `../data/result.json`。路径解析后仍须位于会话工作区内，
      由 Host 与文件服务裁决。术语见[领域词汇表](CONTEXT.md#文档与读取)，
      决策见[ADR-0005](docs/adr/0005-networked-html-preview-isolated-from-harness.md)。
- [ ] **HTML 关联文件实现**：按规格落实受控资源服务、类型与大小限制，支持
      工作区内跨目录相对引用；根相对地址语义与具体接线按需求和固定基线能力确定。
- [x] **HTML 链接导航**：同一会话工作区内的 HTML 链接在预览面板中打开，
      外部网站链接在浏览器新标签页打开，面板保留当前本地 HTML。目标读取仍须
      经 Host 与文件服务裁决；此规则不改变页面加载外部资源和请求 API 的边界。
      术语见[领域词汇表](CONTEXT.md#文档与读取)，决策见
      [ADR-0005](docs/adr/0005-networked-html-preview-isolated-from-harness.md)。
- [ ] **HTML 浏览操作**：按
      [#49](https://github.com/benz-ai-x/dsh-md-preview/issues/49) 落实本地与外部链接、
      当前预览会话内的前进与后退、本地非 HTML 链接的统一预览及脚本导航校验。
- [ ] **文本呈现与准入细节**：落实 JSON、XML 格式化预览、原文切换与错误回退，
      验证展示信息准确及分段读取与格式化的衔接；明确 shell、YAML、程序源代码等
      类型的高亮清单、编码与非文本失败处理，并同步各入口的候选识别。
      JSONL、无扩展名和未知语言的阅读边界已确认。
- [x] **大文本阅读方式**：几十 MB 及更大的日志和 JSONL 采用按需分段读取，先
      呈现一段，再点击“继续读取”加载后续内容；明确显示已加载范围和是否读完。
      “继续读取”与打开最近阅读文档的“继续阅读入口”分别命名，见
      [领域词汇表](CONTEXT.md#文档与读取)。
- [x] **续读期间文件变化**：检测到文件变化（包括追加日志）时，保留已加载内容、
      暂停续读并提示内容刷新；刷新后从头读取，避免拼接不同版本的内容。
      不做跨版本合并，见
      [ADR-0006](docs/adr/0006-text-preview-independent-of-language-recognition.md)。
- [ ] **大文本读取边界**：明确单段与累计限额、超长行、续读失败和
      取消行为。现行读取默认上限为 1 MiB；已核对 lock 指定的
      `packages/fs/fs/src/index.ts`，`streamText` 提供可取消的文本流，具体限额及
      Remote 续读协议仍待设计。
- [x] **首轮文件类别范围**：除文本与 HTML 外，图片、视频、音频和 PDF 均为
      本轮要求。用户已取消 Office 预览需求，Office 不在本插件中预览；相关
      呈现、转换方案及运行依赖不再纳入本轮设计。
- [x] **图片预览交互**：默认适应预览面板大小，支持缩放、拖动查看和原始尺寸
      查看；GIF 保留动画。所有图片均只读，查看操作不修改原文件。
      术语见[领域词汇表](CONTEXT.md#文档与读取)。
- [ ] **图片与音视频格式及限额**：明确支持格式、浏览器解码边界、文件大小与
      解码资源限制；音视频播放方案另见下项。
- [ ] **音视频方案与支持范围**：按
      [#46](https://github.com/benz-ai-x/dsh-md-preview/issues/46) 落实播放/暂停、进度、
      定位和音量；首轮样例涵盖 MP3/WAV 音频及 MP4/WebM 视频，明确容器与编码组合及解码方案。
      原生播放器是候选方案，其支持范围不作为已确认上限；是否需要额外解码或
      转码按需求和验证结果决定，参见
      [MDN 编码支持说明](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs)。
- [x] **PDF 写入边界**：仅提供只读预览，不编辑或保存 PDF 源文件。
- [ ] **PDF 阅读操作与渲染方案**：按
      [#47](https://github.com/benz-ai-x/dsh-md-preview/issues/47) 落实只读翻页、缩放、
      页码跳转，有文本层时提供文字选择与搜索；明确特殊文件支持及失败提示，
      按目标体验选择内置能力或渲染库。
- [x] **新增只读预览的内容刷新**：同一次预览期间，工作区文件在外部被改动时，
      由读者点击面板“刷新”读取最新内容；面板不因文件变化自动重载，当前阅读和
      HTML 交互状态保留到刷新前。HTML 刷新会重新载入页面；首次打开与新的
      预览会话仍按既有契约读取文件。术语见[领域词汇表](CONTEXT.md#文档与读取)，
      HTML 边界见[ADR-0005](docs/adr/0005-networked-html-preview-isolated-from-harness.md)。
- [ ] **实施与验收**：按规格统一各类文件的打开行为，完成支持矩阵、相关现有
      测试、完整 verify 和真实浏览器证据；规格发布不等于功能交付。
- [x] **开发前置**：独立的固定 Harness 检出已完成构建，显式设置
      `DSH_HARNESS_ROOT` 后 strict 123/123 通过（退出 0）；原工作区改动保留，
      开发在独立 worktree 进行，见[环境复核](docs/HANDOVER.md#本机环境事实2026-09-09)。
- [x] **#39 基础文本通路 · 代码与回归**：既有入口可打开普通、无扩展名和未知语言
      UTF-8 文本；Host 与文件服务负责实际读取授权、文本判定及字节限额，新增文本
      只读。查看脸支持显式刷新与 Alt-R，最近阅读记录每次成功打开，并沿用共享
      未保存守卫、取消及迟到结果隔离。Host harness、Remote codec 与完整 Client
      装配回归通过；JSON/XML/JSONL 当前为原文，后续格式化、高亮与分段能力仍待实施。

## UI/UX 对齐 Harness

详细问题、基线数值、修改位置、依赖与验收标准见
[UI/UX 对齐分析](docs/research/harness-uiux-alignment.md)。初次排版分析未取得用户
原图，依据固定 Harness 源码、当时产品源码及历史截图；后续侧边栏与 A/B 修正
依据用户提供的真实截图，见 [截图反馈](docs/research/sidebar-screenshot-feedback.md)。
以下勾选表示**代码已实施并通过自动化回归**；真实页面的布局、颜色及缩放验收
集中在 UX-12，仍未闭环，不能据此宣称视觉验收全部通过。

- [x] **P0 · UX-01** 修复未定义颜色变量、搜索文字变量前缀和深色分段选中态，
      显式定义 hover、当前预览目标、焦点与禁用态。
- [x] **P1 · UX-02** 统一导航主文字为 14px / 20px，辅助路径为 12px / 18px，
      分组标签为 12–13px；统一字体家族与字重层级。
- [x] **P1 · UX-03** 单行条目对齐约 32px 行盒，路径双行条目至少 48px 起步；
      统一内容边距、图文对齐和分组留白。
- [x] **P1 · UX-04** 使用同源图标；常用图标按钮按 28×28px、常驻搜索按 32px
      高设计，扩大展开器命中区并保留键盘操作。
- [x] **P1 · UX-05** 文档名优先；快捷入口、搜索结果与头部整理展示路径，
      将文档名与父目录独立成行，并提供完整路径焦点提示。
- [x] **P1 · UX-06** 整理头部操作分组与折叠断点；解决已有顶部停靠改动与
      契约描述的差异，按实际宽度折叠并优先保留保存/关闭入口。
- [x] **P1 · UX-07** 联合优化快捷区信息量与窄导航空间；文字放大后搜索仍可达，
      手动偏好和各入口语义保持正确。
- [x] **P1 · UX-08** 对齐编辑脸字体与浅/深主题，显式定义行号沟槽、光标、选区、
      查找框及保存状态样式。
- [x] **P2 · UX-09** 移除放大档额外段距与标题上距覆盖；保留 760/940px 阅读宽度，
      正文节奏由平台 Markdown 排版变量统一管理。
- [x] **P2 · UX-10** 收敛阴影、边框、圆角与版本信息占位，保留必要状态反馈。
- [x] **P2 · UX-11** 加入缩放后的窄屏降级、稳定滚动条占位、焦点与状态提示布局。
- [ ] **验收 · UX-12** 保存同条件优化前后截图与 computed style 记录，走完
      搜索→打开→定位→编辑保存→关闭→继续阅读全链，并执行相应验证。

## 下一步

- [x] **文档侧边栏 · 代码与回归** 按用户截图增加会话头部入口与面板关闭按钮；
      宽屏为对话预留空间，窄屏覆盖展开，保留未保存守卫与宽度记忆。
      [Issue #37](https://github.com/benz-ai-x/dsh-md-preview/issues/37)；接入决策见
      [ADR-0004](docs/adr/0004-dock-preview-beside-the-harness-frame.md)。290 项测试与
      干净 profile 安装/移除冒烟通过，见 [验证记录](docs/verification/sidebar-docking/WALKTHROUGH.md)。
- [x] **截图反馈 · F-01/F-02** A 换原生回形针、B 换 ×；提示改为打开工作区文档/关闭
      文档面板，保留未保存守卫。后续建议与验收见
      [人工截图反馈 TODO](docs/research/sidebar-screenshot-feedback.md)。`pnpm verify` 通过
      290 项测试；已重新安装并重启 3185，服务资源与安装包校验通过。
- [ ] **截图反馈 · F-03/F-04** 对齐两侧顶栏操作行，强化导航、面孔切换、面板操作分组。
- [ ] **截图反馈 · F-05/F-06** 同条件校准正文宽度与排版，独立核查文档开头测试残留。
- [ ] **截图反馈 · F-07/F-08** 评估分隔拖柄反馈、默认宽度恢复、大纲与长表格体验。
- [ ] **文档侧边栏 · 页面验收（并入 UX-12）** 复验修正后的 A/B，记录真实布局、
      左右栏开合、工具详情共存、拖宽、浅/深主题、中/英文、边界宽度、缩放与完整阅读链路。
      2026-09-08 最近一次自动化浏览器连接超时，视觉证据仍待补齐。
      人工验收沿用 `r3-accept`（3185，tmux `dsh-r3`，npm 精确版本 0.10.0）。
- [x] **发布 v0.10.0**：`pnpm verify` 与干净 profile 安装/启动/移除冒烟通过；
      npm `latest` 已更新，提交 `9016f87` 与新标签已推送，GitHub Release 已公开。
      已下载核验同一 tarball，并将 `r3-accept`（3185）更新为 npm 正式版后重启。

## 验证与评估

- [ ] HMR 走查：使用 dev-link profile 与 `pnpm watch:client` 验证浏览器
      bundle 热替换及旧贡献释放。
- [ ] 评估 Mermaid 暗色主题适配（目前使用默认主题）。
- [ ] 评估正文内联 `.md` 文件提及的预览包装层；`chatFileMentions` 仍归
      ui-deliverables 所有。
