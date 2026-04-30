import { AxiosRequestConfig } from 'axios';

// ==================== Content-Type 类型 ====================

/**
 * 请求 Content-Type 类型
 * - `json`: application/json;charset=UTF-8（默认）
 * - `form`: application/x-www-form-urlencoded
 * - `file`: 不设置 Content-Type（让浏览器自动处理 multipart/form-data）
 * - 自定义字符串: 直接作为 Content-Type
 */
export type ContentType = 'json' | 'form' | 'file' | string;

// ==================== Token 管理器相关类型 ====================

/** Token 刷新函数的返回值 */
export interface TokenRefreshResult {
  /** 新的 access_token */
  accessToken: string;
  /** 新的 refresh_token（可选） */
  refreshToken?: string;
}

/**
 * Token 刷新失败的原因
 * - `unauthorized`: 未授权（如 refresh_token 无效）
 * - `forbidden`: 禁止访问
 * - `invalid_refresh_token`: refresh_token 无效或过期
 * - `refresh_timeout`: 刷新请求超时
 * - `network_error`: 网络错误
 * - `unknown`: 未知错误
 */
export type TokenRefreshFailureReason =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_refresh_token'
  | 'refresh_timeout'
  | 'network_error'
  | 'unknown';

/**
 * Token 管理器配置
 *
 * @example
 * ```typescript
 * const tokenConfig: TokenManagerConfig = {
 *   isTokenExpired: (error) => error.response?.status === 401,
 *   isTokenExpiredFromResponse: (response) => response.data.code === 401001,
 *   refreshToken: async (error) => {
 *     const refreshToken = getRefreshToken();
 *     const result = await api.refreshToken(refreshToken);
 *     return { accessToken: result.accessToken, refreshToken: result.refreshToken };
 *   },
 *   getAccessToken: () => localStorage.getItem('access_token'),
 *   getRefreshToken: () => localStorage.getItem('refresh_token'),
 *   setTokens: async (result) => {
 *     localStorage.setItem('access_token', result.accessToken);
 *     if (result.refreshToken) {
 *       localStorage.setItem('refresh_token', result.refreshToken);
 *     }
 *   },
 *   setAuthorization: (config, token) => {
 *     config.headers.Authorization = `Bearer ${token}`;
 *   },
 *   onRefreshFailed: (reason, error) => {
 *     console.error('Token refresh failed:', reason, error);
 *     // 跳转到登录页
 *     window.location.href = '/login';
 *   },
 *   whitelistUrls: ['/api/public', /^\/api\/public\//],
 * };
 * ```
 */
export interface TokenManagerConfig {
  /**
   * 判断响应错误是否表示 token 失效（检查 error.response）
   * @param error - Axios 错误对象
   * @returns 是否 token 失效
   */
  isTokenExpired: (error: any) => boolean;

  /**
   * 判断正常响应是否表示 token 失效（检查 response.data）
   * 用于接口返回 200 但业务 code 指示 token 过期的场景
   * @param response - Axios 响应对象
   * @returns 是否 token 失效
   */
  isTokenExpiredFromResponse?: (response: any) => boolean;

  /** 刷新 token 的函数，由使用者实现 */
  refreshToken: (error: any) => Promise<TokenRefreshResult>;

  /** 获取当前 access_token 的函数 */
  getAccessToken: () => string | null;

  /** 设置 token 的函数（刷新生效后调用） */
  setTokens: (result: TokenRefreshResult) => void | Promise<void>;

  /** 获取当前 refresh_token 的函数（可选） */
  getRefreshToken?: () => string | null;

  /**
   * 自定义设置 token 的方式（可选）
   * 默认：`config.headers.Authorization = \`Bearer ${token}\``
   *
   * 示例：
   * - `(config, token) => { config.headers['X-Token'] = token }`
   * - `(config, token) => { config.headers.Authorization = token }`
   * - `(config, token) => { config.headers.Authorization = \`token ${token}\` }`
   * - `(config, token) => { config.headers['X-Access-Token'] = \`Bearer ${token}\` }`
   */
  setAuthorization?: (config: AxiosRequestConfig, token: string) => void;

  /**
   * Token 刷新失败的回调（可选）
   * @param reason - 失败原因
   * @param error - 错误对象
   */
  onRefreshFailed?: (reason: TokenRefreshFailureReason, error: any) => void | Promise<void>;

  /**
   * 不需要 token 的请求白名单
   * 支持字符串精确匹配或正则表达式匹配
   * @default []
   */
  whitelistUrls?: (string | RegExp)[];
}

/** Token 上下文 - 每个请求独立的 token 状态 */
export interface TokenContext {
  /** 请求使用的 token 获取函数（优先级高于全局） */
  getToken: (() => string | null) | null;
  /** 白名单 URL 列表（从配置继承） */
  whitelistUrls: (string | RegExp)[];
}

// ==================== 请求 Key 生成相关类型 ====================

/** 生成请求 key 的函数类型 */
export type GenerateKeyFunction = (config: AxiosRequestConfig) => string;

// ==================== 防重复提交管理器相关类型 ====================

/**
 * 防重复提交配置
 *
 * @example
 * ```typescript
 * const dedupeConfig: DedupeConfig = {
 *   enabled: true,
 *   timeWindow: 1000,
 *   methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
 *   generateKey: 'method:url:data.id', // 使用 method、url 和 data.id 生成 key
 * };
 * ```
 */
export interface DedupeConfig {
  /** 是否启用防重复提交，默认 true */
  enabled?: boolean;

  /**
   * 防重复提交的时间窗口（毫秒）
   * 在此时间窗口内的相同请求会被去重
   * @default 1000
   */
  timeWindow?: number;

  /**
   * 需要防重复提交的方法
   * @default ['POST', 'PUT', 'PATCH', 'DELETE']
   */
  methods?: string[];

  /**
   * 自定义生成请求 key 的方式
   * - 函数：直接使用该函数生成唯一 key
   * - 字符串：使用该字符串作为分隔符，从 config 中提取对应字段拼接
   *   例如：`'method:url'`、`'method:url:data.id'`
   *   特殊值：`'only-url'` 表示只用 url 作为 key
   */
  generateKey?: GenerateKeyFunction | string;
}

/** 防重复提交上下文 - 每个请求独立的去重配置 */
export interface DedupeContext {
  /** 是否启用 */
  enabled: boolean;
  /** 时间窗口（毫秒） */
  timeWindow: number;
  /** 需要去重的方法 */
  methods: string[];
  /** 生成请求 key 的函数 */
  generateKey: (config: AxiosRequestConfig) => string;
}

/** 防重复提交的暂存项 */
export interface DedupeItem {
  /** 定时器 ID */
  timer: ReturnType<typeof setTimeout>;
  /** Promise */
  promise: Promise<any>;
  /** 解析函数 */
  resolve: (value: any) => void;
  /** 拒绝函数 */
  reject: (reason?: any) => void;
}

// ==================== 取消请求管理器相关类型 ====================

/**
 * 请求取消配置（用于搜索等场景，自动取消上一次相同请求）
 *
 * @example
 * ```typescript
 * const cancelConfig: CancelConfig = {
 *   enabled: true,
 *   methods: ['GET'],
 *   generateKey: 'method:url', // 使用 method 和 url 生成 key
 * };
 * ```
 */
export interface CancelConfig {
  /** 是否启用请求取消，默认 true */
  enabled?: boolean;

  /**
   * 需要取消请求的方法
   * @default ['GET']
   */
  methods?: string[];

  /**
   * 自定义生成请求 key 的方式
   * - 函数：直接使用该函数
   * - 字符串：使用该字符串作为分隔符，从 config 中提取对应字段拼接
   */
  generateKey?: GenerateKeyFunction | string;
}

/** 取消请求上下文 - 每个请求独立的取消配置 */
export interface CancelContext {
  /** 是否启用 */
  enabled: boolean;
  /** 需要取消的方法 */
  methods: string[];
  /** 生成请求 key 的函数 */
  generateKey: (config: AxiosRequestConfig) => string;
}

// ==================== 请求重试管理器相关类型 ====================

/**
 * 请求重试配置
 *
 * @example
 * ```typescript
 * const retryConfig: RetryConfig = {
 *   enabled: true,
 *   maxRetries: 3,
 *   retryDelay: 100,
 *   exponentialBackoff: false,
 *   retryCondition: (error, retryCount) => {
 *     // 只在网络错误或 5xx 错误时重试
 *     return !error.response || (error.response.status >= 500 && error.response.status < 600);
 *   },
 * };
 * ```
 */
export interface RetryConfig {
  /** 是否启用重试，默认 false */
  enabled?: boolean;

  /**
   * 最大重试次数
   * @default 3
   */
  maxRetries?: number;

  /**
   * 每次重试的延迟时间（毫秒）
   * 当 `exponentialBackoff` 为 true 时，实际延迟为 `retryDelay * 2^retryCount`
   * @default 100
   */
  retryDelay?: number;

  /**
   * 启用后重试延迟会指数增长（100ms → 200ms → 400ms...）
   * @default false
   */
  exponentialBackoff?: boolean;

  /**
   * 判断哪些错误需要重试，返回 true 则重试
   * 默认：网络错误和 5xx 错误
   * @param error - Axios 错误对象
   * @param retryCount - 当前重试次数
   * @returns 是否应该重试
   */
  retryCondition?: (error: any, retryCount: number) => boolean;
}

/** 请求重试上下文 - 每个请求独立的重试配置 */
export interface RetryContext {
  /** 是否启用 */
  enabled: boolean;
  /** 最大重试次数 */
  maxRetries: number;
  /** 每次重试的延迟时间（毫秒） */
  retryDelay: number;
  /** 是否启用指数退避 */
  exponentialBackoff: boolean;
  /** 判断哪些错误需要重试 */
  retryCondition?: (error: any, retryCount: number) => boolean;
}

// ==================== 简写类型 ====================

/**
 * Token 简写类型
 * - `boolean`: 启用/禁用（启用时需要提供具体配置）
 * - `object`: 完整配置对象
 */
export type TokenShortcut = TokenManagerConfig | boolean;

/**
 * 防重复提交简写类型
 * - `boolean`: 启用/禁用
 * - `string`: 直接作为 generateKey
 * - `function`: 直接作为 generateKey
 * - `string[]`: 直接作为 methods（自动转大写）
 * - `object`: 完整配置对象
 */
export type DedupeShortcut = DedupeConfig | boolean | GenerateKeyFunction | string | string[];

/**
 * 请求取消简写类型
 * - `boolean`: 启用/禁用
 * - `string`: 直接作为 generateKey
 * - `function`: 直接作为 generateKey
 * - `string[]`: 直接作为 methods（自动转大写）
 * - `object`: 完整配置对象
 */
export type CancelShortcut = CancelConfig | boolean | GenerateKeyFunction | string | string[];

/**
 * 请求重试简写类型
 * - `boolean`: 启用/禁用
 * - `number`: 启用并设置 maxRetries
 * - `function`: 直接作为 retryCondition
 * - `object`: 完整配置对象
 */
export type RetryShortcut = RetryConfig | boolean | number | ((error: any, retryCount: number) => boolean);

// ==================== 请求队列相关类型 ====================

/** 请求队列项 */
export interface QueueItem {
  /** 请求唯一标识 */
  requestId: string;
  /** 原始请求配置 */
  config: AxiosRequestConfig;
  /** 解析函数 */
  resolve: (value: any) => void;
  /** 拒绝函数 */
  reject: (reason?: any) => void;
}

// ==================== AxiosRequest 配置类型 ====================

/**
 * AxiosRequest 单个请求配置（扩展 axios 配置）
 *
 * @example
 * ```typescript
 * // 使用实例级管理器（默认）
 * api.get('/api/user');
 *
 * // 禁用 token 管理
 * api.get('/api/public', { token: false });
 *
 * // 自定义重试配置
 * api.post('/api/data', data, {
 *   retry: {
 *     enabled: true,
 *     maxRetries: 5,
 *     retryDelay: 200,
 *   },
 * });
 *
 * // 使用简写
 * api.get('/api/search', { cancel: true }); // 启用取消请求
 * api.post('/api/data', data, { retry: 3 }); // 启用重试，最多 3 次
 * ```
 */
export interface AxiosRequestConfigExtended extends AxiosRequestConfig {
  /**
   * 请求 Content-Type 设置
   * - `json`: application/json;charset=UTF-8（默认）
   * - `form`: application/x-www-form-urlencoded
   * - `file`: 不设置 Content-Type（让浏览器自动处理 multipart/form-data）
   * - 自定义字符串: 直接作为 Content-Type
   */
  contentType?: ContentType;

  /**
   * Token 管理配置
   * - `false`: 禁用 token 管理（用于不需要 token 的请求）
   * - `object`: Token 管理器配置
   * - `undefined`: 使用实例级配置（默认）
   */
  token?: TokenManagerConfig | boolean;

  /** 防重复提交配置，支持简写 */
  dedupe?: DedupeShortcut;

  /** 请求取消配置，支持简写 */
  cancel?: CancelShortcut;

  /** 请求重试配置，支持简写 */
  retry?: RetryShortcut;
}

/**
 * AxiosRequest 实例配置（直接继承 axios 配置，扩展新功能）
 *
 * @example
 * ```typescript
 * const api = new AxiosRequest({
 *   baseURL: 'https://api.example.com',
 *   timeout: 10000,
 *   token: tokenConfig, // 实例级 token 管理（可选）
 *   dedupe: true, // 实例级防重复提交（默认开启）
 *   cancel: true, // 实例级请求取消（默认开启）
 *   retry: { enabled: false }, // 实例级重试（默认关闭）
 * });
 * ```
 */
export interface AxiosRequestInstanceConfig extends AxiosRequestConfig {
  /** Token 管理配置（可选，默认不启用） */
  token?: TokenManagerConfig;

  /** 防重复提交配置，支持简写（默认开启） */
  dedupe?: DedupeShortcut;

  /** 请求取消配置，支持简写（默认开启） */
  cancel?: CancelShortcut;

  /** 请求重试配置，支持简写（默认关闭） */
  retry?: RetryShortcut;
}

// ==================== 管理器上下文合并类型 ====================

/**
 * 请求上下文 - 每个请求独立的执行状态
 * 通过闭包实现天然隔离，无需 Map 存储
 */
export interface RequestContext {
  /** Token 上下文 */
  token?: TokenContext;
  /** 防重复提交上下文 */
  dedupe?: DedupeContext;
  /** 取消请求上下文 */
  cancel?: CancelContext;
  /** 请求重试上下文 */
  retry?: RetryContext;
}

// ==================== 配置合并工具类型 ====================

/**
 * 配置合并策略
 * - `merge`: 深度合并（默认）
 * - `replace`: 完全替换
 * - `shallow`: 浅合并
 */
export type ConfigMergeStrategy = 'merge' | 'replace' | 'shallow';

/**
 * 配置合并选项
 */
export interface ConfigMergeOptions {
  /**
   * 合并策略
   * @default 'merge'
   */
  strategy?: ConfigMergeStrategy;

  /**
   * 是否允许未定义的属性
   * @default false
   */
  allowUndefined?: boolean;
}

// ==================== 管理器基类类型 ====================

/**
 * 管理器默认配置接口
 * 所有管理器都应该定义自己的默认配置类型
 */
export interface ManagerDefaultConfig {
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 管理器上下文接口
 * 所有管理器的上下文都应该扩展此接口
 */
export interface ManagerContext {
  /** 是否启用 */
  enabled: boolean;
}

// ==================== 管理器类类型（将在管理器重构后启用） ====================

// 注意：以下导出将在管理器重构完成后取消注释
// export type { TokenManager } from '../managers/TokenManager';
// export type { DedupeManager } from '../managers/DedupeManager';
// export type { CancelManager } from '../managers/CancelManager';
// export type { RetryManager } from '../managers/RetryManager';
