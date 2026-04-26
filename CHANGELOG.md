# Changelog

所有重要的版本更新都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 和 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

<!-- AUTO_GENERATED -->

# Changelog

## 1.0.1 (2026-04-26)

### ✨ 新功能

- 配置 CI/CD 工作流和发布脚本
- 新增数组简写配置和自定义token赋值方式
- support shorthand config for generateKey and shouldRetry
- add FormData utility and support ESM/CJS/UMD bundles
- generateKey 支持字符串简写，优化配置序列化逻辑
- 新增 contentType 配置，简化 Content-Type 设置
- 支持简写配置形式，类型定义默认值注释与实现一致
- 添加提交规范、lint-staged和完整使用文档
- method转为大写，取消请求和防重复提交默认开启

### 🐛 Bug 修复

- 修复交互式发布脚本
- 恢复 typecheck 脚本

### ♻️ 代码重构

- 简化发布流程，统一为一条命令

### 📝 文档更新

- 更新入口文件注释

### 🔧 构建/工具

- 优化开发流程 - 一键发布脚本 + Node 24
- bump version to 1.0.0

### 📌 其他

- Initial commit: axios-request npm package with token refresh, dedupe, cancel, and retry features (df34814)
