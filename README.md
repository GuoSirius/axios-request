# axios-request

基于 axios 的增强请求库，提供 Token 自动刷新、防止重复提交、请求取消、失败重试、FormData 转换等功能。

## 特性

- ✅ **零成本接入**：与 axios API 完全一致，无学习成本
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
    axiosConfig: { baseURL: '/api' }
  });
</script>
```

---

## 快速开始

### 基础用法（5 分钟上手）

```typescript
import { AxiosRequest } from 'axios-request';

// 1. 创建实例
const client = new AxiosRequest({
  axiosConfig: {
    baseURL: 'https://api.example.com',
    timeout: 10000,
  },
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
  axiosConfig: {
    baseURL: 'https://api.example.com',
    timeout: 10000,
  },

  // Token 自动刷新
  tokenManager: {
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
    duration: 1000,  // 1秒内重复请求会被合并
  },

  // 请求取消（默认开启，仅 GET）
  cancel: {
    enabled: true,
  },

  // 失败重试
  retry: {
    enabled: true,
    maxRetries: 3,
    delay: 100,
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
  axiosConfig: { baseURL: 'https://api.example.com' },
  tokenManager: {
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
  _token: false,  // 简写方式
});

// 或
await client.get('/public/news', {
  _token: { enabled: false },
});
```

#### 自定义 Token 赋值方式

默认情况下，token 会以 `Authorization: Bearer {token}` 的形式添加到请求头中。如果你的 API 使用其他格式，可以自定义：

```typescript
const client = new AxiosRequest({
  tokenManager: {
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
  axiosConfig: { baseURL: 'https://api.example.com' },
  dedupe: {
    enabled: true,       // 默认 true
    duration: 1000,       // 默认 1000ms
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
  duration: 2000,
}

// 数组简写 - 直接作为 methods（自动转大写）
dedupe: ['post', 'put', 'patch']           // 自动转为 { enabled: true, methods: ['POST', 'PUT', 'PATCH'] }
dedupe: ['get', 'Get', 'GET']              // 混合大小写会被归一化为大写
```

#### 单个请求级别配置

```typescript
// 这次请求禁用防重复
await client.post('/users', data, {
  _dedupe: false,
});

// 这次请求用更长的防重时间
await client.post('/users', data, {
  _dedupe: {
    enabled: true,
    duration: 3000,
  },
});
```

---

### 3. 请求自动取消

#### 场景说明

搜索框输入时，自动取消上一次请求，确保只显示最新结果。

```typescript
const client = new AxiosRequest({
  axiosConfig: { baseURL: 'https://api.example.com' },
  cancel: {
    enabled: true,         // 默认 true
    methods: ['GET'],      // 默认值
  },
});

// 用户在搜索框输入
client.get('/search', { params: { q: 'a' } });      // 请求 A
client.get('/search', { params: { q: 'ab' } });     // 自动取消 A，请求 B
client.get('/search', { params: { q: 'abc' } });   // 自动取消 B，请求 C
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
  _cancel: false,  // 不取消上一次请求
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
  axiosConfig: { baseURL: 'https://api.example.com' },
  retry: {
    enabled: true,           // 默认 false
    maxRetries: 3,           // 默认 3
    delay: 100,              // 默认 100ms
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
    delay: 100,
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
    shouldRetry: (error, retryCount) => {
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
  delay: 200,
}
```

#### 单个请求配置

```typescript
// 重试 5 次
await client.get('/unreliable', {
  _retry: 5,
});

// 这次不用重试
await client.get('/fast-fail', {
  _retry: false,
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
| `dedupe` | `{ duration: 2000 }` | 只需改一个参数 |
| `dedupe` | `['post', 'put']` | 数组直接作为 methods（自动转大写）|
| `cancel` | `false` | 禁用请求取消 |
| `cancel` | `true` | 启用，使用默认配置 |
| `cancel` | `['get', 'post']` | 数组直接作为 methods（自动转大写）|
| `retry` | `false` | 禁用重试 |
| `retry` | `true` | 启用，使用默认配置 |
| `retry` | `3` | 启用并设置 maxRetries=3 |
| `_dedupe` | `false` | 单个请求禁用 |
| `_dedupe` | `['post']` | 单个请求使用数组指定 methods |
| `_retry` | `5` | 单个请求重试 5 次 |
| `contentType` | `'json'` | JSON 格式 |
| `contentType` | `'form'` | 表单格式 |
| `contentType` | `'file'` | 文件上传 |

---

## API 文档

### AxiosRequest 构造函数

```typescript
import { AxiosRequest } from 'axios-request';

const client = new AxiosRequest({
  axiosConfig?: AxiosRequestConfig,
  tokenManager?: TokenManagerConfig,
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
  duration?: number;                  // 默认 1000（毫秒）
  methods?: string[];                 // 默认 ['POST', 'PUT', 'PATCH', 'DELETE']
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
  delay?: number;                     // 默认 100（毫秒）
  exponentialBackoff?: boolean;       // 默认 false
  shouldRetry?: (error: any, retryCount: number) => boolean;
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
  axiosConfig: {
    withCredentials: true,  // 允许携带 cookie
  },
});
```

### Q: 如何自定义请求头？

```typescript
const client = new AxiosRequest({
  axiosConfig: {
    headers: {
      'X-App-Version': '1.0.0',
    },
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

### 开发命令

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run dev

# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 运行测试
npm run test

# 验证（类型检查 + lint + 测试）
npm run validate

# 构建
npm run build
```

### 一键发布

```bash
# 交互模式（自动完成：验证 → 构建 → 更新版本 → 生成changelog → 提交 → 推送 → 打标签）
npm run publish

# 指定版本发布
npm run publish -- 1.0.1
npm run publish -- 1.0.1 "feat: 新增xxx功能"
```

推送标签后，GitHub Actions 自动：安装依赖 → 测试 → 构建 → 发布 npm

### GitHub 远程配置（可选）

```bash
git remote add github https://github.com/your-username/axios-request.git
```

---

## 许可证

MIT

## 作者

SiriuSSupreme

## 仓库

- Gitee: https://gitee.com/siriussupreme/axios-request
- GitHub: https://github.com/GuoSirius/axios-request
