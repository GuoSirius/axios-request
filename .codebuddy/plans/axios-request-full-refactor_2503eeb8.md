---
name: axios-request-full-refactor
overview: 全面重构 axios-request 库：重新设计架构，优化代码结构，提升执行效率，实现四大管理器（Token/Dedupe/Cancel/Retry）的完整功能，新增核心扩展，并创建 Vue3+Element Plus+UnoCSS 示例项目。
design:
  architecture:
    framework: vue
  styleKeywords:
    - Cyberpunk Neon UI
    - Dark Mode
    - glassmorphism
    - 渐变
    - 微动画
    - 科技感
  fontSystem:
    fontFamily: PingFang SC, Roboto, sans-serif
    heading:
      size: 24px
      weight: 600
    subheading:
      size: 18px
      weight: 500
    body:
      size: 14px
      weight: 400
  colorSystem:
    primary:
      - "#0EA5E9"
      - "#6366F1"
      - "#8B5CF6"
    background:
      - "#0F172A"
      - "#1E293B"
      - "#334155"
    text:
      - "#F1F5F9"
      - "#94A3B8"
    functional:
      - "#22C55E"
      - "#EF4444"
      - "#F59E0B"
      - "#0EA5E9"
todos:
  - id: refactor-types
    content: 重构类型系统：完善类型定义，导出所有上下文类型，新增配置合并类型
    status: completed
  - id: implement-base-manager
    content: 实现 BaseManager 基类：统一管理器接口和生命周期
    status: completed
    dependencies:
      - refactor-types
  - id: implement-config-merger
    content: 实现配置合并工具 configMerger.ts：统一的管理器配置合并逻辑
    status: completed
    dependencies:
      - refactor-types
  - id: refactor-token-manager
    content: 重构 TokenManager：新增白名单URL支持、完善三处拦截逻辑、增强资源管理
    status: completed
    dependencies:
      - implement-base-manager
      - implement-config-merger
  - id: refactor-retry-manager
    content: 重构 RetryManager：简化配置、完善类型注释、增强资源管理
    status: completed
    dependencies:
      - implement-base-manager
      - implement-config-merger
  - id: refactor-dedupe-manager
    content: 重构 DedupeManager：简化配置、完善类型注释、增强资源管理
    status: completed
    dependencies:
      - implement-base-manager
      - implement-config-merger
  - id: refactor-cancel-manager
    content: 重构 CancelManager：简化配置、完善类型注释、增强资源管理
    status: completed
    dependencies:
      - implement-base-manager
      - implement-config-merger
  - id: implement-manager-registry
    content: 实现 ManagerRegistry：创建和缓存私有级管理器实例
    status: completed
    dependencies:
      - refactor-types
  - id: refactor-core-class
    content: 重构 AxiosRequest 核心类：应用新的配置合并策略，实现实例级/私有级管理器优先级逻辑
    status: completed
    dependencies:
      - implement-manager-registry
  - id: update-tests
    content: 更新测试用例：确保重构后所有功能正常
    status: completed
    dependencies:
      - refactor-core-class
  - id: create-example-project
    content: 创建 Vue3 示例项目基础结构：Vite + Vue3 + Element Plus + UnoCSS 配置
    status: completed
    dependencies:
      - refactor-core-class
  - id: implement-example-layout
    content: 实现示例项目布局和路由：MainLayout、路由配置、导航组件
    status: completed
    dependencies:
      - create-example-project
  - id: implement-token-view
    content: 实现 Token 管理器测试页面：配置面板、测试操作、日志显示
    status: completed
    dependencies:
      - implement-example-layout
  - id: implement-retry-view
    content: 实现重试管理器测试页面：配置面板、重试进度、日志显示
    status: completed
    dependencies:
      - implement-example-layout
  - id: implement-dedupe-view
    content: 实现防重复提交测试页面：配置面板、请求统计、可视化
    status: completed
    dependencies:
      - implement-example-layout
  - id: implement-cancel-view
    content: 实现取消请求测试页面：配置面板、取消统计、可视化
    status: completed
    dependencies:
      - implement-example-layout
  - id: implement-combined-view
    content: 实现多管理器协同测试页面：综合配置、复杂场景测试
    status: completed
    dependencies:
      - implement-token-view
      - implement-retry-view
      - implement-dedupe-view
      - implement-cancel-view
  - id: final-polish
    content: 最终优化：界面美化、代码清理、文档更新
    status: completed
    dependencies:
      - implement-combined-view
      - update-tests
---

## 产品概述

对现有 `axios-request` 库进行全面重构和功能增强，实现四大管理器（Token、Retry、Dedupe、Cancel）的完整功能，并新增 Vue3 + Element Plus + UnoCSS 示例项目。

## 核心功能

### 一、Token 管理器增强

1. 支持自定义判断 token 是否过期（`isTokenExpired`）
2. 支持自定义获取 `access_token` 和 `refresh_token` 方法
3. 支持自定义刷新 token 方法（`refreshToken`）
4. 支持自定义设置 token 和认证头（`setAuthorization`）
5. 支持自定义刷新失败逻辑（`onRefreshFailed`）
6. 支持两种标记不需要 token 的请求方式：`token: false` 和白名单 URL 列表（`whitelistUrls`）
7. 三处拦截处理：

- A. 请求前：判断是否有 token、是否有正在执行的刷新请求，有则入队等待
- B. 接口返回 200 但业务 code 指示 token 过期，触发刷新并入队等待重试
- C. 接口返回 401 等 token 过期异常，触发刷新并入队等待重试

### 二、失败重试管理器

1. 简化配置项，合理设置默认值
2. 明确的 TypeScript 类型标记和注释
3. 完善的资源管理和释放机制

### 三、表单防重复提交管理器

1. 简化配置项，合理设置默认值
2. 明确的 TypeScript 类型标记和注释
3. 完善的资源管理和释放机制

### 四、取消请求管理器

1. 简化配置项，合理设置默认值
2. 明确的 TypeScript 类型标记和注释
3. 完善的资源管理和释放机制

### 五、核心扩展 - 管理器合并策略

1. 综合应用四大管理器，默认三个开启（Dedupe、Cancel、Retry），Token 需手动开启
2. 管理器分为实例级别和私有级别：

- 实例级别：实例化时配置生成，整个实例生命周期内复用
- 私有级别：单个请求时配置，在实例中按配置缓存复用

3. 合并规则：

- 实例级和私有级各自只能有一个
- 发送请求时，实例级优先，无则使用私有级
- 合并后作用于管理器，不修改原配置
- 实例级初始配置 = 管理器默认配置 + 实例化传入配置
- 私有级初始配置 = 管理器默认配置 + 使能开启项

### 六、Vue3 示例项目

1. 使用 Vue3 + Element Plus + UnoCSS
2. 使用免费可用接口或 Mock.js 模拟数据
3. 使用 Vue3 Composition API + TypeScript
4. 界面美观、大气、富有技术感（Cyberpunk Neon UI 风格）
5. 每个管理器单独测试页面 + 多管理器协同测试页面（共6个页面）
6. 示例真实有效，贴近真实应用

### 七、100% 实现

该重构重构，该重写重写，精炼、完美适配应用、适配需求

## 技术栈选择

- **核心库**: TypeScript + Axios
- **构建工具**: Rollup（保持现有）
- **示例项目**: Vue3 + TypeScript + Element Plus + UnoCSS + Vite
- **测试**: Vitest（保持现有）
- **HTTP 模拟**: Mock.js / vite-plugin-mock

## 实施策略：全面重构

### 架构重构设计

#### 新的目录结构

```
d:\workspace\code\axios-request\
├── src/
│   ├── core/
│   │   ├── AxiosRequest.ts          [重构] 核心类，统一拦截器管理
│   │   └── ManagerRegistry.ts        [新增] 管理器注册表，统一管理器生命周期
│   ├── managers/
│   │   ├── base/
│   │   │   └── BaseManager.ts        [新增] 管理器基类，统一接口
│   │   ├── TokenManager.ts           [重构] 增强：白名单、三处拦截、资源管理
│   │   ├── RetryManager.ts           [重构] 增强：配置简化、资源管理
│   │   ├── DedupeManager.ts          [重构] 增强：配置简化、资源管理
│   │   ├── CancelManager.ts          [重构] 增强：配置简化、资源管理
│   │   └── types.ts                  [新增] 管理器通用类型定义
│   ├── types/
│   │   └── index.ts                  [重构] 完善类型定义，导出所有上下文类型
│   ├── utils/
│   │   ├── requestKey.ts             [保持] 保持不变
│   │   ├── formData.ts               [保持] 保持不变
│   │   └── configMerger.ts           [新增] 统一配置合并工具
│   └── index.ts                      [重构] 导出新增类型和方法
├── example/                          [新增] Vue3 示例项目
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── uno.config.ts
│   ├── src/
│   │   ├── main.ts
│   │   ├── App.vue
│   │   ├── styles\
│   │   │   └── global.css
│   │   ├── types\
│   │   │   └── api.ts
│   │   ├── utils\
│   │   │   └── request.ts
│   │   ├── mock\
│   │   │   └── index.ts
│   │   ├── router\
│   │   │   └── index.ts
│   │   ├── layouts\
│   │   │   └── MainLayout.vue
│   │   ├── components\
│   │   │   ├── AppHeader.vue
│   │   │   └── TestPanel.vue
│   │   └── views\
│   │       ├── HomeView.vue
│   │       ├── TokenView.vue
│   │       ├── RetryView.vue
│   │       ├── DedupeView.vue
│   │       ├── CancelView.vue
│   │       └── CombinedView.vue
│   └── public\
├── __tests__/                        [重构] 更新测试用例
├── package.json                       [修改] 新增 example 相关脚本
├── tsconfig.json
└── rollup.config.js
```

#### 管理器基类设计

```typescript
// src/managers/base/BaseManager.ts
export abstract class BaseManager<TConfig, TContext> {
  protected defaultConfig: TConfig;
  
  constructor(config: Partial<TConfig>) {
    this.defaultConfig = this.mergeWithDefaults(config);
  }
  
  // 与默认配置合并
  protected abstract getDefaultConfig(): TConfig;
  
  // 创建请求上下文
  abstract createContext(override?: Partial<TConfig>): TContext;
  
  // 清理资源
  abstract destroy(): void;
}
```

#### Token 管理器增强要点

1. 新增 `whitelistUrls` 配置项，支持字符串数组或正则数组
2. 请求前拦截：检查 `_context.token`，若无 token 或正在刷新，入队等待
3. 响应拦截：检查 `isTokenExpiredFromResponse`（200 响应业务 code）
4. 错误拦截：检查 `isTokenExpired`（401 等异常）
5. 队列机制：使用 Promise 队列，刷新完成后批量重试

#### 配置合并策略

```
管理器默认配置 (硬编码默认值)
    ↓ merge
实例级初始配置 (实例化时传入的配置)
    ↓ 缓存为 defaultContext
    ↓
单个请求时：defaultContext + 请求级配置 → 合并后 context (不修改原配置)
```

#### 资源管理增强

1. **Token 管理器**: 提供 destroy 方法清理队列，防止内存泄漏
2. **Dedupe 管理器**: 超时自动清理 pendingRequests Map，destroy 时清理所有定时器
3. **Cancel 管理器**: AbortController 取消后自动清理，destroy 时取消所有进行中的请求
4. **Retry 管理器**: destroy 时取消进行中的重试定时器

## 实现注意事项

1. **性能优化**: 减少不必要的对象创建和复制，使用对象池复用context
2. **向后兼容**: 保持现有 API 不变，仅增强功能
3. **类型安全**: 完善 TypeScript 类型定义，导出所有必要类型
4. **测试覆盖**: 更新所有测试用例，确保重构后功能正常

## 设计风格

采用现代科技感设计风格（Cyberpunk Neon UI 变体），以深色背景配合蓝色/青色霓虹色调，营造专业、富有技术感的界面。

## 页面规划（共 6 个页面）

### 1. 首页/综合测试 (HomeView.vue)

- **顶部导航栏**: Logo + 页面标题 + 主题切换
- **功能介绍卡片区**: 四大管理器功能卡片，点击跳转对应测试页
- **快速测试面板**: 综合测试多个管理器的协同工作
- **底部状态栏**: 请求状态、管理器状态显示

### 2. Token 管理器测试页 (TokenView.vue)

- **配置面板**: 动态配置 Token 管理器参数
- **测试操作区**: 模拟 token 过期、刷新、失败等场景
- **请求日志区**: 实时显示请求拦截、刷新、重试日志
- **状态显示区**: 当前 token 状态、刷新状态

### 3. 重试管理器测试页 (RetryView.vue)

- **配置面板**: 设置重试次数、延迟、退避策略
- **测试操作区**: 模拟网络错误、5xx 错误触发重试
- **重试进度显示**: 当前重试次数、下次重试倒计时
- **请求日志区**: 每次重试的详细日志

### 4. 防重复提交测试页 (DedupeView.vue)

- **配置面板**: 设置时间窗口、去重方法
- **测试操作区**: 快速连续点击触发防重复逻辑
- **请求状态显示**: 实际发送的请求数量、被拦截的数量
- **可视化展示**: 请求时间线

### 5. 取消请求测试页 (CancelView.vue)

- **配置面板**: 设置取消策略、延迟时间
- **测试操作区**: 模拟搜索场景，快速输入触发取消
- **请求状态显示**: 被取消的请求、实际完成的请求
- **可视化展示**: 请求取消时间线

### 6. 多管理器协同测试页 (CombinedView.vue)

- **综合配置面板**: 同时配置多个管理器
- **复杂场景测试**: 如 token 过期 + 重试 + 取消的组合场景
- **协同效果展示**: 展示多个管理器的执行顺序和协同效果

## 交互设计

- 使用微动画增强交互体验（按钮悬停、卡片悬浮、状态切换）
- 使用渐变和半透明效果营造科技感
- 请求日志使用实时滚动显示
- 状态码/管理器状态使用徽章+颜色区分

## 响应式设计

- 桌面端优先设计
- 使用 UnoCSS 实现响应式布局
- 侧边栏导航（大屏）/ 底部导航（小屏）