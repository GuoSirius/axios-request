# Changelog

所有重要的版本更新都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 和 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

<!-- AUTO_GENERATED -->

## 1.3.0 (2026-04-30)

### ✨ 新功能

- 完善测试用例、示例demo及文档
- 完成 Vue3 示例项目，包括所有管理器测试页面和协同测试
- 完成 Vue3 示例项目基础结构和所有测试视图
- 创建 Vue3 示例项目基础结构（Vite + Vue3 + Element Plus + UnoCSS）
- 实现 ManagerRegistry，管理实例级和请求级管理器生命周期
- 实现配置合并工具 configMerger.ts，优化 BaseManager 使用统一合并逻辑
- 实现 BaseManager 基类，统一管理器接口和生命周期
### 🐛 Bug 修复

- 修复类型错误，统一配置规范化逻辑
- 修复 DedupeManager/CancelManager 中 static 属性问题，完善默认开启逻辑
- 取消注释管理器类类型导出，完善临时注释代码
### ♻️ 代码重构

- 统一配置规范化逻辑，使用Manager静态normalize方法
- 统一配置规范化逻辑，添加私有级Token管理器支持
- 完善实例级/私有级管理器逻辑，都没有时返回undefined
- 简化 ManagerRegistry，私有级管理器按类型缓存复用
- 重构 AxiosRequest 核心类，使用 ManagerRegistry 管理所有管理器
- 重构 CancelManager，简化配置、完善类型注释、增强资源管理
- 重构 DedupeManager，简化配置、完善类型注释、增强资源管理
- 重构 RetryManager，简化配置、完善类型注释、增强资源管理
- 重构 TokenManager，新增白名单URL支持、完善拦截逻辑、增强资源管理
- 重构类型系统，完善类型定义和注释
### 📝 文档更新

- 更新 README、gitignore，完善测试用例和示例 demo
### 🔧 构建/工具

- upgrade all dependencies to latest versions


## 1.2.9 (2026-04-28)

### 🐛 Bug 修复

- 完善 changelog 生成逻辑，支持过滤 release 提交
- 修复 release 模式下 tag 前缀不匹配导致 changelog 为空的问题
### 🔧 构建/工具

- 添加 release-body.md 到 .gitignore


## 1.2.8 (2026-04-28)

### 🐛 Bug 修复

- 修复 release 模式下 tag 前缀不匹配导致 changelog 为空的问题
### 📝 文档更新

- 完善 CHANGELOG.md，补全所有历史版本的提交信息
### 🔧 构建/工具

- v1.2.8
- v1.2.7

## 1.2.7 (2026-04-28)

### 🐛 Bug 修复

- 修复 release 模式下 changelog 为空的问题

## 1.2.6 (2026-04-28)

### 🐛 Bug 修复

- 优化 release 工作流，复用 build 产物

## 1.2.5 (2026-04-28)

### ⚡ 性能优化

- 优化发布信息
- 修复 release

## 1.2.4 (2026-04-28)

### 🐛 Bug 修复

- 修复换行

### ⚡ 性能优化

- 优化 release 信息
- 优化 changelog

## 1.2.3 (2026-04-28)

### ⚡ 性能优化

- 优化 changelog 生成，自动换行
- 优化发布信息

## 1.2.2 (2026-04-28)

### 🐛 Bug 修复

- 测试一下 changelog 的版本号
- 验证是否正确

## 1.2.1 (2026-04-28)

### ⚡ 性能优化

- 测试 changelog

## 1.2.0 (2026-04-28)

### 🔧 构建/工具

- 优化 changelog
- 优化 release

## 1.1.1 (2026-04-28)

### 🔧 构建/工具

- 优化工程化流程

## 1.1.0 (2026-04-28)

### 🐛 Bug 修复

- 修复类型错误和移除已废弃的导出

### ♻️ 代码重构

- 采用'上下文即对象'架构，消除 Map 冗余存储

## 1.0.10 (2026-04-27)

### 🐛 Bug 修复

- validate 和 build 在所有触发时执行，release 仅 tag 时
- 添加 GitHub Actions 写入权限
- 移除 release job 的 needs 依赖
- 修复 workflow YAML 格式

### 🔧 构建/工具

- 合并 workflow，修复 changelog 倒序排列

## 1.0.5 (2026-04-27)

### 📝 文档更新

- update readme

## 1.0.4 (2026-04-27)

### 🔧 构建/工具

- delete mirror

## 1.0.3 (2026-04-27)

### ✨ 新功能

- add release

## 1.0.2 (2026-04-26)

### ✨ 新功能

- CI release 上传构建产物到 GitHub Release
- CI 自动发布 tag 版本
- 发布流程优化 - typecheck + 打标签确认 + main 分支

## 1.0.1 (2026-04-26)

### 🔧 构建/工具

- add typecheck

### 🐛 Bug 修复

- 修复交互式发布脚本
- 恢复 typecheck 脚本

### ♻️ 代码重构

- 简化发布流程，统一为一条命令

### ✨ 新功能

- 配置 CI/CD 工作流和发布脚本

### ⚡ 性能优化

- 优化开发流程 - 一键发布脚本 + Node 24
- 新增数组简写配置和自定义 token 赋值方式
- support shorthand config for generateKey and shouldRetry
- add FormData utility and support ESM/CJS/UMD bundles
- generateKey 支持字符串简写，优化配置序列化逻辑
- 新增 contentType 配置，简化 Content-Type 设置
- 支持简写配置形式，类型定义默认值注释与实现一致

### 📝 文档更新

- 更新入口文件注释

### ✨ 新功能

- 添加提交规范、lint-staged 和完整使用文档
- method 转为大写，取消请求和防重复提交默认开启

## 1.0.0 (2026-04-26)

### ✨ 新功能

- Initial commit: axios-request npm package with token refresh, dedupe, cancel, and retry features