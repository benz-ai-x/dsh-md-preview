[English](README.md) | 中文

# @benz-ai-x/dsh-md-preview

在 DeepSeek Harness 对话旁阅读、编辑工作区文档。打开助手产出的文档、浏览会话工作区，或从上次阅读的位置继续。

[![npm](https://img.shields.io/npm/v/@benz-ai-x/dsh-md-preview)](https://www.npmjs.com/package/@benz-ai-x/dsh-md-preview)
[![GitHub](https://img.shields.io/badge/repo-benz--ai--x%2Fdsh--md--preview-24292e?logo=github)](https://github.com/benz-ai-x/dsh-md-preview)

当前发布：**[v0.10.0](https://github.com/benz-ai-x/dsh-md-preview/releases/tag/v0.10.0)**，发布于 2026-09-08。要求固定的 Harness **0.1.2-rc.1** 基线及 web profile。

未发布源码改动（[#39](https://github.com/benz-ai-x/dsh-md-preview/issues/39)）已加入 UTF-8 文本只读预览、既有文档入口和显式内容刷新。下方带版本的安装命令安装 v0.10.0，新增能力尚待发布。

## 安装或升级

```sh
dsh plugin --profile web add @benz-ai-x/dsh-md-preview@0.10.0 --save-exact
dsh --profile web --dump-config
```

有效配置中应出现 `md-preview` 行。使用 `dsh --profile web` 启动；如果该 profile 已在运行，重启同一个实例并刷新页面。使用其他 web profile 时，将 `web` 替换成它的名称。

移除插件：

```sh
dsh plugin --profile web remove @benz-ai-x/dsh-md-preview
```

## 主要能力

- **预览与编辑**：渲染 Markdown、GFM 表格、代码高亮、TeX 和 Mermaid；使用 CodeMirror 编辑已有 Markdown 文档并保存回工作区。
- **文本阅读**：UTF-8 文本、程序源码、`Dockerfile`、`Makefile` 与未知扩展名按只读原文显示；主动刷新取得外部改动。
- **对话旁阅读**：宽屏时文档侧边栏预留独立空间，记忆手动宽度；窄屏或最大化时覆盖展开。原生导航与工具详情保留各自操作。
- **查找文档**：浏览工作区树，按文档名称搜索未展开的目录，使用当前回合产出、最近阅读和继续阅读入口。
- **阅读连续**：重新打开先读取最新内容，再恢复已记录的阅读位置；浏览器存储可用时，记忆面板宽度、导航宽度与导航选择。
- **保护编辑**：关闭、打开其他文档或切回预览均检查未保存草稿。文件被其他方修改时提供重新加载或强制覆盖；失败后可重试。
- **跟随 Harness 样式**：使用共享排版、主题颜色、原生图标和可见键盘焦点；正文与标题由平台 Markdown 渲染器排版。

## 打开、导航与关闭

| 入口或控件 | 行为 |
| --- | --- |
| 「Session 日志」旁的回形针 | 面板关闭时打开工作区浏览；面板打开时关闭当前面板 |
| 回合下方的文本或 Markdown chip | 打开该产出文档 |
| 消息操作区的「预览文档」 | 列出该消息所属回合产出的文本候选 |
| 面板内的文件夹图标 | 宽面板开合工作区导航；窄面板进入浏览脸 |
| 大纲 | 跳转标题并高亮当前阅读位置 |
| 预览 / 编辑 | 在可编辑文档的查看脸与编辑脸之间切换 |
| 刷新内容 | 在查看脸重新读取当前文档；失败后可重试 |
| 全屏显示 / 还原 | 最大化到应用内容区域，再回到记忆的宽度 |
| × | 经过未保存守卫关闭面板，焦点返回回形针入口 |

回形针打开的是**工作区文档**，目前不支持用户上传的附件。文本候选包括无扩展名文件与未知扩展名；Office、HTML、PDF、图片、音视频及常见二进制容器不进入本次文本预览，其产出 chip 保持 Harness 交给桌面应用打开的行为，工作区对应条目不能打开预览。候选仍须经过 Host 授权并成功读取为 UTF-8 文本。

新增文本只读，本次 JSON、XML、JSONL 显示原始源码。语法高亮、折叠、结构格式化及大文本分段读取由 [Spec #38](https://github.com/benz-ai-x/dsh-md-preview/issues/38) 的 #40–#44 继续实施；HTML、图片、音视频及 PDF 预览由 #45–#49 跟进。Office 预览已排除。默认完整读取上限仍为 1 MiB，二进制或非法 UTF-8 由 Host 返回 `md-preview/not-text`。

应用可用宽度至少为 1056px 时，文档侧边栏独立停靠；更窄或最大化时覆盖展开。初始宽度取半个视口、最多 720px，记忆 360–1200px 的手动拖宽偏好，并按可用空间收缩。拖动左边缘调整宽度，双击边缘切换最大化。面板宽度至少 640px 时，可在正文旁展开「文件 / 大纲」导航；更窄时使用浏览脸或大纲弹层。直接打开文档默认优先正文，已有手动导航偏好时优先采用偏好。

编辑时点击保存按钮或按 Cmd/Ctrl-S。若要放弃草稿，先请求切回预览、打开其他文档或关闭，再在提示中选择**放弃修改**；选择**继续编辑**会保留草稿。当前没有独立的“取消编辑”按钮。保存只写回已有文件，确认成功后返回预览。

工作区搜索按文档**名称**进行不区分大小写的匹配，不读取正文；遍历不完整时明确说明原因，清空查询恢复树的展开状态。每次成功打开都会记录文档身份与阅读时间，包括未滚动的文档。「最近阅读」与「继续阅读」打开新的预览会话时会重新读取，Markdown 继续恢复已有阅读位置。阅读记录和偏好不保存正文、草稿或指纹。

同一次预览期间，文件外部变化或重复选择当前目标不会重载正文。在查看脸点击**刷新内容**或按 **Alt-R** 重新读取。编辑期间不提供内容刷新，离开编辑仍经过未保存守卫。

## 快捷键

`Mod` 在 macOS 上指 Cmd，在 Windows/Linux 上指 Ctrl。面板快捷键需焦点位于面板内；编辑器快捷键需焦点位于编辑器内。

| 快捷键 | 行为 |
| --- | --- |
| Mod-S | 保存 |
| Alt-R | 在查看脸刷新当前文档内容 |
| Mod-F | 编辑器内查找 |
| Mod-Z / Mod-Shift-Z | 撤销 / 重做 |
| Mod-B / Mod-I / Mod-K | 将选区包裹为粗体、斜体或链接 |
| Mod-Shift-O / Mod-Shift-E | 打开大纲 / 工作区导航 |
| Mod-/ | 查看编辑器快捷键帮助 |
| Esc | 优先关闭已打开的弹层或编辑器查找框，再请求关闭面板；不会静默放弃草稿 |
| 方向键 / Enter | 在工作区树中导航与打开条目 |

## 配置

安装后，在该 profile 的 `cordis.patch.yml` 中覆盖已有行：

```yaml
- id: md-preview
  config:
    maxBytes: 1048576
    allowedExtensions: ['.md', '.markdown']
    searchMaxResults: 200
    searchMaxDirectories: 2000
    searchConcurrency: 8
```

后面的 patch 会替换该行的**整个 config**，需要保留的自定义值应一并写出；省略的字段采用 schema 默认值。

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `maxBytes` | `1048576` | 单文件读取、写入的字节上限 |
| `allowedExtensions` | `[".md", ".markdown"]` | 编辑白名单，与已支持的 Markdown 扩展名取交集 |
| `previewExtensions` | `[".md", ".markdown", ".txt"]` | 已弃用的兼容字段；接受旧配置，但不再限制或扩大文本准入 |
| `searchMaxResults` | `200` | 一次工作区搜索最多返回的匹配数 |
| `searchMaxDirectories` | `2000` | 一次工作区搜索最多遍历的目录数 |
| `searchConcurrency` | `8` | 每批遍历并行读取的目录数 |

路径以会话工作区为边界；保存需要读取时取得的指纹或明确的强制覆盖选择。配置默认值以 schema 为准。`allowedExtensions: []` 关闭 Markdown 编辑，仍保留渲染预览；加入 `.txt` 或其他文本扩展名不会使其可编辑。写入时，请求名称与解析后的目标均须为配置允许的 `.md` 或 `.markdown`。旧 profile 可保留 `previewExtensions`，但它不再作为访问白名单；每次打开均由 Host 验证实际文件、工作区范围、字节限额及文件服务的文本读取结果。

## 失败码

| 失败码 | 含义 |
| --- | --- |
| `md-preview/bad-request` | 输入非法，例如保存时既没有指纹也没有指定强制覆盖 |
| `md-preview/unknown-session` | 会话不存在 |
| `md-preview/no-workspace` | 会话没有工作目录 |
| `md-preview/unsupported-extension` | 文件类别不进入预览，或目标不具备编辑资格 |
| `md-preview/not-text` | 文件服务拒绝二进制内容或非法 UTF-8 |
| `md-preview/not-regular-file` | 目标为目录或特殊文件 |
| `md-preview/forbidden` | 工作区范围或文件系统访问检查未通过 |
| `md-preview/not-found` | 目标不存在 |
| `md-preview/too-large` | 读取或写入超过 `maxBytes` |
| `md-preview/conflict` | 文件自本次保存所依据的读取之后已变化 |
| `md-preview/unavailable` | 文件系统或传输操作失败 |

## 安装形态

| 形态 | 命令 | 交付内容 |
| --- | --- | --- |
| npm | `dsh plugin --profile web add @benz-ai-x/dsh-md-preview@0.10.0 --save-exact` | 预构建 JavaScript 与类型声明 |
| Release 归档 | `dsh plugin --profile web add ./benz-ai-x-dsh-md-preview-0.10.0.tgz` | 已完成发布验证的同一归档，可在 GitHub Release 获取归档和 SHA256SUMS |
| Git 源码 | `dsh plugin --profile web add github:benz-ai-x/dsh-md-preview#<commit>` | 自包含的 `prepare` 构建 JavaScript；此形态不生成类型声明 |

Git 安装时，pnpm 可能要求显式允许构建。将报错中给出的确切包键写入该 profile 的 `pnpm-workspace.yaml`，再执行 `add`：

```yaml
allowBuilds:
  '@benz-ai-x/dsh-md-preview': true
```

允许构建会在本机执行包内源码，应使用可信来源并固定 commit。npm 与 Release 归档已包含构建结果。

## 开发与验证

Node 需满足 `^22.19.0 || >=24.0.0`，仓库声明 pnpm 11.17.0。固定 Harness 检出优先从 `DSH_HARNESS_ROOT` 解析，默认位置为 `../deepseek-harness`。

```sh
pnpm install
pnpm context:check:strict
pnpm verify
pnpm watch:client
```

开发依赖默认使用已发布版本。`pnpm context:link` 会显式切换到固定源码检出并刷新 lockfile；源码链接移动后也使用这个现有命令重新同步。

| 部分 | 源码 | 职责 |
| --- | --- | --- |
| Host 服务 | `src/remote.ts` | `mdPreview.read/write/list/search`、工作区权威与取消 |
| Remote 描述符 | `src/typert/remote-client.ts` | 浏览器可用的 codec 与四个 RPC 方法 |
| Client 注册 | `src/client/mount.ts` | 挂载 Remote 与四个 Slot 贡献 |
| 预览面板 | `src/client/PreviewOverlay.tsx` | 渲染、导航与 UI 局部几何状态 |
| 停靠适配 | `src/client/panel-dock.ts`、`use-panel-dock.ts` | 为文档区预留空间，并可逆地恢复固定 Harness 框架 |
| 头部入口 | `src/client/WorkspaceDocsAction.tsx`、`PanelToggle.tsx` | 回形针入口、× 关闭与当前回合产出派生 |
| 预览会话 | `src/client/preview-session.ts`、`use-preview-session.ts` | 读取、编辑、保存生命周期与受守卫的切换 |
| 阅读与偏好 | `src/client/reading.ts`、`preferences.ts` | 阅读位置恢复与有界的浏览器偏好 |
| 工作区浏览 | `src/client/WorkspaceBrowser.tsx` | 树、搜索结果、快捷入口与导航 |
| 编辑 / 图表 | `src/client/editor.tsx`、`diagrams.ts` | CodeMirror 编辑与惰性 Mermaid 增强 |

v0.10.0 发布通过 **290 项测试**、严格基线检查、类型检查和构建检查。同一安装包通过干净 profile 的安装、普通包名导入、配置组合、启动、客户端资源服务与移除验证，见[发布验证](https://github.com/benz-ai-x/dsh-md-preview/blob/main/docs/verification/releases/v0.10.0/WALKTHROUGH.md)。

发布时先运行 `pnpm pack:publishable`，使用该归档完成干净 profile 冒烟，再执行 `npm publish <archive.tgz> --ignore-scripts --access public --registry=https://registry.npmjs.org/`，发布**经过验证的同一个 `.tgz`**。完整步骤、浏览器 2FA 和实例验货见[维护交接](https://github.com/benz-ai-x/dsh-md-preview/blob/main/docs/HANDOVER.md)。

## 已知限制与文档入口

- 停靠适配依赖固定 Harness 的框架结构，升级基线时需要重新验证，见 [ADR-0004](https://github.com/benz-ai-x/dsh-md-preview/blob/main/docs/adr/0004-dock-preview-beside-the-harness-frame.md)。
- 用户上传的文档附件不可预览；正文内联提及的 `.md` 文件保持 Harness 交给桌面应用打开的行为。
- 只编辑已有且受支持的文档，不创建文件；代码围栏与内联 HTML 在编辑器内按纯文本编辑。
- 大纲收集 ATX 标题，setext 标题会渲染但不进入大纲。
- Mermaid 使用默认主题；混用缩进代码块与围栏块的文档跳过增强，渲染失败保留原代码块。
- 浏览器主题、缩放验收及后续顶栏优化继续在 [TODO](https://github.com/benz-ai-x/dsh-md-preview/blob/main/TODO.md) 跟踪。

开发前阅读[项目契约](https://github.com/benz-ai-x/dsh-md-preview/blob/main/docs/agent/PROJECT_CONTRACT.md)与[领域词汇表](https://github.com/benz-ai-x/dsh-md-preview/blob/main/CONTEXT.md)。发布说明见 [GitHub Releases](https://github.com/benz-ai-x/dsh-md-preview/releases)。

## 许可证

MIT
