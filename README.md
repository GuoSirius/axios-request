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

## 快速开始

### 基础用法

```typescript
import { AxiosRequest } from 'axios-request';

// 1. 创建请求实例
const client = new AxiosRequest({
  axiosConfig: {
    baseURL: 'https://api.example.com',
    timeout: 10000,
  },
});

// 2. 使用方式与 axios 完全一致
// GET 请求
const users = await client.get('/users');

// POST 请求
const newUser = await client.post('/users', { name: '张三', age: 25 });

// PUT 请求
const updatedUser = await client.put('/users/1', { name: '李四', age: 30 });

// DELETE 请求
await client.delete('/users/1');

// 带参数请求
const searchResult = await client.get('/search', {
  params: { keyword: 'javascript', page: 1 },
});
```

### 使用 axios 所有配置项

```typescript
const client = new AxiosRequest({
  axiosConfig: {
    baseURL: 'https://api.example.com',
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true,
    // ...任何 axios 配置项
  },
});
```

## 功能详解

### 1. Token 自动刷新

**场景**：当 access_token 过期时，自动使用 refresh_token 获取新 token，刷新期间的其他请求会排队等待。

```typescript
import axios from 'axios';
import { AxiosRequest } from 'axios-request';

const client = new AxiosRequest({
  axiosConfig: {
    baseURL: 'https://api.example.com',
    // headers 中的 token 会自动从 getAccessToken 获取
    headers: {
      Authorization: () => `Bearer ${localStorage.getItem('access_token')}`,
    },
  },
  tokenManager: {
    // 【必须】判断响应是否表示 token 失效
    isTokenExpired: (error) => {
      // 常见判断方式：401 状态码
      return error.response?.status === 401;
    },

    // 【必须】刷新 token 的函数
    refreshToken: async (error) => {
      // 从存储中获取 refresh_token
      const refreshToken = localStorage.getItem('refresh_token');

      // 调用刷新接口
      const response = await axios.post('/auth/refresh', { refreshToken });

      // 返回新的 tokens
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
      };
    },

    // 【必须】获取当前 access_token
    getAccessToken: () => {
      return localStorage.getItem('access_token');
    },

    // 【必须】保存新的 token
    setTokens: (result) => {
      localStorage.setItem('access_token', result.accessToken);
      if (result.refreshToken) {
        localStorage.setItem('refresh_token', result.refreshToken);
      }
    },

    // 【可选】token 刷新失败的回调
    onRefreshFailed: (reason, error) => {
      console.error('Token 刷新失败:', reason);
      // 常见处理：跳转到登录页
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    },
  },
});
```

**工作流程**：
1. 请求发送时，从 `getAccessToken()` 获取 token 并添加到请求头
2. 请求失败时，调用 `isTokenExpired()` 判断是否是 token 过期
3. 如果是 token 过期，调用 `refreshToken()` 获取新 token
4. 调用 `setTokens()` 保存新 token
5. 用新 token 重试失败的请求
6. 如果刷新失败，调用 `onRefreshFailed()` 并拒绝所有队列中的请求

### 2. 防止重复提交

**场景**：防止用户短时间内多次点击提交按钮，导致重复提交。

```typescript
const client = new AxiosRequest({
  axiosConfig: {
    baseURL: 'https://api.example.com',
  },
  dedupe: {
    enabled: true,           // 启用防重复提交（默认 true）
    duration: 1000,          // 防重时间窗口（毫秒），默认 1000ms
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],  // 生效的 HTTP 方法
  },
});

// 示例：用户在 1 秒内连续点击提交按钮
await client.post('/users', { name: '张三' });      // 发起请求
await client.post('/users', { name: '张三' });      // 1秒内，复用上一个请求的 Promise
await client.post('/users', { name: '张三' });      // 1秒内，复用同一个 Promise
// 实际只发起 1 次请求
```

**自定义请求 key**：

```typescript
const client = new AxiosRequest({
  axiosConfig: {
    baseURL: 'https://api.example.com',
  },
  dedupe: {
    enabled: true,
    // 自定义判断重复的 key 生成方式
    generateKey: (config) => {
      // 根据 url + method + 特定参数生成 key
      return `${config.method}:${config.url}:${config.data?.userId}`;
    },
  },
});
```

### 3. 请求自动取消（搜索场景）

**场景**：用户在搜索框输入关键词时，每次输入都发起请求，自动取消上一次未完成的请求。

```typescript
const client = new AxiosRequest({
  axiosConfig: {
    baseURL: 'https://api.example.com',
  },
  cancel: {
    enabled: true,            // 启用请求取消（默认 true）
    methods: ['GET'],         // 生效的 HTTP 方法
  },
});

// 示例：用户在搜索框快速输入
// 输入第一个字符，发起请求 A
client.get('/search', { params: { q: 'a' } });
// 输入第二个字符，自动取消请求 A，发起请求 B
client.get('/search', { params: { q: 'ab' } });
// 输入第三个字符，自动取消请求 B，发起请求 C
client.get('/search', { params: { q: 'abc' } });
// 只返回最后一个请求 C 的结果，确保显示最新数据
```

**使用 POST 进行搜索**：

```typescript
const client = new AxiosRequest({
  axiosConfig: {
    baseURL: 'https://api.example.com',
  },
  cancel: {
    enabled: true,
    methods: ['GET', 'POST'],  // 也支持 POST
  },
});

client.post('/search', { keyword: 'javascript' });
client.post('/search', { keyword: 'javascript react' });  // 自动取消上一次
```

### 4. 请求失败重试

**场景**：网络不稳定时，自动重试失败的请求。

```typescript
const client = new AxiosRequest({
  axiosConfig: {
    baseURL: 'https://api.example.com',
  },
  retry: {
    enabled: true,              // 启用重试（默认 false）
    maxRetries: 3,             // 最大重试次数，默认 3
    delay: 100,                // 重试延迟（毫秒），默认 100ms
    exponentialBackoff: false,  // 是否使用指数退避，默认 false

    // 【可选】自定义判断哪些错误需要重试
    shouldRetry: (error, retryCount) => {
      // 网络错误或 5xx 服务器错误才重试
      return !error.response || error.response.status >= 500;
    },
  },
});
```

**指数退避示例**：

```typescript
const client = new AxiosRequest({
  retry: {
    enabled: true,
    maxRetries: 5,
    delay: 100,                    // 基础延迟
    exponentialBackoff: true,       // 开启指数退避
    // 实际延迟：100ms -> 200ms -> 400ms -> 800ms -> 1600ms
  },
});
```

### 5. 组合使用

所有功能可以组合使用：

```typescript
const client = new AxiosRequest({
  axiosConfig: {
    baseURL: 'https://api.example.com',
    timeout: 10000,
  },
  tokenManager: {
    isTokenExpired: (error) => error.response?.status === 401,
    refreshToken: async () => {
      const response = await axios.post('/auth/refresh', {
        refreshToken: localStorage.getItem('refresh_token'),
      });
      return response.data;
    },
    getAccessToken: () => localStorage.getItem('access_token'),
    setTokens: (result) => {
      localStorage.setItem('access_token', result.accessToken);
    },
  },
  dedupe: {
    enabled: true,
    duration: 1000,
  },
  cancel: {
    enabled: true,
    methods: ['GET'],
  },
  retry: {
    enabled: true,
    maxRetries: 3,
    delay: 100,
  },
});

// 现在可以使用完整功能
const data = await client.get('/users');
const result = await client.post('/users', { name: '张三' });
```

### 6. 单个请求级别配置

可以在单个请求中覆盖全局配置或启用/禁用某个功能：

```typescript
// 为单个请求禁用防重复提交
await client.post('/users', data, {
  _dedupe: {
    enabled: false,  // 禁用防重复提交
  },
});

// 为单个请求修改防重时间
await client.post('/users', data, {
  _dedupe: {
    enabled: true,
    duration: 2000,  // 这次用 2000ms
  },
});

// 为单个请求禁用请求取消
await client.get('/search', {
  params: { q: 'test' },
  _cancel: {
    enabled: false,  // 禁用请求取消
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

// 简写：数字表示重试次数
await client.get('/unreliable-endpoint', {
  _retry: 5,  // 重试 5 次
});

// 禁用 token 刷新
await client.get('/public-data', {
  _tokenManager: {
    enabled: false,  // 这个请求不需要 token
  },
});
```

## API 文档

### `new AxiosRequest(config)`

创建请求实例。

```typescript
const client = new AxiosRequest({
  axiosConfig: { /* axios 配置 */ },
  tokenManager: { /* token 管理配置 */ },
  dedupe: { /* 防重复提交配置 */ },
  cancel: { /* 请求取消配置 */ },
  retry: { /* 重试配置 */ },
});
```

#### 配置参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `axiosConfig` | `AxiosRequestConfig` | 否 | axios 的基础配置 |
| `tokenManager` | `TokenManagerConfig` | 否 | token 管理器配置 |
| `dedupe` | `DedupeConfig` | 否 | 防重复提交配置 |
| `cancel` | `CancelConfig` | 否 | 请求取消配置 |
| `retry` | `RetryConfig` | 否 | 请求重试配置 |

### 实例方法

| 方法 | 说明 |
|------|------|
| `request(config)` | 发起任意类型的请求 |
| `get(url, config?)` | GET 请求 |
| `post(url, data?, config?)` | POST 请求 |
| `put(url, data?, config?)` | PUT 请求 |
| `patch(url, data?, config?)` | PATCH 请求 |
| `delete(url, config?)` | DELETE 请求 |
| `head(url, config?)` | HEAD 请求 |
| `options(url, config?)` | OPTIONS 请求 |
| `getInstance()` | 获取底层 axios 实例（用于高级配置） |
| `clear()` | 清除所有待处理的请求（防重复和请求取消） |

### TokenManagerConfig

```typescript
interface TokenManagerConfig {
  // 判断响应是否表示 token 失效
  isTokenExpired: (error: AxiosError) => boolean;

  // 刷新 token 的函数
  refreshToken: (error: AxiosError) => Promise<TokenResult>;

  // 获取当前 access_token
  getAccessToken: () => string | null | (() => string | null);

  // 保存新的 token
  setTokens: (result: TokenResult) => void;

  // token 刷新失败的回调（可选）
  onRefreshFailed?: (reason: any, error: AxiosError) => void;
}

interface TokenResult {
  accessToken: string;
  refreshToken?: string;
}
```

### DedupeConfig

```typescript
interface DedupeConfig {
  enabled?: boolean;              // 默认 true
  duration?: number;               // 防重时间窗口（毫秒），默认 1000
  methods?: string[];              // 生效的 HTTP 方法，默认 ['POST', 'PUT', 'PATCH', 'DELETE']
  generateKey?: (config: AxiosRequestConfig) => string;  // 自定义 key 生成方式
}
```

### CancelConfig

```typescript
interface CancelConfig {
  enabled?: boolean;               // 默认 true
  methods?: string[];              // 生效的 HTTP 方法，默认 ['GET']
  generateKey?: (config: AxiosRequestConfig) => string;  // 自定义 key 生成方式
}
```

### RetryConfig

```typescript
interface RetryConfig {
  enabled?: boolean;               // 默认 false
  maxRetries?: number;             // 最大重试次数，默认 3
  delay?: number;                  // 重试延迟（毫秒），默认 100
  exponentialBackoff?: boolean;    // 是否使用指数退避，默认 false
  shouldRetry?: (error: AxiosError, retryCount: number) => boolean;  // 自定义判断是否重试
}
```

## 常见问题

### Q: 如何处理 CORS 问题？

```typescript
const client = new AxiosRequest({
  axiosConfig: {
    baseURL: 'https://api.example.com',
    withCredentials: true,  // 允许携带 cookie
  },
});
```

### Q: 如何在请求中添加自定义 header？

```typescript
const client = new AxiosRequest({
  axiosConfig: {
    baseURL: 'https://api.example.com',
    headers: {
      'X-Custom-Header': 'custom-value',
    },
  },
});
```

### Q: 如何处理请求超时？

```typescript
const client = new AxiosRequest({
  axiosConfig: {
    timeout: 5000,  // 5 秒超时
  },
});

try {
  const data = await client.get('/slow-endpoint');
} catch (error) {
  if (error.code === 'ECONNABORTED') {
    console.log('请求超时');
  }
}
```

### Q: 如何获取完整的响应而非只获取 data？

```typescript
// 使用 request 方法可以获取完整响应
const response = await client.request({
  url: '/users',
  method: 'GET',
  transformResponse: [(data) => data],  // 禁用默认转换
});

// response 是完整的 axios 响应对象
console.log(response.status);
console.log(response.headers);
console.log(response.data);
```

### Q: 如何上传文件？

```typescript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('name', 'my-file');

const result = await client.post('/upload', formData, {
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});
```

### Q: 如何下载文件？

```typescript
// 使用 responseType: 'blob'
const response = await client.get('/download/file.pdf', {
  responseType: 'blob',
});

// 保存文件
const url = window.URL.createObjectURL(new Blob([response]));
const link = document.createElement('a');
link.href = url;
link.download = 'file.pdf';
link.click();
```

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

## 作者

SiriuSSupreme

## 仓库

- Gitee: https://gitee.com/siriussupreme/axios-request