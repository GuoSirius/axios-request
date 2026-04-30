# axios-request

基于 axios 的增强请求库，提供 Token 自动刷新、防止重复提交、请求取消、失败重试、FormData 转换等功能。

## 特性

- ✅ **零成本接入**：直接继承 axios 配置，无学习成本
- 🔄 **Token 自动刷新**：自动检测 token 过期并刷新，刷新期间请求自动排队
- 🚫 **防止重复提交**：防止表单重复提交，可配置时间窗口
- ❌ **请求自动取消**：搜索类高频请求，自动取消上次请求
- 🔁 **失败自动重试**：支持重试次数、延迟策略（含指数退避）
- 📦 **三种打包格式**：ESM / CommonJS / UMD
- 📘 **完整 TypeScript 支持**：类型提示覆盖所有配置
- 🛠️ **FormData 工具**：智能转换各种数据类型

---

## 安装

```bash
# npm
npm install axios-request axios

# yarn
yarn add axios-request axios

# pnpm
pnpm add axios-request axios
```

### 浏览器引入（UMD）

```html
<!-- 引入 axios -->
<script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
<!-- 引入 axios-request -->
<script src="https://unpkg.com/axios-request/dist/axios-request.umd.min.js"></script>

<script>
  const client = new AxiosRequest({
    baseURL: '/api'
  });
</script>
```

---

## 快速开始

### 基础用法（5 分钟上手）

```typescript
import { AxiosRequest } from 'axios-request';

// 1. 创建实例（直接继承 axios 配置）
const client = new AxiosRequest({
  baseURL: 'https://api.example.com',
  timeout: 10000,
});

// 2. 使用方式与 axios 完全一致
const users = await client.get('/users');                    // GET
const user = await client.post('/users', { name: '张三' });   // POST
const updated = await client.put('/users/1', { age: 30 });    // PUT
await client.delete('/users/1');                             // DELETE
```

### 完整功能示例

```typescript
import { AxiosRequest } from 'axios-request';
import axios from 'axios';

const client = new AxiosRequest({
  baseURL: 'https://api.example.com',
  timeout: 10000,

  // Token 自动刷新
  token: {
    isTokenExpired: (error) => error.response?.status === 401,
    refreshToken: async () => {
      const res = await axios.post('/auth/refresh', {
        refreshToken: localStorage.getItem('refresh_token'),
      });
      return res.data;
    },
    getAccessToken: () => localStorage.getItem('access_token'),
    setTokens: (result) => {
      localStorage.setItem('access_token', result.accessToken);
      if (result.refreshToken) {
        localStorage.setItem('refresh_token', result.refreshToken);
      }
    },
  },

  // 防重复提交（默认开启）
  dedupe: {
    enabled: true,
    timeWindow: 1000,  // 1秒内重复请求会被合并
  },

  // 请求取消（默认开启，仅 GET）
  cancel: {
    enabled: true,
  },

  // 失败重试
  retry: {
    enabled: true,
    maxRetries: 3,
    retryDelay: 100,
    exponentialBackoff: true,
  },
});

// 使用
const data = await client.get('/users');
```

---

## 功能详解

### 1. Token 自动刷新

#### 基本配置

```typescript
const client = new AxiosRequest({
  baseURL: 'https://api.example.com',
  token: {
    // 【必须】判断 token 是否失效
    isTokenExpired: (error) => error.response?.status === 401,

    // 【必须】刷新 token
    refreshToken: async (error) => {
      const res = await axios.post('/auth/refresh', {
        refreshToken: localStorage.getItem('refresh_token'),
      });
      return res.data;  // 返回 { accessToken, refreshToken? }
    },

    // 【必须】获取当前 token
    getAccessToken: () => localStorage.getItem('access_token'),

    // 【必须】保存新 token
    setTokens: (result) => {
      localStorage.setItem('access_token', result.accessToken);
      if (result.refreshToken) {
        localStorage.setItem('refresh_token', result.refreshToken);
      }
    },

    // 【可选】刷新失败回调
    onRefreshFailed: (reason, error) => {
      console.error('Token 刷新失败:', reason);
      window.location.href = '/login';
    },

    // 【可选】自定义 token 赋值方式
    // 默认：Authorization: Bearer {token}
    // 可以自定义 header 字段名或赋值格式
    setAuthorization: (config, token) => {
      config.headers['X-Access-Token'] = `Bearer ${token}`;
    },
  },
});
```

#### 工作原理

```
请求 → Token 失效(401) → 刷新 Token → 重试请求 → 成功
                   ↓
              刷新失败 → 拒绝所有等待中的请求 → 跳转登录页
```

#### 单个请求禁用 Token

```typescript
// 公开接口不需要 token
await client.get('/public/news', {
  token: false,
});
```

#### 白名单 URL（不需要 Token 的请求）

支持通过白名单配置来标记不需要 Token 的请求，提供两种方式：

**方式一：实例级白名单（推荐）**

```typescript
const client = new AxiosRequest({
  baseURL: 'https://api.example.com',
  token: {
    // ...其他配置
    whitelistUrls: [
      '/public/**',           // 公开接口
      '/auth/login',         // 登录接口
      /^\/static\//,         // 正则匹配静态资源
    ],
  },
});

// 以下请求自动跳过 Token 注入
await client.get('/public/news');       // 匹配 /public/**
await client.get('/auth/login');        // 匹配 /auth/login
await client.get('/static/logo.png');   // 匹配正则 /^\/static\//
```

**方式二：单个请求禁用**

```typescript
// 单个请求禁用 Token
await client.get('/public/news', {
  token: false,
});

// 单个请求配置白名单
await client.get('/public/news', {
  token: {
    whitelistUrls: ['/public/**'],
  },
});
```

#### 单个请求使用不同的 Token

```typescript
// 使用临时的 token（不影响实例配置）
await client.post('/admin/users', data, {
  token: {
    isTokenExpired: () => false,
    refreshToken: async () => ({ accessToken: 'temp-token' }),
    getAccessToken: () => 'temp-token',
    setTokens: () => {},
  },
});
```

#### 单个请求禁用 Token

```typescript
// 公开接口不需要 token
await client.get('/public/news', {
  token: false,
});
```

#### 自定义 Token 赋值方式

默认情况下，token 会以 `Authorization: Bearer {token}` 的形式添加到请求头中。如果你的 API 使用其他格式，可以自定义：

```typescript
const client = new AxiosRequest({
  token: {
    // ...其他配置

    // 自定义 header 字段名
    setAuthorization: (config, token) => {
      config.headers['X-Token'] = token;
    },

    // 使用其他赋值格式
    setAuthorization: (config, token) => {
      config.headers['Authorization'] = `token ${token}`;
    },

    // 同时设置多个 header
    setAuthorization: (config, token) => {
      config.headers['X-Access-Token'] = token;
      config.headers['X-Token-Type'] = 'Bearer';
    },
  },
});
```

---

### 2. 防止重复提交

#### 场景说明

防止用户快速点击提交按钮，导致重复请求。

```typescript
const client = new AxiosRequest({
  baseURL: 'https://api.example.com',
  dedupe: {
    enabled: true,           // 默认 true
    timeWindow: 1000,       // 默认 1000ms
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],  // 默认值
  },
});

// 用户快速点击提交
await client.post('/users', { name: '张三' });  // 发起请求 A
await client.post('/users', { name: '张三' });  // 复用请求 A 的 Promise
await client.post('/users', { name: '张三' });  // 复用请求 A 的 Promise
// 实际只发起 1 次请求
```

#### 自定义 Key 生成（字符串模板）

```typescript
const client = new AxiosRequest({
  dedupe: {
    enabled: true,
    // 字符串模板：用冒号分隔字段路径
    generateKey: 'method:url:data.userId',  // 等价于函数
    // 特殊值：只用 url 作为 key
    generateKey: 'only-url',
  },
});
```

#### 自定义 Key 生成（函数）

```typescript
const client = new AxiosRequest({
  dedupe: {
    enabled: true,
    generateKey: (config) => {
      return `${config.method}:${config.url}:${config.data?.id}`;
    },
  },
});
```

#### 简写方式

```typescript
// 禁用防重复提交
dedupe: false

// 启用（使用默认配置）
dedupe: true

// 完整配置
dedupe: {
  enabled: true,
  timeWindow: 2000,
}

// 数组简写 - 直接作为 methods（自动转大写）
dedupe: ['post', 'put', 'patch']           // 自动转为 { enabled: true, methods: ['POST', 'PUT', 'PATCH'] }
dedupe: ['get', 'Get', 'GET']              // 混合大小写会被归一化为大写
```

#### 单个请求级别配置

```typescript
// 这次请求禁用防重复
await client.post('/users', data, {
  dedupe: false,
});

// 这次请求用更长的防重时间
await client.post('/users', data, {
  dedupe: {
    enabled: true,
    timeWindow: 3000,
  },
});
```

---

### 3. 请求自动取消

#### 场景说明

搜索框输入时，自动取消上一次请求，确保只显示最新结果。

```typescript
const client = new AxiosRequest({
  baseURL: 'https://api.example.com',
  cancel: {
    enabled: true,         // 默认 true
    methods: ['GET'],      // 默认值
  },
});

// 用户在搜索框输入
client.get('/search', { params: { q: 'a' } });      // 请求 A
client.get('/search', { params: { q: 'ab' } });     // 自动取消 A，请求 B
client.get('/search', { params: { q: 'abc' } });    // 自动取消 B，请求 C
```

#### 支持 POST 搜索

```typescript
const client = new AxiosRequest({
  cancel: {
    enabled: true,
    methods: ['GET', 'POST'],  // 支持 POST
  },
});

client.post('/search', { keyword: 'js' });                    // 请求 A
client.post('/search', { keyword: 'javascript' });             // 自动取消 A
client.post('/search', { keyword: 'javascript react' });      // 自动取消 B
```

#### 自定义 Key 生成

```typescript
const client = new AxiosRequest({
  cancel: {
    enabled: true,
    generateKey: 'only-url',  // 只用 url 作为 key
    // 或
    generateKey: (config) => `${config.url}:${config.params?.category}`,
  },
});
```

#### 单个请求禁用

```typescript
await client.get('/static/data', {
  cancel: false,  // 不取消上一次请求
});
```

#### 简写方式

```typescript
// 禁用
cancel: false

// 启用（使用默认配置）
cancel: true

// 数组简写 - 直接作为 methods（自动转大写）
cancel: ['get', 'Get', 'POST']              // 自动转为 { enabled: true, methods: ['GET', 'GET', 'POST'] }
```

---

### 4. 请求失败重试

#### 基础配置

```typescript
const client = new AxiosRequest({
  baseURL: 'https://api.example.com',
  retry: {
    enabled: true,           // 默认 false
    maxRetries: 3,           // 默认 3
    retryDelay: 100,          // 默认 100ms
    exponentialBackoff: false,
  },
});
```

#### 指数退避（推荐）

```typescript
const client = new AxiosRequest({
  retry: {
    enabled: true,
    maxRetries: 5,
    retryDelay: 100,
    exponentialBackoff: true,  // 100ms → 200ms → 400ms → 800ms → 1600ms
  },
});
```

#### 自定义重试条件

```typescript
const client = new AxiosRequest({
  retry: {
    enabled: true,
    maxRetries: 3,
    // 只重试网络错误和 5xx 错误
    retryCondition: (error, retryCount) => {
      // 不重试 4xx 客户端错误
      if (error.response?.status >= 400 && error.response?.status < 500) {
        return false;
      }
      return true;
    },
  },
});
```

#### 简写方式

```typescript
// 数字表示：启用重试，maxRetries = 3
retry: 3

// 布尔表示
retry: false  // 禁用
retry: true   // 启用，使用默认配置

// 对象表示
retry: {
  enabled: true,
  maxRetries: 5,
  retryDelay: 200,
}
```

#### 单个请求配置

```typescript
// 重试 5 次
await client.get('/unreliable', {
  retry: 5,
});

// 这次不用重试
await client.get('/fast-fail', {
  retry: false,
});
```

---

### 5. Content-Type 配置

#### 预设值

```typescript
// JSON（默认）
contentType: 'json'   // → Content-Type: application/json;charset=UTF-8

// Form 表单
contentType: 'form'   // → Content-Type: application/x-www-form-urlencoded

// 文件上传（不设置 Content-Type，让浏览器自动处理）
contentType: 'file'   // → 不设置（multipart/form-data 由浏览器自动设置）
```

#### 自定义

```typescript
contentType: 'application/xml'  // 直接使用
```

#### 请求级别配置

```typescript
// 文件上传
await client.post('/upload', formData, {
  contentType: 'file',  // 让浏览器自动处理 Content-Type
});
```

---

### 6. FormData 转换工具

#### toFormData 函数

自动将各种类型数据转换为 FormData：

```typescript
import { toFormData } from 'axios-request';

// 基础类型
const fd1 = toFormData({
  name: '张三',
  age: 25,
  active: true,
});
// → name=张三&age=25&active=true

// 嵌套对象（点号分隔）
const fd2 = toFormData({
  user: {
    name: '张三',
    profile: {
      age: 25,
    },
  },
});
// → user.name=张三&user.profile.age=25

// 数组（括号下标）
const fd3 = toFormData({
  tags: ['a', 'b', 'c'],
});
// → tags[0]=a&tags[1]=b&tags[2]=c

// 文件上传
const fd4 = toFormData({
  avatar: file,
  attachments: [file1, file2],
});
// → avatar=File&attachments[0]=File&attachments[1]=File

// Date 类型
const fd5 = toFormData({
  createdAt: new Date('2024-01-01'),
});
// → createdAt=2024-01-01T00:00:00.000Z

// 混合数据
const fd6 = toFormData({
  name: '张三',
  age: 25,
  profile: {
    bio: '简介',
  },
  tags: ['a', 'b'],
  avatar: file,
});
```

#### 类型检测工具

```typescript
import { checkType, flattenFormData } from 'axios-request';

// 检测数据类型
const result = checkType(file);
// → { type: 'File', isBlob: true, isPlainObject: false, isArray: false, isPrimitive: false }

const result = checkType({ name: '张三' });
// → { type: 'Object', isBlob: false, isPlainObject: true, isArray: false, isPrimitive: false }

// 将 FormData 展平为数组（调试用）
const entries = flattenFormData(formData);
// → [['name', '张三'], ['avatar', File]]
```

---

### 7. 简写配置汇总

为了简化使用，支持多种简写形式：

| 配置项 | 简写 | 说明 |
|--------|------|------|
| `dedupe` | `false` | 禁用防重复提交 |
| `dedupe` | `true` | 启用，使用默认配置 |
| `dedupe` | `{ timeWindow: 2000 }` | 只需改一个参数 |
| `dedupe` | `['post', 'put']` | 数组直接作为 methods（自动转大写）|
| `cancel` | `false` | 禁用请求取消 |
| `cancel` | `true` | 启用，使用默认配置 |
| `cancel` | `['get', 'post']` | 数组直接作为 methods（自动转大写）|
| `retry` | `false` | 禁用重试 |
| `retry` | `true` | 启用，使用默认配置 |
| `retry` | `3` | 启用并设置 maxRetries=3 |
| `dedupe` | `false` | 单个请求禁用 |
| `dedupe` | `['post']` | 单个请求使用数组指定 methods |
| `retry` | `5` | 单个请求重试 5 次 |
| `contentType` | `'json'` | JSON 格式 |
| `contentType` | `'form'` | 表单格式 |
| `contentType` | `'file'` | 文件上传 |

---

## API 文档

### AxiosRequest 构造函数

```typescript
import { AxiosRequest } from 'axios-request';

// 直接继承 axios 配置 + 新增功能配置
const client = new AxiosRequest({
  // axios 原生配置（直接写在顶层）
  baseURL?: string,
  timeout?: number,
  headers?: object,
  // ...其他 axios 配置

  // 新增功能配置
  token?: TokenManagerConfig,
  dedupe?: DedupeConfig | boolean,
  cancel?: CancelConfig | boolean,
  retry?: RetryConfig | boolean | number,
});
```

### 实例方法

| 方法 | 说明 |
|------|------|
| `get(url, data?, config?)` | GET 请求 |
| `post(url, data?, config?)` | POST 请求 |
| `put(url, data?, config?)` | PUT 请求 |
| `patch(url, data?, config?)` | PATCH 请求 |
| `delete(url, config?)` | DELETE 请求 |
| `head(url, config?)` | HEAD 请求 |
| `options(url, config?)` | OPTIONS 请求 |
| `request(config)` | 发起任意请求 |
| `getInstance()` | 获取底层 axios 实例 |
| `clear()` | 清除所有待处理请求 |

---

## 类型定义

### DedupeConfig

```typescript
interface DedupeConfig {
  enabled?: boolean;                    // 默认 true
  timeWindow?: number;                  // 默认 1000（毫秒）
  methods?: string[];                   // 默认 ['POST', 'PUT', 'PATCH', 'DELETE']
  generateKey?: GenerateKeyFunction | string;  // 函数或字符串模板
}

// 字符串模板示例
generateKey: 'method:url:data.id'     // 用冒号分隔路径
generateKey: 'only-url'               // 特殊值，只用 url
```

### CancelConfig

```typescript
interface CancelConfig {
  enabled?: boolean;                  // 默认 true
  methods?: string[];                 // 默认 ['GET']
  generateKey?: GenerateKeyFunction | string;
}
```

### RetryConfig

```typescript
interface RetryConfig {
  enabled?: boolean;                  // 默认 false
  maxRetries?: number;                // 默认 3
  retryDelay?: number;                // 默认 100（毫秒）
  exponentialBackoff?: boolean;       // 默认 false
  retryCondition?: (error: any, retryCount: number) => boolean;
}
```

### TokenManagerConfig

```typescript
interface TokenManagerConfig {
  isTokenExpired: (error: any) => boolean;
  refreshToken: (error: any) => Promise<TokenRefreshResult>;
  getAccessToken: () => string | null;
  setTokens: (result: TokenRefreshResult) => void | Promise<void>;
  getRefreshToken?: () => string | null;
  onRefreshFailed?: (reason: TokenRefreshFailureReason, error: any) => void | Promise<void>;
  // 自定义 token 赋值方式（可选，默认 Authorization: Bearer {token}）
  setAuthorization?: (config: AxiosRequestConfig, token: string) => void;
}

interface TokenRefreshResult {
  accessToken: string;
  refreshToken?: string;
}

type TokenRefreshFailureReason =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_refresh_token'
  | 'refresh_timeout'
  | 'network_error'
  | 'unknown';
```

### FormData 相关类型

```typescript
// 值类型
type FormDataValue =
  | string | number | boolean
  | null | undefined
  | Date | File | Blob
  | FormDataValue[]
  | { [key: string]: FormDataValue };

// 类型检测结果
interface TypeCheckResult {
  type: 'null' | 'undefined' | 'string' | 'number' | 'boolean' | 'Date' | 'File' | 'Blob' | 'Array' | 'Object';
  isBlob: boolean;
  isPlainObject: boolean;
  isArray: boolean;
  isPrimitive: boolean;
}
```

---

## 常见问题

### Q: 如何上传文件？

```typescript
import { toFormData } from 'axios-request';

const formData = toFormData({
  file: fileInput.files[0],
  name: 'my-file',
});

await client.post('/upload', formData, {
  contentType: 'file',  // 让浏览器自动设置 Content-Type
});
```

### Q: 如何处理 CORS？

```typescript
const client = new AxiosRequest({
  withCredentials: true,  // 允许携带 cookie
});
```

### Q: 如何自定义请求头？

```typescript
const client = new AxiosRequest({
  headers: {
    'X-App-Version': '1.0.0',
  },
});
```

### Q: 如何获取完整响应？

```typescript
const response = await client.request({
  url: '/users',
  transformResponse: [(data) => data],  // 禁用默认转换
});

console.log(response.status);     // 200
console.log(response.headers);    // 响应头
console.log(response.data);       // 响应数据
```

### Q: 如何处理超时？

```typescript
try {
  await client.get('/slow', { timeout: 5000 });
} catch (error) {
  if (error.code === 'ECONNABORTED') {
    console.log('请求超时');
  }
}
```

### Q: 单个请求配置会影响实例配置吗？

不会。所有管理器都采用"请求上下文"机制，单个请求的配置只在当前请求生效，不会修改实例级别的配置。

```typescript
const client = new AxiosRequest({
  dedupe: { timeWindow: 1000 },  // 实例配置
});

// 单个请求的配置只对当前请求生效
await client.post('/api', data, { dedupe: { timeWindow: 5000 } });

// 验证：实例配置未被修改
client.getInstanceConfig().dedupe.timeWindow === 1000;  // true
```

### Q: 如何为单个请求创建临时管理器？

当实例没有配置某个管理器，但某个请求需要该功能时，会自动创建临时管理器：

```typescript
const client = new AxiosRequest({
  // 没有配置 retry
});

// 单个请求启用重试（自动创建临时管理器）
await client.get('/unreliable', { retry: 5 });
```

---

### 8. 管理器架构设计

本库采用统一的管理器架构，所有功能（Token、Dedupe、Cancel、Retry）都遵循相同的设计原则。

#### 核心规则

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Token：默认关闭，需要显式配置才能开启                       │
│ 2. Dedupe/Cancel/Retry：默认开启，可显式配置为 false 关闭    │
└─────────────────────────────────────────────────────────────┘

| 场景                        | Token | Dedupe | Cancel | Retry |
|-----------------------------|-------|--------|--------|-------|
| 实例级有配置                 | 实例级 | 实例级 | 实例级 | 实例级 |
| 实例级没有 + 请求级有        | 私有级 | 私有级 | 私有级 | 私有级 |
| 都没有                       | 无    | 默认   | 默认   | 默认   |
```

#### 设计优势

1. **统一管理**：实例级别的管理器统一管理所有请求
2. **上下文隔离**：每个请求通过独立的上下文对象实现隔离，无 Map 存储
3. **零清理负担**：上下文是普通对象，引用丢失即被 GC，无需手动清理
4. **配置不污染**：单个请求的配置只在当前请求生效，不影响实例配置
5. **私有级缓存**：私有级管理器按类型缓存复用，避免重复创建

#### 实例级管理器 vs 私有级管理器

```typescript
// 实例级管理器：实例化时配置，所有请求共享
const api = new AxiosRequest({
  dedupe: true,    // 实例级，实例化时创建
  cancel: true,    // 实例级，所有请求复用同一个 cancelManager
  retry: { enabled: true, maxRetries: 3 },  // 实例级
});

// 私有级管理器：按需创建，缓存复用
const api = new AxiosRequest({});  // 没有配置任何管理器

// 第一次使用 retry，创建私有级 retryManager
api.get('/test1', { retry: true });

// 第二次使用 retry，复用同一个私有级 retryManager
api.get('/test2', { retry: true });

// 第三次使用 retry，配置不同，也复用同一个私有级 retryManager
api.get('/test3', { retry: { maxRetries: 5 } });
```

#### 上下文即对象

与传统基于 `requestId + Map` 的方式不同，本库采用**上下文即对象**的设计：

```typescript
// 传统方式：需要 requestId 和 Map
manager.setRequestContext(requestId, { enabled: false });
manager.shouldDedupe(requestId, config);
manager.clearRequestContext(requestId);  // 需要手动清理

// 本库方式：上下文就是普通对象
const ctx = manager.createContext({ enabled: false });
manager.shouldDedupe(ctx, config);
// 无需清理，对象引用丢失即被 GC
```

#### 请求上下文机制

```typescript
// 实例有管理器时，请求配置通过上下文覆盖
client.post('/users', data, {
  dedupe: { timeWindow: 5000 },  // 只覆盖 timeWindow，其他使用实例配置
});

// 实例无管理器时，自动创建临时管理器
client.post('/special', data, {
  dedupe: { enabled: true, timeWindow: 2000 },  // 创建临时管理器
});
```

#### 配置不污染验证

```typescript
const client = new AxiosRequest({
  dedupe: {
    enabled: true,
    timeWindow: 1000,
    methods: ['POST'],
  },
});

// 单个请求配置不影响实例配置
client.post('/users', data, {
  dedupe: { timeWindow: 5000 },  // 只对当前请求生效
});

// 验证实例配置未被修改
client.getInstanceConfig().dedupe.timeWindow === 1000;  // true
```

---

## 打包格式

| 格式 | 文件 | 使用场景 |
|------|------|----------|
| ES Module | `dist/axios-request.esm.js` | 现代前端工程（Vite、Webpack） |
| CommonJS | `dist/axios-request.cjs.js` | Node.js、Electron |
| UMD | `dist/axios-request.umd.js` | 浏览器直接引入、CDN |
| UMD (压缩) | `dist/axios-request.umd.min.js` | 生产环境 |

### 引入方式

```typescript
// ES Module
import { AxiosRequest } from 'axios-request';

// CommonJS
const { AxiosRequest } = require('axios-request');

// 浏览器
// <script src="axios-request.umd.min.js"></script>
// const client = new AxiosRequest({...});
```

---

## 开发指南

### 环境要求

- Node.js >= 24

### 安装与初始化

```bash
# 安装依赖
npm install

# 初始化 husky（首次安装后执行一次）
npm run prepare
```

### 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式，监听文件变化并自动构建 |
| `npm run build` | 构建项目，生成 dist 文件 |
| `npm run test` | 运行测试 |
| `npm run lint` | 代码检查 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run guard` | **提交前检查**：类型检查 + lint + 测试，全部通过才能提交 |
| `npm run release` | 发布版本：验证 → 构建 → 更新版本 → 生成 Changelog → 提交 → 推送 → 打标签 |

### 提交代码流程

```
1. 修改代码
2. 运行 npm run guard 验证代码质量
3. 如果验证通过，执行 git commit -m "类型(范围): 描述"
4. 完成提交
```

**提交信息格式**（必须符合 Conventional Commits）：

```
类型(范围): 描述

# 示例
feat(core): 新增 Token 自动刷新功能
fix(utils): 修复 FormData 转换日期格式错误
docs: 更新 README
refactor(types): 重构类型定义
```

**可选的类型**：
- `feat` - 新功能
- `fix` - Bug 修复
- `docs` - 文档更新
- `style` - 代码格式
- `refactor` - 重构
- `perf` - 性能优化
- `test` - 测试
- `build` - 构建或依赖
- `ci` - CI/CD
- `chore` - 其他修改
- `revert` - 回滚

**可选的范围**：`core`、`types`、`utils`、`test`、`docs`、`workflow`、`config`、`deps`、`release`

### 发布版本流程

```bash
# 交互式发布（推荐）
npm run release

# 自动发布
npm run release -- patch    # 自动 patch 版本 (1.0.0 → 1.0.1)
npm run release -- minor    # 自动 minor 版本 (1.0.0 → 1.1.0)
npm run release -- major    # 自动 major 版本 (1.0.0 → 2.0.0)
npm run release -- 1.2.3   # 指定版本号
```

发布命令会自动完成：
1. 验证代码（typecheck → lint → test）
2. 构建项目
3. 更新 package.json 版本号
4. 生成 CHANGELOG.md
5. Git 提交
6. 推送到 origin (gitee)
7. 推送到 github（如果已配置）
8. 创建并推送 Git tag

推送标签后，GitHub Actions 自动：安装依赖 → 测试 → 构建 → 发布 npm

### 双仓库推送

项目支持同时推送到 Gitee (origin) 和 GitHub：

```bash
# 添加 GitHub 远程仓库（首次）
git remote add github https://github.com/GuoSirius/axios-request.git

# 发布时会自动推送到两个仓库
```

### Git Hooks

项目使用 husky 管理 Git hooks：

| Hook | 时机 | 作用 |
|------|------|------|
| `pre-commit` | 提交前 | 自动检查暂存的 .ts 文件（typecheck + lint + test） |
| `commit-msg` | 提交信息 | 验证提交信息是否符合 Conventional Commits 格式 |

如果 `pre-commit` 失败，检查输出并修复问题后重新提交。

---

## 许可证

MIT

## 作者

SiriuSSupreme

## 仓库

- Gitee: https://gitee.com/siriussupreme/axios-request
- GitHub: https://github.com/GuoSirius/axios-request
