# 文档侧边栏实施与验证

日期：2026-09-08。跟踪：[Issue #37](https://github.com/benz-ai-x/dsh-md-preview/issues/37)。

## 首次侧边栏实施

本轮依据用户提供的真实截图实施：右上文字胶囊替换为原生面板图标的镜像，面板右上
使用同款收起按钮；导航主文字维持 14/20，图标为 16px，按钮命中区为 28px。
头部设为 72px，浏览区沿用原生侧栏底色，独立停靠时去除浮层阴影。后续人工截图
显示两侧操作行中心线仍需对齐，已纳入 F-03；图标后续修正见本页末节。

宽屏展开预留空间，收起恢复对话宽度；低于 1056px 或最大化时覆盖展开。拖宽偏好
保持不变，实际宽度按可用空间收缩。原生左侧导航与工具详情保留自身状态及贡献。
未保存草稿仍经统一守卫；收起后焦点返回右上入口；延迟搜索框聚焦不会抢走用户已经
放在文档条目上的焦点。

本轮基于 `7889fbea7a646b87e55ef93ef45926ab53cd16fe`，package 仍为 `0.9.0`；
这是工作区后续改动，不等同于已有 `v0.9.0` 标签。随后按用户要求更新并重启了
`r3-accept` 的 3185 实例，供人工验收。
布局兼容边界见 [ADR-0004](../../adr/0004-dock-preview-beside-the-harness-frame.md)。

## 首次实施的已完成验证

- 修改前 strict 基线检查通过；最终 `pnpm verify` 退出 0：123 项检查、26 个测试文件、
  **290 项测试**、类型检查、构建及 6 项产物检查全部通过，见 [verify.log](verify.log)。
- 新增真实 SlotRegistry、真实 AppFrame 与本插件装配回归：开栏预留空间，原生导航
  独立开合、工具详情保持挂载，未保存守卫继续/放弃两条路径，收起焦点返回，最大化、
  1200/800px 容器尺寸变化与宽度恢复，移除插件 Fiber 后宿主布局恢复。
- 适配器回归覆盖 1920/1200/1056/1055/320px 边界、原有 inline 样式及 priority 恢复、
  未知挂载降级、其他样式所有者保护、observer 与已排队 rAF 清理。浏览器的实际排版
  不由 jsdom 提供，组合测试只模拟几何测量与 ResizeObserver 通知。
- `pnpm pack:publishable` 退出 0：发布清单不含 devDependencies 或 link:/workspace:。
  tarball SHA-256 为 `8654eba148d06e4939f16afaa39d4242bf2750d4edc097190aeecc3cc2cfa460`。
  本地 `lib/client.js` SHA-256 为 `7d4f7c3d2368b8d9257417acc9cf06170e1bf642bed15a884ebba8b107e18c19`。
- 干净 `DSH_HOME=/tmp/dsh-md-preview-sidebar-home`，使用锁定 CLI 的 shipped `web`
  profile 模板离线安装当前 tarball。Host 与 Remote 经普通包名导入通过，具名插件
  name/apply/Config/inject 与无 default export 契约通过。
- 3190 启动成功；启动图 47 项包含本插件，广告的 combo URL 返回 HTTP 200，
  3,951,242 字节，含本轮图标、停靠适配及双语文案。见 [packed-boot.json](packed-boot.json)。
- 移除后启动图恢复 46 项，原插件资源返回 404。见 [packed-remove.json](packed-remove.json)。
  两个测试进程均已停止。

## 未完成的真实页面验收

浏览器连接调用超时，无法取得当前页面截图或操作页面。以上检查不证明视觉验收通过。

- [ ] 同条件浅色/深色、中文/英文截图。
- [ ] 原生左右栏与文档栏同时开合、工具详情可用。
- [ ] 拖宽、窄屏、浏览器缩放与最大化，确认按钮始终可达。
- [ ] 打开→搜索→预览→编辑保存→收起→继续对话，含键盘焦点和原生设置弹层。

## 人工验收实例

2026-09-08 按用户要求，将当前 tarball 安装到已有 `r3-accept` profile 并在原
3185 端口重启，沿用其会话与工作区。tmux 会话为 `dsh-r3`；入口
`http://127.0.0.1:3185/`。安装成功，运行中的启动图含本插件，资源 HTTP 200，
镜像按钮、停靠适配与双语文案标识齐全，见 [manual-server.json](manual-server.json)。
已安装的 client 文件 SHA-256 与本轮构建一致。

安装时将该 profile 已有的 koffi/esbuild 构建白名单迁移到 pnpm 11 使用的
`pnpm-workspace.yaml`；koffi 安装脚本执行成功。修改前的 profile 清单与配置已备份，
位置记录于本机 `/tmp/mdpreview-r3-backup-path.txt`。

本次重启后用户提供了标有 A/B 的人工截图，处理结果见下一节。

## A/B 图标反馈修正与再次重启

2026-09-08 用户要求 A 表达附件入口、B 改为 ×，并征求下一轮 UI/UX 建议。

- A 改为原生 `IconPaperclipOutline16`，B 改为原生 `IconCloseOutline16`；移除镜像
  transform 与关闭按钮的 disclosure 状态。入口继续提供开合状态，提示采用
  「打开工作区文档」「关闭文档面板」及对应英文；原有未保存守卫继续生效。
- 修改前 `pnpm context:check:strict` 通过。修改后 `pnpm verify` 退出 0：123 项
  基线检查、26 个测试文件共 **290 项测试**、类型检查、构建与 6 项产物检查通过，
  见 [icons-verify.log](icons-verify.log)。既有装配测试同步更新可访问名称。
- `pnpm pack:publishable` 退出 0，再次离线安装到 `r3-accept` 退出 0，在原 3185
  端口重启 tmux `dsh-r3`。已安装 client 与当前构建逐字节相同；打包后重新构建
  并通过 freshness 检查。
- 运行中启动图含本插件，资源 HTTP 200，两个新图标引用、中英文提示、停靠适配
  标识齐全，旧镜像样式已消失。见 [icons-manual-server.json](icons-manual-server.json)，
  其中记录当前 tarball、安装文件与实际服务资源的 SHA-256。
- 下一轮问题、证据、建议与验收条件见
  [人工截图反馈 TODO](../../research/sidebar-screenshot-feedback.md)。仅 F-01/F-02 已实施，
  顶栏对齐、操作分组及阅读排版候选未实施；未修改截图中的用户文档。

当前服务已更新，等待用户刷新复验 A/B。上述资源检查不等于浏览器视觉验收；主题、
缩放和完整流程仍待完成。本轮没有执行 npm 发布或创建新 Git 标签。
