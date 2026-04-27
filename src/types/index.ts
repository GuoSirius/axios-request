import { AxiosRequestConfig } from 'axios';

/**
 * Content-Type 类型
 * - json: application/json;charset=UTF-8（默认）
 * - form: application/x-www-form-urlencoded
 * - file: 不设置 Content-Type（让浏览器自动处理 multipart/form-data）
 * - 自定义字符串: 直接作为 Content-Type
 */
export type ContentType = 'json' | 'form' | 'file' | string;

/**
 * Token刷新函数的返回值
 */
export interface TokenRefreshResult {
  /** 新的access_token */
  accessToken: string;
  /** 新的refresh_token（可选） */
  refreshToken?: string;
}

/**
 * Token刷新失败的原因
 */
export type TokenRefreshFailureReason = 'unauthorized' | 'forbidden' | 'invalid_refresh_token' | 'refresh_timeout' | 'network_error' | 'unknown';

/**
 * Token管理器配置
 */
export interface TokenManagerConfig {
  /** 判断响应错误是否表示token失效（检查 error.response） */
  isTokenExpired: (error: any) => boolean;
  /** 判断正常响应是否表示token失效（检查 response.data，可选） */
  isTokenExpiredFromResponse?: (response: any) => boolean;
  /** 刷新token的函数，由使用者实现 */
  refreshToken: (error: any) => Promise<TokenRefreshResult>;
  /** 获取当前access_token的函数 */
  getAccessToken: () => string | null;
  /** 设置token的函数 */
  setTokens: (result: TokenRefreshResult) => void | Promise<void>;
  /** 获取当前refresh_token的函数（可选） */
  getRefreshToken?: () => string | null;
  /** token刷新失败的回调（可选） */
  onRefreshFailed?: (reason: TokenRefreshFailureReason, error: any) => void | Promise<void>;
  /**
   * 自定义设置 token 的方式（可选）
   * 默认：config.headers.Authorization = `Bearer ${token}`
   *
   * 示例：
   * - (config, token) => { config.headers['X-Token'] = token }
   * - (config, token) => { config.headers.Authorization = token }
   * - (config, token) => { config.headers.Authorization = `token ${token}` }
   * - (config, token) => { config.headers['X-Access-Token'] = `Bearer ${token}` }
   */
  setAuthorization?: (config: AxiosRequestConfig, token: string) => void;
}

/**
 * 生成请求 key 的函数类型
 */
export type GenerateKeyFunction = (config: AxiosRequestConfig) => string;

/**
 * 防重复提交配置
 */
export interface DedupeConfig {
  /** 是否启用防重复提交，默认 true */
  enabled?: boolean;
  /** 防重复提交的时间窗口（毫秒），默认 1000ms */
  timeWindow?: number;
  /** 需要防重复提交的方法，默认 ['POST', 'PUT', 'PATCH', 'DELETE'] */
  methods?: string[];
  /**
   * 自定义生成请求 key 的方式
   * - 函数：直接使用该函数生成唯一 key
   * - 字符串：使用该字符串作为分隔符，从 config 中提取对应字段拼接
   *   例如：'method:url'、'method:url:data.id'
   *   特殊值：'only-url' 表示只用 url 作为 key
   */
  generateKey?: GenerateKeyFunction | string;
}

/**
 * 请求取消配置（用于搜索等场景）
 */
export interface CancelConfig {
  /** 是否启用请求取消，默认 true */
  enabled?: boolean;
  /** 需要取消请求的方法，默认 ['GET'] */
  methods?: string[];
  /**
   * 自定义生成请求 key 的方式
   * - 函数：直接使用该函数
   * - 字符串：使用该字符串作为分隔符，从 config 中提取对应字段拼接
   */
  generateKey?: GenerateKeyFunction | string;
}

/**
 * 请求重试配置
 */
export interface RetryConfig {
  /** 是否启用重试，默认 false */
  enabled?: boolean;
  /** 最大重试次数，默认 3 */
  maxRetries?: number;
  /** 每次重试的延迟时间（毫秒），默认 100ms */
  retryDelay?: number;
  /** 启用后重试延迟会指数增长（100ms → 200ms → 400ms...），默认 false */
  exponentialBackoff?: boolean;
  /** 判断哪些错误需要重试，返回 true 则重试，默认网络错误和5xx错误 */
  retryCondition?: (error: any, retryCount: number) => boolean;
}

/**
 * Token简写类型
 * - boolean: 启用/禁用（启用时需要提供具体配置）
 * - object: 完整配置对象
 */
export type TokenShortcut = TokenManagerConfig | boolean;

/**
 * 防重复提交简写类型
 * - boolean: 启用/禁用
 * - string: 直接作为 generateKey
 * - function: 直接作为 generateKey
 * - string[]: 直接作为 methods（自动转大写）
 * - object: 完整配置对象
 */
export type DedupeShortcut = DedupeConfig | boolean | GenerateKeyFunction | string | string[];

/**
 * 请求取消简写类型
 * - boolean: 启用/禁用
 * - string: 直接作为 generateKey
 * - function: 直接作为 generateKey
 * - string[]: 直接作为 methods（自动转大写）
 * - object: 完整配置对象
 */
export type CancelShortcut = CancelConfig | boolean | GenerateKeyFunction | string | string[];

/**
 * 请求重试简写类型
 * - boolean: 启用/禁用
 * - number: 启用并设置 maxRetries
 * - function: 直接作为 retryCondition
 * - object: 完整配置对象
 */
export type RetryShortcut = RetryConfig | boolean | number | ((error: any, retryCount: number) => boolean);

/**
 * AxiosRequest单个请求配置（扩展axios配置）
 */
export interface AxiosRequestConfigExtended extends AxiosRequestConfig {
  /**
   * 请求 Content-Type 设置
   * - json: application/json;charset=UTF-8（默认）
   * - form: application/x-www-form-urlencoded
   * - file: 不设置 Content-Type（让浏览器自动处理 multipart/form-data）
   * - 自定义字符串: 直接作为 Content-Type
   */
  contentType?: ContentType;
  /** Token管理配置 */
  token?: TokenManagerConfig | boolean;
  /** 防重复提交配置，支持简写 */
  dedupe?: DedupeShortcut;
  /** 请求取消配置，支持简写 */
  cancel?: CancelShortcut;
  /** 请求重试配置，支持简写 */
  retry?: RetryShortcut;
}

/**
 * AxiosRequest实例配置（直接继承axios配置，扩展新功能）
 */
export interface AxiosRequestInstanceConfig extends AxiosRequestConfig {
  /** Token管理配置 */
  token?: TokenManagerConfig;
  /** 防重复提交配置，支持简写 */
  dedupe?: DedupeShortcut;
  /** 请求取消配置，支持简写 */
  cancel?: CancelShortcut;
  /** 请求重试配置，支持简写 */
  retry?: RetryShortcut;
}

/**
 * 请求队列项
 */
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

/**
 * 防重复提交的暂存项
 */
export interface DedupeItem {
  /** 定时器ID */
  timer: NodeJS.Timeout;
  /** Promise */
  promise: Promise<any>;
  /** 解析函数 */
  resolve: (value: any) => void;
  /** 拒绝函数 */
  reject: (reason?: any) => void;
}
