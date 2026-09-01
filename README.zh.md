[English](README.md) | 中文

# @benz-ai-x/dsh-md-preview

DSH Web GUI 插件:点击对话中出现的 Markdown 文档,在对话右侧打开渲染后的预览面板;支持受守卫编辑与工作区目录树浏览。

[![npm](https://img.shields.io/npm/v/@benz-ai-x/dsh-md-preview)](https://www.npmjs.com/package/@benz-ai-x/dsh-md-preview)
[![GitHub](https://img.shields.io/badge/repo-benz--ai--x%2Fdsh--md--preview-24292e?logo=github)](https://github.com/benz-ai-x/dsh-md-preview)

## 效果

- 回合产出文件 chip 行中的 `.md` / `.markdown` 文档:点击打开右侧预览面板,渲染 GFM、代码高亮和 TeX。
- 每条助手消息的操作区新增「预览文档」按钮,列出该回合产出的 Markdown 文档。
- 非 Markdown 产出文件保持原有行为(交给系统打开)。
- 面板可关闭、可拖宽(320–1280 px,默认 500);拖出的宽度在本次应用会话内保持。
- 没有预览目标时面板不渲染。
- **编辑**:面板「编辑」进入 CodeMirror 编辑器(行号、GFM 高亮、Cmd/Ctrl-S 保存),「保存」写回工作区、显示「✓ 已保存」提示并回到渲染视图,「取消编辑」丢弃草稿;只编辑已存在的文件。保存失败(非冲突)会显示错误码并提供【重试】。
- **冲突保护**:保存时若文件已被其它方(agent、其它会话、外部编辑器)修改,提示「文件已变化」,由你选择【重新加载】或【强制覆盖】;带未保存修改关闭面板会先询问。
- **工作区浏览**:面板头部「工作区」进入目录树(懒展开、加载/空/失败三态);单击 `.md` 富渲染、`.txt` 等纯文本等宽展示、其它类型明确提示不支持;当前文档在树中高亮并自动定位;支持方向键/Enter 键盘遍历;头部路径面包屑。

## 安装

要求 DSH 基线 `0.1.2-alpha.3`(即 peerDependencies 所列版本)和 web profile。

```sh
dsh plugin --profile <name> add @benz-ai-x/dsh-md-preview
dsh --profile <name> --dump-config   # 应出现 id: md-preview 的行
dsh --profile <name>                 # 打开 Web GUI;回合产出 .md 后点击 chip 预览
dsh plugin --profile <name> remove @benz-ai-x/dsh-md-preview
```

### 三种安装形态(依 [DSH 打包与安装规范](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/user/develop/basic/publish.zh.md))

| 形态 | 命令 | 状态 |
| --- | --- | --- |
| npm(推荐) | `dsh plugin --profile <name> add @benz-ai-x/dsh-md-preview` | ✅ 预构建产物,即装即用 |
| tarball | `dsh plugin --profile <name> add ./benz-ai-x-dsh-md-preview-<ver>.tgz`(tarball 由源码 `pnpm pack:publishable` 产出) | ✅ 预构建产物,无需任何构建授权 |
| Git 直装 | `dsh plugin --profile <name> add github:benz-ai-x/dsh-md-preview` | ❌ **暂不支持**:git 安装拉取源码并要求包自带自包含 `prepare` 构建脚本,而本仓库的源码构建依赖本地 `link:` 的 Harness 检出(见 #8)。请用 npm 或 tarball |

## 配置

```yaml
- id: md-preview
  name: '@benz-ai-x/dsh-md-preview'
  config:
    maxBytes: 1048576        # 单文件读取上限(字节)
    allowedExtensions: ['.md', '.markdown']
```

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `maxBytes` | number | `1048576` | 单文件读/写上限,超出返回 `too-large` |
| `allowedExtensions` | string[] | `[".md", ".markdown"]` | 可编辑的扩展名白名单 |
| `previewExtensions` | string[] | `[".md", ".markdown", ".txt"]` | 可预览的扩展名(可编辑集的超集;纯文本成员只读展示) |

## 失败码

读取失败时面板显示 `md-preview/<reason>`。所有失败码:

| 码 | 含义 |
| --- | --- |
| `md-preview/bad-request` | path 为空或非法;或保存时既无指纹也未强制 |
| `md-preview/unknown-session` | 会话不存在 |
| `md-preview/no-workspace` | 会话没有工作目录 |
| `md-preview/unsupported-extension` | 扩展名不在白名单 |
| `md-preview/forbidden` | 路径超出会话工作区 |
| `md-preview/not-found` | 文件不存在(编辑只针对已存在文件) |
| `md-preview/too-large` | 文件(读取)或内容(写入)超过 `maxBytes` |
| `md-preview/conflict` | 保存时文件已变化(指纹不匹配且未强制) |
| `md-preview/unavailable` | 读/写过程发生 IO 错误 |

## 已知限制

- 正文中内联提到的 `.md` 文件名仍走系统打开(归 ui-deliverables 所有,不归本插件)。
- 面板悬浮在对话右侧,不替换三栏布局。
- 用户上传的文档附件不可预览(目前没有对应的会话面)。

## 开发(source-linked)

```sh
pnpm install
pnpm verify                 # context:check:strict + typecheck + test + build + built:check
pnpm context:sync           # Harness 检出移动后重写 link 并刷新 lockfile
pnpm watch:client           # 客户端 bundle 热构建
```

### 结构

| 部分 | 位置 | 说明 |
| --- | --- | --- |
| Host Remote | `src/remote.ts` | `mdPreview/read(sessionId, path, signal)`;工作区限域、扩展名白名单、字节上限 |
| Remote contribution | `src/typert/remote-client.ts` | 手工维护的浏览器端描述符(生成器产物的等价物) |
| 浏览器入口 | `src/client/index.ts` | 挂载 Remote + 注册三个 Slot 贡献 |
| 预览面板 | `src/client/PreviewOverlay.tsx` | `shell.overlay`(list,增量);编辑/冲突/未保存状态机 |
| 编辑器 | `src/client/editor.tsx` | CodeMirror 6(精选扩展集,构建期内联,client bundle ~400 kB minified) |
| chip 行接管 | `src/client/MdChips.tsx` | `conversation.chat.turnTail`(chain,仅认领含 Markdown 的回合) |
| 消息操作 | `src/client/PreviewAction.tsx` | `conversation.chat.assistant-actions`(list,增量) |

### 真实 profile 验证(本地检出)

```sh
pnpm build
dsh plugin --profile <name> add ./dsh-md-preview
dsh --profile <name> --dump-config
dsh --profile <name>        # 打开 Web GUI,写一个 README.md 产出并点击 chip
dsh plugin --profile <name> remove @benz-ai-x/dsh-md-preview
```

### 打包与发布

```sh
pnpm pack:publishable       # 打出净化 manifest 的 tarball 并复检(无 devDeps、无 link:/workspace:)
pnpm publish:registry       # 以同一净化流程发布到 npm
```

source-linked 验证证明与固定 Harness 检出(见 `dsh-reference.lock.json`)的兼容性;发布形态以 packed tarball 在干净 profile 中的安装/启动/移除冒烟为准。

## 许可证

MIT
