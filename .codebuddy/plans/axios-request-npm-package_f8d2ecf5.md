---
name: axios-request-npm-package
overview: 开发一个基于axios的增强请求库npm包，集成token自动刷新、防重复提交、请求取消、失败重试等功能，支持TypeScript、ESM和CommonJS，兼容浏览器和Node.js环境。
todos:
  - id: init-project
    content: 初始化项目结构和配置文件
    status: completed
  - id: implement-types-utils
    content: 实现类型定义和工具函数
    status: completed
    dependencies:
      - init-project
  - id: implement-managers
    content: 实现4个Manager类（Token、Dedupe、Cancel、Retry）
    status: completed
    dependencies:
      - implement-types-utils
  - id: implement-core
    content: 实现AxiosRequest核心类和入口文件
    status: completed
    dependencies:
      - implement-managers
  - id: setup-build-test
    content: 配置Rollup构建和Vitest测试
    status: completed
    dependencies:
      - implement-core
  - id: docs-publish
    content: 编写文档并发布到npm
    status: completed
    dependencies:
      - setup-build-test
  - id: push-gitee
    content: 推送代码到gitee仓库
    status: completed
    dependencies:
      - docs-publish
---

## 产品概述

开发基于axios的增强请求库npm包，提供token自动刷新、防止重复提交、请求取消、请求重试等功能，完全兼容axios API。

## 核心功能

1. **兼容axios API**：请求参数完全兼容axios，并支持扩展配置项
2. **Token自动刷新**：检测到token失效时自动刷新，刷新期间的请求进入队列等待，获取新token后自动重试
3. **防止重复提交**：对post、put等提交类请求，默认1000ms内防止重复提交，时间可配置
4. **请求自动取消**：对搜索类等高频请求，自动取消上次未完成的请求，确保数据正确性
5. **请求重试机制**：对失败请求自动重试，默认重试3次，次数可配置

## 技术栈选择

- **开发语言**：TypeScript 5.0+
- **基础请求库**：axios 1.6+
- **构建工具**：Rollup（生成ESM和CommonJS双格式）
- **测试框架**：Vitest

## 实现方案

### 核心架构

采用面向对象设计，主要包含：

1. **AxiosRequest核心类**：封装axios实例，提供统一请求接口
2. **TokenManager**：管理token刷新逻辑和请求队列
3. **DedupeManager**：管理防止重复提交
4. **CancelManager**：管理请求取消
5. **RetryManager**：管理请求重试

### 技术决策

- **Token刷新队列机制**：确保同时只有一个token刷新请求，刷新期间的所有请求进入队列等待
- **防重复提交**：基于请求key（url + method + params）去重，在指定时间窗口内相同请求只发出一次
- **请求取消**：使用Axios的AbortController，对相同key的新请求自动取消旧请求
- **请求重试**：支持配置重试次数和条件，可选指数退避策略

## 目录结构

```
axios-request/
├── src/
│   ├── index.ts                    # 入口文件
│   ├── core/
│   │   └── AxiosRequest.ts        # 核心类
│   ├── managers/
│   │   ├── TokenManager.ts         # Token管理
│   │   ├── DedupeManager.ts        # 防重复提交
│   │   ├── CancelManager.ts        # 请求取消
│   │   └── RetryManager.ts         # 请求重试
│   ├── types/
│   │   └── index.ts               # 类型定义
│   └── utils/
│       └── requestKey.ts           # 工具函数
├── dist/                           # 构建输出
├── __tests__/                      # 测试文件
├── package.json
├── tsconfig.json
├── rollup.config.js
└── README.md
```