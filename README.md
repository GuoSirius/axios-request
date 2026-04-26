# axios-request

基于 axios 的增强请求库，提供 token 自动刷新、防止重复提交、请求取消、失败重试等功能。

## 特性

- ✅ **完全兼容 axios**：API 与 axios 完全一致，可无缝替换
- 🔄 **Token 自动刷新**：自动检测 token 过期并用 refresh_token 换取新 token，刷新期间的请求自动进入队列等待
- 🚫 **防止重复提交**：防止表单重复提交（POST、PUT 等），可配置防重时间
- ❌ **请求自动取消**：对搜索类等高频请求，自动取消上次未完成的请求
- 🔁 **请求失败重试**：支持配置重试次数和延迟策略（含指数退避）
- 📦 **双格式输出**：同时支持 ESM 和 CommonJS
- 📘 **TypeScript 支持**：完整的类型定义

## 安装

```bash
npm install axios-request axios
```

```bash
yarn add axios-request axios
```

```bash
pnpm add axios-request axios
```

## 快速开始

```typescript
import { AxiosRequest } from 'axios-request';

// 创建请求实例
const client = new AxiosRequest({
  axiosConfig: {
    baseURL: 'https://api.example.com',
    timeout: 10000,
  },
});

// 使用方式与 axios 完全一致
const data = await client.get('/users');
```

## 高级用法

### 1. Token 自动刷新

```typescript
import { AxiosRequest } from 'axios-request';

const client = new AxiosRequest({
  axiosConfig: {
    baseURL: 'https://api.example.com',
  },
  tokenManager: {
    // 判断响应是否表示 token 失效
    isTokenExpired: (error) => {
      return error.response && error.response.status === 401;
    },
    
    // 刷新 token 的函数
    refreshToken: async (error) => {
      const refreshToken = localStorage.getItem('refresh_token');
      const response = await axios.post('/auth/refresh', { refreshToken });
      return {
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
      };
    },
    
    // 获取当前 access_token
    getAccessToken: () => {
      return localStorage.getItem('access_token');
    },
    
    // 保存新的 token
    setTokens: (result) => {
      localStorage.setItem('access_token', result.accessToken);
      if (result.refreshToken) {
        localStorage.setItem('refresh_token', result.refreshToken);
      }
    },
    
    // token 刷新失败的回调（可选）
    onRefreshFailed: (reason, error) => {
      console.error('Token refresh failed:', reason);
      // 跳转到登录页
      window.location.href = '/login';
    },
  },
});
```

### 2. 防止重复提交

```typescript
const client = new AxiosRequest({
  dedupe: {
    enabled: true,          // 启用防重复提交
    duration: 1000,         // 防重时间窗口（毫秒），默认 1000ms
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],  // 需要防重的 HTTP 方法
  },
});

// 在 1000ms 内重复调用只会产生一次请求
await client.post('/users', { name: 'John' });
await client.post('/users', { name: 'John' }); // 不会重复提交
```

### 3. 请求自动取消（搜索场景）

```typescript
const client = new AxiosRequest({
  cancel: {
    enabled: true,          // 启用请求取消
    methods: ['GET'],        // 需要取消的 HTTP 方法
  },
});

// 连续输入时，上次请求会自动取消
client.get('/search', { params: { q: 'hello' } });
client.get('/search', { params: { q: 'hello world' } }); // 自动取消上一次请求
```

### 4. 请求失败重试

```typescript
const client = new AxiosRequest({
  retry: {
    enabled: true,              // 启用重试
    maxRetries: 3,             // 最大重试次数，默认 3
    delay: 100,                // 重试延迟（毫秒），默认 100ms
    exponentialBackoff: false,  // 是否使用指数退避，默认 false
    
    // 自定义判断哪些错误需要重试（可选）
    shouldRetry: (error, retryCount) => {
      // 网络错误或 5xx 错误才重试
      return !error.response || error.response.status >= 500;
    },
  },
});
```

### 5. 单个请求配置

所有功能都支持在单个请求级别进行配置：

```typescript
// 为单个请求启用/禁用防重复提交
await client.post('/users', data, {
  _dedupe: {
    enabled: true,
    duration: 2000,  // 覆盖全局配置
  },
});

// 为单个请求启用/禁用请求取消
await client.get('/search', {
  params: { q: 'test' },
  _cancel: {
    enabled: true,
  },
});

// 为单个请求配置重试
await client.get('/unreliable-endpoint', {
  _retry: {
    enabled: true,
    maxRetries: 5,
    delay: 500,
    exponentialBackoff: true,
  },
});

// 简化写法：直接传数字表示重试次数
await client.get('/unreliable-endpoint', {
  _retry: 5,  // 重试 5 次
});
```

## API 文档

### `new AxiosRequest(config)`

创建请求实例。

#### `config` 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `axiosConfig` | `AxiosRequestConfig` | axios 的基础配置 |
| `tokenManager` | `TokenManagerConfig` | token 管理器配置 |
| `dedupe` | `DedupeConfig` | 防重复提交配置 |
| `cancel` | `CancelConfig` | 请求取消配置 |
| `retry` | `RetryConfig` | 请求重试配置 |

### 实例方法

- `request(config)` - 发起请求
- `get(url, config)` - GET 请求
- `post(url, data, config)` - POST 请求
- `put(url, data, config)` - PUT 请求
- `patch(url, data, config)` - PATCH 请求
- `delete(url, config)` - DELETE 请求
- `head(url, config)` - HEAD 请求
- `options(url, config)` - OPTIONS 请求
- `getInstance()` - 获取底层 axios 实例
- `clear()` - 清除所有待处理的请求

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

## 作者

SiriuSSupreme

## 仓库

- Gitee: https://gitee.com/siriussupreme/axios-request
