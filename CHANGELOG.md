# Changelog

所有重要的版本更新都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 和 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

<!-- AUTO_GENERATED -->

## 1.1.0 (2026-04-27)

### 🔥 重大重构

- **架构重构**：采用"上下文即对象"设计，替代传统的 requestId + Map 模式
  - 消除所有 `Map<string, Context>` 冗余存储
  - 上下文通过 `createContext()` 工厂方法创建，是普通对象
  - 无需手动清理，对象引用丢失即被 GC
  - 代码量减少 50%+

### 📊 性能优化

- TokenManager: 276 行 → 100 行 (-64%)
- DedupeManager: 186 行 → 85 行 (-54%)
- CancelManager: 163 行 → 70 行 (-57%)
- RetryManager: 196 行 → 75 行 (-62%)
- AxiosRequest: 535 行 → 280 行 (-48%)

## 1.0.6 (2026-04-27)

### 🐛 Bug 修复

- 修复防重复提交和请求取消默认未开启的问题

### 🔧 构建/工具

- release v1.0.5

### 📌 其他

- Merge branch 'main' of https://github.com/GuoSirius/axios-request (0cb05f0)

