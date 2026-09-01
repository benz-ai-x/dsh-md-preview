# peerDependencies 只声明宿主运行时真正外部导入的包

宿主 bundle 构建后唯一的运行时外部导入是 `@deepseek-ai/dsh-typert-protocol`,
因此它是唯一的 peer。cordis 只以类型出现(由 Loader 环境提供),浏览器侧的平台
模块(store/primitives/slots 等)在运行时来自 shell 的冻结模块表而非 npm——把它们
写进 peers 会让每个安装者收到"missing peer"警告(0.2.6 之前的实际故障),而降级成
普通依赖又会为共享类引入重复实例、破坏类型身份。

## Consequences

- hoisted profile 里 `pnpm peers check` 对仅剩的这一条 peer 仍会告警——DSH 的
  boot 模块治愈层在运行时满足它,lockfile 检查器看不见,属预期噪音。
