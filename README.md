# @benz-ai-x/dsh-md-preview

DSH web GUI 插件：点击对话中出现的 Markdown 文档，在对话右侧打开渲染后的预览面板。

## 效果

- 回合产出文件 chip 行中的 `.md` / `.markdown` 文档 → 点击打开右侧预览面板（GFM、代码高亮、TeX）。
- 每条助手消息的操作区新增「预览文档」按钮，列出该回合产出的 Markdown 文档。
- 非 Markdown 产出文件保持原有行为（调用系统打开）。
- 面板可关闭、可拖宽；无预览目标时不渲染。

## 结构

| 部分 | 位置 | 说明 |
| --- | --- | --- |
| Host Remote | `src/remote.ts` | `mdPreview/read(sessionId, path, signal)`；会话工作区限域、扩展名白名单、字节上限 |
| Remote contribution | `src/typert/remote-client.ts` | 手工维护的浏览器端描述符（生成器产物的等价物） |
| 浏览器入口 | `src/client/index.ts` | 挂载 Remote + 注册三个 Slot 贡献 |
| 预览面板 | `src/client/PreviewOverlay.tsx` | `shell.overlay`（list，增量） |
| chip 行接管 | `src/client/MdChips.tsx` | `conversation.chat.turnTail`（chain，仅认领含 Markdown 的回合） |
| 消息操作 | `src/client/PreviewAction.tsx` | `conversation.chat.assistant-actions`（list，增量） |

## 配置

```yaml
- id: md-preview
  name: '@benz-ai-x/dsh-md-preview'
  config:
    maxBytes: 1048576        # 单文件读取上限（字节）
    allowedExtensions: ['.md', '.markdown']
```

## 安装（npm 发布形态）

```sh
dsh plugin --profile <name> add @benz-ai-x/dsh-md-preview
dsh --profile <name> --dump-config   # 确认 md-preview 行
dsh --profile <name>                 # 打开 Web GUI，回合产出 .md 后点击 chip 预览
dsh plugin --profile <name> remove @benz-ai-x/dsh-md-preview
```

要求 DSH 基线 `0.1.2-alpha.3`（见 peerDependencies）。

## 开发（source-linked）

```sh
pnpm install
pnpm verify                 # context:check:strict + typecheck + test + build + built:check
pnpm context:sync           # Harness 检出移动后重写 link 并刷新 lockfile
```

## 真实 profile 验证（本地检出）

```sh
pnpm build
dsh plugin --profile <name> add ./dsh-md-preview
dsh --profile <name> --dump-config
dsh --profile <name>        # 打开 Web GUI，写一个 README.md 产出并点击 chip
dsh plugin --profile <name> remove @benz-ai-x/dsh-md-preview
```

source-linked 验证证明与固定 Harness 检出（见 `dsh-reference.lock.json`）
的兼容性；发布形态以 packed tarball 在干净 profile 中的安装/启动/移除
冒烟为准。
